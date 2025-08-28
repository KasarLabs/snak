import { AgentConfig, logger } from '@snakagent/core';
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
import { MemoryAgent } from 'agents/operators/memoryAgent.js';
import { RagAgent } from 'agents/operators/ragAgent.js';
import {
  AutonomousGraphNode,
  DEFAULT_AUTONOMOUS_CONFIG,
  ConfigValidator,
} from './config/autonomous-config.js';
import { Agent, AgentReturn, Memories, ParsedPlan } from './types/index.js';
import { MemoryStateManager } from './utils/memory-utils.js';
import { MemoryGraph } from './sub-graph/memory.js';
import { PlannerGraph } from './sub-graph/planner_graph.js';
import { AgentExecutorGraph } from './sub-graph/executor_graph.js';
import { v4 as uuidv4 } from 'uuid';

export const AutonomousGraphState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
  last_message: Annotation<BaseMessage | BaseMessage[]>({
    reducer: (x, y) => y,
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
  plan: Annotation<ParsedPlan>({
    reducer: (x, y) => y,
    default: () => ({
      steps: [],
      summary: '',
    }),
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
});

export const AutonomousConfigurableAnnotation = Annotation.Root({
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
  human_in_the_loop: Annotation<boolean>({
    reducer: (x, y) => y,
    default: () => false,
  }),
  agent_config: Annotation<AgentConfig | undefined>({
    reducer: (x, y) => y,
    default: () => undefined,
  }),
  conversation_id: Annotation<string>({
    reducer: (x, y) => y,
    default: () => uuidv4(),
  }),
});
export class AutonomousAgent {
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
        logger.debug('[AutonomousAgent] Memory agent retrieved successfully');
        // const memoryTools = this.memoryAgent.prepareMemoryTools(); TODO
        // this.toolsList.push(...memoryTools);
      } else {
        logger.warn(
          '[AutonomousAgent] WARNING: Memory agent not available - memory features will be limited'
        );
      }
    } catch (error) {
      logger.error(
        `[AutonomousAgent] Failed to retrieve memory agent: ${error}`
      );
    }
  }

  private async initializeRagAgent(): Promise<void> {
    try {
      this.ragAgent = this.snakAgent.getRagAgent();
      if (!this.ragAgent) {
        logger.warn(
          '[AutonomousAgent] WARNING: RAG agent not available - RAG context will be skipped'
        );
      }
    } catch (error) {
      logger.error(`[AutonomousAgent] Failed to retrieve RAG agent: ${error}`);
    }
  }

  // --- END GRAPH NODE ---
  private end_graph(state: typeof AutonomousGraphState): {
    plan: ParsedPlan;
    currentStepIndex: number;
    retry: number;
  } {
    logger.info('[EndGraph] Cleaning up state for graph termination');
    const emptyPlan: ParsedPlan = {
      steps: [],
      summary: '',
    };
    return {
      plan: emptyPlan,
      currentStepIndex: 0,
      retry: 0,
    };
  }

  private orchestrationRouter(
    state: typeof AutonomousGraphState.State,
    config: RunnableConfig<typeof AutonomousConfigurableAnnotation.State>
  ): AutonomousGraphNode {
    logger.debug(`[Orchestration Router] Last agent: ${state.last_agent}`);

    if (state.skipValidation.skipValidation) {
      const validTargets = Object.values(AutonomousGraphNode);
      const goto = state.skipValidation.goto as AutonomousGraphNode;

      if (validTargets.includes(goto)) {
        logger.debug(
          `[Orchestration Router] Skip validation routing to: ${goto}`
        );
        return goto;
      } else {
        logger.warn(
          `[Orchestration Router] Invalid skip validation target: ${goto}, defaulting to end_graph`
        );
        return AutonomousGraphNode.END_GRAPH;
      }
    }

    if (state.last_agent === Agent.EXEC_VALIDATOR) {
      logger.debug(
        `[Orchestration Router] Execution complete, routing to memory`
      );
      return AutonomousGraphNode.MEMORY_ORCHESTRATOR;
    }

    if (state.last_agent === Agent.PLANNER_VALIDATOR) {
      logger.debug(`[Orchestration Router] Plan validated, routing to memory`);
      return AutonomousGraphNode.MEMORY_ORCHESTRATOR;
    }

    if (state.last_agent === Agent.MEMORY_MANAGER) {
      if (
        (state.last_message as BaseMessage).additional_kwargs.final === true
      ) {
        logger.debug(
          `[Orchestration Router] Final execution reached, routing to planner`
        );
        return AutonomousGraphNode.PLANNING_ORCHESTRATOR;
      }
    }

    logger.debug(`[Orchestration Router] Default routing to executor`);
    return AutonomousGraphNode.AGENT_EXECUTOR;
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
      maxGraphSteps: DEFAULT_AUTONOMOUS_CONFIG.maxGraphSteps,
      shortTermMemory: DEFAULT_AUTONOMOUS_CONFIG.shortTermMemory,
      memorySize: DEFAULT_AUTONOMOUS_CONFIG.memorySize,
      humanInTheLoop: DEFAULT_AUTONOMOUS_CONFIG.humanInTheLoop,
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
    typeof AutonomousGraphState.State,
    typeof AutonomousConfigurableAnnotation.State
  > {
    if (!this.memoryAgent) {
      throw new Error('MemoryAgent is not setup');
    }

    logger.debug(
      '[Autonomous Agent] Building workflow with initialized components'
    );
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
    const workflow = new StateGraph(
      AutonomousGraphState,
      AutonomousConfigurableAnnotation
    )
      .addNode(AutonomousGraphNode.PLANNING_ORCHESTRATOR, planner_graph)
      .addNode(AutonomousGraphNode.MEMORY_ORCHESTRATOR, memory_graph)
      .addNode(AutonomousGraphNode.AGENT_EXECUTOR, executor_graph)
      .addNode(AutonomousGraphNode.END_GRAPH, this.end_graph.bind(this))
      .addEdge('__start__', AutonomousGraphNode.PLANNING_ORCHESTRATOR)
      .addConditionalEdges(
        AutonomousGraphNode.PLANNING_ORCHESTRATOR,
        this.orchestrationRouter.bind(this)
      )
      .addConditionalEdges(
        AutonomousGraphNode.MEMORY_ORCHESTRATOR,
        this.orchestrationRouter.bind(this)
      )
      .addConditionalEdges(
        AutonomousGraphNode.AGENT_EXECUTOR,
        this.orchestrationRouter.bind(this)
      )
      .addEdge(AutonomousGraphNode.END_GRAPH, END);

    return workflow as unknown as StateGraph<
      typeof AutonomousGraphState.State,
      typeof AutonomousConfigurableAnnotation.State
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

      logger.info(
        '[AutonomousAgent] Successfully initialized autonomous agent'
      );

      return {
        app: this.app,
        agent_config: this.agentConfig,
      };
    } catch (error) {
      logger.error(
        '[AutonomousAgent] Failed to create autonomous agent:',
        error
      );
      throw error;
    }
  }
}

// ============================================
// FACTORY FUNCTION
// ============================================

export const createAutonomousAgent = async (
  snakAgent: SnakAgentInterface,
  modelSelector: ModelSelector | null
): Promise<AgentReturn> => {
  const agent = new AutonomousAgent(snakAgent, modelSelector);
  return agent.initialize();
};
