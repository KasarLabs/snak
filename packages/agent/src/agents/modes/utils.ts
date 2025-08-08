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
import { Tool } from '@langchain/core/tools';

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
  result: z.string().describe('should be empty'),
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

export const ValidatorResponseSchema = z.object({
  success: z.boolean().describe('true if sucess | false if failure'),
  results: z.array(z.string()).describe('The results of the validator'),
});

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

export function formatShortMemoryMessage(plan: ParsedPlan): string {
  try {
    const result = plan.steps
      .map((step: StepInfo) => {
        if (step.status != 'completed') {
          return '';
        }
        const format_response: string[] = [];
        format_response.push(`Q: [STEP_${step.stepNumber}] ${step.stepName}`);
        format_response.push(`Type: ${step.type}`);
        format_response.push(`Description : ${step.description}`);
        if (step.type === 'tools') {
          if (step.tools && step.tools.length > 0) {
            step.tools.forEach((tool, index) => {
              const tool_desc: string = `Tools Description: [TOOLS_${index}] ${tool.description}`;
              format_response.push(tool_desc);
              const tool_result: string = `Tools Result : ${tool.result}`;
              format_response.push(tool_result);
            });
          }
        } else {
          const tool_result: string = `Message Result : ${step.result}`;
          format_response.push(tool_result);
        }
        return format_response;
      })
      .concat()
      .join('\n');
    return result;
  } catch (error) {
    throw error;
  }
}

export function formatExecutionMessage(step: StepInfo): string {
  try {
    const format_response: string[] = [];
    format_response.push(`Q: [STEP_${step.stepNumber}] ${step.stepName}`);
    format_response.push(`Type: ${step.type}`);
    format_response.push(`Description : ${step.description}`);
    if (step.type === 'tools') {
      if (step.tools && step.tools.length > 0) {
        step.tools.forEach((tool, index) => {
          const tool_desc: string = `Tools Description: [TOOLS_${index}] ${tool.description}`;
          format_response.push(tool_desc);
          const tool_required = `Tools Required Input: ${tool.required}`;
          format_response.push(tool_required);
          const tool_result = `Tool Exepected Result: ${tool.expected_result}`;
          format_response.push(tool_result);
        });
      }
    }
    return format_response.join('\n');
  } catch (error) {
    throw new error();
  }
}

export function formatToolResponse(
  messages: ToolMessage | ToolMessage[],
  step: StepInfo
): StepInfo {
  try {
    console.log(messages);
    if (step.type === 'tools' && step.tools && step.tools.length > 0) {
      if (!Array.isArray(messages)) {
        step.tools[0].result = `tool_name: ${messages.name}, tool_call_id : ${messages.id}, raw_result : ${messages.content.toLocaleString()}`;
      } else {
        if (step.tools && step.tools.length > 0) {
          messages.forEach((msg: ToolMessage, index: number) => {
            if (step.tools && step.tools[index]) {
              step.tools[index].result =
                `tool_name: ${msg.name}, tool_call_id : ${msg.id}, raw_result : ${msg.content.toLocaleString()}`;
            }
          });
        }
      }
      console.log(step);
      return step;
    } else {
      throw new Error('Wrong Message Tool to format!');
    }
  } catch (error) {
    throw error;
  }
}
export function formatValidatorToolsExecutor(step: StepInfo): string {
  try {
    const format_response: string[] = [];

    // Header section
    format_response.push(`Q: [STEP_${step.stepNumber}] ${step.stepName}`);
    format_response.push(`Type: ${step.type}`);
    format_response.push(`Description: ${step.description}`);

    if (step.type === 'tools') {
      if (step.tools && step.tools.length > 0) {
        // Tools requirements section
        format_response.push(`\n=== TOOLS REQUIREMENTS ===`);

        step.tools.forEach((tool, index) => {
          format_response.push(`\n[TOOL_${index}]`);
          format_response.push(`Description: ${tool.description}`);
          format_response.push(
            `Required Input: ${tool.required || '<NO INPUT REQUIRED>'}`
          );
          format_response.push(`Expected Result: ${tool.expected_result}`);
        });

        // Actual response section
        format_response.push(`\n=== ACTUAL RESPONSE ===`);
        format_response.push(step.result.content);
      }
    }

    console.log(format_response.join('\n'));
    return format_response.join('\n');
  } catch (error) {
    throw error;
  }
}
