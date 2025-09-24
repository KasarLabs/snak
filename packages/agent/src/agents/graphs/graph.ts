import { AgentConfig, logger } from '@snakagent/core';
import {
  StateGraph,
  Annotation,
  END,
  CompiledStateGraph,
} from '@langchain/langgraph';
import {
  DynamicStructuredTool,
  StructuredTool,
  Tool,
} from '@langchain/core/tools';
import { AnyZodObject } from 'zod';
import { BaseMessage } from '@langchain/core/messages';
import { RunnableConfig } from '@langchain/core/runnables';
import { RagAgent } from '../operators/ragAgent.js';
import {
  GraphNode,
  TaskExecutorNode,
  TaskManagerNode,
  TaskMemoryNode,
  TaskVerifierNode,
} from '../../shared/enums/agent.enum.js';
import {
  GraphErrorType,
  Memories,
  skipValidationType,
  TaskType,
  UserRequest,
} from '../../shared/types/index.js';
import { MemoryStateManager } from './manager/memory/memory-utils.js';
import { MemoryGraph } from './sub-graph/task-memory.graph.js';
import { TaskManagerGraph } from './sub-graph/task-manager.graph.js';
import { AgentExecutorGraph } from './sub-graph/task-executor.graph.js';
import { TaskVerifierGraph } from './sub-graph/task-verifier.graph.js';
import { isInEnum } from '../../shared/enums/index.js';
import { initializeDatabase } from '../../agents/utils/database.utils.js';
import { initializeToolsList } from '../../tools/tools.js';
import { SnakAgent } from '@agents/core/snakAgent.js';
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';

export const GraphState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => {
      return y;
    },
    default: () => [],
  }),
  last_node: Annotation<
    | TaskExecutorNode
    | TaskManagerNode
    | TaskMemoryNode
    | GraphNode
    | TaskVerifierNode
  >({
    reducer: (x, y) => y,
    default: () => GraphNode.START,
  }),
  memories: Annotation<Memories>({
    reducer: (x, y) => y,
    default: () => MemoryStateManager.createInitialState(0),
  }),
  rag: Annotation<string>({
    reducer: (x, y) => y,
    default: () => '',
  }),
  tasks: Annotation<TaskType[]>({
    reducer: (x, y) => y,
    default: () => [],
  }),
  currentTaskIndex: Annotation<number>({
    reducer: (x, y) => y,
    default: () => 0,
  }),
  retry: Annotation<number>({
    reducer: (x, y) => y,
    default: () => 0,
  }),
  currentGraphStep: Annotation<number>({
    reducer: (x, y) => y,
    default: () => 0,
  }),
  skipValidation: Annotation<skipValidationType>({
    reducer: (x, y) => y,
    default: () => ({ skipValidation: false, goto: '' }),
  }),
  error: Annotation<GraphErrorType | null>({
    reducer: (x, y) => y,
    default: () => null,
  }),
});

export type GraphStateType = typeof GraphState.State;

export const GraphConfigurableAnnotation = Annotation.Root({
  thread_id: Annotation<string | undefined>({
    reducer: (x, y) => y,
    default: () => undefined,
  }),
  agent_config: Annotation<AgentConfig.Runtime | null>({
    reducer: (x, y) => y,
    default: () => null,
  }),
  user_request: Annotation<UserRequest | undefined>({
    reducer: (x, y) => y,
    default: () => undefined,
  }),
});

export type GraphConfigurableType = typeof GraphConfigurableAnnotation.State;
export class Graph {
  private toolsList: (
    | StructuredTool
    | Tool
    | DynamicStructuredTool<AnyZodObject>
  )[] = [];
  private agentConfig: AgentConfig.Runtime;
  private ragAgent: RagAgent | null = null;
  private checkpointer: PostgresSaver;
  private app: CompiledStateGraph<any, any, any, any, any, any>;
  private config: typeof GraphConfigurableAnnotation.State | null = null;

  constructor(private snakAgent: SnakAgent) {
    const pg_checkpointer = snakAgent.getPgCheckpointer();
    if (!pg_checkpointer) {
      throw new Error('Checkpointer is required for graph initialization');
    }
    this.checkpointer = pg_checkpointer;
  }

  private async initializeRagAgent(): Promise<void> {
    try {
      this.ragAgent = this.snakAgent.getRagAgent();
      if (!this.ragAgent) {
        logger.warn(
          '[Agent] WARNING: RAG agent not available - RAG context will be skipped'
        );
      }
    } catch (error) {
      logger.error(`[Agent] Failed to retrieve RAG agent: ${error}`);
    }
  }

