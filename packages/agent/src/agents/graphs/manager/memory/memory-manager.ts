import { v4 as uuidv4 } from 'uuid';
import { logger } from '@snakagent/core';
import {
  MemoryItem,
  STMContext,
  LTMContext,
  MemoryOperationResult,
  StepInfo,
  HistoryItem,
} from '../../../../shared/types/index.js';
import { memory } from '@snakagent/database/queries';
import { BaseMessage } from '@langchain/core/messages';

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
      console.log('STM HEAD', stm.head);
      console.log('Recent Index:', recentIndex);
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
    const startIndex = stm.size < stm.maxSize ? 0 : stm.head;

    for (let i = 0; i < stm.size; i++) {
      const index = (startIndex + i) % stm.maxSize;
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
}
