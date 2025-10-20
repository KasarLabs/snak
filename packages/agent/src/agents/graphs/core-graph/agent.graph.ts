import { AgentConfig, DEFAULT_AGENT_CONFIG, logger } from '@snakagent/core';
import {
  StateGraph,
  Annotation,
  END,
  CompiledStateGraph,
  interrupt,
  START,
} from '@langchain/langgraph';
import {
  DynamicStructuredTool,
  StructuredTool,
  Tool,
} from '@langchain/core/tools';
import { AnyZodObject } from 'zod';
import {
  BaseMessage,
  HumanMessage,
  AIMessageChunk,
} from '@langchain/core/messages';
import { RunnableConfig } from '@langchain/core/runnables';
import { RagAgent } from '../../operators/ragAgent.js';
import {
  GraphNode,
  TaskExecutorNode,
  TaskManagerNode,
  TaskMemoryNode,
  TaskVerifierNode,
} from '../../../shared/enums/agent.enum.js';
import {
  GraphErrorType,
  Memories,
  skipValidationType,
  TaskType,
  userRequestWithHITL,
} from '../../../shared/types/index.js';
import { MemoryStateManager } from '../manager/memory/memory-utils.js';
import { MemoryGraph } from '../sub-graph/task-memory.graph.js';
import { TaskManagerGraph } from '../sub-graph/task-manager.graph.js';
import { AgentExecutorGraph } from '../sub-graph/task-executor.graph.js';
import { TaskVerifierGraph } from '../sub-graph/task-verifier.graph.js';
import { isInEnum } from '../../../shared/enums/index.js';
import { initializeDatabase } from '../../utils/database.utils.js';
import { initializeToolsList } from '../../../tools/tools.js';
import { SnakAgent } from '@agents/core/snakAgent.js';
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import { getCurrentTask } from '../utils/graph.utils.js';
import { STMManager } from '@lib/memory/index.js';
import { ToolCallType } from '../../../shared/types/index.js';
import { GraphError } from '../utils/error.utils.js';

