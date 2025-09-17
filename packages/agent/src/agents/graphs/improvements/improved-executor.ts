/**
 * Improved Executor with Execution Constraints
 * Prevents redundant calls and ensures logical execution flow
 */

import { AIMessageChunk, BaseMessage } from '@langchain/core/messages';
import { RunnableConfig } from '@langchain/core/runnables';
import { GraphState, GraphConfigurableAnnotation } from '../graph.js';
import { TaskType, StepType, ToolCall } from '../../../shared/types/index.js';
import { ExecutorNode } from '../../../shared/enums/agent-modes.enum.js';
import { ExecutionConstraintsManager, ExecutionState } from './execution-constraints.js';
import { logger } from '@snakagent/core';
import { v4 as uuidv4 } from 'uuid';

export interface ExecutorEnhancedState extends typeof GraphState.State {
  executionState?: ExecutionState;
}

export class ImprovedExecutorLogic {
  /**
   * Enhanced reasoning executor with execution constraints
   */
  public static async enhancedReasoningExecutor(
    state: ExecutorEnhancedState,
    config: RunnableConfig<typeof GraphConfigurableAnnotation.State>,
    originalExecutor: Function
  ): Promise<{
    messages: BaseMessage[];
    last_node: ExecutorNode;
    tasks?: TaskType[];
    currentGraphStep?: number;
    currentTaskIndex?: number;
    executionState?: ExecutionState;
  }> {
    try {
      // Initialize execution state if not present
      if (!state.executionState) {
        state.executionState = ExecutionConstraintsManager.createInitialState();
      }

      // Get the current task
      const currentTask = state.tasks[state.tasks.length - 1];
      if (!currentTask) {
        throw new Error('No current task available');
      }

      // Check if task is already completed
      if (currentTask.status === 'completed') {
        logger.info('[ImprovedExecutor] Task already completed, skipping execution');
        return {
          messages: [],
          last_node: ExecutorNode.REASONING_EXECUTOR,
          tasks: state.tasks,
          currentGraphStep: state.currentGraphStep + 1,
          currentTaskIndex: state.currentTaskIndex,
          executionState: state.executionState,
        };
      }

      // Enhanced prompt context with execution state
      const enhancedContext = this.buildEnhancedContext(state, currentTask);
      
      // Call original executor with enhanced context
      const result = await originalExecutor(
        { ...state, enhancedContext },
        config
      );

      // Validate and potentially modify the tool call
      if (result.messages && result.messages.length > 0) {
        const lastMessage = result.messages[result.messages.length - 1];
        
        if (lastMessage instanceof AIMessageChunk && lastMessage.tool_calls?.length > 0) {
          const toolCall = lastMessage.tool_calls[0];
          const validation = ExecutionConstraintsManager.validateToolCall(
            toolCall.name,
            state.executionState
          );

          if (!validation.allowed) {
            logger.warn(`[ImprovedExecutor] Tool call blocked: ${validation.reason}`);
            
            // Create alternative action
            const alternativeAction = this.createAlternativeAction(
              toolCall.name,
              validation.reason!,
              state.executionState
            );

            return alternativeAction;
          }

          // Update execution state
          const updatedExecutionState = ExecutionConstraintsManager.updateExecutionState(
            state.executionState,
            toolCall.name
          );

          return {
            ...result,
            executionState: updatedExecutionState,
          };
        }
      }

      return {
        ...result,
        executionState: state.executionState,
      };

    } catch (error: any) {
      logger.error(`[ImprovedExecutor] Enhanced execution failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Builds enhanced context for better decision making
   */
  private static buildEnhancedContext(
    state: ExecutorEnhancedState,
    currentTask: TaskType
  ): string {
    const executionHistory = state.executionState?.toolCallHistory.slice(-5) || [];
    const lastTool = state.executionState?.lastToolCall;
    const stepCount = currentTask.steps.length;

    const context = `
EXECUTION CONTEXT:
- Current Step: ${stepCount + 1}
- Last Tool Used: ${lastTool || 'None'}
- Recent Tools: [${executionHistory.join(', ')}]
- Task Status: ${currentTask.status}
- Completion Attempts: ${state.executionState?.taskCompletionAttempts || 0}

EXECUTION CONSTRAINTS:
- Avoid repeating the same tool consecutively unless necessary
- Only use end_task when the objective is truly complete
- Build upon previous actions rather than duplicating them
- Consider the logical flow of actions

CURRENT OBJECTIVE: ${currentTask.text}
REASONING: ${currentTask.reasoning}
    `;

    return context;
  }

  /**
   * Creates alternative action when tool call is blocked
   */
  private static createAlternativeAction(
    blockedTool: string,
    reason: string,
    executionState: ExecutionState
  ): {
    messages: BaseMessage[];
    last_node: ExecutorNode;
    executionState: ExecutionState;
  } {
    let alternativeAction: string;
    let suggestedTool: string;

    switch (blockedTool) {
      case 'end_task':
        alternativeAction = 'I should verify the current state before ending the task';
        suggestedTool = 'mobile_list_elements_on_screen';
        break;
      case 'mobile_use_device':
        alternativeAction = 'I should use the default device instead';
        suggestedTool = 'mobile_use_default_device';
        break;
      default:
        alternativeAction = 'I should check the current state and plan the next logical step';
        suggestedTool = 'mobile_list_elements_on_screen';
    }

    const message = new AIMessageChunk({
      content: `Tool call blocked (${reason}). ${alternativeAction}`,
      additional_kwargs: {
        from: ExecutorNode.REASONING_EXECUTOR,
        blocked_tool: blockedTool,
        alternative_action: alternativeAction,
      },
    });

    // Create suggested tool call
    const toolCall: ToolCall<'id'> = {
      name: suggestedTool,
      args: { noParams: {} },
      id: `snak_${uuidv4()}`,
      type: 'tool_call',
    };

    message.tool_calls = [toolCall];

    const updatedExecutionState = ExecutionConstraintsManager.updateExecutionState(
      executionState,
      suggestedTool
    );

    return {
      messages: [message],
      last_node: ExecutorNode.REASONING_EXECUTOR,
      executionState: updatedExecutionState,
    };
  }

  /**
   * Enhanced step completion logic
   */
  public static createEnhancedStep(
    thoughts: any,
    toolName: string,
    toolArgs: any,
    executionState: ExecutionState
  ): StepType {
    // Enhanced thoughts that include execution context
    const enhancedThoughts = {
      ...thoughts,
      execution_notes: `Step follows previous action: ${executionState.lastToolCall || 'none'}. ` +
                     `Tool history: [${executionState.toolCallHistory.slice(-3).join(', ')}]`,
    };

    return {
      thoughts: enhancedThoughts,
      tool: {
        name: toolName,
        args: toolArgs,
        result: '',
        status: toolName === 'end_task' ? 'completed' : 'pending',
      },
    };
  }

  /**
   * Prevents task completion spam
   */
  public static shouldAllowTaskCompletion(
    currentTask: TaskType,
    executionState: ExecutionState
  ): { allowed: boolean; reason?: string } {
    // Already completed
    if (currentTask.status === 'completed') {
      return {
        allowed: false,
        reason: 'Task is already marked as completed',
      };
    }

    // Too many completion attempts
    if (executionState.taskCompletionAttempts >= 2) {
      return {
        allowed: false,
        reason: 'Maximum task completion attempts reached',
      };
    }

    // No steps taken
    if (currentTask.steps.length === 0) {
      return {
        allowed: false,
        reason: 'Cannot complete task without taking any steps',
      };
    }

    // Last step was also end_task
    if (executionState.lastToolCall === 'end_task') {
      return {
        allowed: false,
        reason: 'Already attempted to end task in previous step',
      };
    }

    return { allowed: true };
  }

  /**
   * Enhanced router that considers execution state
   */
  public static enhancedExecutorRouter(
    state: ExecutorEnhancedState,
    config: RunnableConfig<typeof GraphConfigurableAnnotation.State>,
    originalRouter: Function
  ): ExecutorNode {
    // Check execution state for routing decisions
    if (state.executionState?.stepInProgress === false && 
        state.executionState?.taskCompletionAttempts > 0) {
      logger.debug('[ImprovedExecutor] Task completion detected, routing to end');
      return ExecutorNode.END;
    }

    // Use original router logic with execution state awareness
    return originalRouter(state, config);
  }
}