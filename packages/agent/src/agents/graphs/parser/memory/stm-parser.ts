import { STMContext } from '@stypes/memory.types.js';

export function stm_format_for_history(stm: STMContext): string {
  try {
    if (stm.size === 0) return 'No short-term memory available.';
    const formattedItems: string[] = [];
    const head = stm.head;
    const items = stm.items;
    for (let i = head; i < stm.size; i++) {
      if (stm.items[i] === null) continue;
      formattedItems.push(stm.items[i]!.content);
    }
    for (let i = 0; i < head; i++) {
      if (stm.items[i] === null) continue;
      formattedItems.push(stm.items[i]!.content);
    }
    return formattedItems.join('\n');
  } catch (error) {
    throw new Error('Error formatting STM context: ' + error);
  }
}