export const GraphState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => {
      return y;
    },
    default: () => [],
  }),
  lastNode: Annotation<
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
  user_request: Annotation<userRequestWithHITL | undefined>({
    reducer: (x, y) => y,
    default: () => {
      return { request: '', hitl_threshold: 0 };
    },
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
  private graph: CompiledStateGraph<any, any, any, any, any, any>;
  private config: typeof GraphConfigurableAnnotation.State | null = null;

  constructor(private snakAgent: SnakAgent) {
    const pg_checkpointer = snakAgent.getPgCheckpointer();
    if (!pg_checkpointer) {
      throw new GraphError('E08GI110', 'Graph.constructor');
    }
    this.checkpointer = pg_checkpointer;
  }

  async initialize(): Promise<CompiledStateGraph<any, any, any, any, any>> {
    try {
      // Get agent configuration
      this.agentConfig = this.snakAgent.getAgentConfig();
      if (!this.agentConfig) {
        throw new GraphError('E08GI140', 'Graph.initialize');
      }

      // Initialize database
      await initializeDatabase(this.snakAgent.getDatabaseCredentials());
      this.toolsList = await initializeToolsList(this.agentConfig);
      // Initialize RAG agent if enabled
      if (this.agentConfig.rag?.enabled !== false) {
        await this.initializeRagAgent();
      }

      // Build and compile the workflow
      const workflow = this.buildWorkflow();
      const graph = workflow.compile({ checkpointer: this.checkpointer });
      logger.info('[Agent] Successfully initialized agent');
      return graph;
    } catch (error) {
      logger.error('[Agent] Failed to create agent:', error);
      throw error;
    }
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
    retry: number;
    skipValidation: skipValidationType;
    error: null;
  } {
    logger.info('[EndGraph] Cleaning up state for graph termination');
    return {
      retry: 0,
      skipValidation: { skipValidation: false, goto: '' },
      error: null,
    };
  }

  private orchestrationRouter(
    state: typeof GraphState.State,
    config: RunnableConfig<typeof GraphConfigurableAnnotation.State>
  ): GraphNode {
    if (state.error?.hasError && state.error.type !== 'block_task') {
      logger.error(
        `[Router] Error: ${state.error.source} -> ${state.error.message}`
      );
      return GraphNode.END_GRAPH;
    }
    const currentTask = state.tasks[state.tasks.length - 1];

    if (state.skipValidation.skipValidation) {
      const validTargets = Object.values(GraphNode);
      const goto = state.skipValidation.goto as GraphNode;

      if (validTargets.includes(goto)) {
        return goto;
      } else {
        logger.warn(`[Router] Invalid skip target: ${goto}`);
        return GraphNode.END_GRAPH;
      }
    }

    if (isInEnum(TaskVerifierNode, state.lastNode))
      if (state.lastNode === TaskVerifierNode.TASK_UPDATER) {
        if (
          currentTask.status === 'completed' ||
          currentTask.status === 'failed'
        ) {
          return GraphNode.MEMORY_ORCHESTRATOR;
        }
      }
    if (isInEnum(TaskMemoryNode, state.lastNode)) {
      if (
        currentTask.status === 'completed' ||
        currentTask.status === 'failed'
      ) {
        return GraphNode.TASK_MANAGER;
      } else {
        return GraphNode.AGENT_EXECUTOR;
      }
    }
    if (isInEnum(GraphNode, state.lastNode)) {
      if (state.lastNode === GraphNode.HUMAN_HANDLER) {
        const lastMessage = state.messages[state.messages.length - 1];
        const from = lastMessage?.additional_kwargs?.from;

        if (from === TaskManagerNode.HUMAN) {
          return GraphNode.TASK_MANAGER;
        }
        if (from === TaskExecutorNode.HUMAN) {
          return GraphNode.AGENT_EXECUTOR;
        }
        logger.warn(`[Router] Unknown human handler source`);
        return GraphNode.MEMORY_ORCHESTRATOR;
      }
    }

    if (isInEnum(TaskExecutorNode, state.lastNode)) {
      if (state.error && state.error.hasError) {
        if (state.error.type === 'block_task') {
          logger.warn(`[Router] Blocked task, routing to task manager`);
          return GraphNode.TASK_MANAGER;
        }
        return GraphNode.END_GRAPH;
      }
      if (currentTask && currentTask.status === 'waiting_validation') {
        return GraphNode.TASK_VERIFIER;
      } else {
        return GraphNode.MEMORY_ORCHESTRATOR;
      }
    }

    if (isInEnum(TaskManagerNode, state.lastNode)) {
      return GraphNode.MEMORY_ORCHESTRATOR;
    }

    return GraphNode.AGENT_EXECUTOR;
  }
  private initGraphStateValue(
    state: typeof GraphState.State,
    config: RunnableConfig<typeof GraphConfigurableAnnotation.State>
  ): GraphStateType {
    if (!config.configurable?.agent_config) {
      throw new GraphError('E08GC210', 'Graph.initGraphStateValue');
    }
    const memorySize =
      config.configurable.agent_config.memory.size_limits
        .short_term_memory_size;

    if (
      typeof memorySize !== 'number' ||
      memorySize < 0 ||
      !Number.isInteger(memorySize)
    ) {
      throw new GraphError('E08GC240', 'Graph.initGraphStateValue', undefined, {
        memorySize,
      });
    }
    if (!state.memories || state.memories.stm.items.length === 0) {
      state.memories = MemoryStateManager.createInitialState(memorySize);
    }
    return state;
  }

  private async human_handler(state: typeof GraphState.State): Promise<{
    messages: BaseMessage[];
    tasks: TaskType[];
    lastNode: GraphNode;
    currentGraphStep: number;
    memories?: Memories;
    skipValidation?: skipValidationType;
  }> {
    const currentTask = getCurrentTask(state.tasks);
    if (!currentTask) {
      throw new GraphError('E08HI710', 'Graph.human_handler');
    }

    const requestSource = state.lastNode;
    logger.info(`[HumanHandler] Processing input from: ${requestSource}`);

    if (
      requestSource === TaskManagerNode.HUMAN ||
      requestSource === TaskManagerNode.CREATE_TASK
    ) {
      const h_input = interrupt(currentTask.thought.speak);
      if (!h_input) {
        throw new GraphError('E08HI720', 'Graph.human_handler[Manager]');
      }

      currentTask.human = h_input;
      currentTask.status = 'completed';
      state.tasks[state.tasks.length - 1] = currentTask;

      return {
        messages: [
          new AIMessageChunk({
            content: h_input,
            additional_kwargs: { from: TaskManagerNode.HUMAN, final: false },
          }),
        ],
        tasks: state.tasks,
        lastNode: GraphNode.HUMAN_HANDLER,
        currentGraphStep: state.currentGraphStep + 1,
        skipValidation: { skipValidation: false, goto: '' },
      };
    }

    if (
      requestSource === TaskExecutorNode.HUMAN ||
      requestSource === TaskExecutorNode.REASONING_EXECUTOR
    ) {
      const currentStep = currentTask.steps[currentTask.steps.length - 1];
      if (!currentStep || currentStep.type !== 'human') {
        throw new GraphError('E08HI730', 'Graph.human_handler[Executor]');
      }

      const h_input = interrupt(currentStep.thought.speak);
      if (!h_input) {
        throw new GraphError('E08HI720', 'Graph.human_handler[Executor]');
      }

      const human_message = new HumanMessage({
        content: h_input,
        additional_kwargs: { from: TaskExecutorNode.HUMAN, final: false },
      });

      const newMemories = STMManager.addMemory(
        state.memories.stm,
        [human_message],
        currentTask.id,
        currentStep.id
      );
      if (!newMemories.success || !newMemories.data) {
        throw new GraphError(
          'E08MM410',
          'Graph.human_handler[Executor]',
          undefined,
          { error: newMemories.error }
        );
      }
      state.memories.stm = newMemories.data;

      currentStep.tool.forEach((t: ToolCallType) => {
        if (t.name === 'response_task') {
          t.status = 'completed';
          t.result = h_input;
        }
      });

      currentTask.steps[currentTask.steps.length - 1] = currentStep;
      state.tasks[state.tasks.length - 1] = currentTask;

      return {
        messages: [human_message],
        tasks: state.tasks,
        lastNode: GraphNode.HUMAN_HANDLER,
        currentGraphStep: state.currentGraphStep + 1,
        memories: state.memories,
        skipValidation: { skipValidation: false, goto: '' },
      };
    }

    throw new GraphError('E08HI740', 'Graph.human_handler', undefined, {
      requestSource,
    });
  }

  private buildWorkflow(): StateGraph<
    typeof GraphState.State,
    typeof GraphConfigurableAnnotation.State
  > {
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
      .addNode(GraphNode.HUMAN_HANDLER, this.human_handler.bind(this))
      .addNode(GraphNode.END_GRAPH, this.end_graph.bind(this))
      .addEdge(START, GraphNode.INIT_STATE_VALUE)
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
      .addConditionalEdges(
        GraphNode.HUMAN_HANDLER,
        this.orchestrationRouter.bind(this)
      )
      .addEdge(GraphNode.END_GRAPH, END);
    return workflow as unknown as StateGraph<
      typeof GraphState.State,
      typeof GraphConfigurableAnnotation.State
    >;
  }

  public updateConfig(
    newConfig: typeof GraphConfigurableAnnotation.State
  ): void {
    if (!this.graph) {
      throw new GraphError('E08GI100', 'Graph.updateConfig');
    }
    this.config = newConfig;
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
