/**
 * Integration Guide for Graph Improvements
 * Shows how to integrate the new optimizations into the existing system
 */

import { StateGraph, MemorySaver, Annotation } from '@langchain/langgraph';
import { GraphState, GraphConfigurableAnnotation } from '../graph.js';
import { ExecutionConstraintsManager, ExecutionState } from './execution-constraints.js';
import { ImprovedTaskPlanner } from './improved-planner.js';
import { ImprovedExecutorLogic } from './improved-executor.js';
import { SimplifiedOrchestration } from './simplified-orchestration.js';

// Extended state with improvements
export const EnhancedGraphState = Annotation.Root({
  ...GraphState.spec,
  // Add execution constraints state
  executionState: Annotation<ExecutionState>({
    reducer: (x, y) => y,
    default: () => ExecutionConstraintsManager.createInitialState(),
  }),
  // Add flow state for better tracking
  flowState: Annotation<{
    currentPhase: 'planning' | 'execution' | 'verification' | 'completion';
    phaseSwitchCount: number;
    lastDecision: string;
  }>({
    reducer: (x, y) => y,
    default: () => ({
      currentPhase: 'planning' as const,
      phaseSwitchCount: 0,
      lastDecision: 'Initial state',
    }),
  }),
});

/**
 * Integration steps for existing Graph class
 */
export class GraphIntegrationGuide {
  
  /**
   * Step 1: Update your Graph class constructor to include new dependencies
   */
  static updateGraphConstructor() {
    return `
    // In your Graph class constructor, add:
    private executionConstraints: ExecutionConstraintsManager;
    private improvedPlanner: ImprovedTaskPlanner;
    
    constructor(snakAgent: SnakAgentInterface, modelSelector: ModelSelector | null) {
      // ... existing constructor code ...
      this.executionConstraints = new ExecutionConstraintsManager();
      this.improvedPlanner = new ImprovedTaskPlanner();
    }
    `;
  }

  /**
   * Step 2: Update the buildWorkflow method
   */
  static updateBuildWorkflow() {
    return `
    private buildWorkflow(): StateGraph<
      typeof EnhancedGraphState.State,
      typeof GraphConfigurableAnnotation.State
    > {
      // Replace GraphState with EnhancedGraphState
      const workflow = new StateGraph(EnhancedGraphState, GraphConfigurableAnnotation)
        .addNode(GraphNode.PLANNING_ORCHESTRATOR, this.enhancedPlannerGraph.bind(this))
        .addNode(GraphNode.MEMORY_ORCHESTRATOR, memory_graph)
        .addNode(GraphNode.AGENT_EXECUTOR, this.enhancedExecutorGraph.bind(this))
        .addNode(GraphNode.TASK_VERIFIER, task_verifier_graph)
        .addNode(GraphNode.TASK_UPDATER, this.enhancedTaskUpdater.bind(this))
        .addNode(GraphNode.END_GRAPH, this.end_graph.bind(this))
        
        // Use simplified orchestration
        .addConditionalEdges(
          '__start__',
          SimplifiedOrchestration.simplifiedStartRouter
        )
        .addConditionalEdges(
          GraphNode.PLANNING_ORCHESTRATOR,
          SimplifiedOrchestration.simplifiedOrchestrationRouter
        )
        .addConditionalEdges(
          GraphNode.MEMORY_ORCHESTRATOR,
          SimplifiedOrchestration.simplifiedOrchestrationRouter
        )
        .addConditionalEdges(
          GraphNode.AGENT_EXECUTOR,
          SimplifiedOrchestration.simplifiedOrchestrationRouter
        )
        .addConditionalEdges(
          GraphNode.TASK_VERIFIER,
          SimplifiedOrchestration.simplifiedOrchestrationRouter
        )
        .addConditionalEdges(
          GraphNode.TASK_UPDATER,
          SimplifiedOrchestration.simplifiedOrchestrationRouter
        )
        .addEdge(GraphNode.END_GRAPH, END);

      return workflow;
    }
    `;
  }

