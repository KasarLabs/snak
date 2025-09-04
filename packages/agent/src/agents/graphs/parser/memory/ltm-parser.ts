// --- LTM PARSING --- //

import { memory } from '@snakagent/database/queries';

export function formatLTMForContext(ltmItems: memory.Similarity[]): string {
  try {
    if (!ltmItems || ltmItems.length === 0) {
      return 'No long-term memories available';
    }

    const formatted_memories: string[] = [];

    ltmItems.forEach((memory, index) => {
      const type_prefix = memory.memory_type === 'episodic' ? 'E' : 'S';
      const similarity_score = `(${(memory.similarity * 100).toFixed(1)}%)`;
      const content = memory.content.substring(0, 120);

      // Extract key metadata context
      let metadata_context = '';
      if (memory.metadata) {
        const parts = [];
        if (memory.metadata.category)
          parts.push(`category:${memory.metadata.category}`);
        if (memory.metadata.confidence)
          parts.push(`confidence:${memory.metadata.confidence}`);
        if (memory.metadata.access_count)
          parts.push(`access_count:${memory.metadata.access_count}`);
        if (parts.length > 0) {
          metadata_context = `[${parts.join('|')}]`;
        }
      }

      formatted_memories.push(
        `${type_prefix}${index + 1}:${similarity_score}${metadata_context}→${content}...`
      );
    });

    return formatted_memories.join('\n');
  } catch (error) {
    return `formatLTMForContext: ${error}`;
  }
}
