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
  History,
  HistoryItem,
  ParsedPlan,
  ReturnTypeCheckPlanorHistory,
  ErrorContext,
  StepInfo,
} from '../../../shared/types/index.js';
import { logger } from '@snakagent/core';
import { Command } from '@langchain/langgraph';

// --- Format Functions ---
export function formatParsedPlanSimple(plan: ParsedPlan): string {
  let formatted = `Plan Summary: ${plan.summary}\n\n`;
  formatted += `Steps (${plan.steps.length} total):\n`;

  plan.steps.forEach((step) => {
    // Format principal de l'étape
    formatted += `${step.stepNumber}. ${step.stepName} [${step.type}] - ${step.status}\n`;
    formatted += `   Description: ${step.description}\n`;

    // Si c'est une étape tools, afficher les détails des outils
    if (step.type === 'tools' && step.tools && step.tools.length > 0) {
      formatted += `   Tools:\n`;
      step.tools.forEach((tool, index) => {
        formatted += `   - Tool ${index + 1}:\n`;
        formatted += `     • Description: ${tool.description}\n`;
        formatted += `     • Required: ${tool.required}\n`;
        formatted += `     • Expected Result: ${tool.expected_result}\n`;
      });
    }

    formatted += '\n';
  });

  return formatted;
}

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

// --- Terminal State Checks ---
export function isTerminalMessage(message: BaseMessage): boolean {
  return (
    message.additional_kwargs.final === true ||
    message.content.toString().includes('FINAL ANSWER') ||
    message.content.toString().includes('PLAN_COMPLETED')
  );
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

export function calculateTotalTokenFromSteps(steps: StepInfo[]): number {
  try {
    let total_tokens: number = 0;
    for (const step of steps) {
      if (step.status === 'completed') {
        if (step.type != 'tools') {
          // Skip tool steps for token calculation
        }
        total_tokens += estimateTokens(step.description);
        total_tokens += estimateTokens(step.stepName);
      }
    }
    return total_tokens;
  } catch (error) {
    throw error;
  }
}

// Mode-specific utility functions - no more complex branching

export const getCurrentPlanStep = (
  plans_or_histories: Array<ParsedPlan | History> | undefined,
  currentTaskIndex: number
): StepInfo | null => {
  try {
    if (!plans_or_histories || plans_or_histories.length === 0) {
      throw new Error('No plan available');
    }

    const latest = plans_or_histories[plans_or_histories.length - 1];
    if (latest.type !== 'plan') {
      throw new Error('Current execution is not in plan mode');
    }

    if (currentTaskIndex < 0 || currentTaskIndex >= latest.steps.length) {
      throw new Error(`Invalid step index: ${currentTaskIndex}`);
    }

    return latest.steps[currentTaskIndex];
  } catch (error) {
    logger.error(`Error retrieving plan step: ${error}`);
    throw error;
  }
};

export const getCurrentHistoryItem = (
  plans_or_histories: Array<ParsedPlan | History> | undefined
): HistoryItem | null => {
  try {
    if (!plans_or_histories || plans_or_histories.length === 0) {
      return null;
    }

    const latest = plans_or_histories[plans_or_histories.length - 1];
    if (latest.type !== 'history') {
      throw new Error('Current execution is not in history mode');
    }

    if (latest.items.length === 0) {
      return null;
    }

    return latest.items[latest.items.length - 1];
  } catch (error) {
    logger.error(`Error retrieving history item: ${error}`);
    return null;
  }
};

export const getCurrentPlan = (
  plans_or_histories: Array<ParsedPlan | History> | undefined
): ParsedPlan | null => {
  if (!plans_or_histories || plans_or_histories.length === 0) {
    return null;
  }

  const latest = plans_or_histories[plans_or_histories.length - 1];
  return latest.type === 'plan' ? latest : null;
};

export const getCurrentHistory = (
  plans_or_histories: Array<ParsedPlan | History> | undefined
): History | null => {
  if (!plans_or_histories || plans_or_histories.length === 0) {
    return null;
  }

  const latest = plans_or_histories[plans_or_histories.length - 1];
  return latest.type === 'history' ? latest : null;
};

export const checkAndReturnLastItemFromPlansOrHistories = (
  plans_or_histories: Array<ParsedPlan | History> | undefined,
  currentTaskIndex: number
): ReturnTypeCheckPlanorHistory => {
  try {
    if (!plans_or_histories || plans_or_histories.length === 0) {
      throw new Error('No plan or history available');
    }

    const latest = plans_or_histories[plans_or_histories.length - 1];
    if (latest.type === 'plan') {
      if (
        currentTaskIndex === undefined ||
        currentTaskIndex < 0 ||
        currentTaskIndex > latest.steps.length
      ) {
        throw new Error('Invalid current step index');
      }
      return { type: 'step', item: latest.steps[currentTaskIndex] };
    } else if (latest.type === 'history') {
      if (latest.items.length === 0) {
        logger.debug('No history items available');
        return { type: 'history', item: null };
      }
      return { type: 'history', item: latest.items[latest.items.length - 1] };
    } else {
      throw new Error('Unknown type in plan or history');
    }
  } catch (error) {
    logger.error(`Error retrieving last item: ${error}`);
    throw error;
  }
};
export const checkAndReturnObjectFromPlansOrHistories = (
  plans_or_histories: Array<ParsedPlan | History> | undefined
): ParsedPlan | History => {
  try {
    if (!plans_or_histories || plans_or_histories.length === 0) {
      throw new Error('No plan or history available');
    }

    const latest = plans_or_histories[plans_or_histories.length - 1];
    if (latest.type === 'plan') {
      return latest;
    } else if (latest.type === 'history') {
      return latest;
    } else {
      throw new Error('Unknown type in plan or history');
    }
  } catch (error) {
    logger.error(`Error retrieving last item: ${error}`);
    throw error;
  }
};

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
  const fullMessage = additionalContext
    ? `${error.message} - Context: ${additionalContext}`
    : error.message;

  const enhancedError = new Error(fullMessage);
  enhancedError.stack = error.stack;

  return createErrorCommand(enhancedError, source, {
    currentGraphStep: state?.currentGraphStep ? state.currentGraphStep + 1 : 0,
  });
}
