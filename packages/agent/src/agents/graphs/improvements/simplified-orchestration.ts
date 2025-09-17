/**
 * Simplified Orchestration System
 * Cleaner routing logic with better decision making for GPT-4 Mini
 */

import { RunnableConfig } from '@langchain/core/runnables';
import { GraphState, GraphConfigurableAnnotation } from '../graph.js';
import { GraphNode, VerifierNode, ExecutorNode, PlannerNode } from '../../../shared/enums/agent-modes.enum.js';
import { AgentMode, logger } from '@snakagent/core';
import { ExecutionState } from './execution-constraints.js';

export interface SimplifiedState extends typeof GraphState.State {
  executionState?: ExecutionState;
  flowState?: {
    currentPhase: 'planning' | 'execution' | 'verification' | 'completion';
    phaseSwitchCount: number;
    lastDecision: string;
  };
}

export class SimplifiedOrchestration {
  /**
   * Simplified main orchestration router with clear decision logic
   */
  public static simplifiedOrchestrationRouter(
    state: SimplifiedState,
    config: RunnableConfig<typeof GraphConfigurableAnnotation.State>
  ): GraphNode {
    const context = this.buildRoutingContext(state, config);
    
    logger.debug(`[SimplifiedOrchestration] Routing decision context: ${JSON.stringify(context)}`);

    // Error handling - always terminate on errors
    if (state.error?.hasError) {
      logger.error(`[SimplifiedOrchestration] Error detected: ${state.error.message}`);
      return GraphNode.END_GRAPH;
    }

    // Step limit protection
    if (context.isOverStepLimit) {
      logger.warn('[SimplifiedOrchestration] Step limit reached');
      return GraphNode.END_GRAPH;
    }

    // Simple state-based routing
    switch (context.lastNodeType) {
      case 'planner':
        return this.routeFromPlanner(context);
      
      case 'executor':
        return this.routeFromExecutor(context);
      
      case 'verifier':
        return this.routeFromVerifier(context);
      
      case 'task_updater':
        return this.routeFromTaskUpdater(context);
      
      default:
        return this.routeFromStart(context);
    }
  }

  /**
   * Build clear routing context
   */
  private static buildRoutingContext(
    state: SimplifiedState,
    config: RunnableConfig<typeof GraphConfigurableAnnotation.State>
  ) {
    const agentConfig = config.configurable?.agent_config;
    const lastMessage = state.messages[state.messages.length - 1];
    const currentTask = state.tasks[state.tasks.length - 1];
    
    return {
      // Basic state
      lastNode: state.last_node,
      lastNodeType: this.categorizeNode(state.last_node),
      agentMode: agentConfig?.mode || AgentMode.AUTONOMOUS,
      
      // Task state
      hasActiveTasks: state.tasks.length > 0,
      currentTaskIndex: state.currentTaskIndex,
      currentTask,
      hasMoreTasks: state.currentTaskIndex + 1 < state.tasks.length,
      
      // Task status
      isTaskCompleted: currentTask?.status === 'completed',
      isTaskFailed: currentTask?.status === 'failed',
      
      // Message state
      lastMessage,
      lastMessageFrom: lastMessage?.additional_kwargs?.from,
      
      // Verification state
      isTaskVerified: lastMessage?.additional_kwargs?.taskCompleted === true,
      isVerificationFailed: lastMessage?.additional_kwargs?.taskCompleted === false,
      
      // Limits and protection
      isOverStepLimit: state.currentGraphStep >= (config.configurable?.max_graph_steps || 1000),
      retryCount: state.retry,
      maxRetries: 3,
      
      // Flow control
      skipValidation: state.skipValidation?.skipValidation,
      executionState: state.executionState,
    };
  }

  /**
   * Categorize nodes for cleaner routing logic
   */
  private static categorizeNode(node: any): string {
    if (Object.values(PlannerNode).includes(node)) return 'planner';
    if (Object.values(ExecutorNode).includes(node)) return 'executor';
    if (Object.values(VerifierNode).includes(node)) return 'verifier';
    if (node === GraphNode.TASK_UPDATER) return 'task_updater';
    return 'other';
  }

  /**
   * Route from planner nodes
   */
  private static routeFromPlanner(context: any): GraphNode {
    logger.debug('[SimplifiedOrchestration] Routing from planner');
    
    // Always go to memory after planning to save context
    return GraphNode.MEMORY_ORCHESTRATOR;
  }

  /**
   * Route from executor nodes
   */
  private static routeFromExecutor(context: any): GraphNode {
    logger.debug('[SimplifiedOrchestration] Routing from executor');
    
    // If task was completed during execution, verify it
    if (context.isTaskCompleted) {
      logger.debug('[SimplifiedOrchestration] Task completed, routing to verifier');
      return GraphNode.TASK_VERIFIER;
    }
    
    // Otherwise save execution state to memory
    return GraphNode.MEMORY_ORCHESTRATOR;
  }

