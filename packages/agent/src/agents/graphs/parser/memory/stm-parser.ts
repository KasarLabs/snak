import {
  AIMessage,
  AIMessageChunk,
  BaseMessage,
  HumanMessage,
  ToolMessage,
} from '@langchain/core/messages';
import { STMManager } from '@lib/memory/index.js';
import { logger } from '@snakagent/core';
import { STMContext } from '@stypes/memory.type.js';

function formatAiMessagetoXML(
  message: AIMessage | AIMessageChunk,
  indent: number = 0
): string {
  const result_formated: string[] = [];
  const baseIndent = '  '.repeat(indent);

  result_formated.push(
    `${baseIndent}<message type="ai_message" id="${message.id}">`
  );

  if (message.tool_calls && message.tool_calls.length > 0) {
    result_formated.push(`${baseIndent}  <tool_calls>`);

    for (const tool_call of message.tool_calls) {
      result_formated.push(
        `${baseIndent}    <tool_call name="${tool_call.name}">`
      );

      for (const [argKey, argValue] of Object.entries(tool_call.args)) {
        // Escape XML special characters in the value
        const escapedValue = String(argValue)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&apos;');

        result_formated.push(
          `${baseIndent}      <arg name="${argKey}">${escapedValue}</arg>`
        );
      }

      result_formated.push(`${baseIndent}    </tool_call>`);
    }

    result_formated.push(`${baseIndent}  </tool_calls>`);
  }

  if (message.content) {
    const escapedContent = String(message.content)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');

    result_formated.push(`${baseIndent}  <content>${escapedContent}</content>`);
  }

  result_formated.push(`${baseIndent}</message>`);

  return result_formated.join('\n');
}

function formatToolMessagetoXML(
  message: ToolMessage,
  indent: number = 0
): string {
  const result_formated: string[] = [];
  const baseIndent = '  '.repeat(indent);
  result_formated.push(
    `${baseIndent}<message type="tool_response" id="${message.tool_call_id}">`
  );
  result_formated.push(`${baseIndent}  <tool name="${message.name}">`);

  // Escape XML special characters in content
  const escapedContent = String(message.content)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

  result_formated.push(`${baseIndent}    <content>${escapedContent}</content>`);
  result_formated.push(`${baseIndent}  </tool>`);
  result_formated.push(`${baseIndent}</message>`);

  return result_formated.join('\n');
}

function formatHumanMessagetoXML(
  message: HumanMessage,
  indent: number = 0
): string {
  const result_formated: string[] = [];
  const baseIndent = '  '.repeat(indent);

  result_formated.push(
    `${baseIndent}<message type="human_message" id="${message.id}">`
  );

  // Escape XML special characters in content
  const escapedContent = String(message.content)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

  result_formated.push(`${baseIndent}  <content>${escapedContent}</content>`);
  result_formated.push(`${baseIndent}</message>`);

  return result_formated.join('\n');
}

function formatBaseMessageToXML(
  message: BaseMessage,
  indent: number = 0
): string {
  try {
    // console.log('Formatting BaseMessage to XML:');
    // console.log('Message constructor:', message.constructor.name);
    // console.log('Is AIMessageChunk:', message instanceof AIMessageChunk);
    // console.log('Is AIMessage:', message instanceof AIMessage);
    // console.log('Is ToolMessage:', message instanceof ToolMessage);
    // console.log('Is HumanMessage:', message instanceof HumanMessage);

    if (message instanceof AIMessageChunk || message instanceof AIMessage) {
      return formatAiMessagetoXML(message, indent);
    } else if (
      message instanceof ToolMessage ||
      message.constructor.name === 'ToolMessage'
    ) {
      return formatToolMessagetoXML(message as ToolMessage, indent);
    } else if (message instanceof HumanMessage) {
      return formatHumanMessagetoXML(message, indent);
    }
    return '';
  } catch (error) {
    logger.error('Error parsing BaseMessage to XML', { error });
    return '';
  }
}

export function formatSTMToXML(stm: STMContext): string {
  try {
    const items = STMManager.getMemories(stm);
    const formatd_version: string[] = [];

    if (!items || items.length === 0) {
      return '  <!-- Empty conversation -->';
    }
    for (const item of items) {
      if (item.message && item.message.length > 0) {
        for (const message of item.message) {
          const formatd_message = formatBaseMessageToXML(message, 1); // indent level 1 for messages
          if (formatd_message && formatd_message.length > 0) {
            formatd_version.push(formatd_message);
          }
        }
      }
    }
    return formatd_version.join('\n');
  } catch (error) {
    logger.error('Error parsing STM to XML', { error });
    return '<ai_conversation>\n  <!-- Error parsing short-term-memory -->\n</ai_conversation>';
  }
}
