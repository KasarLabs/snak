import { Id, logger } from '@snakagent/core';
import { ToolCall } from '../../../shared/types/tools.types.js';
import { v4 as uuidv4 } from 'uuid';
/**
 * Parses Actions from ReAct response to extract tool calls
 * Handles cases where result.tools_call.length is 0 but there are actions to parse
 */
export function parseActionsToToolCallsReact(
  content: string
): ToolCall<Id.Id>[] {
  const toolCalls: ToolCall<Id.Id>[] = [];

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
