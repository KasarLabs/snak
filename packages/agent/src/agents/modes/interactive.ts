import { StateGraph, MemorySaver, Annotation } from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import {
  AIMessage,
  AIMessageChunk,
  BaseMessage,
  HumanMessage,
} from '@langchain/core/messages';
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from '@langchain/core/prompts';
import { logger, AgentConfig } from '@snakagent/core';
import { SnakAgentInterface } from '../../tools/tools.js';
import {
  initializeToolsList,
  initializeDatabase,
  truncateToolResults,
  formatAgentResponse,
} from '../core/utils.js';
import { ModelSelector } from '../operators/modelSelector.js';
import { SupervisorAgent } from '../supervisor/supervisorAgent.js';
import { interactiveRules } from '../../prompt/prompts.js';
import { TokenTracker } from '../../token/tokenTracking.js';
import { AgentReturn } from './autonomous.js';
import { MemoryAgent } from 'agents/operators/memoryAgent.js';
import { RagAgent } from 'agents/operators/ragAgent.js';

/**
 * Retrieves the memory agent instance from the SupervisorAgent.
 * @returns A promise that resolves to the memory agent instance or null if not found or an error occurs.
 */
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

const getRagAgent = async () => {
  try {
    const supervisorAgent = SupervisorAgent.getInstance?.() || null;
    if (supervisorAgent) {
      return await supervisorAgent.getRagAgent();
    }
    return null;
  } catch (error) {
    logger.error(`Failed to get rag agent: ${error}`);
    return null;
  }
};

/**
 * Creates and configures an interactive agent.
 * @param snakAgent - The SnakAgentInterface instance.
 * @param modelSelector - An optional ModelSelector instance for dynamic model selection.
 * @returns A promise that resolves to the compiled agent application.
 * @throws Will throw an error if agent configuration is missing or invalid.
 */
