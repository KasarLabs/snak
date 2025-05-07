import { StateGraph, MemorySaver, Annotation } from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { AIMessage, BaseMessage } from '@langchain/core/messages';
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from '@langchain/core/prompts';
import { logger } from '@snakagent/core';
import { StarknetAgentInterface } from '../../tools/tools.js';
import {
  initializeToolsList,
  initializeDatabase,
  truncateToolResults,
  formatAgentResponse,
} from '../core/utils.js';
import { estimateTokens } from '../../token/tokenTracking.js';
import { ModelSelectionAgent } from '../operators/modelSelectionAgent.js';
import { SupervisorAgent } from '../supervisor/supervisorAgent.js';
import { baseSystemPrompt, interactiveRules } from 'prompt/prompts.js';

// Helper function to get memory agent from supervisor
const getMemoryAgent = async () => {
  try {
    // Try to get supervisor instance
    const supervisorAgent = SupervisorAgent.getInstance?.() || null;
    if (supervisorAgent) {
      return await supervisorAgent.getMemoryAgent();
    }
    return null;
  } catch (error) {
    logger.error(`Failed to get memory agent: ${error}`);
    return null;
  }
};

/**
 * Creates an agent in interactive mode
 */
export const createInteractiveAgent = async (
  starknetAgent: StarknetAgentInterface,
  modelSelector: ModelSelectionAgent | null
) => {
  try {
    const agent_config = starknetAgent.getAgentConfig();
    logger.debug('agent_config', agent_config);
    if (!agent_config) {
      throw new Error('Agent configuration is required');
    }

    await initializeDatabase(starknetAgent.getDatabaseCredentials());

    // Initialize tools
    const toolsList = await initializeToolsList(starknetAgent, agent_config);

    // Get memory agent if memory is enabled
    let memoryAgent = null;
    if (agent_config.memory) {
      try {
        memoryAgent = await getMemoryAgent();
        if (memoryAgent) {
          logger.debug('Successfully retrieved memory agent');
          // Add memory tools to toolsList
          const memoryTools = memoryAgent.prepareMemoryTools();
          toolsList.push(...memoryTools);
        } else {
          logger.warn(
            'Memory agent not available, memory features will be limited'
          );
        }
      } catch (error) {
        logger.error(`Error retrieving memory agent: ${error}`);
      }
    }

    const GraphState = Annotation.Root({
      messages: Annotation<BaseMessage[]>({
        reducer: (x, y) => x.concat(y),
      }),
      memories: Annotation<string>,
    });

    const toolNode = new ToolNode(toolsList);

    // Add wrapper to log tool executions
    const originalInvoke = toolNode.invoke.bind(toolNode);
    toolNode.invoke = async (state, config) => {
      // Log the tool call request
      const lastMessage = state.messages[state.messages.length - 1];
      const toolCalls = lastMessage?.tool_calls || [];

      if (toolCalls.length > 0) {
        logger.debug(`Tool execution starting: ${toolCalls.length} calls`);
        for (const call of toolCalls) {
          logger.info(
            `Executing tool: ${call.name} with args: ${JSON.stringify(call.args).substring(0, 150)}${JSON.stringify(call.args).length > 150 ? '...' : ''}`
          );
        }
      }

      // Execute the original method
      const startTime = Date.now();
      const result = await originalInvoke(state, config);
      const executionTime = Date.now() - startTime;

      // Use truncateToolResults function to handle result truncation
      const truncatedResult = truncateToolResults(result, 5000);

      // Log the execution completion
      if (
        truncatedResult &&
        truncatedResult.messages &&
        truncatedResult.messages.length > 0
      ) {
        const resultMessage =
          truncatedResult.messages[truncatedResult.messages.length - 1];
        logger.debug(
          `Tool execution completed in ${executionTime}ms with result type: ${resultMessage._getType?.() || typeof resultMessage}`
        );
      }

      return truncatedResult;
    };

    const configPrompt = agent_config.prompt?.content || '';
    const memoryPrompt = ``;
    const finalPrompt = agent_config.memory
      ? `${configPrompt}\n${memoryPrompt}`
      : `${configPrompt}`;

    async function callModel(
      state: typeof GraphState.State
    ): Promise<{ messages: BaseMessage[] }> {
      if (!agent_config) {
        throw new Error('Agent configuration is required but not available');
      }

      if (!agent_config.name) {
        throw new Error('Agent name is required in configuration');
      }

      if (!(agent_config as any).bio) {
        throw new Error('Agent bio is required in configuration');
      }

      if (
        !Array.isArray((agent_config as any).objectives) ||
        (agent_config as any).objectives.length === 0
      ) {
        throw new Error('Agent objectives are required in configuration');
      }

      if (
        !Array.isArray((agent_config as any).knowledge) ||
        (agent_config as any).knowledge.length === 0
      ) {
        throw new Error('Agent knowledge is required in configuration');
      }

      const interactiveSystemPrompt = `
        ${baseSystemPrompt(agent_config)}

        ${interactiveRules}
           
        Available tools: ${toolsList.map((tool) => tool.name).join(', ')}
      `;

      const prompt = ChatPromptTemplate.fromMessages([
        [
          'system',
          `${finalPrompt.trim()}
        ${state.memories ? '\nUser Memory Context:\n' + state.memories : ''}
        ${state.memories ? '\n' : ''}
        ${interactiveSystemPrompt}`.trim(),
        ],
        new MessagesPlaceholder('messages'),
      ]);

      try {
        // Filter model-selector messages from history
        const filteredMessages = state.messages.filter(
          (msg) =>
            !(
              msg instanceof AIMessage &&
              msg.additional_kwargs?.from === 'model-selector'
            )
        );

        if (filteredMessages.length !== state.messages.length) {
          logger.debug(
            `Filtered out ${state.messages.length - filteredMessages.length} model-selector messages from history`
          );
        }

        const formattedPrompt = await prompt.formatMessages({
          tool_names: toolsList.map((tool) => tool.name).join(', '),
          messages: filteredMessages,
          memories: state.memories || '',
        });

        // Estimate message size and check limit
        const estimatedTokens = estimateTokens(JSON.stringify(formattedPrompt));
        if (estimatedTokens > 90000) {
          logger.warn(
            `Prompt exceeds safe token limit: ${estimatedTokens} tokens. Truncating messages...`
          );

          // Only keep the last 4 messages
          const truncatedMessages = state.messages.slice(-4);

          const truncatedPrompt = await prompt.formatMessages({
            tool_names: toolsList.map((tool) => tool.name).join(', '),
            messages: truncatedMessages,
            memories: state.memories || '',
          });

          // Use model selection agent if available
          if (modelSelector) {
            // Get modelType from state if available
            const stateModelType =
              typeof state.memories === 'object' && state.memories
                ? (state.memories as any).modelType
                : null;

            const selectedModelType =
              stateModelType ||
              (await modelSelector.selectModelForMessages(filteredMessages));

            logger.debug(
              `Using dynamically selected model: ${selectedModelType}`
            );
            const modelForThisTask = await modelSelector.getModelForTask(
              filteredMessages,
              selectedModelType
            );

            const boundModel =
              typeof modelForThisTask.bindTools === 'function'
                ? modelForThisTask.bindTools(toolsList)
                : modelForThisTask;

            const result = await boundModel.invoke(truncatedPrompt);
            return formatAIMessageResult(result);
          } else {
            // Use existing model selector or create a new one if needed
            logger.debug('Using existing model selector with smart model');
            const existingModelSelector = ModelSelectionAgent.getInstance();

            // If we have a model selector available, use it
            if (existingModelSelector) {
              const smartModel = await existingModelSelector.getModelForTask(
                truncatedMessages,
                'smart'
              );

              const boundSmartModel =
                typeof smartModel.bindTools === 'function'
                  ? smartModel.bindTools(toolsList)
                  : smartModel;

              const result = await boundSmartModel.invoke(truncatedPrompt);
              return formatAIMessageResult(result);
            } else {
              // Fallback to creating direct model with specific provider
              logger.warn(
                'No model selector available, using direct provider selection'
              );
              throw new Error(
                'Model selection requires a configured ModelSelectionAgent'
              );
            }
          }
        }

        // If we're below the limit, use the full prompt with dynamic model selection
        if (modelSelector) {
          // Get modelType from state if available
          const stateModelType =
            typeof state.memories === 'object' && state.memories
              ? (state.memories as any).modelType
              : null;

          const selectedModelType =
            stateModelType ||
            (await modelSelector.selectModelForMessages(filteredMessages));

          logger.debug(
            `Using dynamically selected model: ${selectedModelType}`
          );
          const modelForThisTask = await modelSelector.getModelForTask(
            filteredMessages,
            selectedModelType
          );

          const boundModel =
            typeof modelForThisTask.bindTools === 'function'
              ? modelForThisTask.bindTools(toolsList)
              : modelForThisTask;

          const result = await boundModel.invoke(formattedPrompt) as AIMessage;
          return formatAIMessageResult(result);
        } else {
          // Fallback to creating direct model with specific provider
          logger.warn(
            'No model selector available, using direct provider selection'
          );
          throw new Error(
            'Model selection requires a configured ModelSelectionAgent'
          );
        }
      } catch (error) {
        // Handle token limit errors specifically
        if (
          error instanceof Error &&
          (error.message.includes('token limit') ||
            error.message.includes('tokens exceed') ||
            error.message.includes('context length'))
        ) {
          logger.error(`Token limit error: ${error.message}`);

          // Create a very reduced version with only the last message
          const minimalMessages = state.messages.slice(-2);

          try {
            // Try with a minimal prompt using smart model
            const emergencyPrompt = await prompt.formatMessages({
              tool_names: toolsList.map((tool) => tool.name).join(', '),
              messages: minimalMessages,
              memories: '',
            });

            // Try to use an existing model selector first
            const existingModelSelector = ModelSelectionAgent.getInstance();
            if (existingModelSelector) {
              const emergencyModel =
                await existingModelSelector.getModelForTask(
                  minimalMessages,
                  'smart'
                );

              const boundEmergencyModel =
                typeof emergencyModel.bindTools === 'function'
                  ? emergencyModel.bindTools(toolsList)
                  : emergencyModel;

              const result = await boundEmergencyModel.invoke(emergencyPrompt);
              return formatAIMessageResult(result);
            } else {
              // No model selector available
              throw new Error(
                'Model selection requires a configured ModelSelectionAgent'
              );
            }
          } catch (emergencyError) {
            // If even the emergency prompt fails, return a formatted error message
            return {
              messages: [
                new AIMessage({
                  content:
                    'The conversation has become too long and exceeds token limits. Please start a new conversation.',
                  additional_kwargs: {
                    from: 'snak',
                    final: true,
                    error: 'token_limit_exceeded',
                  },
                }),
              ],
            };
          }
        }

        // For other types of errors, propagate them
        throw error;
      }
    }

    // Helper function to ensure consistent AI message formatting
    function formatAIMessageResult(result: any): { messages: BaseMessage[] } {
      let finalResult = result;
      if (!(finalResult instanceof AIMessage)) {
        finalResult = new AIMessage({
          content:
            typeof finalResult.content === 'string'
              ? finalResult.content
              : JSON.stringify(finalResult.content),
          additional_kwargs: {
            from: 'snak',
            final: true,
          },
        });
      } else if (!finalResult.additional_kwargs) {
        finalResult.additional_kwargs = { from: 'snak', final: true };
      } else if (!finalResult.additional_kwargs.from) {
        finalResult.additional_kwargs.from = 'snak';
        finalResult.additional_kwargs.final = true;
      }

      // Use truncateToolResults function to handle result truncation
      const truncatedResult = truncateToolResults(finalResult, 5000);

      // Log the AI response with formatAgentResponse to ensure consistency across modes
      const finalResultToLog = truncatedResult || finalResult;

      if (
        finalResultToLog instanceof AIMessage ||
        (finalResultToLog &&
          typeof finalResultToLog === 'object' &&
          'content' in finalResultToLog)
      ) {
        const content =
          typeof finalResultToLog.content === 'string'
            ? finalResultToLog.content
            : JSON.stringify(finalResultToLog.content || '');

        if (content && content.trim() !== '') {
          // Format and log the response consistently with other modes
          logger.info(`Agent Response:\n\n${formatAgentResponse(content)}`);
        }
      }

      return {
        messages: [finalResult],
      };
    }

    // Decides whether to continue with tools or end execution
    function shouldContinue(state: typeof GraphState.State) {
      const messages = state.messages;
      const lastMessage = messages[messages.length - 1] as AIMessage;

      if (lastMessage.tool_calls?.length) {
        logger.debug(
          `Detected ${lastMessage.tool_calls.length} tool calls in response, routing to tools node`
        );
        return 'tools';
      }
      return 'end';
    }

    // Build the workflow graph
    const workflow = new StateGraph(GraphState)
      .addNode('agent', callModel)
      .addNode('tools', toolNode);

    // Add memory node if configured
    if (agent_config.memory && memoryAgent) {
      workflow
        .addNode('memory', memoryAgent.createMemoryNode())
        .addEdge('__start__', 'memory')
        .addEdge('memory', 'agent');
    } else {
      workflow.addEdge('__start__', 'agent');
    }

    // Complete the graph connections
    workflow
      .addConditionalEdges('agent', shouldContinue)
      .addEdge('tools', 'agent');

    // Compile the workflow
    const checkpointer = new MemorySaver();
    const app = workflow.compile({
      ...(agent_config.memory
        ? {
            checkpointer: checkpointer,
            configurable: {},
          }
        : {}),
    });

    return app;
  } catch (error) {
    logger.error('Failed to create an interactive agent:', error);
    throw error;
  }
};
