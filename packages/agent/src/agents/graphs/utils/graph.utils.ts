// ============================================
// UTILITY FUNCTIONS
// ============================================

import {
  AIMessage,
  AIMessageChunk,
  BaseMessage,
  HumanMessage,
  ToolMessage,
} from '@langchain/core/messages';
import {
  GraphErrorType,
  GraphErrorTypeEnum,
  StateErrorHandlerType,
  TaskType,
} from '../../../shared/types/index.js';
import { AgentConfig, logger } from '@snakagent/core';
import { Command, Graph, StateSnapshot, task } from '@langchain/langgraph';
import { RunnableConfig } from '@langchain/core/runnables';
import {
  GraphConfigurableAnnotation,
  GraphState,
  GraphStateType,
} from '../core-graph/agent.graph.js';
import { ToolCallChunk, ToolCall } from '@langchain/core/messages/tool';
import { v4 as uuidv4 } from 'uuid';
import {
  HITL_CONSTRAINT_LEVEL_0,
  HITL_CONSTRAINT_LEVEL_1,
  HITL_CONSTRAINT_LEVEL_2,
  HITL_CONSTRAINT_LEVEL_3,
  HITL_CONSTRAINT_LEVEL_4,
} from '@prompts/agents/snak/hitl/hitl-contraint.prompt.js';
// --- Response Generators ---
export function createMaxIterationsResponse<T>(
  graph_step: number,
  current_node: T
): {
  messages: BaseMessage[];
  lastNode: T;
} {
  const message = new AIMessageChunk({
    content: `Reaching maximum iterations for interactive agent. Ending workflow.`,
    additional_kwargs: {
      final: true,
      graph_step: graph_step,
    },
  });
  return {
    messages: [message],
    lastNode: current_node,
  };
}

// --- Message Utilities ---
/**
 * Generic type-safe message finder implementation
 * Provides proper type narrowing for message retrieval
 * @param messages - Array of base messages to search through
 * @param MessageClass - Constructor function for the specific message type
 * @returns The most recent message of the specified type or null
 */
function getLatestMessageForMessageImpl<T extends BaseMessage>(
  messages: BaseMessage[],
  MessageClass: new (...args: unknown[]) => T
): T | null {
  try {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i] instanceof MessageClass) {
        return messages[i] as T;
      }
    }
    return null;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    logger.error(
      `Helper: Error in getLatestMessageForMessage - ${errorMessage}`
    );
    throw error;
  }
}

// Implementation for each overload using the generic function
export function getLatestMessageForMessage(
  messages: BaseMessage[],
  MessageClass: typeof ToolMessage
): ToolMessage | null;
export function getLatestMessageForMessage(
  messages: BaseMessage[],
  MessageClass: typeof AIMessageChunk
): AIMessageChunk | null;
export function getLatestMessageForMessage(
  messages: BaseMessage[],
  MessageClass: typeof AIMessage
): AIMessage | null;
export function getLatestMessageForMessage(
  messages: BaseMessage[],
  MessageClass: typeof HumanMessage
): HumanMessage | null;
export function getLatestMessageForMessage<T extends BaseMessage>(
  messages: BaseMessage[],
  MessageClass: new (...args: unknown[]) => T
): T | null {
  return getLatestMessageForMessageImpl(messages, MessageClass);
}

/**
 * Type-safe error checking for token limit errors
 * Validates if an error is related to token limits without using any
 * @param error - Error to check, can be Error instance or unknown type
 * @returns true if the error indicates a token limit issue
 */
export function isTokenLimitError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  return (
    error.message?.includes('token limit') ||
    error.message?.includes('tokens exceed') ||
    error.message?.includes('context length')
  );
}

// --- TOKEN CALCULATE --- //

export function estimateTokens(text: string): number {
  const charCount = text.length;

  const wordCount = text.split(/\s+/).filter((word) => word.length > 0).length;

  const estimatedTokens = Math.ceil((charCount / 4 + wordCount) / 2);

  return estimatedTokens;
}

