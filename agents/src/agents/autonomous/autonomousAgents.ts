import { ChatAnthropic } from '@langchain/anthropic';
import { createAllowedTools } from '../../tools/tools.js';
import { AiConfig } from '../../common/index.js';
import { ChatOpenAI } from '@langchain/openai';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatOllama } from '@langchain/ollama';
import { StarknetAgentInterface } from '../../tools/tools.js';
import { MemorySaver } from '@langchain/langgraph';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { MCP_CONTROLLER } from '../../services/mcp/src/mcp.js';
import { logger } from '@hijox/core';
import {
  DynamicStructuredTool,
  StructuredTool,
  Tool,
} from '@langchain/core/tools';
import { AnyZodObject } from 'zod';
import { configureModelWithTracking } from '../../token/tokenTracking.js';

export const createAutonomousAgent = async (
  starknetAgent: StarknetAgentInterface,
  aiConfig: AiConfig
) => {
  // Initialize model based on provider
  const initializeModel = () => {
    const verbose = aiConfig.langchainVerbose === true;

    switch (aiConfig.aiProvider) {
      case 'anthropic':
        if (!aiConfig.aiProviderApiKey) {
          throw new Error(
            'Valid Anthropic API key is required: https://docs.anthropic.com/en/api/admin-api/apikeys/get-api-key'
          );
        }
        return new ChatAnthropic({
          modelName: aiConfig.aiModel,
          anthropicApiKey: aiConfig.aiProviderApiKey,
          verbose,
        });

      case 'openai':
        if (!aiConfig.aiProviderApiKey) {
          throw new Error(
            'Valid OpenAI API key is required: https://platform.openai.com/api-keys'
          );
        }
        return new ChatOpenAI({
          modelName: aiConfig.aiModel,
          openAIApiKey: aiConfig.aiProviderApiKey,
          verbose,
        });

      case 'gemini':
        if (!aiConfig.aiProviderApiKey) {
          throw new Error(
            'Valid Gemini API key is required: https://ai.google.dev/gemini-api/docs/api-key'
          );
        }
        return new ChatGoogleGenerativeAI({
          modelName: aiConfig.aiModel,
          apiKey: aiConfig.aiProviderApiKey,
          convertSystemMessageToHumanContent: true,
          verbose,
        });

      case 'ollama':
        return new ChatOllama({
          model: aiConfig.aiModel,
          verbose,
        });

      default:
        throw new Error(`Unsupported AI provider: ${aiConfig.aiProvider}`);
    }
  };

  // Initialize model with token tracking
  const model = configureModelWithTracking(initializeModel(), {
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

    // Check if autonomous mode is explicitly disabled in new mode config
    if (json_config.mode && json_config.mode.autonomous === false) {
      throw new Error('Autonomous mode is disabled in agent configuration');
    }

    // Get allowed tools
    let tools: (StructuredTool | Tool | DynamicStructuredTool<AnyZodObject>)[] =
      await createAllowedTools(starknetAgent, json_config.plugins);

    // Initialize MCP tools if configured
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

    // Create the agent
    const memory = new MemorySaver();
    const agent = createReactAgent({
      llm: model,
      tools,
      checkpointSaver: memory,
      messageModifier: json_config.prompt,
    });

    // Patch the agent to handle token limits in autonomous mode
    const originalAgentInvoke = agent.invoke.bind(agent);

    // @ts-ignore - Ignore type errors for this method
    agent.invoke = async function (input: any, config?: any) {
      try {
        return await originalAgentInvoke(input, config);
      } catch (error) {
        // Handle token limit errors
        if (
          error instanceof Error &&
          (error.message.includes('token limit') ||
            error.message.includes('tokens exceed') ||
            error.message.includes('context length'))
        ) {
          logger.warn(
            `Token limit error in autonomous agent: ${error.message}`
          );

          // Use a shorter message to continue
          const continueInput = {
            messages:
              'The previous action was too complex and exceeded token limits. Take a simpler action while keeping your main objectives in mind.',
          };

          try {
            return await originalAgentInvoke(continueInput, config);
          } catch (secondError) {
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
    logger.error('Failed to create autonomous agent:', error);
    throw error;
  }
};
