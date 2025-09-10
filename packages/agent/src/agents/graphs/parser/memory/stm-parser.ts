import { STMContext } from '@stypes/memory.types.js';

export function stm_format_for_history(stm: STMContext): string {
  try {
    if (stm.size === 0) return 'No short-term memory available.';

    const formattedItems: string[] = [];

    // Parcours du plus récent (head) vers le plus ancien
    // en tenant compte de la structure circulaire du buffer
    for (let i = 0; i < stm.size; i++) {
      // Calcul de l'index en partant de head et en remontant
      const index = (stm.head - i + stm.items.length) % stm.items.length;

      if (stm.items[index] === null || stm.items[index] === undefined) continue;

      formattedItems.push(stm.items[index]!.content);
    }

    return formattedItems.join('\n');
  } catch (error) {
    throw new Error('Error formatting STM context: ' + error);
  }
}
