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
  History,
  HistoryItem,
  ParsedPlan,
  StepInfo,
  STMContext,
  StepToolsInfo,
  ValidatorStepResponse,
  HistoryToolsInfo,
} from './types/index.js';
import { logger } from '@snakagent/core';
import { late, z } from 'zod';
import { tool, Tool } from '@langchain/core/tools';

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
  tokens: z
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
  message: resultSchema
    .describe(
      'Message Output (only for type="message") - empty during planning, populated during execution'
    )
    .optional()
    .default({ content: '', tokens: 0 }),
  status: z
    .enum(['pending', 'completed', 'failed'])
    .default('pending')
    .describe('Execution state of this step'),
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

export type PlanSchemaType = z.infer<typeof PlanSchema>;

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
    return `Complete (${validated.length}/${total})`;
  }

  return `Progress: [${validated.join(',')}] -> Step ${response.nextSteps}`;
}

// --- Response Generators ---
export function createMaxIterationsResponse(graph_step: number): {
  messages: BaseMessage[];
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
    messages: [message],
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
export function isTerminalMessage(message: BaseMessage): boolean {
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
      messages: [message],
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
    messages: [message],
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
        if (step.type != 'tools') {
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
    throw new error();
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
// export function formatValidatorToolsExecutor(step: StepInfo): string {
//   try {
//     const header = `S${step.stepNumber}:${step.stepName}`;
//     const format_response: string[] = [];

//     format_response.push(header);
//     format_response.push(`Type: ${step.type}`);
//     format_response.push(`Description: ${step.description}`);

//     if (step.type === 'tools' && step.tools && step.tools.length > 0) {
//       const toolInfo = step.tools
//         .map((tool, index) => {
//           return `T${index + 1}:${tool.description}\nRequired: ${tool.required || '<NO INPUT REQUIRED>'}\n
//                   Expected: ${tool.expected_result}\nResult: ${tool.result}`;
//         })
//         .join('\n\n');

//       format_response.push(`\nTools:\n${toolInfo}`);
//     }
//     return format_response.join('\n');
//   } catch (error) {
//     throw error;
//   }
// }

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

export function formatStepsForContext(steps: StepInfo[]): string {
  try {
    return steps
      .map((step) => {
        const header = `S${step.stepNumber}:${step.stepName}`;

        if (step.type === 'tools' && step.tools && step.tools.length > 0) {
          // For tool steps, include tool info and results
          const toolInfo = step.tools
            .map((t, i) => `T${i + 1}:${t.description}->${t.result}`)
            .join('|');
          return `${header}[${toolInfo}]`;
        }

        // For non-tool steps, just show result
        if (!step.message) {
          throw new Error('Message content is missing');
        }
        return `${header}→${step.message.content}`;
      })
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
      const header = `H:${new Date(item.timestamp).toISOString()}`;
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

export function formatCurrentStepForSTM(step: StepInfo): string {
  try {
    const header = `S${step.stepNumber}:${step.stepName}`;
    if (step.type === 'tools' && step.tools && step.tools.length > 0) {
      const toolInfo = step.tools
        .map((t, i) => `T${i}:${t.description}->${t.result}`)
        .join('|');
      return `${header}[${toolInfo}]`;
    }
    if (step.message === undefined) {
      throw new Error('Message content is missing');
    }
    return `${header}→${step.message.content}`;
  } catch (error) {
    return `formatCurrentStepForSTM: ${error}`;
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