export function createErrorCommand(
  type: GraphErrorTypeEnum,
  error: Error,
  source: string,
  additionalUpdates?: Record<string, any>
): Command {
  const errorContext: GraphErrorType = {
    type: type,
    hasError: true,
    message: error.message,
    source,
    timestamp: Date.now(),
  };

  logger.error(`[${source}] Error occurred: ${error.message}`, error);

  const updates = {
    error: errorContext,
    skipValidation: { skipValidation: true, goto: 'end_graph' },
    ...additionalUpdates,
  };

  return new Command({
    update: updates,
    goto: 'end_graph',
    graph: Command.PARENT,
  });
}

export function handleNodeError(
  type: GraphErrorTypeEnum,
  error: Error,
  source: string,
  state?: StateErrorHandlerType,
  additionalContext?: string
): Command {
  // Avoid redundant context if additionalContext is same as error message
  const fullMessage =
    additionalContext && additionalContext !== error.message
      ? `${error.message} - Context: ${additionalContext}`
      : error.message;

  const enhancedError = new Error(fullMessage);
  enhancedError.stack = error.stack;

  return createErrorCommand(type, enhancedError, source, {
    currentGraphStep: state?.currentGraphStep ? state.currentGraphStep + 1 : 0,
    ...state?.additionalUpdates,
  });
}

export function handleEndGraph(
  source: string,
  state?: StateErrorHandlerType,
  successMessage?: string,
  additionalUpdates?: Record<string, any>
): Command {
  const message = successMessage || 'Graph execution completed successfully';

  logger.info(`[${source}] ${message}`);

  const updates = {
    error: null,
    skipValidation: { skipValidation: true, goto: 'end_graph' },
    currentGraphStep: state?.currentGraphStep ? state.currentGraphStep + 1 : 0,
    ...state?.additionalUpdates,
  };

  return new Command({
    update: updates,
    goto: 'end_graph',
    graph: Command.PARENT,
  });
}

