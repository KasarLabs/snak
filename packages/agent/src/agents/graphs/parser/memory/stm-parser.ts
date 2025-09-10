import { STMContext } from '@stypes/memory.types.js';

export function stm_format_for_history(stm: STMContext): string {
  try {
    if (stm.size === 0) return 'No short-term memory available.';

    const formattedItems: string[] = [];
    const toolsUsed: string[] = [];

    // Parcours du plus récent (head) vers le plus ancien
    // en tenant compte de la structure circulaire du buffer
    for (let i = 0; i < stm.size; i++) {
      // Calcul de l'index en partant de head et en remontant
      const index = (stm.head - i + stm.items.length) % stm.items.length;

      if (stm.items[index] === null || stm.items[index] === undefined) continue;

      const content = stm.items[index]!.content;
      formattedItems.push(`-${content}`);
      
      // Extract tool names for redundancy detection
      const toolMatch = content.match(/Tool:\s*(\w+)/);
      if (toolMatch) {
        toolsUsed.push(toolMatch[1]);
      }
    }

    // Add redundancy warning if same tool used multiple times
    const toolCounts = toolsUsed.reduce((acc, tool) => {
      acc[tool] = (acc[tool] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const redundantTools = Object.entries(toolCounts).filter(([_, count]) => count > 1);
    
    let result = `WORKING_MEMORY:\n${formattedItems.join('\n')}`;
    
    if (redundantTools.length > 0) {
      result += `\n\nWARNING: Recently used tools (avoid repeating): ${redundantTools.map(([tool, count]) => `${tool}(${count}x)`).join(', ')}`;
    }

    return result;
  } catch (error) {
    throw new Error('Error formatting STM context: ' + error);
  }
}