export const createInteractiveAgent = async (
  snakAgent: SnakAgentInterface,
  modelSelector: ModelSelector | null
): Promise<AgentReturn> => {
  try {
    const agent_config: AgentConfig = snakAgent.getAgentConfig();
    if (!agent_config) {
      throw new Error('Agent configuration is required');
    }

    await initializeDatabase(snakAgent.getDatabaseCredentials());

    const toolsList = await initializeToolsList(snakAgent, agent_config);

    let memoryAgent: MemoryAgent | null = null;
    if (agent_config.memory) {
      try {
        memoryAgent = await getMemoryAgent();
        if (memoryAgent) {
          logger.debug('Successfully retrieved memory agent');
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

    let ragAgent: RagAgent | null = null;
    if (agent_config.rag?.enabled !== false) {
      try {
        ragAgent = await getRagAgent();
        if (!ragAgent) {
          logger.warn('Rag agent not available, rag context will be skipped');
        }
      } catch (error) {
        logger.error(`Error retrieving rag agent: ${error}`);
      }
    }

    const GraphState = Annotation.Root({
      messages: Annotation<BaseMessage[]>({
        reducer: (x, y) => x.concat(y),
      }),
      memories: Annotation<string>,
      rag: Annotation<string>,
    });

    const toolNode = new ToolNode(toolsList);
    // Add wrapper to log tool executions
    const originalInvoke = toolNode.invoke.bind(toolNode);
    toolNode.invoke = async (state, config) => {
      const lastMessage = state.messages[state.messages.length - 1];
      const toolCalls = lastMessage?.tool_calls || [];

      if (toolCalls.length > 0) {
        for (const call of toolCalls) {
          logger.info(
            `Executing tool: ${call.name} with args: ${JSON.stringify(call.args).substring(0, 150)}${JSON.stringify(call.args).length > 150 ? '...' : ''}`
          );
        }
      }

      const startTime = Date.now();
      const result = await originalInvoke(state, config);
      const executionTime = Date.now() - startTime;

      const truncatedResult = truncateToolResults(result, 5000);

      if (truncatedResult?.messages?.length > 0) {
        const resultMessage =
          truncatedResult.messages[truncatedResult.messages.length - 1];
        logger.debug(
          `Tool execution completed in ${executionTime}ms with result type: ${resultMessage._getType?.() || typeof resultMessage}`
        );
      }

      return truncatedResult;
    };

    const configPrompt = agent_config.prompt?.content || '';
    const finalPrompt = `${configPrompt}`;

    /**
     * Calls the appropriate language model with the current state and tools.
     * @param state - The current state of the graph.
     * @returns A promise that resolves to an object containing the model's response messages.
     * @throws Will throw an error if agent configuration is incomplete or if model invocation fails.
     */
    async function callModel(
      state: typeof GraphState.State
    ): Promise<{ messages: BaseMessage[] }> {
      if (!agent_config) {
        throw new Error('Agent configuration is required but not available');
      }
      const interactiveSystemPrompt = `
        ${interactiveRules}
        Available tools: ${toolsList.map((tool) => tool.name).join(', ')}
      `;
      const systemMessages: (string | MessagesPlaceholder | [string, string])[] = [
        [
          'system',
          `${finalPrompt.trim()}
        ${interactiveSystemPrompt}`.trim(),
        ],
        ];

      const lastUserMessage =
        [...state.messages].reverse().find((msg) => msg instanceof HumanMessage) ||
        state.messages[state.messages.length - 1];

      if (memoryAgent && lastUserMessage) {
        try {
          const memories = await memoryAgent.retrieveRelevantMemories(
            lastUserMessage,
            agent_config.chatId || 'default_chat',
            agent_config.id
          );
          if (memories?.length) {
            const memoryContext = memoryAgent.formatMemoriesForContext(memories);
            if (memoryContext.trim()) {
              systemMessages.push(['system', memoryContext]);
            }
          }
        } catch (error) {
          logger.error(`Error retrieving memory context: ${error}`);
        }
      }

      if (ragAgent && lastUserMessage) {
        try {
          const docs = await ragAgent.retrieveRelevantRag(
            lastUserMessage,
            agent_config.rag?.topK,
            agent_config.id
          );
          if (docs?.length) {
            const ragContext = ragAgent.formatRagForContext(docs);
            if (ragContext.trim()) {
              systemMessages.push(['system', ragContext]);
            }
          }
        } catch (error) {
          logger.error(`Error retrieving rag context: ${error}`);
        }
      }

      systemMessages.push(new MessagesPlaceholder('messages'));

      const prompt = ChatPromptTemplate.fromMessages(systemMessages);

      try {
        const filteredMessages = state.messages.filter(
          (msg) =>
            !(
              msg instanceof AIMessageChunk &&
              msg.additional_kwargs?.from === 'model-selector'
            )
        );

        const currentMessages = filteredMessages;

        if (modelSelector) {
          // Extract originalUserQuery from first HumanMessage if available
          const originalUserMessage = currentMessages.find(
            (msg): msg is HumanMessage => msg instanceof HumanMessage
          );
          const originalUserQuery = originalUserMessage
            ? typeof originalUserMessage.content === 'string'
              ? originalUserMessage.content
              : JSON.stringify(originalUserMessage.content)
            : '';

          const selectedModelType = await modelSelector.selectModelForMessages(
            filteredMessages,
            { originalUserQuery }
          );

          const boundModel =
            typeof selectedModelType.model.bindTools === 'function'
              ? selectedModelType.model.bindTools(toolsList)
              : selectedModelType.model;

          const formattedPrompt = await prompt.formatMessages({
            messages: currentMessages,
          });

          const result = await boundModel.invoke(formattedPrompt);
          TokenTracker.trackCall(result, selectedModelType.model_name);
          return {
            messages: [...formattedPrompt, result],
          };
        } else {
          const existingModelSelector = ModelSelector.getInstance();
          if (existingModelSelector) {
            throw new Error(
              'Model selection requires a configured ModelSelector'
            );
          } else {
            logger.warn(
              'No model selector available, using direct provider selection is not supported without a ModelSelector.'
            );
            throw new Error(
              'Model selection requires a configured ModelSelector'
            );
          }
        }
      } catch (error) {
        if (
          error instanceof Error &&
          (error.message.includes('token limit') ||
            error.message.includes('tokens exceed') ||
            error.message.includes('context length'))
        ) {
          logger.error(`Token limit error: ${error.message}`);

          logger.error(`Model invocation failed: ${error}`);
          throw error;
        }
        // For any other error, rethrow to ensure function never returns undefined
        throw error;
      }
    }

    /**
     * Formats the result from an AI model call into a consistent AIMessage structure.
     * Also truncates the message content if it's too long and logs the response.
     * @param result - The raw result from the AI model.
     * @returns An object containing an array with a single formatted AIMessage.
     */
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

      const truncatedResultInstance = truncateToolResults(finalResult, 5000);

      const resultToLog = truncatedResultInstance || finalResult;

      if (
        resultToLog instanceof AIMessage ||
        (resultToLog &&
          typeof resultToLog === 'object' &&
          'content' in resultToLog)
      ) {
        const content =
          typeof resultToLog.content === 'string'
            ? resultToLog.content
            : JSON.stringify(resultToLog.content || '');

        if (content?.trim()) {
          logger.info(`Agent Response:

${formatAgentResponse(content)}`);
        }
      }
      return {
        messages: [result],
      };
    }

    /**
     * Determines the next step in the workflow based on the last message.
     * If the last message contains tool calls, it routes to the 'tools' node.
     * Otherwise, it ends the execution.
     * @param state - The current state of the graph.
     * @returns 'tools' if tool calls are present, otherwise 'end'.
     */
    function shouldContinue(state: typeof GraphState.State) {
      const messages = state.messages;
      const lastMessage = messages[messages.length - 1] as AIMessage;
      if (lastMessage.tool_calls?.length) {
        logger.debug(
          `Detected ${lastMessage.tool_calls.length} tool calls, routing to tools node.`
        );
        return 'tools';
      }
      return 'end';
    }

    let workflow = new StateGraph(GraphState)
      .addNode('agent', callModel)
      .addNode('tools', toolNode);

    if (agent_config.memory && memoryAgent) {
      workflow = (workflow as any)
        .addNode('memory', memoryAgent.createMemoryNode())
        .addEdge('__start__', 'memory');
      if (ragAgent) {
        workflow = (workflow as any)
          .addNode('ragNode', ragAgent.createRagNode(agent_config.id))
          .addEdge('memory', 'ragNode')
          .addEdge('ragNode', 'agent');
      } else {
        workflow = (workflow as any).addEdge('memory', 'agent');
      }
    } else if (ragAgent) {
      workflow = (workflow as any)
        .addNode('ragNode', ragAgent.createRagNode(agent_config.id))
        .addEdge('__start__', 'ragNode')
        .addEdge('ragNode', 'agent');
    } else {
      workflow = (workflow as any).addEdge('__start__', 'agent');
    }

    workflow
      .addConditionalEdges('agent', shouldContinue)
      .addEdge('tools', 'agent');

    const checkpointer = new MemorySaver();
    const app = workflow.compile({
      ...(agent_config.memory
        ? {
            checkpointer: checkpointer,
            configurable: {},
          }
        : {}),
    });
    return {
      app,
      agent_config,
    };
  } catch (error) {
    logger.error('Failed to create an interactive agent:', error);
    throw error;
  }
};
