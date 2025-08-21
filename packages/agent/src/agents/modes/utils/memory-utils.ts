import { v4 as uuidv4 } from 'uuid';
import { logger } from '@snakagent/core';
import {
  MemoryItem,
  CircularSTM,
  LTMContext,
  Memories,
  MemoryOperationResult,
} from '../types/index.js';

/**
 * Safe Short-Term Memory operations with O(1) complexity
 * Uses circular buffer to avoid array.shift() performance issues
 */
export class STMManager {
  /**
   * Creates an empty STM state
   */
  static createEmpty(maxSize: number = 15): CircularSTM {
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
    stm: CircularSTM,
    content: string
  ): MemoryOperationResult<CircularSTM> {
    try {
      const newItem: MemoryItem = {
        content: content.trim(),
        memories_id: uuidv4(),
        timestamp: Date.now(),
        metadata: { insertIndex: stm.totalInserted },
      };

      // Validate input
      if (!content.trim()) {
        return {
          success: false,
          error: 'Content cannot be empty',
          timestamp: Date.now(),
        };
      }

      // Create new items array with the new item
      const newItems = [...stm.items];
      newItems[stm.head] = newItem;

      // Use freeze to make items fields immutable
      const newSTM: CircularSTM = {
        items: Object.freeze(newItems),
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
   * Gets all active memories in chronological order (newest first)
   */
  static getMemories(stm: CircularSTM): MemoryItem[] {
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
  static getRecentMemories(stm: CircularSTM, count: number): MemoryItem[] {
    const allMemories = this.getMemories(stm);
    return allMemories.slice(-count);
  }

  /**
   * Clears all memories - returns new empty STM
   */
  static clear(stm: CircularSTM): CircularSTM {
    return this.createEmpty(stm.maxSize);
  }
  /**
   * Validates STM state integrity
   */
  static validate(stm: CircularSTM): boolean {
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
      context: '',
      retrievedAt: 0,
      relevanceScore: 0,
      memoryIds: Object.freeze([]),
      isStale: true,
    };
  }

  /**
   * Updates LTM context with new retrieved data
   */
  static updateContext(
    ltm: LTMContext,
    newContext: string,
    memoryIds: string[],
    relevanceScore: number = 0.8
  ): LTMContext {
    return {
      context: newContext.trim(),
      retrievedAt: Date.now(),
      relevanceScore: Math.max(0, Math.min(1, relevanceScore)),
      memoryIds: Object.freeze([...memoryIds]),
      isStale: false,
    };
  }

  /**
   * Marks LTM as stale (needs refresh)
   */
  static markStale(ltm: LTMContext): LTMContext {
    return {
      ...ltm,
      isStale: true,
    };
  }

  /**
   * Checks if LTM needs refresh based on age
   */
  static needsRefresh(
    ltm: LTMContext,
    maxAgeMs: number = 5 * 60 * 1000
  ): boolean {
    if (ltm.isStale) return true;
    return Date.now() - ltm.retrievedAt > maxAgeMs;
  }
}

/**
 * Complete memory state manager
 */
export class MemoryStateManager {
  /**
   * Creates initial memory state
   */
  static createInitialState(stmSize: number): Memories {
    return {
      stm: STMManager.createEmpty(stmSize),
      ltm: LTMManager.createEmpty(),
      isProcessing: false,
      lastError: undefined,
    };
  }

  /**
   * Safely adds memory to STM with full error handling
   */
  static addSTMMemory(
    state: Memories,
    content: string
  ): MemoryOperationResult<Memories> {
    if (state.isProcessing) {
      return {
        success: false,
        error: 'Memory operation already in progress',
        timestamp: Date.now(),
      };
    }

    const stmResult = STMManager.addMemory(state.stm, content);

    if (!stmResult.success || !stmResult.data) {
      return {
        success: false,
        error: stmResult.error,
        timestamp: Date.now(),
      };
    }

    return {
      success: true,
      data: {
        ...state,
        stm: stmResult.data,
      },
      timestamp: Date.now(),
    };
  }

  /**
   * Updates LTM context
   */
  static updateLTM(
    state: Memories,
    context: string,
    memoryIds: string[],
    relevanceScore?: number
  ): Memories {
    return {
      ...state,
      ltm: LTMManager.updateContext(
        state.ltm,
        context,
        memoryIds,
        relevanceScore
      ),
      lastError: undefined,
    };
  }

  /**
   * Return a copy of current Memories State with updated isProcessing field
   */
  static setProcessing(state: Memories, isProcessing: boolean): Memories {
    return {
      ...state,
      isProcessing,
    };
  }

  /**
   * Validates complete memory state
   */
  static validate(state: Memories): boolean {
    try {
      return STMManager.validate(state.stm);
    } catch {
      return false;
    }
  }
}

/**
 * Format memories for context display
 */
export function formatSTMForContext(stm: CircularSTM): string {
  const memories = STMManager.getMemories(stm);
  if (memories.length === 0) return 'No recent memories';

  return memories
    .map((memory, index) => `${index + 1}. ${memory.content}`)
    .join('\n');
}

/**
 * Format single memory item for step processing
 */
export function formatMemoryItem(item: MemoryItem): string {
  const age = Math.round((Date.now() - item.timestamp) / 1000);
  return `[${age}s ago] ${item.content}`;
}
