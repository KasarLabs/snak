import {
  StateGraph,
  MemorySaver,
  Annotation,
  LangGraphRunnableConfig,
  END,
} from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import {
  AIMessage,
  AIMessageChunk,
  BaseMessage,
  HumanMessage,
  ToolMessage,
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
import {
  interactiveRules,
  planPrompt,
  PromptPlanInteractive,
} from '../../prompt/prompts.js';
import { TokenTracker } from '../../token/tokenTracking.js';
import { AgentReturn } from './autonomous.js';
import { MemoryAgent } from 'agents/operators/memoryAgent.js';
import { RagAgent } from 'agents/operators/ragAgent.js';
import { RunnableConfig } from '@langchain/core/runnables';

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
        memoryAgent = snakAgent.getMemoryAgent();
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
        ragAgent = snakAgent.getRagAgent();
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
    const originalToolNodeInvoke = toolNode.invoke.bind(toolNode);
    toolNode.invoke = async (
      state: typeof GraphState.State,
      config?: LangGraphRunnableConfig
    ): Promise<{ messages: BaseMessage[] } | null> => {
      logger.warn('HELLO FROM TOOLS');
      const lastMessage = state.messages[state.messages.length - 1];
      const lastIterationNumber = getLatestMessageForMessage(
        state.messages,
        AIMessageChunk
      )?.additional_kwargs.iteration_number;
      const toolCalls =
        lastMessage instanceof AIMessageChunk && lastMessage.tool_calls
          ? lastMessage.tool_calls
          : [];

      if (toolCalls.length > 0) {
        toolCalls.forEach((call) => {
          logger.info(
            `Executing tool: ${call.name} with args: ${JSON.stringify(call.args).substring(0, 150)}${JSON.stringify(call.args).length > 150 ? '...' : ''}`
          );
        });
      }

      const startTime = Date.now();
      try {
        const result = await originalToolNodeInvoke(state, config);
        const executionTime = Date.now() - startTime;
        const truncatedResult: { messages: [ToolMessage] } =
          truncateToolResults(result, 5000); // Max 5000 chars for tool output

        logger.debug(
          `Tool execution completed in ${executionTime}ms. Results: ${Array.isArray(truncatedResult) ? truncatedResult.length : typeof truncatedResult}`
        );

        truncatedResult.messages.forEach((res) => {
          res.additional_kwargs = {
            from: 'tools',
            final: false,
            iteration_number: lastIterationNumber,
          };
        });

        logger.warn(JSON.stringify(truncatedResult));
        return truncatedResult;
      } catch (error) {
        const executionTime = Date.now() - startTime;
        logger.error(
          `Tool execution failed after ${executionTime}ms: ${error}`
        );
        throw error;
      }
    };
    const configPrompt = agent_config.prompt?.content || '';
    const finalPrompt = `${configPrompt}`;

    function getLatestMessageForMessage(
      messages: BaseMessage[],
      MessageClass: typeof ToolMessage
    ): ToolMessage | null;
    function getLatestMessageForMessage(
      messages: BaseMessage[],
      MessageClass: typeof AIMessageChunk
    ): AIMessageChunk | null;
    function getLatestMessageForMessage(
      messages: BaseMessage[],
      MessageClass: typeof AIMessage
    ): AIMessage | null;
    function getLatestMessageForMessage(
      messages: BaseMessage[],
      MessageClass: typeof HumanMessage
    ): HumanMessage | null {
      try {
        for (let i = messages.length - 1; i >= 0; i--) {
          if (messages[i] instanceof MessageClass) {
            return messages[i];
          }
        }
        return null;
      } catch (error: any) {
        logger.error(error);
        throw error;
      }
    }
    /**
     * Calls the appropriate language model with the current state and tools.
     * @param state - The current state of the graph.
     * @returns A promise that resolves to an object containing the model's response messages.
     * @throws Will throw an error if agent configuration is incomplete or if model invocation fails.
     */
    async function callModel(
      state: typeof GraphState.State,
      config?: RunnableConfig
    ): Promise<{ messages: BaseMessage[] }> {
      if (!agent_config || !modelSelector) {
        throw new Error('Agent configuration and ModelSelector are required.');
      }

      // Configuration extraction
      const maxGraphSteps = config?.configurable?.config.max_graph_steps;
      const shortTermMemory = config?.configurable?.config.short_term_memory;
      const messages = state.messages;
      const lastMessage = messages[messages.length - 1];

      // Determine iteration number
      let iteration_number = 0;
      if (lastMessage instanceof ToolMessage) {
        logger.debug('ToolMessage Detected');
        const lastMessageAi = getLatestMessageForMessage(
          state.messages,
          AIMessageChunk
        );
        if (!lastMessageAi) {
          throw new Error('Error trying to get latest AI Message Chunk');
        }
        iteration_number =
          (lastMessageAi.additional_kwargs.iteration_number as number) || 0;
      } else if (lastMessage instanceof AIMessageChunk) {
        iteration_number =
          (lastMessage.additional_kwargs.iteration_number as number) || 0;
      }

      if (maxGraphSteps <= iteration_number) {
        return {
          messages: [
            new AIMessageChunk({
              content: `Reaching maximum iterations for autonomous agent. Ending workflow.`,
              additional_kwargs: {
                final: true,
                iteration_number: iteration_number,
              },
            }),
          ],
        };
      }

      iteration_number++;

      // Determine start iteration
      let startIteration = 0;
      if ((config?.metadata?.langgraph_step as number) === 1) {
        startIteration = 1;
      } else if (
        Array.isArray(config?.metadata?.langgraph_triggers) &&
        typeof config.metadata.langgraph_triggers[0] === 'string' &&
        config.metadata.langgraph_triggers[0] === '__start__:agent'
      ) {
        startIteration = config?.metadata?.langgraph_step as number;
      } else {
        const lastAiMessage = getLatestMessageForMessage(
          state.messages,
          AIMessageChunk
        );
        if (!lastAiMessage) {
          throw new Error('Error trying to get latest AI Message Chunk');
        }
        startIteration = lastAiMessage.additional_kwargs
          .start_iteration as number;
      }

      logger.info(
        `startIteration: ${startIteration}, iteration: ${iteration_number}`
      );

      // Check max iterations

      logger.info('Autonomous agent callModel invoked.');

      // Build system prompt

      const autonomousSystemPrompt = `
        ${agent_config.prompt.content}
        ${interactiveRules}
          
        Available tools: ${toolsList.map((tool) => tool.name).join(', ')}`;

      try {
        // Filter messages based on short-term memory
        const filteredMessages = [];
        let lastIterationCount = iteration_number - 1;
        let s_temp = shortTermMemory;

        for (let i = state.messages.length - 1; i >= 0; i--) {
          const msg = state.messages[i];

          // Skip model-selector messages
          if (
            (msg instanceof AIMessageChunk || msg instanceof ToolMessage) &&
            msg.additional_kwargs?.from === 'model-selector'
          ) {
            continue;
          }

          // Handle iteration filtering
          if (lastIterationCount !== msg.additional_kwargs?.iteration_number) {
            lastIterationCount =
              (msg.additional_kwargs?.iteration_number as number) || 0;
            s_temp--;
          }

          if (s_temp === 0) break;

          filteredMessages.unshift(msg);
        }

        // Create and format prompt
        const prompt = ChatPromptTemplate.fromMessages([
          ['system', autonomousSystemPrompt],
          new MessagesPlaceholder('messages'),
        ]);

        const formattedPrompt = await prompt.formatMessages({
          messages: filteredMessages,
        });

        // Model selection and invocation
        const selectedModelType =
          await modelSelector.selectModelForMessages(filteredMessages);
        const boundModel =
          typeof selectedModelType.model.bindTools === 'function'
            ? selectedModelType.model.bindTools(toolsList)
            : selectedModelType.model;

        logger.debug(
          `Autonomous agent invoking model (${selectedModelType.model_name}) with ${filteredMessages.length} messages.`
        );

        const result = await boundModel.invoke(formattedPrompt);
        if (!result) {
          throw new Error(
            'Model invocation returned no result. Please check the model configuration.'
          );
        }
        TokenTracker.trackCall(result, selectedModelType.model_name);

        // Add metadata to result
        result.additional_kwargs = {
          ...result.additional_kwargs,
          from: 'autonomous-agent',
          final: false,
          start_iteration: startIteration,
          iteration_number: iteration_number,
        };

        return { messages: [result] };
      } catch (error: any) {
        logger.error(`Error calling model in autonomous agent: ${error}`);

        // Handle token limit errors
        if (
          error.message?.includes('token limit') ||
          error.message?.includes('tokens exceed') ||
          error.message?.includes('context length')
        ) {
          logger.error(
            `Token limit error during autonomous callModel: ${error.message}`
          );
          return {
            messages: [
              new AIMessageChunk({
                content:
                  'Error: The conversation history has grown too large, exceeding token limits. Cannot proceed.',
                additional_kwargs: {
                  error: 'token_limit_exceeded',
                  final: true,
                },
              }),
            ],
          };
        }

        // Handle other errors
        return {
          messages: [
            new AIMessageChunk({
              content: `Error: An unexpected error occurred while processing the request. Error : ${error}`,
              additional_kwargs: {
                error: 'unexpected_error',
                final: true,
              },
            }),
          ],
        };
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
    function shouldContinue(
      state: typeof GraphState.State,
      config?: RunnableConfig
    ): 'tools' | 'agent' | 'end' {
      const messages = state.messages;
      const lastMessage = messages[messages.length - 1];
      if (lastMessage instanceof AIMessageChunk) {
        if (
          lastMessage.additional_kwargs.final === true ||
          lastMessage.content.toString().includes('FINAL ANSWER') ||
          lastMessage.content.toString().includes('PLAN_COMPLETED')
        ) {
          logger.info(
            `Final message received, routing to end node. Message: ${lastMessage.content}`
          );
          return 'end';
        }
        if (lastMessage.tool_calls?.length) {
          logger.debug(
            `Detected ${lastMessage.tool_calls.length} tool calls, routing to tools node.`
          );
          return 'tools';
        }
      } else if (lastMessage instanceof ToolMessage) {
        const lastAiMessage = getLatestMessageForMessage(
          messages,
          AIMessageChunk
        );
        if (!lastAiMessage) {
          throw new Error('Error trying to get last AIMessageChunk');
        }
        const graphMaxSteps = config?.configurable?.config
          .max_graph_steps as number;

        const iteration = lastMessage.additional_kwargs
          ?.iteration_number as number;
        if (graphMaxSteps <= iteration) {
          logger.info(
            `Tools : Final message received, routing to end node. Message: ${lastMessage.content}`
          );
          return 'end';
        }

        logger.debug(
          `Received ToolMessage, routing back to agent node. Message: ${lastMessage.content}`
        );
        return 'agent';
      }
      logger.info('Routing to AgentMode');
      return 'agent';
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