export type isValidConfigurationType = {
  isValid: boolean;
  error?: string;
};
export function isValidConfiguration(
  config: RunnableConfig<typeof GraphConfigurableAnnotation.State>
): isValidConfigurationType {
  try {
    if (!config) {
      return { isValid: false, error: 'Configuration object is missing.' };
    }
    if (!config.configurable?.agent_config) {
      return { isValid: false, error: 'Agent configuration is missing.' };
    }
    return { isValid: true };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Helper: Error in isValidConfiguration - ${errorMessage}`);
    return { isValid: false, error: errorMessage };
  }
}

export function hasReachedMaxSteps(
  currentStep: number,
  config: AgentConfig.Runtime
): boolean {
  const max_steps = config.graph.max_steps;
  return currentStep >= max_steps;
}

export function getCurrentTask(tasks: TaskType[]): TaskType {
  try {
    const currentTask = tasks[tasks.length - 1];
    if (!currentTask) {
      throw new Error('No current task found in tasks list');
    }
    return currentTask;
  } catch (error) {
    throw error; // Propagated error to be handled by caller
  }
}

export function getRetrieveMemoryRequestFromGraph(
  state: GraphStateType,
  config: RunnableConfig<typeof GraphConfigurableAnnotation.State>
): string | null {
  try {
    // Check if we have tasks with steps
    if (
      state.tasks?.length > 0 &&
      state.tasks[state.tasks.length - 1].steps?.length > 0
    ) {
      const currentTask = getCurrentTask(state.tasks);
      const reasoning =
        currentTask.steps[currentTask.steps.length - 1]?.thought?.reasoning;

      if (!reasoning) {
        throw new Error('Current task step is missing reasoning');
      }
      return reasoning;
    }

    // Fallback to user request or objectives
    const configurable = config?.configurable;
    if (!configurable?.agent_config) {
      throw new Error('Missing agent configuration');
    }

    // Check HITL threshold for user request
    const userRequest = configurable.user_request?.request;
    if (userRequest) {
      return userRequest;
    }

    // If we get here, we have no valid request source
    throw new Error('No valid memory request source found');
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    logger.error(
      `Helper: Error in getRetrieveMemoryRequestFromGraph - ${errorMessage}`
    );
    return null;
  }
}

export function GenerateToolCallFromToolCallChunks(
  toolCallChunks: ToolCallChunk[]
): ToolCall[] {
  try {
    const toolCall: Array<ToolCall> = [];
    if (!toolCallChunks || toolCallChunks.length === 0) {
      return toolCall;
    }
    toolCallChunks.forEach((tool: ToolCallChunk) => {
      if (tool) {
        if (
          !tool.name ||
          tool.index === undefined ||
          tool.index === null ||
          !tool.args
        ) {
          throw new Error(
            'Invalid tool call chunk structure expected name,args and index'
          );
        } else {
          toolCall.push({
            name: tool.name,
            args: tool.args ? JSON.parse(tool.args) : { noParams: {} },
            id: tool.id ?? uuidv4(),
            type: 'tool_call',
          });
        }
      }
    });
    return toolCall;
  } catch (error) {
    logger.error(error);
    return [];
  }
}

export function GenerateToolCallsFromMessage(
  message: AIMessageChunk
): AIMessageChunk {
  try {
    if (!message.tool_call_chunks || message.tool_call_chunks.length === 0) {
      return message;
    }
    const toolCalls = GenerateToolCallFromToolCallChunks(
      message.tool_call_chunks
    );
    message.tool_calls = toolCalls;
    const tools_name = toolCalls.map((t) => t.name);
    if (message.invalid_tool_calls && message.invalid_tool_calls.length > 0) {
      message.invalid_tool_calls = message.invalid_tool_calls.filter(
        (invalid_t) => !tools_name.includes(invalid_t.name ?? '')
      );
    }
    return message;
  } catch (error) {
    logger.error(error);
    return message;
  }
}

export function routingFromSubGraphToParentGraphEndNode(
  state: typeof GraphState.State,
  config: RunnableConfig<typeof GraphConfigurableAnnotation.State>
): Command {
  const lastNode = state.lastNode;
  logger.info(`[${lastNode}] Routing to parent graph end node`);

  return new Command({
    update: {
      skipValidation: { skipValidation: true, goto: 'end_graph' },
    },
    goto: 'end_graph',
    graph: Command.PARENT,
  });
}

export function routingFromSubGraphToParentGraphHumanHandlerNode(
  state: typeof GraphState.State,
  config: RunnableConfig<typeof GraphConfigurableAnnotation.State>
): Command {
  const lastNode = state.lastNode;
  logger.info(`[${lastNode}] Routing to parent graph human handler node`);

  return new Command({
    update: {
      skipValidation: { skipValidation: true, goto: 'human_handler' },
      lastNode: lastNode,
      currentGraphStep: state.currentGraphStep,
      tasks: state.tasks,
      messages: state.messages,
      memories: state.memories,
      rag: state.rag,
      retry: state.retry,
      error: state.error,
    },
    goto: 'human_handler',
    graph: Command.PARENT,
  });
}

export function getHITLContraintFromTreshold(threshold: number): string | null {
  if (threshold <= 0 || threshold > 1) return HITL_CONSTRAINT_LEVEL_0;
  switch (true) {
    case threshold > 0 && threshold <= 0.25:
      return HITL_CONSTRAINT_LEVEL_1;
    case threshold > 0.25 && threshold <= 0.5:
      return HITL_CONSTRAINT_LEVEL_2;
    case threshold > 0.5 && threshold < 0.75:
      return HITL_CONSTRAINT_LEVEL_3;
    case threshold >= 0.75 && threshold < 1:
      return HITL_CONSTRAINT_LEVEL_4;
    case threshold === 1:
      return 'always';
    default:
      return null;
  }
}

export function isInterrupt(stateSnapshot: StateSnapshot): boolean {
  if (
    stateSnapshot.tasks?.length > 0 &&
    stateSnapshot.tasks[0]?.interrupts?.length > 0
  ) {
    const interrupt = stateSnapshot.tasks[0].interrupts[0];
    logger.info(`[SnakAgent] Interrupt detected: ${interrupt?.value}`);
    return true;
  }
  return false;
}

export function getInterruptCommand(request: string): Command {
  const command = new Command({
    resume: request,
  });
  return command;
}
