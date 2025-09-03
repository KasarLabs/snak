import { ToolMessage } from '@langchain/core/messages';
import { logger } from '@snakagent/core';
import { ToolCall } from '../../../types/tools.types.js';
import { v4 as uuidv4 } from 'uuid';
export interface ReActStep {
  thought: string;
  action: string;
  observation?: string;
  final_result?: string;
}

export interface ParsedReActResponse {
  steps: ReActStep[];
  currentStep: ReActStep;
  hasToolCall: boolean;
  isFinalAnswer: boolean;
}
/**
 * Parses a ReAct-formatted response to extract thought, action, and observation components
 */
export function parseReActResponse(content: string): ParsedReActResponse {
  const steps: ReActStep[] = [];
  let currentStep: ReActStep = { thought: '', action: '', final_result: '' };
  let hasToolCall = false;
  let isFinalAnswer = false;

  // Split content by lines and process each
  const lines = content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line);

  for (const line of lines) {
    if (line.startsWith('**Thought**:') || line.startsWith('Thought:')) {
      // If we have a current step, save it before starting a new one
      if (currentStep.thought || currentStep.action) {
        steps.push({ ...currentStep });
      }
      currentStep = {
        thought: line.replace(/^\*?\*?Thought\*?\*?:?\s*/, ''),
        action: '',
      };
    } else if (line.startsWith('**Action**:') || line.startsWith('Action:')) {
      currentStep.action = line.replace(/^\*?\*?Action\*?\*?:?\s*/, '');

      // Check if this is a final answer
    } else if (
      line.startsWith('**Observation**:') ||
      line.startsWith('Observation:')
    ) {
      currentStep.observation = line.replace(
        /^\*?\*?Observation\*?\*?:?\s*/,
        ''
      );
    } else if (
      line.startsWith('**FINAL_ANSWER**:') ||
      line.startsWith('FINAL_ANSWER:')
    ) {
      currentStep.final_result = line.replace(
        /^\*?\*?FINAL_ANSWER\*?\*?:?\s*/,
        ''
      );
      isFinalAnswer = true;
    } else if (currentStep.thought && !currentStep.action) {
      // Continue thought if we're still in the thought section
      currentStep.thought += ' ' + line;
    } else if (
      currentStep.action &&
      !line.startsWith('**') &&
      !line.startsWith('Observation:')
    ) {
      // Continue action if we're in the action section
      currentStep.action += ' ' + line;
    }
  }

  // Add the final step if it exists
  if (currentStep.thought || currentStep.action) {
    steps.push(currentStep);
  }

  // Determine if there are tool calls based on action content
  const lastStep = steps[steps.length - 1];
  if (lastStep && lastStep.action) {
    hasToolCall =
      !lastStep.action.toLowerCase().includes('final_answer') &&
      lastStep.action.length > 0 &&
      !lastStep.action.toLowerCase().startsWith('provide') &&
      !lastStep.action.toLowerCase().startsWith('answer') &&
      !lastStep.action.toLowerCase().startsWith('explain');
  }
  console.log(currentStep);
  return {
    steps,
    currentStep: lastStep || currentStep,
    hasToolCall,
    isFinalAnswer,
  };
}

/**
 * Formats ReAct steps for memory storage
 */
export function formatReActStepsForMemory(steps: ReActStep[]): string {
  return steps
    .map(
      (step, index) =>
        `Step ${index + 1}:\nThought: ${step.thought}\nAction: ${step.action}` +
        (step.observation ? `\nObservation: ${step.observation}` : '')
    )
    .join('\n\n');
}

/**
 * Validates if a response follows ReAct format
 */
export function isValidReActFormat(content: string): boolean {
  const hasThought = /\*?\*?Thought\*?\*?:/.test(content);
  const hasAction = /\*?\*?Action\*?\*?:/.test(content);

  return hasThought && hasAction;
}

/**
 * Creates a ReAct observation from tool results
 */
export function createReActObservation(toolResults: ToolMessage[]): string {
  if (!toolResults || toolResults.length === 0) {
    return 'No tool results received.';
  }

  const observations = toolResults.map((result) => {
    // Maybe Upgrade Parsing
    if (typeof result.content === 'string') {
      return result.content;
    } else if (
      result.content &&
      typeof result.content.toString === 'function'
    ) {
      return result.content.toString();
    } else {
      return JSON.stringify(result.content || result);
    }
  });

  return observations.join('\n');
}

/**
 * Enhances ReAct response with proper formatting
 */
export function enhanceReActResponse(
  content: string,
  toolResults?: any[]
): string {
  const parsed = parseReActResponse(content);

  if (!isValidReActFormat(content)) {
    logger.warn('[ReAct] Response does not follow ReAct format, enhancing...');
    return `**Thought**: Let me analyze this request and determine the best approach.\n**Action**: ${content}`;
  }

  // If we have tool results and the last step doesn't have an observation, add it
  if (
    toolResults &&
    toolResults.length > 0 &&
    parsed.currentStep &&
    !parsed.currentStep.observation
  ) {
    const observation = createReActObservation(toolResults);
    return content + `\n**Observation**: ${observation}`;
  }

  return content;
}

/**
 * Parses Actions from ReAct response to extract tool calls
 * Handles cases where result.tools_call.length is 0 but there are actions to parse
 */
export function parseActionsToToolCallsReact(content: string): ToolCall[] {
  const toolCalls: ToolCall[] = [];

  try {
    // Look for Action patterns in the content
    const actionRegex =
      /\*?\*?Action\*?\*?:\s*```?\s*([\[{][\s\S]*?[\]}])\s*```?/gi;
    const matches = content.matchAll(actionRegex);

    for (const match of matches) {
      try {
        const jsonStr = match[1].trim();

        // Parse the JSON from the action
        const actionJson = JSON.parse(jsonStr);

        // Check if it's an array of tool calls or a single object
        const toolCallArray = Array.isArray(actionJson)
          ? actionJson
          : [actionJson];

        for (const toolCall of toolCallArray) {
          // Extract tool name, removing "functions." prefix if present
          const toolName = toolCall.name?.replace(/^functions\./, '') || '';

          if (toolName) {
            toolCalls.push({
              name: toolName,
              args: toolCall.args || {},
              id: toolCall.id || uuidv4(), // Use provided id or generate new one
              type: toolCall.type || 'tool_call',
            });
          }
        }
      } catch (jsonError) {
        logger.warn(
          `[ToolsHandler] Failed to parse action JSON: ${jsonError.message}`
        );

        // Fallback: try to extract tool name from malformed JSON
        const toolNameMatch = match[1].match(
          /"name":\s*"(?:functions\.)?([^"]+)"/
        );
        if (toolNameMatch) {
          const toolName = toolNameMatch[1];
          // Try to extract args if possible
          const argsMatch = match[1].match(/"args":\s*({[^}]*}|null)/);
          let args = {};

          if (argsMatch && argsMatch[1] !== 'null') {
            try {
              args = JSON.parse(argsMatch[1]);
            } catch {
              args = {};
            }
          }

          toolCalls.push({
            name: toolName,
            args: args,
            id: uuidv4(),
            type: 'tool_call',
          });
        }
      }
    }

    logger.debug(
      `[ToolsHandler] Parsed ${toolCalls.length} tool calls from actions`
    );
    return toolCalls;
  } catch (error) {
    logger.error(
      `[ToolsHandler] Error parsing actions to tool calls: ${error.message}`
    );
    return [];
  }
}
