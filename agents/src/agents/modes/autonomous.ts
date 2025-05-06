import { logger } from '@snakagent/core';
import { StarknetAgentInterface } from '../../tools/tools.js';
import { createAllowedTools } from '../../tools/tools.js';
import { StateGraph, MemorySaver, Annotation } from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { MCP_CONTROLLER } from '../../services/mcp/src/mcp.js';
import {
  DynamicStructuredTool,
  StructuredTool,
  Tool,
} from '@langchain/core/tools';
import { AnyZodObject } from 'zod';
import { AIMessage, BaseMessage } from '@langchain/core/messages';
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from '@langchain/core/prompts';
import { ModelSelectionAgent } from '../operators/modelSelectionAgent.js';
import { LangGraphRunnableConfig } from '@langchain/langgraph';
import { truncateToolResults, formatAgentResponse } from '../core/utils.js';

/**
 * Creates an agent in autonomous mode using StateGraph
 * @param starknetAgent The Starknet agent instance
 * @param modelSelector Model selector instance
 */
export const createAutonomousAgent = async (
  starknetAgent: StarknetAgentInterface,
  modelSelector: ModelSelectionAgent | null
) => {
  try {
    const json_config = starknetAgent.getAgentConfig();
    if (!json_config) {
      throw new Error('Agent configuration is required');
    }

    // Check if autonomous mode is explicitly disabled in config (redundant check, StarknetAgent likely handles this)
    // if (json_config.mode && json_config.mode.autonomous === false) {
    //   throw new Error('Autonomous mode is disabled in agent configuration');
    // }

    // --- Tool Initialization ---
    let toolsList: (
      | StructuredTool
      | Tool
      | DynamicStructuredTool<AnyZodObject>
    )[] = await createAllowedTools(starknetAgent, json_config.plugins);

    // Initialize MCP tools if configured
    if (
      json_config.mcpServers &&
      Object.keys(json_config.mcpServers).length > 0
    ) {
      try {
        const mcp = MCP_CONTROLLER.fromJsonConfig(json_config);
        await mcp.initializeConnections();
        const mcpTools = mcp.getTools();
        logger.info(
          `Added ${mcpTools.length} MCP tools to the autonomous agent`
        );
        toolsList = [...toolsList, ...mcpTools];
      } catch (error) {
        logger.error(`Failed to initialize MCP tools: ${error}`);
        // Consider if this should throw or just warn
      }
    }

    // --- Model Selection Check ---
    if (!modelSelector) {
      logger.error(
        'ModelSelectionAgent is required for autonomous mode but was not provided.'
      );
      throw new Error('ModelSelectionAgent is required for autonomous mode.');
    }

    // --- State Definition ---
    const GraphState = Annotation.Root({
      messages: Annotation<BaseMessage[]>({
        reducer: (x, y) => x.concat(y),
      }),
      // Add other state properties if needed for autonomous control later (e.g., iteration count)
    });

    // --- Tool Node with Logging ---
    const toolNode = new ToolNode(toolsList);
    const originalToolNodeInvoke = toolNode.invoke.bind(toolNode);
    toolNode.invoke = async (
      state: typeof GraphState.State,
      config?: LangGraphRunnableConfig
    ) => {
      const lastMessage = state.messages[state.messages.length - 1];
      let toolCalls: any[] = []; // Initialize toolCalls

      // Check if lastMessage is an AIMessage before accessing tool_calls
      if (lastMessage instanceof AIMessage && lastMessage.tool_calls) {
        toolCalls = lastMessage.tool_calls;
      }

      if (toolCalls.length > 0) {
        logger.debug(`Tool execution starting: ${toolCalls.length} calls`);
        for (const call of toolCalls) {
          logger.info(
            `Executing tool: ${call.name} with args: ${JSON.stringify(call.args).substring(0, 150)}${JSON.stringify(call.args).length > 150 ? '...' : ''}`
          );
        }
      } else {
        logger.debug(
          'ToolNode invoked, but no tool calls found in the last message.'
        );
      }

      const startTime = Date.now();
      try {
        const result = await originalToolNodeInvoke(state, config);
        const executionTime = Date.now() - startTime;

        // Use truncateToolResults function instead of manual logging
        const truncatedResult = truncateToolResults(result, 5000);

        // Langchain ToolNode result is directly the ToolMessages, not wrapped in { messages: [...] }
        if (Array.isArray(truncatedResult)) {
          logger.debug(
            `Tool execution completed in ${executionTime}ms with ${truncatedResult.length} results.`
          );
        } else {
          logger.debug(
            `Tool execution completed in ${executionTime}ms. Result type: ${typeof truncatedResult}`
          );
        }
        // Return the truncated result
        return truncatedResult;
      } catch (error) {
        const executionTime = Date.now() - startTime;
        logger.error(
          `Tool execution failed after ${executionTime}ms: ${error}`
        );
        throw error; // Re-throw error to be handled by the graph/caller
      }
    };

    // --- Agent Node (callModel) ---
    async function callModel(
      state: typeof GraphState.State
    ): Promise<{ messages: BaseMessage[] }> {
      // Ensure return type matches graph expectation
      if (!json_config) {
        // This check might be redundant due to the initial check, but good practice
        throw new Error('Agent configuration is required but not available');
      }
      if (!modelSelector) {
        // This check might be redundant due to the initial check
        throw new Error('ModelSelectionAgent is required but not available');
      }

      // --- Prepare Autonomous System Prompt ---
      let baseSystemPrompt = '';
      if (json_config.prompt && json_config.prompt.content) {
        if (typeof json_config.prompt.content === 'string') {
          baseSystemPrompt = json_config.prompt.content;
        } else {
          logger.warn(
            'System prompt content has an unexpected type, using default.'
          );
          // Default prompt or handle differently
        }
      }

      const autonomousSystemPrompt = `${baseSystemPrompt}

You are now operating in AUTONOMOUS MODE. This means:

1.  You must complete tasks step-by-step without requiring user input.
2.  Work towards the GOAL defined in the initial messages using the tools available to you.
3.  Break down complex tasks into manageable steps.
4.  Think step-by-step about your plan and reasoning before deciding on an action (tool call) or providing a final answer.
5.  For each response that is not the final answer, briefly explain your reasoning and the next action you plan to take via a tool call.
6.  When your task is complete and you have the final result, respond with "FINAL ANSWER: <your conclusion>" at the very end of your message. Do not call any tools in the same message as the FINAL ANSWER.

Available tools: ${toolsList.map((tool) => tool.name).join(', ')}

Remember to be methodical, efficient, and provide clear reasoning for your actions. Adhere strictly to the autonomous operation guidelines.
`;

      const prompt = ChatPromptTemplate.fromMessages([
        ['system', autonomousSystemPrompt],
        new MessagesPlaceholder('messages'),
      ]);

      // Filter messages if needed (e.g., remove internal system messages)
      const filteredMessages = state.messages; // Apply filtering if necessary

      try {
        const formattedPrompt = await prompt.formatMessages({
          messages: filteredMessages,
        });

        // TODO: Implement robust token limit handling for autonomous mode
        // This might involve summarizing older messages or using a different strategy
        // than just truncating like in interactive mode. For now, proceed without explicit limit handling.

        const selectedModelType =
          await modelSelector.selectModelForMessages(filteredMessages); // Default to dynamic selection
        const modelForThisTask = await modelSelector.getModelForTask(
          filteredMessages,
          selectedModelType
        );

        // Ensure the model is bound with tools if the capability exists
        const boundModel =
          typeof modelForThisTask.bindTools === 'function'
            ? modelForThisTask.bindTools(toolsList)
            : modelForThisTask;

        logger.debug(
          `Autonomous agent invoking model (${selectedModelType}) with ${filteredMessages.length} messages.`
        );
        // Use 'unknown' and type guards for safer result handling
        const result: unknown = await boundModel.invoke(formattedPrompt);
        logger.debug(`Autonomous agent model invocation complete.`);

        // Ensure result is BaseMessage[]
        let finalResultMessages: BaseMessage[];

        if (result instanceof AIMessage) {
          finalResultMessages = [result];
        } else if (
          Array.isArray(result) &&
          result.every((m): m is BaseMessage => m instanceof BaseMessage)
        ) {
          // Use type guard in .every()
          finalResultMessages = result;
        } else if (
          typeof result === 'object' &&
          result !== null &&
          'content' in result &&
          typeof result.content === 'string'
        ) {
          // Check if it's an object with a string 'content' property (basic check)
          finalResultMessages = [
            new AIMessage({
              content: result.content,
              // Safely access tool_calls if it exists
              tool_calls:
                'tool_calls' in result && Array.isArray(result.tool_calls)
                  ? result.tool_calls
                  : undefined,
            }),
          ];
        } else {
          logger.error(`Unexpected model result type: ${typeof result}`);
          // Create a fallback error message
          finalResultMessages = [
            new AIMessage(
              'Error: Received unexpected response format from language model.'
            ),
          ];
        }

        // Add standard 'from' metadata for consistency if missing
        finalResultMessages.forEach((msg) => {
          if (msg instanceof AIMessage && !msg.additional_kwargs?.from) {
            if (!msg.additional_kwargs) msg.additional_kwargs = {};
            msg.additional_kwargs.from = 'starknet-autonomous'; // Differentiate source
          }
        });

        // Log AI output for monitoring purposes
        const lastMessage = finalResultMessages[finalResultMessages.length - 1];
        if (lastMessage) {
          const contentToCheck =
            typeof lastMessage.content === 'string'
              ? lastMessage.content.trim()
              : JSON.stringify(lastMessage.content || '');

          if (contentToCheck && contentToCheck !== '') {
            // Format and display the output with the standard box format
            const content =
              typeof lastMessage.content === 'string'
                ? lastMessage.content
                : JSON.stringify(lastMessage.content);

            // Replace box display with simple log
            logger.info(`Agent Response:\n\n${formatAgentResponse(content)}`);

            // Also log to the logger for records
            logger.debug(`Autonomous agent: AI output logged`);
          }

          if (
            lastMessage instanceof AIMessage &&
            lastMessage.tool_calls &&
            lastMessage.tool_calls.length > 0
          ) {
            const toolNames = lastMessage.tool_calls
              .map((call) => call.name)
              .join(', ');
            logger.info(
              `Autonomous agent: Tool calls: ${lastMessage.tool_calls.length} calls - [${toolNames}]`
            );
          }
        }

        return { messages: finalResultMessages };
      } catch (error) {
        logger.error(`Error calling model in autonomous agent: ${error}`);
        // Handle token limit errors specifically if they occur
        if (
          error instanceof Error &&
          (error.message.includes('token limit') ||
            error.message.includes('tokens exceed') ||
            error.message.includes('context length'))
        ) {
          logger.error(
            `Token limit error during autonomous callModel: ${error.message}`
          );
          // Return an error message that the main loop can use
          return {
            messages: [
              new AIMessage({
                content:
                  'Error: The conversation history has grown too large, exceeding token limits. Cannot proceed.',
                additional_kwargs: {
                  error: 'token_limit_exceeded',
                  final: true,
                }, // Signal error and potential final state
              }),
            ],
          };
        }
        // Propagate other errors as AIMessage
        return {
          messages: [new AIMessage(`Error during model execution: ${error}`)],
        };
      }
    }

    // --- Graph Edges ---
    function shouldContinue(state: typeof GraphState.State): 'tools' | 'agent' {
      const lastMessage = state.messages[state.messages.length - 1];

      // Check for tool calls only if it's an AIMessage
      if (lastMessage instanceof AIMessage && lastMessage.tool_calls?.length) {
        logger.debug(
          `Detected ${lastMessage.tool_calls.length} tool calls. Routing to tools node.`
        );
        return 'tools';
      }

      // Check if the message contains "FINAL ANSWER"
      if (
        lastMessage instanceof AIMessage &&
        typeof lastMessage.content === 'string' &&
        lastMessage.content.includes('FINAL ANSWER:')
      ) {
        logger.debug('Detected "FINAL ANSWER" in message');

        // Capture the FINAL ANSWER content
        const finalAnswer = lastMessage.content;

        // Create a new message instructing the agent to continue
        const continuationMessage = new AIMessage({
          content: `I've received your final answer: "${finalAnswer}"\n\nBased on the history of your actions and your objectives, what would you like to do next? You can either continue with another task or refine your previous solution.`,
          additional_kwargs: {
            from: 'starknet-autonomous',
          },
        });

        // Add the continuation message to the state
        state.messages.push(continuationMessage);

        logger.debug(
          'Added continuation prompt to encourage further exploration'
        );
        return 'agent';
      }

      // If no tool calls and no FINAL ANSWER, always loop back to the agent to force continuation.
      // Termination is handled by the external recursion limit in execute_autonomous.
      logger.debug(
        'No tool calls detected. Routing back to agent for next iteration.'
      );
      return 'agent'; // Force loop back to agent
    }

    // --- Build Workflow ---
    const workflow = new StateGraph(GraphState)
      .addNode('agent', callModel)
      .addNode('tools', toolNode);

    workflow.setEntryPoint('agent');

    // Modify conditional edges: only 'tools' or 'agent' targets
    workflow.addConditionalEdges('agent', shouldContinue, {
      tools: 'tools',
      agent: 'agent', // Route back to agent if shouldContinue returns 'agent'
      // __end__: '__end__', // REMOVED __end__ route
    });

    workflow.addEdge('tools', 'agent'); // Always loop back to agent after tools

    // --- Compile ---
    // Use MemorySaver for potential state persistence if needed across separate executions,
    // but the main loop control will be external in StarknetAgent.execute_autonomous.
    const checkpointer = new MemorySaver();
    const app = workflow.compile({ checkpointer });

    // Return the compiled app and potentially other config needed by StarknetAgent
    return {
      app, // The compiled LangGraph app
      json_config, // Pass config along if needed
      maxIteration: json_config.mode?.maxIteration || 50, // Default max iterations for autonomous mode
    };
  } catch (error) {
    logger.error('Failed to create autonomous agent graph:', error);
    throw error;
  }
};
