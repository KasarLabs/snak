import {
  interrupt,
  StateGraph,
  MemorySaver,
  Annotation,
} from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { AIMessage, BaseMessage, HumanMessage } from '@langchain/core/messages';
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from '@langchain/core/prompts';
import { logger } from '@snakagent/core';
import { AgentConfig } from '../../config/jsonConfig.js';
import { StarknetAgentInterface } from '../../tools/tools.js';
import {
  initializeToolsList,
  truncateToolResults,
  formatAgentResponse,
} from '../core/utils.js';
import { ModelSelectionAgent } from '../operators/modelSelectionAgent.js';
import {
  hybridRules,
  baseSystemPrompt,
  finalAnswerRules,
} from 'prompt/prompts.js';

/**
 * Creates and configures a hybrid agent that can use tools, interact with humans,
 * and select models dynamically based on the context.
 *
 * @param starknetAgent - The Starknet agent interface providing tools and configuration.
 * @param modelSelector - An optional model selection agent to dynamically choose LLMs.
 * @returns An object containing the compiled LangGraph app, agent configuration, and max iteration count.
 * @throws Error if agent configuration is missing or invalid, or if model initialization fails.
 */
export const createHybridAgent = async (
  starknetAgent: StarknetAgentInterface,
  modelSelector: ModelSelectionAgent | null
) => {
  let agent_config: AgentConfig | undefined = undefined;

  try {
    agent_config = starknetAgent.getAgentConfig();
    if (!agent_config) {
      throw new Error('Agent configuration is required');
    }

    const toolsList = await initializeToolsList(starknetAgent, agent_config);

    // Define the graph state
    const GraphState = Annotation.Root({
      messages: Annotation<BaseMessage[]>({
        reducer: (x, y) => x.concat(y),
      }),
      waiting_for_input: Annotation<boolean>({
        default: () => false,
        value: (_, y) => y,
      }),
      iterations: Annotation<number>({
        default: () => 0,
        value: (_, y) => y,
      }),
    });

    const toolNode = new ToolNode(toolsList);

    // Add wrapper to log tool executions and truncate results
    const originalToolNodeInvoke = toolNode.invoke.bind(toolNode);
    toolNode.invoke = async (state, config) => {
      const lastMessage = state.messages[state.messages.length - 1];
      let toolCalls: Array<{ name: string; args: Record<string, any> }> = [];

      if (lastMessage instanceof AIMessage && lastMessage.tool_calls) {
        toolCalls = lastMessage.tool_calls;
      }

      if (toolCalls.length > 0) {
        logger.debug(
          `Hybrid agent: Tool execution starting: ${toolCalls.length} calls`
        );
        for (const call of toolCalls) {
          logger.info(
            `Executing tool: ${call.name} with args: ${JSON.stringify(call.args).substring(0, 150)}${JSON.stringify(call.args).length > 150 ? '...' : ''}`
          );
        }
      }

      const startTime = Date.now();
      try {
        const result = await originalToolNodeInvoke(state, config);
        const executionTime = Date.now() - startTime;

        if (result) {
          logger.debug(
            `Hybrid agent: Tool execution result structure: ${
              Array.isArray(result)
                ? 'Array[' + result.length + ']'
                : typeof result === 'object' && result.messages
                  ? 'Object with messages[' + result.messages.length + ']'
                  : typeof result
            }`
          );
        }

        const truncatedResult = truncateToolResults(result, 5000);

        logger.debug(
          `Hybrid agent: Tool execution completed in ${executionTime}ms`
        );
        return truncatedResult;
      } catch (error) {
        const executionTime = Date.now() - startTime;
        logger.error(
          `Hybrid agent: Tool execution failed after ${executionTime}ms: ${error}`
        );
        throw error;
      }
    };

    /**
     * Node that handles human input by interrupting the graph execution.
     * It waits for external input and then adds it as a HumanMessage to the state.
     * @param state - The current state of the graph.
     * @returns An object with the new human message and reset waiting_for_input flag, or an empty object if not waiting.
     */
    async function humanInputNode(state: typeof GraphState.State) {
      // Interrupt only when explicitly requested
      if (!state.waiting_for_input) {
        return {}; // No state change, continue
      }

      const lastMessage = state.messages[state.messages.length - 1];
      const messageToShow = lastMessage.content;

      logger.debug(
        `Hybrid agent: Interrupting for human input. Last message: ${typeof messageToShow === 'string' ? messageToShow.substring(0, 100) + '...' : '[complex content]'}`
      );

      // Interrupt execution and wait for human input
      const humanInput = interrupt({
        message: messageToShow,
        state_summary: {
          message_count: state.messages.length,
          iterations: state.iterations,
        },
      });

      logger.debug(
        `Hybrid agent: Received human input: ${typeof humanInput === 'string' ? humanInput.substring(0, 100) + '...' : JSON.stringify(humanInput).substring(0, 100) + '...'}`
      );

      // Add the human message to the conversation
      return {
        messages: [new HumanMessage(humanInput)],
        waiting_for_input: false, // Reset the flag
      };
    }

    /**
     * Processes the current state and generates the next agent response using an LLM.
     * It handles iteration limits, final answer processing, and model selection.
     * @param state - Current graph state containing conversation history and status flags.
     * @returns Updated state with new agent message and updated status flags.
     * @throws Error if model invocation fails or exceeds maximum iterations, or if config is missing.
     */
    async function callModel(state: typeof GraphState.State) {
      const currentIteration = state.iterations || 0;
      const maxIterations = agent_config?.maxIteration || 50;

      if (currentIteration >= maxIterations) {
        logger.warn(`Hybrid agent: Max iterations reached (${maxIterations})`);
        return {
          messages: [
            new AIMessage({
              content: `Maximum iterations (${maxIterations}) reached. Execution stopped.`,
              additional_kwargs: {
                from: 'hybrid-agent',
                final: true,
                error: 'max_iterations_reached',
              },
            }),
          ],
          iterations: currentIteration + 1,
        };
      }

      const lastMessage = state.messages[state.messages.length - 1];
      if (
        lastMessage instanceof AIMessage &&
        lastMessage.additional_kwargs?.final_answer === true
      ) {
        const finalAnswer = lastMessage.content;
        logger.debug(`Hybrid agent: Processing final answer continuation`);

        delete lastMessage.additional_kwargs.final_answer;

        let finalAnswerContent = finalAnswer;
        if (typeof finalAnswerContent === 'string') {
          const match = finalAnswerContent.match(/FINAL ANSWER:(.*?)$/s);
          if (match && match[1]) {
            finalAnswerContent = match[1].trim();
          }
        }

        return {
          messages: [
            new AIMessage({
              content: finalAnswerRules(finalAnswerContent),
              additional_kwargs: {
                from: 'hybrid-agent',
              },
            }),
          ],
          iterations: currentIteration + 1,
        };
      }

      if (!agent_config?.name) {
        throw new Error('Agent name is missing in configuration');
      }
      if (!(agent_config as any)?.bio) {
        throw new Error('Agent bio is missing in configuration');
      }
      if (
        !Array.isArray((agent_config as any)?.lore) ||
        (agent_config as any)?.lore.length === 0
      ) {
        throw new Error('Agent lore is missing or empty in configuration');
      }
      if (
        !Array.isArray((agent_config as any)?.objectives) ||
        (agent_config as any)?.objectives.length === 0
      ) {
        throw new Error(
          'Agent objectives are missing or empty in configuration'
        );
      }
      if (
        !Array.isArray((agent_config as any)?.knowledge) ||
        (agent_config as any)?.knowledge.length === 0
      ) {
        throw new Error('Agent knowledge is missing or empty in configuration');
      }

      // System prompt with hybrid instructions
      const hybridSystemPrompt = `
        ${baseSystemPrompt(agent_config)}

        ${hybridRules}
           
        Available tools: ${toolsList.map((tool) => tool.name).join(', ')}
      `;

      const prompt = ChatPromptTemplate.fromMessages([
        ['system', hybridSystemPrompt],
        new MessagesPlaceholder('messages'),
      ]);

      const formattedPrompt = await prompt.formatMessages({
        messages: state.messages,
      });

      // Trim trailing spaces to avoid Claude API error
      for (const message of formattedPrompt) {
        if (typeof message.content === 'string') {
          message.content = message.content.trimEnd();
        } else if (Array.isArray(message.content)) {
          // For messages with array content
          for (const part of message.content) {
            if (part.type === 'text' && typeof part.text === 'string') {
              part.text = part.text.trimEnd();
            }
          }
        }
      }

      const selectedModelType = modelSelector
        ? await modelSelector.selectModelForMessages(state.messages)
        : 'smart';

      const modelForThisTask = modelSelector
        ? await modelSelector.getModelForTask(state.messages, selectedModelType)
        : null;

      if (!modelForThisTask) {
        throw new Error('No model available for this task');
      }

      const boundModel =
        typeof modelForThisTask.bindTools === 'function'
          ? modelForThisTask.bindTools(toolsList)
          : modelForThisTask;

      logger.debug(
        `Hybrid agent: Invoking model (${selectedModelType}) with ${state.messages.length} messages (iteration ${currentIteration + 1})`
      );

      const result: BaseMessage = await boundModel.invoke(formattedPrompt);
      logger.debug(`Hybrid agent: Model invocation complete`);

      let resultMessage: AIMessage;
      if (result instanceof AIMessage) {
        resultMessage = result;
      } else {
        // If result is not an AIMessage, it's some other BaseMessage.
        // It will have 'content'. It won't have 'tool_calls' in the AIMessage specific way.
        resultMessage = new AIMessage({
          content:
            typeof result.content === 'string'
              ? result.content
              : JSON.stringify(result.content),
          tool_calls: undefined, // AIMessage constructor handles optional tool_calls
          additional_kwargs: {
            from: 'hybrid-agent',
            ...(result.additional_kwargs || {}), // Preserve other kwargs
          },
        });
      }

      const contentToCheck =
        typeof resultMessage.content === 'string'
          ? resultMessage.content.trim()
          : JSON.stringify(resultMessage.content || '');

      if (contentToCheck && contentToCheck !== '') {
        const content =
          typeof resultMessage.content === 'string'
            ? resultMessage.content
            : JSON.stringify(resultMessage.content);

        logger.info(`Agent Response:\n\n${formatAgentResponse(content)}`);

        if (!resultMessage.additional_kwargs) {
          resultMessage.additional_kwargs = {};
        }
        resultMessage.additional_kwargs.logged = true;
      }

      if (resultMessage.tool_calls && resultMessage.tool_calls.length > 0) {
        logger.info(
          `Hybrid agent: Tool calls: ${resultMessage.tool_calls.length} calls - [${resultMessage.tool_calls
            .map((call) => call.name)
            .join(', ')}]`
        );
      }

      // Check if we need to wait for human input
      const content =
        typeof resultMessage.content === 'string' ? resultMessage.content : '';
      const waitForInput = content.includes('WAITING_FOR_HUMAN_INPUT:');

      // Check if it's a final answer
      const isFinal = content.includes('FINAL ANSWER:');

      if (waitForInput) {
        logger.debug(`Hybrid agent: Detected request for human input`);
        resultMessage.additional_kwargs = {
          ...resultMessage.additional_kwargs,
          wait_for_input: true,
        };
      }

      if (isFinal) {
        logger.debug(`Hybrid agent: Detected final answer`);
        resultMessage.additional_kwargs = {
          ...resultMessage.additional_kwargs,
          final: true,
        };
      }

      return {
        messages: [resultMessage],
        waiting_for_input: waitForInput,
        iterations: currentIteration + 1,
      };
    }

    /**
     * Determines the next step in the agent's workflow based on the last message and current state.
     * @param state - The current state of the graph.
     * @returns A string indicating the next node to transition to: 'human_input', 'tools', 'agent', or 'end'.
     */
    function shouldContinue(state: typeof GraphState.State) {
      const lastMessage = state.messages[state.messages.length - 1];

      if (state.waiting_for_input) {
        logger.debug(
          `Hybrid agent: Waiting for human input, routing to human_input node`
        );
        return 'human_input';
      }

      if (lastMessage instanceof AIMessage && lastMessage.tool_calls?.length) {
        logger.debug(`Hybrid agent: Routing to tools node`);
        return 'tools';
      }

      if (
        lastMessage instanceof AIMessage &&
        typeof lastMessage.content === 'string' &&
        lastMessage.content.includes('FINAL ANSWER:') &&
        !lastMessage.additional_kwargs?.processed_final_answer
      ) {
        logger.debug(
          `Hybrid agent: Detected "FINAL ANSWER" in message content`
        );

        if (!lastMessage.additional_kwargs) {
          lastMessage.additional_kwargs = {};
        }

        lastMessage.additional_kwargs.final_answer = true;
        lastMessage.additional_kwargs.processed_final_answer = true;

        logger.debug(
          `Hybrid agent: Marked message with final_answer flag for processing`
        );
        return 'agent';
      }

      if (
        lastMessage instanceof AIMessage &&
        lastMessage.additional_kwargs?.final === true
      ) {
        logger.debug(`Hybrid agent: Final message detected, ending execution`);
        return 'end';
      }

      logger.debug(`Hybrid agent: Routing back to agent node`);
      return 'agent';
    }

    // Build the workflow
    const workflow = new StateGraph(GraphState)
      .addNode('agent', callModel)
      .addNode('tools', toolNode)
      .addNode('human_input', humanInputNode);

    workflow.setEntryPoint('agent');

    // Connect the nodes
    workflow.addConditionalEdges('agent', shouldContinue, {
      tools: 'tools',
      human_input: 'human_input',
      agent: 'agent', // Allows re-prompting or continuing if no tools/human input
      end: '__end__',
    });

    workflow.addEdge('tools', 'agent');
    workflow.addEdge('human_input', 'agent');

    // Compile with checkpointer for interruption support
    const checkpointer = new MemorySaver();
    const app = workflow.compile({ checkpointer });

    return {
      app,
      agent_config,
      maxIteration: agent_config.maxIteration || 50,
    };
  } catch (error) {
    logger.error('Failed to create hybrid agent:', error, {
      agentName: agent_config?.name || 'unknown',
      errorDetails: error instanceof Error ? error.stack : undefined,
    });

    const enhancedError = new Error(
      `Failed to create hybrid agent: ${error instanceof Error ? error.message : String(error)}`
    );

    if (error instanceof Error) {
      (enhancedError as any).cause = error;
    }
    throw enhancedError;
  }
};
