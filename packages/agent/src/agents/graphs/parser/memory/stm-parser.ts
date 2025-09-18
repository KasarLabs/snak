import { AIMessage, ToolMessage } from '@langchain/core/messages';
import { STMContext } from '@stypes/memory.types.js';

export function stm_format_for_history(stm: STMContext): string {
  try {
    const allMessages = [];
    for (let i = 0; i < stm.maxSize; i++) {
      const index = (stm.head + i) % stm.maxSize;
      if (stm.items[index] === null || stm.items[index] === undefined) {
        continue;
      }
      for (let y = 0; y < stm.items[index].message.length; y++) {
        let msg = stm.items[index]?.message[y];
        if (
          msg === undefined ||
          (msg instanceof ToolMessage && msg.name === 'response_task')
        ) {
          continue;
        }
        const separator = msg instanceof AIMessage ? 'Ai' : 'Tool';

        let content;
        if (typeof msg === 'object') {
          content = JSON.stringify(msg, null, 4);
        }
        allMessages.push(`<${separator}>\n${content}\n</${separator}>`);
      }
    }

    return allMessages.join('\n\n');
  } catch (error) {
    throw new Error('Error formatting STM context: ' + error);
  }
}