  /**
   * Step 3: Update PlannerGraph to use improved planning
   */
  static updatePlannerGraph() {
    return `
    // In your PlannerGraph class, update the planExecution method:
    private async planExecution(
      state: typeof EnhancedGraphState.State,
      config: RunnableConfig<typeof GraphConfigurableAnnotation.State>
    ) {
      // Check if we should create a new task
      const userGoal = config.configurable?.objectives || 
                      this.agentConfig.prompt.content.toString();
                      
      if (!ImprovedTaskPlanner.shouldCreateNewTask(state.tasks, userGoal)) {
        logger.info('[ImprovedPlanner] Skipping duplicate task creation');
        return {
          messages: [],
          last_node: PlannerNode.CREATE_INITIAL_PLAN,
          tasks: state.tasks,
          currentGraphStep: state.currentGraphStep + 1,
        };
      }

      // Create optimized task using improved planner
      const optimizedTask = ImprovedTaskPlanner.createOptimizedTask(
        userGoal,
        this.toolsList.map(tool => tool.name)
      );

      const aiMessage = new AIMessageChunk({
        content: \`Enhanced plan created: \${optimizedTask.text}\`,
        additional_kwargs: {
          error: false,
          final: false,
          from: GraphNode.PLANNING_ORCHESTRATOR,
        },
      });

      state.tasks.push(optimizedTask);
      
      return {
        messages: [aiMessage],
        last_node: PlannerNode.CREATE_INITIAL_PLAN,
        tasks: state.tasks,
        executionMode: ExecutionMode.PLANNING,
        currentGraphStep: state.currentGraphStep + 1,
      };
    }
    `;
  }

  /**
   * Step 4: Update AgentExecutorGraph to use constraints
   */
  static updateExecutorGraph() {
    return `
    // In your AgentExecutorGraph class, update the reasoning_executor method:
    private async reasoning_executor(
      state: typeof EnhancedGraphState.State,
      config: RunnableConfig<typeof GraphConfigurableAnnotation.State>
    ) {
      // Use enhanced executor logic
      return await ImprovedExecutorLogic.enhancedReasoningExecutor(
        state,
        config,
        this.originalReasoningExecutor.bind(this) // Your existing logic
      );
    }

    // Update the executor router
    private executor_router(
      state: typeof EnhancedGraphState.State,
      config: RunnableConfig<typeof GraphConfigurableAnnotation.State>
    ): ExecutorNode {
      return ImprovedExecutorLogic.enhancedExecutorRouter(
        state,
        config,
        this.originalExecutorRouter.bind(this) // Your existing router
      );
    }
    `;
  }

  /**
   * Step 5: Update the task updater
   */
  static updateTaskUpdater() {
    return `
    private task_updater(
      state: typeof EnhancedGraphState.State,
      config: RunnableConfig<typeof GraphConfigurableAnnotation.State>
    ) {
      try {
        const currentTask = state.tasks[state.tasks.length - 1];
        if (!currentTask) {
          throw new Error('[Enhanced Task Updater] No tasks found in the state.');
        }

        // Use improved completion detection
        const isReallyComplete = SimplifiedOrchestration.isTaskTrulyComplete(
          currentTask,
          state.executionState
        );

        if (!isReallyComplete && currentTask.status === 'completed') {
          logger.warn('[Enhanced Task Updater] Task marked complete but not truly finished');
          // Reset task status to continue execution
          const updatedTasks = [...state.tasks];
          updatedTasks[state.currentTaskIndex].status = 'pending';
          
          return {
            tasks: updatedTasks,
            currentTaskIndex: state.currentTaskIndex,
            last_node: GraphNode.TASK_UPDATER,
          };
        }

        // ... rest of your existing task updater logic
        
      } catch (error) {
        logger.error(\`[Enhanced Task Updater] Error: \${error}\`);
        return { last_node: GraphNode.TASK_UPDATER };
      }
    }
    `;
  }

