import { AgentConfig, logger } from '@snakagent/core';
import { SnakAgentInterface } from '../../tools/tools.js';
import { createAllowedTools } from '../../tools/tools.js';
import {
  StateGraph,
  MemorySaver,
  Annotation,
  END,
  START,
  Graph,
  interrupt,
  Command,
  MessagesAnnotation,
} from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { MCP_CONTROLLER } from '../../services/mcp/src/mcp.js';
import {
  DynamicStructuredTool,
  StructuredTool,
  Tool,
} from '@langchain/core/tools';
import { AnyZodObject } from 'zod';
import {
  AIMessage,
  BaseMessage,
  ToolMessage,
  HumanMessage,
  AIMessageChunk,
} from '@langchain/core/messages';
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from '@langchain/core/prompts';
import { ModelSelector } from '../operators/modelSelector.js';
import { LangGraphRunnableConfig } from '@langchain/langgraph';
import { truncateToolResults, formatAgentResponse } from '../core/utils.js';
import { autonomousRules, hybridRules } from '../../prompt/prompts.js';
import { TokenTracker } from '../../token/tokenTracking.js';
import fs from 'fs';
import { queryObjects } from 'v8';
import { RunnableConfig } from '@langchain/core/runnables';
import { start } from 'repl';
/**
 * Defines the state structure for the autonomous agent graph.
 */
const GraphState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (
      x: BaseMessage[],
      y: BaseMessage | BaseMessage[]
    ): BaseMessage[] => x.concat(y),
    default: (): BaseMessage[] => [],
  }),
});

export interface AgentReturn {
  app: any;
  agent_config: AgentConfig;
}

/**
 * Creates and configures an autonomous agent using a StateGraph.
 * This agent can use tools, interact with models, and follow a defined workflow.
 * @async
 * @param {SnakAgentInterface} snakAgent - The Starknet agent instance providing configuration and context
 * @param {ModelSelector | null} modelSelector - The model selection agent for choosing appropriate LLMs
 * @returns {Promise<Object>} Promise resolving to compiled LangGraph app, agent config, and max iterations
 * @throws {Error} If agent configuration or model selector is missing, or if MCP tool initialization fails
 */
