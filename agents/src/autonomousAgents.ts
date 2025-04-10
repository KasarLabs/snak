import { ChatAnthropic } from '@langchain/anthropic';
import { createAllowedTools } from './tools/tools.js';
import { AiConfig } from '../common/index.js';
import { ChatOpenAI } from '@langchain/openai';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatOllama } from '@langchain/ollama';
import { StarknetAgentInterface } from './tools/tools.js';
import { MemorySaver } from '@langchain/langgraph';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { MCP_CONTROLLER } from './mcp/src/mcp.js';
import logger from './logger.js';
import {
  DynamicStructuredTool,
  StructuredTool,
  Tool,
} from '@langchain/core/tools';
import { AnyZodObject } from 'zod';
import { configureModelWithTracking } from './tokenTracking.js';

export const createAutonomousAgent = async (
  starknetAgent: StarknetAgentInterface,
  aiConfig: AiConfig
) => {
  let model;

  switch (aiConfig.aiProvider) {
    case 'anthropic':
      if (!aiConfig.aiProviderApiKey) {
        throw new Error(
          'Valid Anthropic api key is required https://docs.anthropic.com/en/api/admin-api/apikeys/get-api-key'
        );
      }
      model = new ChatAnthropic({
        modelName: aiConfig.aiModel,
        anthropicApiKey: aiConfig.aiProviderApiKey,
        verbose: aiConfig.langchainVerbose === true,
      });
      break;
    case 'openai':
      if (!aiConfig.aiProviderApiKey) {
        throw new Error(
          'Valid OpenAI api key is required https://platform.openai.com/api-keys'
        );
      }
      model = new ChatOpenAI({
        modelName: aiConfig.aiModel,
        openAIApiKey: aiConfig.aiProviderApiKey,
        verbose: aiConfig.langchainVerbose === true,
      });
      break;
    case 'gemini':
      if (!aiConfig.aiProviderApiKey) {
        throw new Error(
          'Valid Gemini api key is required https://ai.google.dev/gemini-api/docs/api-key'
        );
      }
      model = new ChatGoogleGenerativeAI({
        modelName: aiConfig.aiModel,
        apiKey: aiConfig.aiProviderApiKey,
        convertSystemMessageToHumanContent: true,
        verbose: aiConfig.langchainVerbose === true,
      });
      break;
    case 'ollama':
      model = new ChatOllama({
        model: aiConfig.aiModel,
        verbose: aiConfig.langchainVerbose === true,
      });
      break;
    default:
      throw new Error(`Unsupported AI provider: ${aiConfig.aiProvider}`);
  }

  // Add token tracking with flexible limits for autonomous mode
  model = configureModelWithTracking(model, {
    tokenLogging: aiConfig.langchainVerbose !== false,
    maxInputTokens: aiConfig.maxInputTokens || 50000,
    maxCompletionTokens: aiConfig.maxCompletionTokens || 50000,
    maxTotalTokens: aiConfig.maxTotalTokens || 100000,
  });

  try {
    const json_config = starknetAgent.getAgentConfig();
    if (!json_config) {
      throw new Error('Agent configuration is required');
    }

    let tools: (StructuredTool | Tool | DynamicStructuredTool<AnyZodObject>)[];
    const allowedTools = await createAllowedTools(
      starknetAgent,
      json_config.plugins
    );

    tools = allowedTools;
    const memory = new MemorySaver();

    if (
      json_config.mcpServers &&
      Object.keys(json_config.mcpServers).length > 0
    ) {
      try {
        const mcp = MCP_CONTROLLER.fromJsonConfig(json_config);
        await mcp.initializeConnections();

        const mcpTools = mcp.getTools();
        logger.info(`Added ${mcpTools.length} MCP tools to the agent`);
        tools = [...tools, ...mcpTools];
      } catch (error) {
        logger.error(`Failed to initialize MCP tools: ${error}`);
      }
    }

    const agent = createReactAgent({
      llm: model,
      tools: tools,
      checkpointSaver: memory,
      messageModifier: json_config.prompt,
    });

    // Patch the agent to handle token limits in autonomous mode
    const originalAgentInvoke = agent.invoke.bind(agent);
    // @ts-ignore - Ignore type errors for this method
    agent.invoke = async function (input: any, config?: any) {
      try {
        // Try normal call
        return await originalAgentInvoke(input, config);
      } catch (error) {
        // Check if error is related to token limits
        if (
          error instanceof Error &&
          (error.message.includes('token limit') ||
            error.message.includes('tokens exceed') ||
            error.message.includes('context length'))
        ) {
          logger.warn(
            `Token limit error in autonomous agent: ${error.message}`
          );

          // Instead of recreating an entirely new context,
          // we'll just use a shorter message to continue
          const continueInput = {
            messages:
              'The previous action was too complex and exceeded token limits. Take a simpler action while keeping your main objectives in mind.',
          };

          try {
            // Retry with a simplified message that preserves intent
            return await originalAgentInvoke(continueInput, config);
          } catch (secondError) {
            // If even this approach fails, log the error
            logger.error(`Failed simplified action attempt: ${secondError}`);

            // Return a format compatible with the expected interface
            // @ts-ignore - Ignore type errors for this error return
            return {
              messages: [
                {
                  content:
                    "I had to abandon the current action due to token limits. I'll try a different approach in the next turn.",
                  type: 'ai',
                },
              ],
            };
          }
        }

        // For other types of errors, propagate them
        throw error;
      }
    };

    return {
      agent,
      agentConfig: {
        configurable: { thread_id: json_config.chat_id },
      },
      json_config,
    };
  } catch (error) {
    logger.error('Failed to create autonomous agent : ', error);
    throw error;
  }
};
