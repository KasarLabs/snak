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
import { BaseMessage, SystemMessage } from '@langchain/core/messages';

export const createAutonomousAgent = async (
  starknetAgent: StarknetAgentInterface,
  aiConfig: AiConfig
) => {
  // Use model selector if available, otherwise initialize model based on provider
  const initializeModel = () => {
    // Check if we should use the modelSelector
    if (aiConfig.modelSelector) {
      logger.debug('Using ModelSelectionAgent for autonomous agent');

      // Create a base model to extend - this will provide the necessary methods and properties
      // that LangChain expects for the React agent
      const baseModel = new ChatOpenAI({
        modelName: 'placeholder-model',
        temperature: 0,
      });

      // Create a proxy that wraps the baseModel but redirects invoke calls to modelSelector
      const modelProxy = {
        ...baseModel,
        invoke: async (messages: BaseMessage[], options?: any) => {
          const startTime = Date.now();
          // Check options for a forced model type
          const forceModel = options?.forceModelType === 'smart';
          let modelTypeToUse: string | undefined = undefined;
          if (forceModel) {
            logger.debug(
              "Model invocation triggered with forced 'smart' model."
            );
            modelTypeToUse = 'smart';
          }

          // Call the modelSelector's invokeModel, potentially forcing the type
          // Pass the original messages and the potentially forced model type
          const result = await aiConfig.modelSelector.invokeModel(
            messages,
            modelTypeToUse // Pass the determined model type
          );
          const endTime = Date.now();
          logger.debug(
            `Model invocation completed in ${
              endTime - startTime
            }ms (Model used: ${modelTypeToUse || 'auto-selected'})`
          );
          return result;
        },
        // Ensure bindTools works properly
        bindTools: function (tools: any) {
          logger.debug('ModelSelectionAgent proxy bindTools called');
          // Return this to maintain chainability
          return this;
        },
      };

      return modelProxy;
    }

    // Default initialization if no modelSelector
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

    // Modify the original prompt or create a new one with next steps instruction
    let originalPrompt = json_config.prompt;
    let modifiedPrompt: SystemMessage;
    // Updated instructions to explicitly mention considering tools
    const toolInstruction =
      '\\n\\nImportant instructions for task management and tool use:\\n' +
      '1. Analyze the request and your objectives. Determine if any of your available tools can help achieve the goal.\\n' +
      '2. If a tool is appropriate, plan to use it. If not, proceed with a text-based response or action.\\n' +
      '3. Focus on ONE SIMPLE TASK per iteration, whether it involves using a tool or generating text.\\n' +
      '4. Break complex operations into multiple simple steps across separate iterations.\\n' +
      '5. Keep each action focused, specific, and achievable in a single step.\\n' +
      "6. Always end your response with a section titled 'NEXT STEPS:' where you clearly state what single action you plan to take next (using a tool or generating text). Be specific but keep it simple and focused.";

    if (originalPrompt) {
      // Add next steps instruction to the existing prompt
      modifiedPrompt = new SystemMessage(
        originalPrompt.content + toolInstruction
      );
    } else {
      // Create a new prompt with next steps instruction
      modifiedPrompt = new SystemMessage(
        'You are an autonomous agent with access to various tools. Respond to queries and take actions as needed.' +
          toolInstruction
      );
    }

    // Add logging for the tools being passed
    logger.debug(
      `Passing ${tools.length} tools to createReactAgent: ${tools.map((t) => t.name).join(', ')}`
    );

    // Create the agent
    const memory = new MemorySaver();
    const agent = createReactAgent({
      llm: model,
      tools,
      checkpointSaver: memory,
      messageModifier: modifiedPrompt,
    });

    // Patch the agent to handle token limits in autonomous mode
    const originalAgentInvoke = agent.invoke.bind(agent);

    // @ts-ignore - Ignore type errors for this method
    agent.invoke = async function (input: any, config?: any) {
      try {
        // Log if this is a retry attempt
        if (config?.isRetryAttempt === true) {
          logger.debug("Executing retry attempt with forced 'smart' model.");
        }
        return await originalAgentInvoke(input, config);
      } catch (error) {
        // Handle token limit errors (and potentially other retryable errors)
        const isRetryableError =
          error instanceof Error &&
          (error.message.includes('token limit') ||
            error.message.includes('tokens exceed') ||
            error.message.includes('context length')); // Add other error types if needed

        // Check if it's a retryable error AND not already a retry attempt
        if (isRetryableError && !(config?.isRetryAttempt === true)) {
          logger.warn(
            `Agent action failed: ${
              (error as Error).message
            }. Retrying with 'smart' model.`
          );

          // Prepare config for retry attempt
          const retryConfig = {
            ...config,
            // Pass existing configurable fields
            configurable: { ...(config?.configurable || {}) },
            // Signal to the proxy invoke to force the smart model
            forceModelType: 'smart',
            // Mark this as a retry attempt to prevent infinite loops
            isRetryAttempt: true,
          };

          try {
            // Re-invoke with the *original* input but the new config forcing 'smart'
            return await originalAgentInvoke(input, retryConfig);
          } catch (secondError) {
            logger.error(
              `Retry attempt with smart model also failed: ${secondError}`
            );
            // Fallback message if retry fails
            // Return a format compatible with the expected interface
            // @ts-ignore - Ignore type errors for this error return
            return {
              messages: [
                {
                  content:
                    'I encountered an issue performing the action, and retrying with a more powerful model also failed. I will abandon this complex step and try a simpler approach.\n\nNEXT STEPS: I will simplify the next action to avoid the previous error. I will focus on a single, small step.',
                  type: 'ai',
                },
              ],
            };
          }
        } else if (isRetryableError && config?.isRetryAttempt === true) {
          // Handle case where the retry attempt itself failed
          logger.error(
            `Retry attempt failed: ${(error as Error).message}. Aborting action.`
          );
          // Fallback message if retry fails
          // @ts-ignore - Ignore type errors for this error return
          return {
            messages: [
              {
                content:
                  'I encountered an issue performing the action, and retrying with a more powerful model also failed. I will abandon this complex step and try a simpler approach.\n\nNEXT STEPS: I will simplify the next action to avoid the previous error. I will focus on a single, small step.',
                type: 'ai',
              },
            ],
          };
        }

        // For non-retryable errors, or errors that occurred during retry, log and re-throw
        logger.error(`Unhandled agent error during execution: ${error}`);
        throw error; // Re-throw errors that shouldn't be retried or failed on retry
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