  private end_graph(state: typeof GraphState): {
    currentTaskIndex: number;
    retry: number;
    skipValidation: skipValidationType;
    error: null;
  } {
    logger.info('[EndGraph] Cleaning up state for graph termination');
    return {
      currentTaskIndex: 0,
      retry: 0,
      skipValidation: { skipValidation: false, goto: '' },
      error: null,
    };
  }

  private orchestrationRouter(
    state: typeof GraphState.State,
    config: RunnableConfig<typeof GraphConfigurableAnnotation.State>
  ): GraphNode {
    logger.debug(`[Orchestration Router] Last agent: ${state.last_node}`);
    // Check for errors first
    if (state.error?.hasError && state.error.type !== 'blocked_task') {
      logger.error(
        `[Orchestration Router] Error detected from ${state.error.source}: ${state.error.message}`
      );
      return GraphNode.END_GRAPH;
    }

    const currentTask = state.tasks[state.tasks.length - 1];

    // Skip validation if flagged
    if (state.skipValidation.skipValidation) {
      const validTargets = Object.values(GraphNode);
      const goto = state.skipValidation.goto as GraphNode;

      if (validTargets.includes(goto)) {
        logger.debug(
          `[Orchestration Router] Skip validation routing to: ${goto}`
        );
        return goto;
      } else {
        logger.warn(
          `[Orchestration Router] Invalid skip validation target: ${goto}, defaulting to end_graph`
        );
        return GraphNode.END_GRAPH;
      }
    }

    if (isInEnum(TaskVerifierNode, state.last_node))
      if (state.last_node === TaskVerifierNode.TASK_UPDATER) {
        if (
          currentTask.status === 'completed' ||
          currentTask.status === 'failed'
        ) {
          logger.debug(
            `[Orchestration Router] Memory operations complete, routing to task verifier`
          );
          return GraphNode.MEMORY_ORCHESTRATOR;
        }
      }
    if (isInEnum(TaskMemoryNode, state.last_node)) {
      if (
        currentTask.status === 'completed' ||
        currentTask.status === 'failed'
      ) {
        logger.debug(
          `[Orchestration Router] Memory operations complete, routing to task manager`
        );
        return GraphNode.TASK_MANAGER;
      } else {
        logger.debug(
          `[Orchestration Router] Memory operations complete, routing to agent executor`
        );
        return GraphNode.AGENT_EXECUTOR;
      }
    }
    if (isInEnum(TaskExecutorNode, state.last_node)) {
      // Check if a task was just completed (end_task tool was called)
      if (state.error && state.error.hasError) {
        logger.error(
          `[Orchestration Router] Error detected from ${state.error.source}: ${state.error.message}`
        );
        if (state.error.type === 'blocked_task') {
          logger.warn(
            `[Orchestration Router] Blocked task detected, routing to END node`
          );
          return GraphNode.TASK_MANAGER;
        }
        return GraphNode.END_GRAPH;
      }
      if (currentTask && currentTask.status === 'waiting_validation') {
        logger.debug(
          `[Orchestration Router] Task completed, routing to task verifier`
        );
        return GraphNode.TASK_VERIFIER;
      } else {
        logger.debug(
          `[Orchestration Router] Execution complete, routing to memory`
        );
        return GraphNode.MEMORY_ORCHESTRATOR;
      }
    }

    if (isInEnum(TaskManagerNode, state.last_node)) {
      logger.debug(`[Orchestration Router] Plan validated, routing to memory`);
      return GraphNode.MEMORY_ORCHESTRATOR;
    }

    logger.debug(`[Orchestration Router] Default routing to executor`);
    return GraphNode.AGENT_EXECUTOR;
  }
  private initGraphStateValue(
    state: typeof GraphState.State,
    config: RunnableConfig<typeof GraphConfigurableAnnotation.State>
  ): GraphStateType {
    logger.debug('[Agent] Initializing graph state values');
    if (!config.configurable?.agent_config) {
      throw new Error('Agent configuration is required in config');
    }
    console.log(config);
    const memorySize =
      config.configurable.agent_config.memory.size_limits
        .short_term_memory_size;
    state.memories = MemoryStateManager.createInitialState(memorySize);
    console.log('Initial state:', state.memories);
    return state;
  }

