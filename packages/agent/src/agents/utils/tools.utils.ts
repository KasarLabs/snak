import { ToolMessage } from '@langchain/core/messages';
import { logger } from '@snakagent/core';
/**
 * Truncates string content if it exceeds maximum length
 * @param content - The string content to truncate
 * @param maxLength - Maximum allowed length
 * @returns Truncated string with metadata or original string
 */
const truncateStringContentHelper = (
  content: string,
  maxLength: number
): string => {
  const originalLength = content.length;
  if (originalLength > maxLength) {
    logger.debug(
      `Content truncated from ${originalLength} to ${maxLength} characters.`
    );
    return (
      content.substring(0, maxLength) +
      `... [truncated ${originalLength - maxLength} characters]`
    );
  }
  return content;
};

/**
 * Truncates tool response content to prevent oversized results
 * Handles both array and object formats with nested message structures
 * @param result - Tool invocation result
 * @param maxLength - Maximum content length (default: 5000)
 * @returns Result with truncated content strings
 */
export function truncateToolResults(
  result: any,
  maxLength: number = 20000
): { messages: ToolMessage[] } {
  for (const tool_message of result.messages) {
    let content: string;
    try {
      // Safely handle content conversion, avoiding Response body issues
      if (typeof tool_message.content === 'string') {
        content = tool_message.content;
      } else if (
        tool_message.content &&
        typeof tool_message.content.toString === 'function'
      ) {
        content = tool_message.content.toString();
      } else if (
        tool_message.content &&
        typeof tool_message.content.toLocaleString === 'function'
      ) {
        content = tool_message.content.toLocaleString();
      } else {
        content = String(tool_message.content || '');
      }
    } catch (error) {
      logger.warn(
        `Failed to convert tool message content to string: ${error.message}`
      );
      content = '[Content conversion failed - Response body may be locked]';
    }

    const truncatedContent = truncateStringContentHelper(content, maxLength);
    tool_message.content = truncatedContent;
  }
  return result;
}
