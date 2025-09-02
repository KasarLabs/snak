import { AgentConfig, AgentMode, logger } from '@snakagent/core';
import { SnakAgentInterface } from '../../tools/tools.js';
import { StateGraph, MemorySaver, Annotation, END } from '@langchain/langgraph';
import {
  DynamicStructuredTool,
  StructuredTool,
  Tool,
} from '@langchain/core/tools';
import { AnyZodObject, z } from 'zod';
import { BaseMessage } from '@langchain/core/messages';
import { ModelSelector } from '../operators/modelSelector.js';
import { initializeDatabase, initializeToolsList } from '../core/utils.js';
import { RunnableConfig } from '@langchain/core/runnables';
import { MemoryAgent } from '../../agents/operators/memoryAgent.js';
import { RagAgent } from '../../agents/operators/ragAgent.js';
import {
  GraphNode,
  DEFAULT_GRAPH_CONFIG,
  ConfigValidator,
  DEFAULT_AGENT_CONFIG,
} from './config/default-config.js';
import {
  Agent,
  AgentReturn,
  History,
  Memories,
  ParsedPlan,
  StepInfo,
} from './types/index.js';
import { MemoryStateManager } from './utils/memory-utils.js';
import { MemoryGraph } from './sub-graph/memory.js';
import { PlannerGraph } from './sub-graph/planner_graph.js';
import { AgentExecutorGraph } from './sub-graph/executor_graph.js';
import { v4 as uuidv4 } from 'uuid';

export enum ExecutionMode {
  PLANNING = 'PLANNING',
  REACTIVE = 'REACTIVE',
  AUTOMATIC = 'AUTOMATIC', // Let the system decide based on query complexity
}
export const GraphState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => y,
    default: () => [],
  }),
  last_agent: Annotation<Agent>({
    reducer: (x, y) => y,
    default: () => Agent.START,
  }),
  memories: Annotation<Memories>({
    reducer: (x, y) => y,
    default: () => MemoryStateManager.createInitialState(5),
  }),
  rag: Annotation<string>({
    reducer: (x, y) => y,
    default: () => '',
  }),
  plans_or_histories: Annotation<Array<ParsedPlan | History>>({
    reducer: (
      x: Array<ParsedPlan | History>,
      y: ParsedPlan | History | Array<ParsedPlan | History>
    ) => {
      logger.debug('Plans Or Histories Reducer Called');
      if (y === undefined) return x;
      if (Array.isArray(y)) return y;
      if (x === undefined || x.length === 0) {
        logger.debug(`First Plan/History Added.`);
        return [y];
      }
      if (x[x.length - 1].id === y.id) {
        logger.debug('Plan/History Updated.');
        return [...x.slice(0, -1), y];
      } else {
        logger.debug('Plan/History Added.');
        x.push(y);
        return x;
      }
    },
    default: () => [],
  }),
  currentStepIndex: Annotation<number>({
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
  skipValidation: Annotation<{ skipValidation: boolean; goto: string }>({
    reducer: (x, y) => y,
    default: () => ({ skipValidation: false, goto: '' }),
  }),
  error: Annotation<{
    hasError: boolean;
    message: string;
    source: string;
    timestamp: number;
  } | null>({
    reducer: (x, y) => y,
    default: () => null,
  }),
});

export const GraphConfigurableAnnotation = Annotation.Root({
  thread_id: Annotation<string | undefined>({
    reducer: (x, y) => y,
    default: () => undefined,
  }),
  max_graph_steps: Annotation<number>({
    reducer: (x, y) => y,
    default: () => 100,
  }),
  short_term_memory: Annotation<number>({
    reducer: (x, y) => y,
    default: () => 5,
  }),
  memory_size: Annotation<number>({
    reducer: (x, y) => y,
    default: () => 20,
  }),
  human_in_the_loop: Annotation<number>({
    reducer: (x, y) => y,
    default: () => 0,
  }),
  agent_config: Annotation<AgentConfig | undefined>({
    reducer: (x, y) => y,
    default: () => undefined,
  }),
  user_request: Annotation<string | undefined>({
    reducer: (x, y) => y,
    default: () => undefined,
  }),
  executionMode: Annotation<ExecutionMode>({
    reducer: (x, y) => y,
    default: () => ExecutionMode.REACTIVE,
  }),
});
export class Graph {
  private modelSelector: ModelSelector | null;
  private toolsList: (
    | StructuredTool
    | Tool
    | DynamicStructuredTool<AnyZodObject>
  )[] = [];
  private memoryAgent: MemoryAgent | null = null;
  private agentConfig: AgentConfig;
  private ragAgent: RagAgent | null = null;
  private checkpointer: MemorySaver;
  private app: any;

