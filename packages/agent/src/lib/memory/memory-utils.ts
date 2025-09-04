import {
  Memories,
  MemoryOperationResult,
  StepInfo,
  HistoryItem,
  STMContext,
  LTMContext,
} from '../../types/index.js';
import { STMManager, LTMManager } from './memory-manager.js';
import { memory } from '@snakagent/database/queries';

/**
 * Memory state management namespace
 */
export namespace MemoryStateManager {
  /**
   * Creates initial memory state
   */
  export function createInitialState(stmSize: number): Memories {
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
  export function addSTMMemory(
    state: Memories,
    item: StepInfo | HistoryItem,
    timestamp: number
  ): MemoryOperationResult<Memories> {
    if (state.isProcessing) {
      return {
        success: false,
        error: 'Memory operation already in progress',
        timestamp: timestamp,
      };
    }

    const stmResult = STMManager.addMemory(state.stm, item);

    if (!stmResult.success || !stmResult.data) {
      return {
        success: false,
        error: stmResult.error,
        timestamp: timestamp,
      };
    }

    return {
      success: true,
      data: {
        ...state,
        stm: stmResult.data,
      },
      timestamp: timestamp,
    };
  }

  /**
   * Updates LTM context
   */
  export function updateLTM(
    state: Memories,
    newItems: memory.Similarity[]
  ): Memories {
    return {
      ...state,
      ltm: LTMManager.updateContext(newItems),
      lastError: undefined,
    };
  }

  /**
   * Return a copy of current Memories State with updated isProcessing field
   */
  export function setProcessing(
    state: Memories,
    isProcessing: boolean
  ): Memories {
    return {
      ...state,
      isProcessing,
    };
  }

  /**
   * Validates complete memory state
   */
  export function validate(state: Memories): boolean {
    try {
      return STMManager.validate(state.stm);
    } catch {
      return false;
    }
  }
}

export function JSONstringifySTM(stm: STMContext): string {
  return JSON.stringify(
    stm.items.filter((item) => {
      if (item) {
        return item;
      }
    }),
    null,
    2
  );
}

export function JSONstringifyLTM(ltm: LTMContext): string {
  return JSON.stringify(ltm.items, null, 2);
}