  private buildWorkflow(): StateGraph<
    typeof GraphState.State,
    typeof GraphConfigurableAnnotation.State
  > {
    logger.debug('[Agent] Building workflow with initialized components');
    const memory = new MemoryGraph(
      this.agentConfig.graph.model,
      this.agentConfig.memory
    );
    const taskManager = new TaskManagerGraph(this.agentConfig, this.toolsList);

    const executor = new AgentExecutorGraph(
      this.agentConfig,
      this.agentConfig.graph.model,
      this.toolsList
    );

    const taskVerifier = new TaskVerifierGraph(this.agentConfig.graph.model);

    executor.createAgentExecutorGraph();
    memory.createGraphMemory();
    taskManager.createTaskManagerGraph();
    taskVerifier.createTaskVerifierGraph();

    const executor_graph = executor.getExecutorGraph();
    const memory_graph = memory.getMemoryGraph();
    const task_manager_graph = taskManager.getTaskManagerGraph();
    const task_verifier_graph = taskVerifier.getVerifierGraph();
    const workflow = new StateGraph(GraphState, GraphConfigurableAnnotation)
      .addNode(GraphNode.INIT_STATE_VALUE, this.initGraphStateValue.bind(this))
      .addNode(GraphNode.TASK_MANAGER, task_manager_graph)
      .addNode(GraphNode.MEMORY_ORCHESTRATOR, memory_graph)
      .addNode(GraphNode.AGENT_EXECUTOR, executor_graph)
      .addNode(GraphNode.TASK_VERIFIER, task_verifier_graph)
      .addNode(GraphNode.END_GRAPH, this.end_graph.bind(this))
      .addEdge('__start__', GraphNode.INIT_STATE_VALUE)
      .addEdge(GraphNode.INIT_STATE_VALUE, GraphNode.TASK_MANAGER)
      .addConditionalEdges(
        GraphNode.TASK_MANAGER,
        this.orchestrationRouter.bind(this)
      )
      .addConditionalEdges(
        GraphNode.MEMORY_ORCHESTRATOR,
        this.orchestrationRouter.bind(this)
      )
      .addConditionalEdges(
        GraphNode.AGENT_EXECUTOR,
        this.orchestrationRouter.bind(this)
      )
      .addConditionalEdges(
        GraphNode.TASK_VERIFIER,
        this.orchestrationRouter.bind(this)
      )
      .addEdge(GraphNode.END_GRAPH, END);
    return workflow as unknown as StateGraph<
      typeof GraphState.State,
      typeof GraphConfigurableAnnotation.State
    >;
  }

  async initialize(): Promise<CompiledStateGraph<any, any, any, any, any>> {
    try {
      // Get agent configuration
      this.agentConfig = this.snakAgent.getAgentConfig();
      if (!this.agentConfig) {
        throw new Error('Agent configuration is required');
      }

      // Initialize database
      await initializeDatabase(this.snakAgent.getDatabaseCredentials());
      // Initialize tools
      this.toolsList = await initializeToolsList(
        this.snakAgent,
        this.agentConfig
      );
      this.toolsList = this.toolsList.filter(
        (tool) =>
          tool.name !== 'mobile_take_screenshot' &&
          tool.name !== 'mobile_save_screenshot'
      );
      this.toolsList.forEach((tool) => {
        logger.debug(`[Agent] Tool initialized: ${tool.name}`);
      });
      // Initialize RAG agent if enabled
      if (this.agentConfig.rag?.enabled !== false) {
        await this.initializeRagAgent();
      }

      // Build and compile the workflow
      const workflow = this.buildWorkflow();
      const app = workflow.compile({ checkpointer: this.checkpointer });
      logger.info('Agent] Successfully initialized agent');
      return app;
    } catch (error) {
      logger.error('[Agent] Failed to create agent:', error);
      throw error;
    }
  }

  public updateConfig(
    newConfig: typeof GraphConfigurableAnnotation.State
  ): void {
    if (!this.app) {
      throw new Error('Agent not initialized. Call initialize() first.');
    }
    this.config = newConfig;
    logger.debug('[Agent] Configuration updated successfully');
  }
}

// ============================================
// FACTORY FUNCTION
// ============================================

export const createGraph = async (
  snakAgent: SnakAgent
): Promise<CompiledStateGraph<any, any, any, any, any>> => {
  const agent = new Graph(snakAgent);
  return agent.initialize();
};
