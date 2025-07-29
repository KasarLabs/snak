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
import { Agent, ParsedPlan, ValidatorStepResponse } from './interactive.js';
import { logger } from 'starknet';

// --- Format Functions ---
export function formatParsedPlanSimple(plan: ParsedPlan): string {
  let formatted = `Plan Summary: ${plan.summary}\n\n`;
  formatted += `Steps (${plan.steps.length} total):\n`;

  plan.steps.forEach((step) => {
    const status =
      step.status === 'completed' ? '✓' : step.status === 'failed' ? '✗' : '○';
    formatted += `${status} ${step.stepNumber}. ${step.stepName} - ${step.description}\n`;
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
    return `✅ Complete (${validated.length}/${total})`;
  }

  return `📋 Progress: [${validated.join(',')}] ➡️ Step ${response.nextSteps}`;
}

// --- Iteration Management ---
export function calculateIterationNumber(
  messages: BaseMessage[],
  lastMessage: BaseMessage
): number {
  let iteration_number = 0;

  if (lastMessage instanceof ToolMessage) {
    logger.debug('Executor: ToolMessage Detected');
    const lastMessageAi = getLatestMessageForMessage(messages, AIMessageChunk);
    if (!lastMessageAi) {
      throw new Error('Executor: Error trying to get latest AI Message Chunk');
    }
    iteration_number =
      (lastMessageAi.additional_kwargs.iteration_number as number) || 0;
  } else if (lastMessage instanceof AIMessageChunk) {
    iteration_number =
      (lastMessage.additional_kwargs.iteration_number as number) || 0;
  }

  return iteration_number;
}

// --- Response Generators ---
export function createMaxIterationsResponse(iteration_number: number): {
  messages: BaseMessage[];
  last_agent: Agent;
} {
  return {
    messages: [
      new AIMessageChunk({
        content: `Reaching maximum iterations for interactive agent. Ending workflow.`,
        additional_kwargs: {
          final: true,
          iteration_number: iteration_number,
        },
      }),
    ],
    last_agent: Agent.EXECUTOR,
  };
}

// --- Message Utilities ---
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
export function getLatestMessageForMessage(
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
    logger.error(`Helper: Error in getLatestMessageForMessage - ${error}`);
    throw error;
  }
}

// --- FILTER --- ///
export function filterMessagesByShortTermMemory(
  messages: BaseMessage[],
  iteration_number: number,
  shortTermMemory: number
): BaseMessage[] {
  const filteredMessages = [];
  let lastIterationCount = iteration_number - 1;
  let s_temp = shortTermMemory;

  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];

    // Skip model-selector messages
    if (
      (msg instanceof AIMessageChunk || msg instanceof ToolMessage) &&
      msg.additional_kwargs?.from === 'model-selector'
    ) {
      continue;
    }

    // Handle iteration filtering
    // TODO add checking with type of Agent
    if (lastIterationCount !== msg.additional_kwargs?.iteration_number) {
      lastIterationCount =
        (msg.additional_kwargs?.iteration_number as number) || 0;
      s_temp--;
    }

    if (s_temp === 0) break;

    filteredMessages.unshift(msg);
  }

  return filteredMessages;
}

// --- Terminal State Checks ---
export function isTerminalMessage(message: AIMessageChunk): boolean {
  return (
    message.additional_kwargs.final === true ||
    message.content.toString().includes('FINAL ANSWER') ||
    message.content.toString().includes('PLAN_COMPLETED')
  );
}

export function isTokenLimitError(error: any): boolean {
  return (
    error.message?.includes('token limit') ||
    error.message?.includes('tokens exceed') ||
    error.message?.includes('context length')
  );
}

// --- ERROR HANDLING --- //
export function handleModelError(error: any): {
  messages: BaseMessage[];
  last_agent: Agent.EXECUTOR;
} {
  logger.error(`Executor: Error calling model - ${error}`);

  if (this.isTokenLimitError(error)) {
    logger.error(
      `Executor: Token limit error during model invocation - ${error.message}`
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
      last_agent: Agent.EXECUTOR,
    };
  }

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
    last_agent: Agent.EXECUTOR,
  };
}
