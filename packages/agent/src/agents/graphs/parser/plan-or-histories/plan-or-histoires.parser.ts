import { ToolMessage } from '@langchain/core/messages';
import { logger } from '@snakagent/core';
import {
  HistoryItem,
  HistoryToolsInfo,
  History,
  ParsedPlan,
  StepInfo,
  StepToolsInfo,
  ValidatorStepResponse,
  ReturnTypeCheckPlanorHistory,
} from '../../../../types/index.js';

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
    logger.error(`Error formatting execution message: ${error}`);
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
      logger.debug('Item is empty');
      return '';
    }
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
