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
  Agent,
  ParsedPlan,
  StepInfo,
  ValidatorStepResponse,
} from './types/index.js';
import { logger } from '@snakagent/core';
import { z } from 'zod';

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

// --- Response Generators ---
export function createMaxIterationsResponse(graph_step: number): {
  messages: BaseMessage;
  last_message: BaseMessage;
  last_agent: Agent;
} {
  const message = new AIMessageChunk({
    content: `Reaching maximum iterations for interactive agent. Ending workflow.`,
    additional_kwargs: {
      final: true,
      graph_step: graph_step,
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
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    // Handle iteration filtering
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

  if (isTokenLimitError(error)) {
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
        if (step.type === 'tools') {
          total_tokens += step.result.tokens;
        } else {
          total_tokens;
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

export function generateShortTermMemoryMesage(plan: ParsedPlan): string {
  try {
    const result = plan.steps.map((s: StepInfo) => {
      if (s.status != 'completed') {
        return "";
      }
      `Q:`
    });
  } catch (error) {
    throw error;
  }
}

export const tools_call = z.object({
  description: z
    .string()
    .describe(
      'Tool execution details: what it does, parameters used, and configuration'
    ),
  required: z
    .string()
    .describe(
      'Required inputs and their sources (e.g., "user query, step 2 filters")'
    ),
  expected_result: z.string().describe('Expected output data.'),
});

export const resultSchema = z.object({
  content: z
    .string()
    .describe(
      'Output content placeholder - empty during planning, populated during execution'
    )
    .default(''),
  token: z
    .number()
    .describe('Ouput Token Count - empty during planning')
    .default(0),
});

export const StepInfoSchema = z.object({
  stepNumber: z
    .number()
    .int()
    .min(1)
    .max(100)
    .describe('Execution order (1-100)'),
  stepName: z
    .string()
    .min(1)
    .max(200)
    .describe('Action-oriented step title under 200 chars'),
  description: z
    .string()
    .describe(
      'Full step details: objective, inputs/sources, methodology, outputs, success criteria'
    ),
  type: z
    .enum(['tools', 'message', 'human_in_the_loop'])
    .describe(
      'Step type: tools (automated), message (AI processing), human_in_the_loop (human input)'
    ),

  tools: z
    .array(tools_call)
    .optional()
    .describe(
      'Parallel tool executions (only for type="tools"). Must be independent'
    ),
  status: z
    .enum(['pending', 'completed', 'failed'])
    .default('pending')
    .describe('Execution state of this step'),
  result: resultSchema
    .describe(
      'Output placeholder - empty during planning, populated during execution'
    )
    .default({ content: '', token: 0 }),
});

export const PlanSchema = z.object({
  steps: z
    .array(StepInfoSchema)
    .min(1)
    .max(20)
    .describe('Executable workflow steps (1-20) with clear dependencies'),
  summary: z
    .string()
    .describe('Plan overview: objectives, approach, outcomes (max 300 chars)'),
});
