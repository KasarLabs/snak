/**
 * Execution Constraints System
 * Prevents redundant calls and ensures logical execution flow
 */

export interface ExecutionState {
  lastToolCall: string | null;
  toolCallHistory: string[];
  stepInProgress: boolean;
  taskCompletionAttempts: number;
  maxConsecutiveRepeats: number;
}

export interface StepConstraints {
  preventConsecutiveDuplicates: boolean;
  maxRetries: number;
  requiredPrecedents?: string[];
  blockedAfter?: string[];
}

export class ExecutionConstraintsManager {
  private static readonly DEFAULT_CONSTRAINTS: StepConstraints = {
    preventConsecutiveDuplicates: true,
    maxRetries: 3,
  };

  private static readonly TOOL_CONSTRAINTS: Record<string, StepConstraints> = {
    end_task: {
      preventConsecutiveDuplicates: true,
      maxRetries: 1, // Only allow one end_task call per step
      blockedAfter: ['end_task'], // Block consecutive end_task calls
    },
    mobile_use_device: {
      preventConsecutiveDuplicates: true,
      maxRetries: 2,
      requiredPrecedents: ['mobile_list_available_devices'],
    },
    mobile_launch_app: {
      preventConsecutiveDuplicates: true,
      maxRetries: 2,
      requiredPrecedents: ['mobile_use_device', 'mobile_use_default_device'],
    },
    mobile_type_keys: {
      preventConsecutiveDuplicates: false, // Allow typing multiple times
      maxRetries: 3,
    },
  };

  public static validateToolCall(
    toolName: string,
    executionState: ExecutionState
  ): { allowed: boolean; reason?: string } {
    const constraints = this.TOOL_CONSTRAINTS[toolName] || this.DEFAULT_CONSTRAINTS;

    // Check for consecutive duplicates
    if (constraints.preventConsecutiveDuplicates && executionState.lastToolCall === toolName) {
      return {
        allowed: false,
        reason: `Consecutive calls to ${toolName} are not allowed`,
      };
    }

    // Check max consecutive repeats
    const recentCalls = executionState.toolCallHistory.slice(-3);
    const consecutiveCount = recentCalls.filter(call => call === toolName).length;
    
    if (consecutiveCount >= constraints.maxRetries) {
      return {
        allowed: false,
        reason: `Maximum retry limit (${constraints.maxRetries}) reached for ${toolName}`,
      };
    }

    // Check required precedents
    if (constraints.requiredPrecedents) {
      const hasRequiredPrecedent = constraints.requiredPrecedents.some(precedent =>
        executionState.toolCallHistory.includes(precedent)
      );
      if (!hasRequiredPrecedent) {
        return {
          allowed: false,
          reason: `${toolName} requires one of: ${constraints.requiredPrecedents.join(', ')}`,
        };
      }
    }

    // Check blocked after
    if (constraints.blockedAfter) {
      const isBlockedAfter = constraints.blockedAfter.some(blocker =>
        executionState.toolCallHistory.includes(blocker)
      );
      if (isBlockedAfter) {
        return {
          allowed: false,
          reason: `${toolName} is blocked after: ${constraints.blockedAfter.join(', ')}`,
        };
      }
    }

    return { allowed: true };
  }

  public static updateExecutionState(
    state: ExecutionState,
    toolName: string
  ): ExecutionState {
    return {
      ...state,
      lastToolCall: toolName,
      toolCallHistory: [...state.toolCallHistory, toolName].slice(-10), // Keep last 10 calls
      stepInProgress: toolName !== 'end_task',
      taskCompletionAttempts: toolName === 'end_task' ? state.taskCompletionAttempts + 1 : state.taskCompletionAttempts,
    };
  }

  public static createInitialState(): ExecutionState {
    return {
      lastToolCall: null,
      toolCallHistory: [],
      stepInProgress: false,
      taskCompletionAttempts: 0,
      maxConsecutiveRepeats: 2,
    };
  }
}