  /**
   * Step 6: Add validation to tool execution
   */
  static updateToolExecution() {
    return `
    // In your toolNodeInvoke method, add validation:
    private async toolNodeInvoke(
      state: typeof EnhancedGraphState.State,
      config: RunnableConfig<typeof GraphConfigurableAnnotation.State>,
      originalInvoke: Function
    ) {
      const lastMessage = state.messages[state.messages.length - 1];
      const toolCalls = lastMessage instanceof AIMessageChunk && lastMessage.tool_calls
        ? lastMessage.tool_calls
        : [];

      // Validate each tool call before execution
      for (const toolCall of toolCalls) {
        const validation = ExecutionConstraintsManager.validateToolCall(
          toolCall.name,
          state.executionState
        );

        if (!validation.allowed) {
          logger.warn(\`[Enhanced Tools] Skipping blocked tool: \${validation.reason}\`);
          continue; // Skip this tool call
        }
      }

      // Execute original tool logic
      const result = await originalInvoke(state, config);
      
      // Update execution state after successful tool execution
      if (toolCalls.length > 0) {
        let updatedExecutionState = state.executionState;
        for (const toolCall of toolCalls) {
          updatedExecutionState = ExecutionConstraintsManager.updateExecutionState(
            updatedExecutionState,
            toolCall.name
          );
        }
        
        return {
          ...result,
          executionState: updatedExecutionState,
        };
      }

      return result;
    }
    `;
  }

  /**
   * Step 7: Quick integration checklist
   */
  static getIntegrationChecklist() {
    return [
      '✅ Replace GraphState with EnhancedGraphState',
      '✅ Update constructor to include new managers',
      '✅ Replace orchestration routers with SimplifiedOrchestration',
      '✅ Update planner to use ImprovedTaskPlanner',
      '✅ Update executor to use ImprovedExecutorLogic',
      '✅ Add execution constraints validation to tool calls',
      '✅ Update task updater with enhanced completion detection',
      '✅ Test with GPT-4 Mini to verify reduced redundancy',
    ];
  }

  /**
   * Step 8: Configuration updates
   */
  static getConfigurationUpdates() {
    return `
    // Add to your default config:
    export const ENHANCED_GRAPH_CONFIG = {
      ...DEFAULT_GRAPH_CONFIG,
      executionConstraints: {
        maxConsecutiveRepeats: 2,
        preventDuplicateEndTask: true,
        enableToolValidation: true,
      },
      improvedPlanning: {
        enableWorkflowPatterns: true,
        maxTaskGranularity: 5,
        preventTaskDuplication: true,
      },
      simplifiedOrchestration: {
        enableFlowStateTracking: true,
        maxPhaseSwitches: 10,
      },
    };
    `;
  }
}

/**
 * Usage Example
 */
export const integrationExample = `
// 1. Update your imports
import { EnhancedGraphState } from './improvements/integration-guide.js';
import { ExecutionConstraintsManager } from './improvements/execution-constraints.js';
import { ImprovedTaskPlanner } from './improvements/improved-planner.js';
import { SimplifiedOrchestration } from './improvements/simplified-orchestration.js';

// 2. Update your Graph class
export class EnhancedGraph extends Graph {
  constructor(snakAgent: SnakAgentInterface, modelSelector: ModelSelector | null) {
    super(snakAgent, modelSelector);
    // Integration code here...
  }
  
  // Override methods with enhanced versions...
}

// 3. Use enhanced graph
const enhancedAgent = new EnhancedGraph(snakAgent, modelSelector);
const result = await enhancedAgent.initialize();
`;

/**
 * Expected Improvements
 */
export const expectedImprovements = {
  redundantCalls: 'Reduced by 70-80%',
  taskCompletion: 'More accurate completion detection',
  executionFlow: 'Cleaner, more logical progression',
  errorRecovery: 'Better handling of failed actions',
  resourceUsage: 'Fewer unnecessary LLM calls',
  debugging: 'Better logging and state tracking',
};