  constructor(
    private snakAgent: SnakAgentInterface,
    modelSelector: ModelSelector | null
  ) {
    this.modelSelector = modelSelector;
    this.checkpointer = new MemorySaver();
  }

  private async initializeMemoryAgent(): Promise<void> {
    try {
      this.memoryAgent = this.snakAgent.getMemoryAgent();
      if (this.memoryAgent) {
        logger.debug('Agent] Memory agent retrieved successfully');
        // const memoryTools = this.memoryAgent.prepareMemoryTools(); TODO
        // this.toolsList.push(...memoryTools);
      } else {
        logger.warn(
          'Agent] WARNING: Memory agent not available - memory features will be limited'
        );
      }
    } catch (error) {
      logger.error(`Agent] Failed to retrieve memory agent: ${error}`);
    }
  }

  private async initializeRagAgent(): Promise<void> {
    try {
      this.ragAgent = this.snakAgent.getRagAgent();
      if (!this.ragAgent) {
        logger.warn(
          'Agent] WARNING: RAG agent not available - RAG context will be skipped'
        );
      }
    } catch (error) {
      logger.error(`Agent] Failed to retrieve RAG agent: ${error}`);
    }
  }

  private end_graph(state: typeof GraphState): {
    plans_or_histories: Array<ParsedPlan | History> | undefined;
    currentStepIndex: number;
    retry: number;
  } {
    logger.info('[EndGraph] Cleaning up state for graph termination');
    return {
      plans_or_histories: undefined,
      currentStepIndex: 0,
      retry: 0,
    };
  }

  private orchestrationRouter(
    state: typeof GraphState.State,
    config: RunnableConfig<typeof GraphConfigurableAnnotation.State>
  ): GraphNode {
    logger.debug(`[Orchestration Router] Last agent: ${state.last_agent}`);

    // Check for errors first
    if (state.error?.hasError) {
      logger.error(
        `[Orchestration Router] Error detected from ${state.error.source}: ${state.error.message}`
      );
      return GraphNode.END_GRAPH;
    }

    const l_msg = state.messages[state.messages.length - 1];
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

    if (state.last_agent === Agent.EXEC_VALIDATOR) {
      logger.debug(
        `[Orchestration Router] Execution complete, routing to memory`
      );
      return GraphNode.MEMORY_ORCHESTRATOR;
    }

    if (state.last_agent === Agent.PLANNER_VALIDATOR) {
      logger.debug(`[Orchestration Router] Plan validated, routing to memory`);
      return GraphNode.MEMORY_ORCHESTRATOR;
    }

    if (state.last_agent === Agent.MEMORY_MANAGER) {
      const executionMode = config.configurable?.executionMode;
      if (
        l_msg.additional_kwargs.final === true &&
        executionMode === ExecutionMode.PLANNING
      ) {
        logger.debug(
          `[Orchestration Router] Final execution reached in PLANNING mode, routing to planner`
        );
        return GraphNode.PLANNING_ORCHESTRATOR;
      } else if (
        l_msg.additional_kwargs.final === true &&
        executionMode === ExecutionMode.REACTIVE
      ) {
        logger.debug(
          `[Orchestration Router] Final execution reached in REACTIVE mode, routing to end`
        );
        return GraphNode.END_GRAPH;
      }
    }

    logger.debug(`[Orchestration Router] Default routing to executor`);
    return GraphNode.AGENT_EXECUTOR;
  }

  private startOrchestrationRouter(
    state: typeof GraphState.State,
    config: RunnableConfig<typeof GraphConfigurableAnnotation.State>
  ): GraphNode {
    try {
      const agentConfig =
        config.configurable?.agent_config ?? DEFAULT_GRAPH_CONFIG.agent_config;
      if (!agentConfig) {
        throw new Error(
          '[Start Orchestration Router] AgentConfig is undefined.'
        );
      }
      const currentMode: AgentMode = agentConfig.mode;
      const executionMode = config.configurable?.executionMode;

      switch (currentMode) {
        case AgentMode.INTERACTIVE:
          if (executionMode !== ExecutionMode.REACTIVE) {
            return GraphNode.PLANNING_ORCHESTRATOR;
          } else {
            return GraphNode.AGENT_EXECUTOR;
          }
        case AgentMode.AUTONOMOUS:
          return GraphNode.PLANNING_ORCHESTRATOR;
        case AgentMode.HYBRID:
          return GraphNode.END_GRAPH;
        default:
          throw new Error(
            `[Start Orchestration Router] No Agent entry point Found find for mode : ${currentMode}`
          );
      }
    } catch (error) {
      logger.error(error);
      return GraphNode.END_GRAPH;
    }
  }