  /**
   * Route from verifier nodes  
   */
  private static routeFromVerifier(context: any): GraphNode {
    logger.debug('[SimplifiedOrchestration] Routing from verifier');
    
    // Always go to task updater after verification
    return GraphNode.TASK_UPDATER;
  }

  /**
   * Route from task updater
   */
  private static routeFromTaskUpdater(context: any): GraphNode {
    logger.debug('[SimplifiedOrchestration] Routing from task updater');
    
    const taskSuccess = context.lastMessage?.additional_kwargs?.taskSuccess;
    
    if (taskSuccess === true) {
      // Task was successfully verified and completed
      if (context.hasMoreTasks) {
        logger.debug('[SimplifiedOrchestration] Moving to next task');
        return GraphNode.AGENT_EXECUTOR;
      } else {
        logger.debug('[SimplifiedOrchestration] All tasks completed');
        return GraphNode.END_GRAPH;
      }
    } else if (taskSuccess === false) {
      // Task verification failed, need to retry
      if (context.retryCount < context.maxRetries) {
        logger.debug('[SimplifiedOrchestration] Task failed, retrying with executor');
        return GraphNode.AGENT_EXECUTOR;
      } else {
        logger.warn('[SimplifiedOrchestration] Max retries reached, ending');
        return GraphNode.END_GRAPH;
      }
    }
    
    // Default: continue with execution
    return GraphNode.AGENT_EXECUTOR;
  }

  /**
   * Route from start
   */
  private static routeFromStart(context: any): GraphNode {
    logger.debug('[SimplifiedOrchestration] Routing from start');
    
    // If we have tasks, go directly to execution
    if (context.hasActiveTasks) {
      return GraphNode.AGENT_EXECUTOR;
    }
    
    // Otherwise start with planning
    return GraphNode.PLANNING_ORCHESTRATOR;
  }

  /**
   * Simplified start orchestration router
   */
  public static simplifiedStartRouter(
    state: SimplifiedState,
    config: RunnableConfig<typeof GraphConfigurableAnnotation.State>
  ): GraphNode {
    const agentConfig = config.configurable?.agent_config;
    
    if (!agentConfig) {
      logger.error('[SimplifiedOrchestration] No agent config found');
      return GraphNode.END_GRAPH;
    }

    const mode = agentConfig.mode;
    
    switch (mode) {
      case AgentMode.AUTONOMOUS:
        // Autonomous agents always start with planning
        return GraphNode.PLANNING_ORCHESTRATOR;
        
      case AgentMode.INTERACTIVE:
        // Interactive agents can skip planning if execution mode is reactive
        const executionMode = config.configurable?.executionMode;
        if (executionMode === 'REACTIVE') {
          return GraphNode.AGENT_EXECUTOR;
        }
        return GraphNode.PLANNING_ORCHESTRATOR;
        
      case AgentMode.HYBRID:
        // Hybrid mode always starts with planning
        return GraphNode.PLANNING_ORCHESTRATOR;
        
      default:
        logger.warn(`[SimplifiedOrchestration] Unknown agent mode: ${mode}`);
        return GraphNode.END_GRAPH;
    }
  }

  /**
   * Enhanced task completion detection
   */
  public static isTaskTrulyComplete(
    task: any,
    executionState?: ExecutionState
  ): boolean {
    // Basic completion check
    if (task?.status !== 'completed') {
      return false;
    }

    // Must have taken some steps
    if (!task.steps || task.steps.length === 0) {
      return false;
    }

    // Last step should be meaningful (not just repeated end_task calls)
    if (executionState) {
      const recentEndTasks = executionState.toolCallHistory
        .slice(-3)
        .filter(tool => tool === 'end_task').length;
      
      if (recentEndTasks > 1) {
        return false; // Likely redundant completion
      }
    }

    return true;
  }

  /**
   * Flow state management
   */
  public static updateFlowState(
    state: SimplifiedState,
    newPhase: 'planning' | 'execution' | 'verification' | 'completion'
  ): SimplifiedState {
    const currentPhase = state.flowState?.currentPhase;
    const switchCount = currentPhase === newPhase ? 
      (state.flowState?.phaseSwitchCount || 0) : 
      (state.flowState?.phaseSwitchCount || 0) + 1;

    return {
      ...state,
      flowState: {
        currentPhase: newPhase,
        phaseSwitchCount: switchCount,
        lastDecision: `Switched to ${newPhase} phase`,
      },
    };
  }
}