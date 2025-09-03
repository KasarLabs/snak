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
  StepInfo,
  StepToolsInfo,
  ValidatorStepResponse,
  HistoryToolsInfo,
} from '../../types/memory.types.js';
import { logger } from '@snakagent/core';
import { Command } from '@langchain/langgraph';
import { memory } from '@snakagent/database/queries';

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

export function formatStepsStatusCompact(
  response: ValidatorStepResponse
): string {
  const validated = response.steps
    .filter((s) => s.validated)
    .map((s) => s.number);
  const total = response.steps.length;

  if (response.isFinal) {
    return `Complete (${validated.length}/${total})`;
  }

  return `Progress: [${validated.join(',')}] -> Step ${response.nextSteps}`;
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

export function formatExecutionMessage(step: StepInfo): string {
  try {
    const format_response: string[] = [];
    format_response.push(`S${step.stepNumber}:${step.stepName}`);
    format_response.push(`Type: ${step.type}`);
    format_response.push(`Description: ${step.description}`);
    if (step.type === 'tools') {
      if (step.tools && step.tools.length > 0) {
        step.tools.forEach((tool, index) => {
          const tool_desc: string = `T${index}:${tool.description}`;
          format_response.push(tool_desc);
          const tool_required = `Required: ${tool.required}`;
          format_response.push(tool_required);
          const tool_result = `Expected: ${tool.expected_result}`;
          format_response.push(tool_result);
        });
      }
    }
    return format_response.join('\n');
  } catch (error) {
    throw new Error('Failed to format execution message');
  }
}

// Mode-specific tool formatting functions
export function formatToolsForPlan(
  messages: ToolMessage | ToolMessage[],
  currentStep: StepInfo
): StepToolsInfo[] {
  try {
    const tools = currentStep.tools || [];
    const msgArray = Array.isArray(messages) ? messages : [messages];

    msgArray.forEach((msg: ToolMessage, index: number) => {
      if (tools[index]) {
        tools[index].result = msg.content.toString();
        tools[index].metadata = {
          tool_name: msg.name || '',
          tool_call_id: msg.tool_call_id || '',
          timestamp: new Date(Date.now()).toISOString(),
        };
      }
    });

    return tools;
  } catch (error) {
    logger.error(`Error formatting tools for plan: ${error}`);
    throw error;
  }
}

export function formatToolsForHistory(
  messages: ToolMessage | ToolMessage[]
): HistoryToolsInfo[] {
  try {
    const msgArray = Array.isArray(messages) ? messages : [messages];

    return msgArray.map((msg: ToolMessage) => ({
      result: msg.content.toString(),
      metadata: {
        tool_name: msg.name || '',
        tool_call_id: msg.tool_call_id || '',
        timestamp: new Date(Date.now()).toISOString(),
      },
    }));
  } catch (error) {
    logger.error(`Error formatting tools for history: ${error}`);
    throw error;
  }
}

export function formatToolResponse(
  messages: ToolMessage | ToolMessage[],
  currentItem: ReturnTypeCheckPlanorHistory
): StepToolsInfo[] | HistoryToolsInfo[] {
  try {
    if (currentItem.type === 'history') {
      return formatToolsForHistory(messages);
    } else {
      return formatToolsForPlan(messages, currentItem.item);
    }
  } catch (error) {
    logger.error(`Error formatting tool response: ${error}`);
    throw error;
  }
}

export function formatValidatorToolsExecutor(
  item: ReturnTypeCheckPlanorHistory
): string {
  try {
    if (!item.item) {
      console.log('Item is empty');
      return '';
    }
    console.log(item.item);
    const header =
      item.type === 'step'
        ? `S${item.item.stepNumber}:${item.item.stepName}\nD:${item.item.description}`
        : `Q:${new Date(item.item.timestamp).toISOString()}\nD:History Item`;

    if (
      item.type === 'step' &&
      item.item.type === 'tools' &&
      item.item.tools &&
      item.item.tools.length > 0
    ) {
      // For tool steps, include tool info and results
      const toolInfo = item.item.tools
        .map(
          (t, i) =>
            `T${i + 1}:${t.description}\n Result: \`\`\`json ${JSON.stringify({ tool_name: t.metadata?.tool_name, tools_call_id: t.metadata?.tool_call_id, tool_result: t.result })}\`\`\``
        )
        .join('|');
      return `${header}[${toolInfo}]`;
    } else if (
      item.type === 'history' &&
      item.item.type === 'tools' &&
      item.item.tools &&
      item.item.tools.length > 0
    ) {
      const toolInfo = item.item.tools
        .map(
          (t, i) =>
            `T${i + 1}:Result: \`\`\`json ${JSON.stringify({ tool_name: t.metadata?.tool_name, tools_call_id: t.metadata?.tool_call_id, tool_result: t.result })}\`\`\``
        )
        .join('|');
      return `${header}[${toolInfo}]`;
    }
    if (!item.item.message) {
      // For non-tool steps, just show result
      throw new Error('Message content is missing');
    }
    return `${header}→${item.item.message.content}`;
  } catch (error) {
    return `formatValidatorToolsExecutor: ${error}`;
  }
}

export function formatStepsForContext(
  steps: Array<StepInfo | HistoryItem>
): string {
  try {
    return steps
      .map((step) => formatSteporHistoryForSTM(step)) // Arrow function returns implicitly
      .join('\n');
  } catch (error) {
    return `formatStepsForContext: ${error}`;
  }
}

export function formatSteporHistoryForSTM(
  item: StepInfo | HistoryItem
): string {
  try {
    if ('stepNumber' in item === false) {
      // HistoryItem
      const header = `ReAct Step : ${item.message ? item.message.content : 'No Message'}\n at ${new Date(item.timestamp).toISOString()}`; // HistoryItem
      if (item.type === 'tools' && item.tools && item.tools.length > 0) {
        const toolInfo = item.tools
          .map((t, i) => `T${i}:${t.metadata?.tool_name}->${t.result}`)
          .join('|');
        return `${header}[${toolInfo}]`;
      }
      if (!item.message) {
        throw new Error('Message content is missing in HistoryItem');
      }
      return `${header}→${item.message.content}`;
    }
    const header = `S${item.stepNumber}:${item.stepName}`; // StepInfo
    if (item.type === 'tools' && item.tools && item.tools.length > 0) {
      const toolInfo = item.tools
        .map((t, i) => `T${i}:${t.description}->${t.result}`)
        .join('|');
      return `${header}[${toolInfo}]`;
    }
    if (!item.message) {
      throw new Error('Message content is missing in StepInfo');
    }
    return `${header}→${item.message.content}`;
  } catch (error) {
    return `formatSteporHistoryForSTM: ${error}`;
  }
}

export type ReturnTypeCheckPlanorHistory =
  | { type: 'step'; item: StepInfo }
  | { type: 'history'; item: HistoryItem | null };

// Mode-specific utility functions - no more complex branching

export const getCurrentPlanStep = (
  plans_or_histories: Array<ParsedPlan | History> | undefined,
  currentStepIndex: number
): StepInfo | null => {
  try {
    if (!plans_or_histories || plans_or_histories.length === 0) {
      throw new Error('No plan available');
    }

    const latest = plans_or_histories[plans_or_histories.length - 1];
    if (latest.type !== 'plan') {
      throw new Error('Current execution is not in plan mode');
    }

    if (currentStepIndex < 0 || currentStepIndex >= latest.steps.length) {
      throw new Error(`Invalid step index: ${currentStepIndex}`);
    }

    return latest.steps[currentStepIndex];
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
  currentStepIndex: number
): ReturnTypeCheckPlanorHistory => {
  try {
    if (!plans_or_histories || plans_or_histories.length === 0) {
      throw new Error('No plan or history available');
    }

    const latest = plans_or_histories[plans_or_histories.length - 1];
    if (latest.type === 'plan') {
      if (
        currentStepIndex === undefined ||
        currentStepIndex < 0 ||
        currentStepIndex > latest.steps.length
      ) {
        throw new Error('Invalid current step index');
      }
      return { type: 'step', item: latest.steps[currentStepIndex] };
    } else if (latest.type === 'history') {
      if (latest.items.length === 0) {
        console.log('No history items available');
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

// --- ERROR HANDLING --- //
export interface ErrorContext {
  hasError: boolean;
  message: string;
  source: string;
  timestamp: number;
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
  const fullMessage = additionalContext
    ? `${error.message} - Context: ${additionalContext}`
    : error.message;

  const enhancedError = new Error(fullMessage);
  enhancedError.stack = error.stack;

  return createErrorCommand(enhancedError, source, {
    currentGraphStep: state?.currentGraphStep ? state.currentGraphStep + 1 : 0,
  });
}

// --- LTM PARSING --- //

export function formatLTMForContext(ltmItems: memory.Similarity[]): string {
  try {
    if (!ltmItems || ltmItems.length === 0) {
      return 'No long-term memories available';
    }

    const formatted_memories: string[] = [];

    ltmItems.forEach((memory, index) => {
      const type_prefix = memory.memory_type === 'episodic' ? 'E' : 'S';
      const similarity_score = `(${(memory.similarity * 100).toFixed(1)}%)`;
      const content = memory.content.substring(0, 120);

      // Extract key metadata context
      let metadata_context = '';
      if (memory.metadata) {
        const parts = [];
        if (memory.metadata.category)
          parts.push(`category:${memory.metadata.category}`);
        if (memory.metadata.confidence)
          parts.push(`confidence:${memory.metadata.confidence}`);
        if (memory.metadata.access_count)
          parts.push(`access_count:${memory.metadata.access_count}`);
        if (parts.length > 0) {
          metadata_context = `[${parts.join('|')}]`;
        }
      }

      formatted_memories.push(
        `${type_prefix}${index + 1}:${similarity_score}${metadata_context}→${content}...`
      );
    });

    return formatted_memories.join('\n');
  } catch (error) {
    return `formatLTMForContext: ${error}`;
  }
}

// --- EVOLVE FROM HISTORY PARSING --- //

export function parseEvolveFromHistoryContext(
  plans_or_histories: Array<ParsedPlan | History> | undefined
): string {
  try {
    if (!plans_or_histories || plans_or_histories.length === 0) {
      return 'No execution history available for evolution';
    }

    const chronological_context: string[] = [];
    chronological_context.push('CHRONOLOGICAL EXECUTION HISTORY:');
    chronological_context.push('');

    // Process in chronological order (as they appear in the array)
    plans_or_histories.forEach((item, index) => {
      if (item.type === 'plan') {
        const completed = item.steps.filter(
          (s) => s.status === 'completed'
        ).length;
        chronological_context.push(`${index + 1}. PLAN: ${item.summary}`);
        chronological_context.push(
          `   Status: ${completed}/${item.steps.length} steps completed`
        );

        // Show recent completed steps
        const recentCompleted = item.steps.filter(
          (s) => s.status === 'completed'
        );
        recentCompleted.forEach((step) => {
          chronological_context.push(
            `   → ${step.stepName}: ${step.description.substring(0, 80)}...`
          );
        });
      } else if (item.type === 'history') {
        chronological_context.push(
          `${index + 1}. HISTORY: ${item.items.length} interactions`
        );

        // Show recent history items
        const recentItems = item.items;
        recentItems.forEach((historyItem) => {
          const content =
            historyItem.message?.content ||
            historyItem.userquery ||
            'No content';
          chronological_context.push(`   → ${content.substring(0, 80)}...`);
        });
      }
      chronological_context.push('');
    });

    // Current state (last item in chronological order)
    const latest = plans_or_histories[plans_or_histories.length - 1];
    chronological_context.push('CURRENT STATE:');
    if (latest.type === 'plan') {
      const lastStep = latest.steps[latest.steps.length - 1];
      chronological_context.push(
        `Mode: PLAN | Last Step: ${lastStep?.stepName || 'None'} (${lastStep?.status || 'pending'})`
      );
    } else {
      chronological_context.push(
        `Mode: HISTORY | Total Interactions: ${latest.items.length}`
      );
    }

    return chronological_context.join('\n');
  } catch (error) {
    logger.error(`Error parsing evolve from history context: ${error}`);
    return `Error parsing chronological history: ${error}`;
  }
}
