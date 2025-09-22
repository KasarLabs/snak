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
import { ErrorContext, TaskType } from '../../../shared/types/index.js';
import { AgentConfig, logger } from '@snakagent/core';
import { Command } from '@langchain/langgraph';
import { RunnableConfig } from '@langchain/core/runnables';
import { GraphConfigurableAnnotation, GraphState } from '../graph.js';

// --- Response Generators ---
export function createMaxIterationsResponse<T>(
  graph_step: number,
  current_node: T
): {
  messages: BaseMessage[];
  last_node: T;
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
    last_node: current_node,
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
  error: Error,
  source: string,
  additionalUpdates?: Record<string, any>
): Command {
  const errorContext: ErrorContext = {
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
  error: Error,
  source: string,
  state?: any,
  additionalContext?: string
): Command {
  // Avoid redundant context if additionalContext is same as error message
  const fullMessage = additionalContext && additionalContext !== error.message
    ? `${error.message} - Context: ${additionalContext}`
    : error.message;

  const enhancedError = new Error(fullMessage);
  enhancedError.stack = error.stack;

  return createErrorCommand(enhancedError, source, {
    currentGraphStep: state?.currentGraphStep ? state.currentGraphStep + 1 : 0,
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
    throw error; // Propaged error to be handled by caller
  }
}