export const createAutonomousAgent = async (
  snakAgent: SnakAgentInterface,
  modelSelector: ModelSelector | null
): Promise<AgentReturn> => {
  try {
    console.log(
      'Staarknet Autonomous Agent: Initializing autonomous agent graph...'
    );
    const agent_config = snakAgent.getAgentConfig();
    if (!agent_config) {
      throw new Error('Agent configuration is required.');
    }

    if (!modelSelector) {
      logger.error(
        'ModelSelector is required for autonomous mode but was not provided.'
      );
      throw new Error('ModelSelector is required for autonomous mode.');
    }

    let toolsList: (
      | StructuredTool
      | Tool
      | DynamicStructuredTool<AnyZodObject>
    )[] = await createAllowedTools(snakAgent, agent_config.plugins);

    if (
      agent_config.mcpServers &&
      Object.keys(agent_config.mcpServers).length > 0
    ) {
      try {
        const mcp = MCP_CONTROLLER.fromAgentConfig(agent_config);
        await mcp.initializeConnections();
        const mcpTools = mcp.getTools();
        logger.info(
          `Initialized ${mcpTools.length} MCP tools for the autonomous agent.`
        );
        toolsList = [...toolsList, ...mcpTools];
      } catch (error) {
        logger.error(`Failed to initialize MCP tools: ${error}`);
      }
    }

    const toolNode = new ToolNode(toolsList);
    const originalToolNodeInvoke = toolNode.invoke.bind(toolNode);

    /**
     * Custom tool node invoker with logging and result truncation
     */
    toolNode.invoke = async (
      state: typeof GraphState.State,
      config?: LangGraphRunnableConfig
    ): Promise<{ messages: BaseMessage[] } | null> => {
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

        console.log(
          `Tool invocation result: ${JSON.stringify(
            truncatedResult as any,
            null,
            2
          )}`
        );
        return truncatedResult;
      } catch (error) {
        const executionTime = Date.now() - startTime;
        logger.error(
          `Tool execution failed after ${executionTime}ms: ${error}`
        );
        throw error;
      }
    };

    /**
     * Language model node that formats prompts, invokes the selected model, and processes responses
     *
     * @param {typeof GraphState.State} state - Current graph state containing messages
     * @returns {Promise<{ messages: BaseMessage[] }>} Object containing new messages from the model
     * @throws {Error} If agent configuration or model selector is unavailable
     */

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
    ): HumanMessage | null;
    function getLatestMessageForMessage(
      messages: BaseMessage[],
      MessageClass: any
    ): any {
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
    async function callModel(
      state: typeof GraphState.State,
      config?: RunnableConfig
    ): Promise<{ messages: BaseMessage[] }> {
      if (!agent_config || !modelSelector) {
        throw new Error('Agent configuration and ModelSelector are required.');
      }

      console.log(
        config?.configurable?.config.max_graph_steps,
        config?.configurable?.config.short_term_memory
      );
      let iteration_number = 0;

      const maxGraphSteps = config?.configurable?.config.max_graph_steps;
      const shortTermMemory = config?.configurable?.config.short_term_memory;
      const messages = state.messages;
      const lastMessage = messages[messages.length - 1];
      const lastMessageAi = getLatestMessageForMessage(
        state.messages,
        AIMessageChunk
      );

      console.log('Messages Lenght', messages.length);
      if (lastMessage instanceof ToolMessage) {
        logger.debug('ToolMessage Detected');

        if (!lastMessageAi) {
          throw new Error('Error trying to get latest AI Message Chunk');
        }
        // logger.info(
        //   `Last Message AI ${JSON.stringify(lastMessageAi, null, 2)}`
        // );
        iteration_number =
          (lastMessageAi.additional_kwargs.iteration_number as number) || 0;
      } else if (lastMessage instanceof AIMessageChunk) {
        iteration_number =
          (lastMessage.additional_kwargs.iteration_number as number) || 0;
      }
      iteration_number++;
      let startIteration: number = 0;
      if ((config?.metadata?.langgraph_step as number) === 1) {
        startIteration = 1;
      }
      if (
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

      logger.info(`startIteration: ${startIteration}`);
      console.log('iteration_number', iteration_number);
      if (maxGraphSteps <= iteration_number) {
        return {
          messages: [
            new AIMessageChunk({
              content: `Reaching maximum iterations for autonomous agent. Ending workflow.`,
              additional_kwargs: {
                final: true,
                start_iteration: startIteration,
              },
            }),
          ],
        };
      }

      logger.info('Autonomous agent callModel invoked.');
      const state2 = GraphState.Node;

      const autonomousSystemPrompt = `
        ${agent_config.prompt.content}

        ${hybridRules}

        Available tools: ${toolsList.map((tool) => tool.name).join(', ')}`;

      fs.appendFileSync('log.txt', JSON.stringify(lastMessage, null, 2));
      logger.debug(
        `Autonomous agent callModel: Iteration number is ${iteration_number}`
      );
      const prompt = ChatPromptTemplate.fromMessages([
        ['system', autonomousSystemPrompt],
        new MessagesPlaceholder('messages'),
      ]);

      let lastIterationCount = iteration_number - 1;
      let s_temp = shortTermMemory;
      try {
        const filteredMessages = [];
        for (let i = state.messages.length - 1; i >= 0; i--) {
          const msg = state.messages[i];
          // logger.debug(
          //   `Adding message to filteredMessages: ${JSON.stringify(msg)}`
          // );
          if (
            !(
              (msg instanceof AIMessageChunk || msg instanceof ToolMessage) &&
              msg.additional_kwargs?.from === 'model-selector'
            )
          ) {
            if (lastIterationCount != msg.additional_kwargs?.iteration_number) {
              console.log(
                `Skipping message with different iteration number: ${msg.additional_kwargs?.iteration_number}`
              );
              lastIterationCount =
                (msg.additional_kwargs?.iteration_number as number) || 0;
              s_temp--;
            }
            if (s_temp === 0) {
              break;
            }

            filteredMessages.unshift(msg);
          }
        }

        // console.log(JSON.stringify(prompt, null, 2));
        // console.log(JSON.stringify(filteredMessages, null, 2));
        const formattedPrompt = await prompt.formatMessages({
          messages: filteredMessages,
        });
        console.log(JSON.stringify(formattedPrompt, null, 2));

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
        TokenTracker.trackCall(result, selectedModelType.model_name);

        console.log('About to check instanceof');
        console.log(`Result type: ${Object.getPrototypeOf(result)}`);
        result.additional_kwargs = {
          ...result.additional_kwargs,
          from: 'autonomous-agent',
          final: false,
          start_iteration: startIteration,
          iteration_number: iteration_number,
        };
        const finalMessage = { messages: [result] };
        return finalMessage;
      } catch (error: any) {
        logger.error(`Error calling model in autonomous agent: ${error}`);
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
        return {
          messages: [
            new AIMessageChunk({
              content: `Error: An unexpected error occurred while processing the request. Error : ${error} `,
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
     * Determines the next step in the agent's workflow based on the last message
     *
     * @param {typeof GraphState.State} state - Current graph state
     * @returns {'tools' | 'agent'} Next node to execute
     */
    function shouldContinue(
      state: typeof GraphState.State,
      config?: RunnableConfig
    ): 'tools' | 'agent' | 'end' {
      const messages = state.messages;
      const lastMessage = messages[messages.length - 1];
      console.log('Object : ', Object.getPrototypeOf(lastMessage));
      if (lastMessage instanceof AIMessageChunk) {
        if (
          lastMessage.additional_kwargs.final === true ||
          lastMessage.content.toString().includes('FINAL ANSWER')
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

        const startIteration = lastAiMessage.additional_kwargs
          .start_iteration as number;

        if (
          (config?.metadata?.langgraph_step as number) >=
          config?.configurable?.config.max_graph_steps + startIteration
        ) {
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

    function shouldContinueHybrid(
      state: typeof GraphState.State,
      config?: RunnableConfig
    ): 'tools' | 'agent' | 'end' | 'human' {
      const messages = state.messages;
      const lastMessage = messages[messages.length - 1];
      console.log('Object : ', Object.getPrototypeOf(lastMessage));
      if (lastMessage instanceof AIMessageChunk) {
        // logger.debug(JSON.stringify(lastMessage, null, 2));
        if (
          lastMessage.additional_kwargs.final === true ||
          lastMessage.content.toString().includes('FINAL ANSWER')
        ) {
          logger.info(
            `Final message received, routing to end node. Message: ${lastMessage.content}`
          );
          return 'end';
        }
        if (
          lastMessage.content.toString().includes('WAITING_FOR_HUMAN_INPUT')
        ) {
          return 'human';
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

        const startIteration = lastAiMessage.additional_kwargs
          .start_iteration as number;
        const graphMaxSteps = config?.configurable?.config
          .max_graph_steps as number;

        const iteration = lastMessage.additional_kwargs
          ?.iteration_number as number;
        console.log("Iteration Tools: ", iteration);
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

    async function humanNode(
      state: typeof MessagesAnnotation.State
    ): Promise<{ messages: BaseMessage[] }> {
      console.log('Hello from humanNode');
      const lastAiMessage = getLatestMessageForMessage(
        state.messages,
        AIMessageChunk
      );
      const input = interrupt(lastAiMessage?.content);

      console.log('Bye from humanNode');
      return {
        messages: [
          new AIMessageChunk({
            content: input,
            additional_kwargs: {
              from: 'human',
              final: false,
              iteration_number:
                (lastAiMessage?.additional_kwargs.iteration_number as number) ||
                0,
            },
          }),
        ],
      };
    }
    const human_in_the_loop = true;
    let workflow;
    if (!human_in_the_loop) {
      workflow = new StateGraph(GraphState)
        .addNode('agent', callModel)
        .addNode('tools', toolNode);

      workflow.addEdge(START, 'agent');

      workflow.addConditionalEdges('agent', shouldContinue, {
        tools: 'tools',
        agent: 'agent',
        end: END,
      });

      workflow.addConditionalEdges('tools', shouldContinue, {
        tools: 'tools',
        agent: 'agent',
        end: END,
      });
    } else {
      workflow = new StateGraph(GraphState)
        .addNode('agent', callModel)
        .addNode('tools', toolNode)
        .addNode('human', humanNode);

      workflow.addEdge(START, 'agent');
      workflow.addEdge('human', 'agent');
      workflow.addConditionalEdges('agent', shouldContinueHybrid, {
        tools: 'tools',
        agent: 'agent',
        human: 'human',
        end: END,
      });

      workflow.addConditionalEdges('tools', shouldContinueHybrid, {
        tools: 'tools',
        agent: 'agent',
        end: END,
      });
    }
    const checkpointer = new MemorySaver(); // For potential state persistence
    const app = workflow.compile({ checkpointer });

    //     CompiledStateGraph<StateType<{
    //     messages: BinaryOperatorAggregate<BaseMessage[], BaseMessage[]>;
    // }>, UpdateType<{
    //     messages: BinaryOperatorAggregate<BaseMessage[], BaseMessage[]>;
    // }>, "__start__" | ... 1 more ... | "tools", {
    //     messages: BinaryOperatorAggregate<BaseMessage[], BaseMessage[]>;
    // }, {
    //     messages: BinaryOperatorAggregate<BaseMessage[], BaseMessage[]>;
    // }, StateDefinition>

    console.log(JSON.stringify(agent_config));
    return {
      app,
      agent_config,
    };
  } catch (error) {
    logger.error(`Failed to create autonomous agent graph: ${error}`);
    throw error;
  }
};
