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
import { Agent, ParsedPlan, ValidatorStepResponse } from './types/index.js';
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
  messages: BaseMessage;
  last_message: BaseMessage;
  last_agent: Agent;
} {
  const message = new AIMessageChunk({
    content: `Reaching maximum iterations for interactive agent. Ending workflow.`,
    additional_kwargs: {
      final: true,
      iteration_number: iteration_number,
    },
  });
  return {
    messages: message,
    last_message: message,
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
  shortTermMemory: number
): BaseMessage[] {
  const filteredMessages = [];
  const iterationAgent = [
    Agent.EXECUTOR,
    Agent.PLANNER,
    Agent.ADAPTIVE_PLANNER,
    Agent.TOOLS,
    Agent.SUMMARIZE,
  ];
  const m_length = messages.length - 1;
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    // Handle iteration filtering
    // TODO add checking with type of Agent
    if (
      iterationAgent.includes(msg.additional_kwargs.from as Agent) ||
      msg instanceof HumanMessage ||
      msg instanceof ToolMessage
    ) {
      if (
        (msg instanceof AIMessageChunk && msg.tool_calls?.length) ||
        msg instanceof ToolMessage
      ) {
        filteredMessages.unshift(msg);
        continue;
      } else {
        filteredMessages.unshift(msg);
        shortTermMemory--;
      }
    }
    if (shortTermMemory <= 0) break;
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
  messages: BaseMessage;
  last_agent: Agent.EXECUTOR;
} {
  logger.error(`Executor: Error calling model - ${error}`);

  if (this.isTokenLimitError(error)) {
    logger.error(
      `Executor: Token limit error during model invocation - ${error.message}`
    );

    const message = new AIMessageChunk({
      content:
        'Error: The conversation history has grown too large, exceeding token limits. Cannot proceed.',
      additional_kwargs: {
        error: 'token_limit_exceeded',
        final: true,
      },
    });
    return {
      messages: message,
      last_agent: Agent.EXECUTOR,
    };
  }

  const message = new AIMessageChunk({
    content: `Error: An unexpected error occurred while processing the request. Error : ${error}`,
    additional_kwargs: {
      error: 'unexpected_error',
      final: true,
    },
  });
  return {
    messages: message,
    last_agent: Agent.EXECUTOR,
  };
}