  private getCompileOptions(): {
    checkpointer?: MemorySaver;
    configurable?: Record<string, any>;
  } {
    const baseOptions = this.agentConfig.memory
      ? {
          checkpointer: this.checkpointer,
        }
      : {};
    const validatedConfig = ConfigValidator.validate({
      maxGraphSteps: DEFAULT_GRAPH_CONFIG.maxGraphSteps,
      shortTermMemory: DEFAULT_GRAPH_CONFIG.shortTermMemory,
      memorySize: DEFAULT_GRAPH_CONFIG.memorySize,
      humanInTheLoop: DEFAULT_GRAPH_CONFIG.humanInTheLoop,
    });

    return {
      ...baseOptions,
      configurable: {
        max_graph_steps: validatedConfig.maxGraphSteps,
        short_term_memory: validatedConfig.shortTermMemory,
        memory_size: validatedConfig.memorySize,
        human_in_the_loop: validatedConfig.humanInTheLoop,
        agent_config: this.agentConfig,
      },
    };
  }

  private buildWorkflow(): StateGraph<
    typeof GraphState.State,
    typeof GraphConfigurableAnnotation.State
  > {
    if (!this.memoryAgent) {
      throw new Error('MemoryAgent is not setup');
    }

    logger.debug(' Agent] Building workflow with initialized components');
    const memory = new MemoryGraph(
      this.agentConfig,
      this.modelSelector,
      this.memoryAgent
    );
    const planner = new PlannerGraph(
      this.agentConfig,
      this.modelSelector as ModelSelector,
      this.toolsList
    );

    const executor = new AgentExecutorGraph(
      this.agentConfig,
      this.modelSelector as ModelSelector,
      this.toolsList
    );

    executor.createAgentExecutorGraph();
    memory.createGraphMemory();
    planner.createPlannerGraph();
    const executor_graph = executor.getExecutorGraph();
    const memory_graph = memory.getMemoryGraph();
    const planner_graph = planner.getPlannerGraph();
    const workflow = new StateGraph(GraphState, GraphConfigurableAnnotation)
      .addNode(GraphNode.PLANNING_ORCHESTRATOR, planner_graph)
      .addNode(GraphNode.MEMORY_ORCHESTRATOR, memory_graph)
      .addNode(GraphNode.AGENT_EXECUTOR, executor_graph)
      .addNode(GraphNode.END_GRAPH, this.end_graph.bind(this))
      .addConditionalEdges(
        '__start__',
        this.startOrchestrationRouter.bind(this)
      )
      .addConditionalEdges(
        GraphNode.PLANNING_ORCHESTRATOR,
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
      .addEdge(GraphNode.END_GRAPH, END);
    return workflow as unknown as StateGraph<
      typeof GraphState.State,
      typeof GraphConfigurableAnnotation.State
    >;
  }

  async initialize(): Promise<AgentReturn> {
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

      // Initialize memory agent if enabled
      await this.initializeMemoryAgent();

      // Initialize RAG agent if enabled
      if (this.agentConfig.rag?.enabled !== false) {
        await this.initializeRagAgent();
      }

      // Build and compile the workflow
      const workflow = this.buildWorkflow();
      this.app = workflow.compile(this.getCompileOptions());

      logger.info('Agent] Successfully initialized agent');

      return {
        app: this.app,
        agent_config: this.agentConfig,
      };
    } catch (error) {
      logger.error('Agent] Failed to create agent:', error);
      throw error;
    }
  }
}

// ============================================
// FACTORY FUNCTION
// ============================================

export const createGraph = async (
  snakAgent: SnakAgentInterface,
  modelSelector: ModelSelector | null
): Promise<AgentReturn> => {
  const agent = new Graph(snakAgent, modelSelector);
  return agent.initialize();
};
