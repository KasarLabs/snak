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
import {
  AUTONOMOUS_CONTINUE_ON_TOKEN_LIMIT,
  AUTONOMOUS_FAIL_ON_TOKEN_LIMIT,
} from './prompts/prompts.js';

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

  // Log model details at the start
  logger.info(
    `Creating autonomous agent with model - Provider: ${aiConfig.aiProvider}, Model: ${aiConfig.aiModel}`
  );

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

    // Get tools list with adaptive model selection if supported
    let tools: (StructuredTool | Tool | DynamicStructuredTool<AnyZodObject>)[] = [];
    let suggestedModelLevel = 'smart'; // Default model level
    
    if ('createToolSelectionExecutor' in starknetAgent) {
      // Use adaptive model selection based on tool count
      const result = await (starknetAgent as any).createToolSelectionExecutor(true);
      tools = result.toolsList;
      suggestedModelLevel = result.modelLevel;
      
      // Log the suggested model level based on tool count
      logger.info(`Tool count suggests using '${suggestedModelLevel}' model level for autonomous agent`);
      
      // Note: We don't actually change the model here since aiConfig is already passed in
      // But we could in a future version if we modify the architecture to support changing model at runtime
    } else {
      // Fall back to original implementation
      tools = await createAllowedTools(starknetAgent, json_config.plugins);
    }

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
        // Log which model is being used right before invocation
        logger.info(
          `Autonomous agent invoking model: ${model.llm?.model || model._modelName || model.model || aiConfig.aiProvider}/${aiConfig.aiModel}`
        );
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
            messages: AUTONOMOUS_CONTINUE_ON_TOKEN_LIMIT,
          };

          try {
            logger.info(
              `Autonomous agent retry with simplified prompt: ${model.llm?.model || model._modelName || model.model || aiConfig.aiProvider}/${aiConfig.aiModel}`
            );
            return await originalAgentInvoke(continueInput, config);
          } catch (secondError) {
            logger.error(`Failed simplified action attempt: ${secondError}`);

            // Return a format compatible with the expected interface
            // @ts-ignore - Ignore type errors for this error return
            return {
              messages: [
                {
                  content: AUTONOMOUS_FAIL_ON_TOKEN_LIMIT,
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
      suggestedModelLevel, // Include suggested model level in the return object
    };
  } catch (error) {
    logger.error('Failed to create autonomous agent:', error);
    throw error;
  }
};
