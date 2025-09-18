import { v4 as uuidv4 } from 'uuid';
import { logger } from '@snakagent/core';
import {
  MemoryItem,
  STMContext,
  LTMContext,
  MemoryOperationResult,
} from '../../../../shared/types/index.js';
import { memory } from '@snakagent/database/queries';
import { AIMessageChunk, BaseMessage } from '@langchain/core/messages';
import {
  BaseChatModel,
  BaseChatModelCallOptions,
} from '@langchain/core/language_models/chat_models';
import { th } from 'zod/v4/locales';
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from '@langchain/core/prompts';
import { LTN_SUMMARIZE_SYSTEM_PROMPT } from '@prompts/index.js';

/**
 * Safe Short-Term Memory operations with O(1) complexity
 * Uses circular buffer to avoid array.shift() performance issues
 */
export class STMManager {
  /**
   * Creates an empty STM state
   */
  static createEmpty(maxSize: number = 15): STMContext {
    return {
      items: new Array(maxSize).fill(null),
      maxSize,
      head: 0,
      size: 0,
      totalInserted: 0,
    };
  }

  /**
   * Adds a new memory item to STM - O(1) operation
   */
  static addMemory(
    stm: STMContext,
    item: BaseMessage[],
    task_id: string
  ): MemoryOperationResult<STMContext> {
    try {
      // Validate input
      if (!item) {
        return {
          success: false,
          error: 'Step cannot be empty',
          timestamp: Date.now(),
        };
      }

      const newItem: MemoryItem = {
        message: item,
        task_id: task_id,
        timestamp: Date.now(),
        metadata: { insertIndex: stm.totalInserted },
      };

      // Create new items array with the new item
      const newItems = [...stm.items];
      newItems[stm.head] = newItem;

      const newSTM: STMContext = {
        items: newItems,
        maxSize: stm.maxSize,
        head: (stm.head + 1) % stm.maxSize,
        size: Math.min(stm.size + 1, stm.maxSize),
        totalInserted: stm.totalInserted + 1,
      };

      return {
        success: true,
        data: newSTM,
        timestamp: Date.now(),
      };
    } catch (error) {
      logger.error('[STMManager] Error adding memory:', error);
      return {
        success: false,
        error: `Failed to add memory: ${error.message}`,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Updates the most recent memory item in STM - O(1) operation
   */
  static updateMessageRecentMemory(
    stm: STMContext,
    item: BaseMessage | BaseMessage[]
  ): MemoryOperationResult<STMContext> {
    try {
      if (stm.size === 0) {
        return {
          success: false,
          error: 'No memories to update',
          timestamp: Date.now(),
        };
      }
      const recentIndex = (stm.head - 1 + stm.maxSize) % stm.maxSize; // Index of the most recent item
      const currentItem = stm.items[recentIndex];
      if (currentItem === null) {
        throw new Error('Recent memory is null');
      }
      if (currentItem.message.length === 0) {
        throw new Error('Recent memory has empty message array');
      }
      currentItem.message = currentItem.message.concat(item);
      const newItems = [...stm.items];
      newItems[recentIndex] = currentItem;

      const newSTM: STMContext = {
        items: newItems,
        maxSize: stm.maxSize,
        head: stm.head,
        size: stm.size,
        totalInserted: stm.totalInserted,
      };

      return {
        success: true,
        data: newSTM,
        timestamp: Date.now(),
      };
    } catch (error) {
      logger.error('[STMManager] Error updating recent memory:', error);
      throw error;
    }
  }

  /**
   * Gets all active memories in chronological order (newest first)
   */
  static getMemories(stm: STMContext): MemoryItem[] {
    const memories: MemoryItem[] = [];

    if (stm.size === 0) return memories;
    for (let i = 0; i < stm.maxSize; i++) {
      const index = (stm.head + i) % stm.maxSize;
      const item = stm.items[index];
      if (item !== null) {
        memories.push(item);
      }
    }

    return memories;
  }

  /**
   * Gets the most recent N memories
   */
  static getRecentMemories(stm: STMContext, count: number): MemoryItem[] {
    const allMemories = this.getMemories(stm);
    return allMemories.slice(-count);
  }

  static async summarize_before_inserting(
    content: string,
    model: BaseChatModel
  ): Promise<{ message: BaseMessage; tokens: number }> {
    try {
      if (!model) {
        throw new Error('Model is not defined');
      }
      const prompt = ChatPromptTemplate.fromMessages([
        ['system', LTN_SUMMARIZE_SYSTEM_PROMPT],
        new MessagesPlaceholder('content'),
      ]);

      const aiMessage = await model.invoke(
        await prompt.formatMessages({
          content: content,
        })
      );
      return {
        message: aiMessage,
        tokens: aiMessage.usage_metadata?.total_tokens ?? 0,
      };
    } catch (error: any) {
      throw error;
    }
  }

  /**
   * Clears all memories - returns new empty STM
   */
  static clear(stm: STMContext): STMContext {
    return this.createEmpty(stm.maxSize);
  }

  /**
   * Validates STM state integrity
   */
  static validate(stm: STMContext): boolean {
    try {
      // Check basic structure
      if (!Array.isArray(stm.items) || stm.items.length !== stm.maxSize) {
        return false;
      }

      // Check constraints
      if (stm.head < 0 || stm.head >= stm.maxSize) return false;
      if (stm.size < 0 || stm.size > stm.maxSize) return false;
      if (stm.totalInserted < 0) return false;

      // Count actual non-null items
      const actualSize = stm.items.filter((item) => item !== null).length;
      return actualSize === stm.size;
    } catch {
      return false;
    }
  }
}

/**
 * Long-Term Memory context manager
 */
export class LTMManager {
  /**
   * Creates empty LTM context
   */
  static createEmpty(): LTMContext {
    return {
      items: [],
      episodic_size: 0,
      semantic_size: 0,
      merge_size: 0,
    };
  }

  /**
   * Updates LTM context with new retrieved data
   */
  static updateContext(newItems: memory.Similarity[]): LTMContext {
    let episodic_counter = 0;
    let semantic_counter = 0;
    newItems.forEach((item) => {
      if (item.memory_type === 'episodic') {
        episodic_counter++;
      } else {
        semantic_counter++;
      }
    });
    return {
      items: newItems,
      episodic_size: episodic_counter,
      semantic_size: semantic_counter,
      merge_size: newItems.length,
    };
  }

  /**
   * Format memories for inclusion in a context
   * @param memories The memories to format
   */
  static formatMemoriesForContext(memories: memory.Similarity[]): string {
    if (memories.length === 0) {
      return '';
    }

    const s_memories: memory.Similarity[] = [];
    const e_memories: memory.Similarity[] = [];
    for (const memory of memories) {
      if (memory.memory_type === 'semantic') {
        s_memories.push(memory);
      } else if (memory.memory_type === 'episodic') {
        e_memories.push(memory);
      }
    }

    const formattedEpisodicMemories = e_memories
      .map((mem) => {
        return `Episodic Memory [id: ${mem.memory_id}, relevance: ${mem.similarity.toFixed(4)}, confidence ${mem.metadata.confidence}, last_updated: ${mem.metadata.updated_at}]: ${mem.content}`;
      })
      .join('\n\n');
    const formattedSemanticMemories = s_memories
      .map((mem) => {
        return `Semantic Memory [id: ${mem.memory_id}, relevance: ${mem.similarity.toFixed(4)}, category: ${mem.metadata.category}, confidence ${mem.metadata.confidence}, last_updated: ${mem.metadata.updated_at}]: ${mem.content}`;
      })
      .join('\n\n');

    return formattedEpisodicMemories.concat(formattedSemanticMemories);
  }
}
