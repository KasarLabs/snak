import { AgentConfig, logger } from '@snakagent/core';
import { SnakAgentInterface } from '../../tools/tools.js';
import { createAllowedTools } from '../../tools/tools.js';
import {
  StateGraph,
  MemorySaver,
  Annotation,
  END,
  START,
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
} from '@langchain/core/messages';
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from '@langchain/core/prompts';
import { ModelSelector } from '../operators/modelSelector.js';
import { LangGraphRunnableConfig } from '@langchain/langgraph';
import { truncateToolResults, formatAgentResponse } from '../core/utils.js';
import { autonomousRules } from '../../prompt/prompts.js';
import { TokenTracker } from '../../token/tokenTracking.js';

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
    ): Promise<ToolMessage | ToolMessage[] | null> => {
      const lastMessage = state.messages[state.messages.length - 1];
      const toolCalls =
        lastMessage instanceof AIMessage && lastMessage.tool_calls
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
        const truncatedResult = truncateToolResults(result, 5000); // Max 5000 chars for tool output

        logger.debug(
          `Tool execution completed in ${executionTime}ms. Results: ${Array.isArray(truncatedResult) ? truncatedResult.length : typeof truncatedResult}`
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
    async function callModel(
      state: typeof GraphState.State
    ): Promise<{ messages: BaseMessage[] }> {
      if (!agent_config || !modelSelector) {
        throw new Error('Agent configuration and ModelSelector are required.');
      }

      const autonomousSystemPrompt = `
      ${agent_config.prompt.content}

      ${autonomousRules}

      Available tools: ${toolsList.map((tool) => tool.name).join(', ')}`;

      const prompt = ChatPromptTemplate.fromMessages([
        ['system', autonomousSystemPrompt],
        new MessagesPlaceholder('messages'),
      ]);

      const filteredMessages = state.messages;

      try {
        const formattedPrompt = await prompt.formatMessages({
          messages: filteredMessages,
        });

        // Is it use to get the HumanMessage from the messages array in id[]
        const originalUserMessage = filteredMessages.find(
          (msg): msg is HumanMessage => msg instanceof HumanMessage
        );
        const originalUserQuery = originalUserMessage
          ? typeof originalUserMessage.content === 'string'
            ? originalUserMessage.content
            : JSON.stringify(originalUserMessage.content)
          : '';
        console.log(
          `Original user query: ${originalUserQuery.substring(0, 100)}${
            originalUserQuery.length > 100 ? '...' : ''
          }`
        );
        const selectedModelType =
          await modelSelector.selectModelForMessages(filteredMessages);

        const boundModel =
          typeof selectedModelType.model.bindTools === 'function'
            ? selectedModelType.model.bindTools(toolsList)
            : selectedModelType.model;

        logger.debug(
          `Autonomous agent invoking model (${selectedModelType}) with ${filteredMessages.length} messages.`
        );
        const result = await boundModel.invoke(formattedPrompt);
        TokenTracker.trackCall(result, selectedModelType.model_name);

        let finalResultMessages: BaseMessage[];

        if (result instanceof AIMessage) {
          finalResultMessages = [result];
        } else {
          throw new Error(
            `Unexpected model response type: ${typeof result}. Expected AIMessage.`
          );
        }

        finalResultMessages.forEach((msg) => {
          if (msg instanceof AIMessage) {
            msg.additional_kwargs = {
              ...msg.additional_kwargs,
              from: msg.additional_kwargs?.from || 'starknet-autonomous',
              token_model_selector: selectedModelType.token,
            };
          } else {
            throw new Error(
              `Unexpected message type: ${typeof msg}. Expected AIMessage.`
            );
          }
        });

        const responseMessage =
          finalResultMessages[finalResultMessages.length - 1];
        if (responseMessage) {
          console.log(
            `ResponseMessage: ${JSON.stringify(responseMessage, null, 2)}`
          );
          const contentToLog =
            typeof responseMessage.content === 'string'
              ? responseMessage.content
              : JSON.stringify(responseMessage.content);

          if (contentToLog && contentToLog.trim() !== '') {
            logger.info(
              `Agent Response:\n\n${formatAgentResponse(contentToLog)}`
            );
          }

          if (
            responseMessage instanceof AIMessage &&
            responseMessage.tool_calls &&
            responseMessage.tool_calls.length > 0
          ) {
            const toolNames = responseMessage.tool_calls
              .map((call) => call.name)
              .join(', ');
            logger.info(
              `Autonomous agent: Requested ${responseMessage.tool_calls.length} tool calls: [${toolNames}]`
            );
          }
        }

        return { messages: finalResultMessages };
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
              new AIMessage({
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
            new AIMessage(
              `Error during model execution: ${error.message || String(error)}`
            ),
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
      state: typeof GraphState.State
    ): 'tools' | 'agent' | 'end' {
      const lastMessage = state.messages[state.messages.length - 1];

      if (!lastMessage) {
        logger.warn(
          'shouldContinue called with no messages in state. Defaulting to agent.'
        );
        return 'agent';
      }

      if (lastMessage instanceof AIMessage && lastMessage.tool_calls?.length) {
        logger.debug(
          `Detected ${lastMessage.tool_calls.length} tool calls. Routing to tools node.`
        );
        return 'tools';
      }

      if (
        lastMessage instanceof AIMessage &&
        typeof lastMessage.content === 'string' &&
        lastMessage.content.includes('FINAL ANSWER:') &&
        !lastMessage.additional_kwargs?.processed_final_answer // Ensure it's not already processed
      ) {
        logger.debug(
          'Detected "FINAL ANSWER" in message. Routing to agent for processing.'
        );
        // Mark message for processing in callModel
        lastMessage.additional_kwargs = {
          ...(lastMessage.additional_kwargs || {}),
          final_answer: true,
          processed_final_answer: true, // Mark as processed to avoid re-entry for the same message
        };
        return 'end'; // Route to agent to handle the FINAL ANSWER logic
      }

      logger.debug(
        'No tool calls or unprocessed FINAL ANSWER. Routing back to agent for next iteration.'
      );
      return 'agent';
    }

    const workflow = new StateGraph(GraphState)
      .addNode('agent', callModel)
      .addNode('tools', toolNode);

    workflow.addEdge(START, 'agent');

    workflow.addConditionalEdges('agent', shouldContinue, {
      tools: 'tools',
      agent: 'agent',
      end: END,
    });

    workflow.addEdge('tools', 'agent');

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
