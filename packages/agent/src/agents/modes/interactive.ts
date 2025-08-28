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
  InteractiveGraphNode,
  DEFAULT_INTERACTIVE_CONFIG,
  ConfigValidator,
} from './config/interactive-config.js';
import { Agent, AgentReturn, Memories, ParsedPlan } from './types/index.js';
import { MemoryStateManager } from './utils/memory-utils.js';
import { MemoryGraph } from './sub-graph/memory.js';
import { PlannerGraph } from './sub-graph/planner_graph.js';
import { AgentExecutorGraph } from './sub-graph/executor_graph.js';
import { v4 as uuidv4 } from 'uuid';

export const InteractiveGraphState = Annotation.Root({
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
});

export const InteractiveConfigurableAnnotation = Annotation.Root({
  short_term_memory: Annotation<number>({
    reducer: (x, y) => y,
    default: () => 5,
  }),
  memory_size: Annotation<number>({
    reducer: (x, y) => y,
    default: () => 20,
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
export class InteractiveAgent {
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
        logger.debug('[InteractiveAgent] Memory agent retrieved successfully');
        // const memoryTools = this.memoryAgent.prepareMemoryTools(); TODO
        // this.toolsList.push(...memoryTools);
      } else {
        logger.warn(
          '[InteractiveAgent] WARNING: Memory agent not available - memory features will be limited'
        );
      }
    } catch (error) {
      logger.error(
        `[InteractiveAgent] Failed to retrieve memory agent: ${error}`
      );
    }
  }

  private async initializeRagAgent(): Promise<void> {
    try {
      this.ragAgent = this.snakAgent.getRagAgent();
      if (!this.ragAgent) {
        logger.warn(
          '[InteractiveAgent] WARNING: RAG agent not available - RAG context will be skipped'
        );
      }
    } catch (error) {
      logger.error(`[InteractiveAgent] Failed to retrieve RAG agent: ${error}`);
    }
  }

  // --- END GRAPH NODE ---
  private end_graph(state: typeof InteractiveGraphState): {
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
    state: typeof InteractiveGraphState.State,
    config: RunnableConfig<typeof InteractiveConfigurableAnnotation.State>
  ): InteractiveGraphNode {
    logger.debug(`[Orchestration Router] Last agent: ${state.last_agent}`);

    if (state.last_agent === Agent.EXEC_VALIDATOR) {
      logger.debug(
        `[Orchestration Router] Execution complete, routing to memory`
      );
      return InteractiveGraphNode.MEMORY_ORCHESTRATOR;
    }

    if (state.last_agent === Agent.PLANNER_VALIDATOR) {
      logger.debug(`[Orchestration Router] Plan validated, routing to memory`);
      return InteractiveGraphNode.MEMORY_ORCHESTRATOR;
    }

    if (state.last_agent === Agent.MEMORY_MANAGER) {
      if (
        state.messages[state.messages.length - 1].additional_kwargs.final ===
        true
      ) {
        logger.debug(
          `[Orchestration Router] Final execution reached, routing to planner`
        );
        return InteractiveGraphNode.PLANNING_ORCHESTRATOR;
      }
    }

    logger.debug(`[Orchestration Router] Default routing to executor`);
    return InteractiveGraphNode.AGENT_EXECUTOR;
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
      shortTermMemory: DEFAULT_INTERACTIVE_CONFIG.shortTermMemory,
      memorySize: DEFAULT_INTERACTIVE_CONFIG.memorySize,
    });

    return {
      ...baseOptions,
      configurable: {
        short_term_memory: validatedConfig.shortTermMemory,
        memory_size: validatedConfig.memorySize,
        agent_config: this.agentConfig,
      },
    };
  }

  private buildWorkflow(): StateGraph<
    typeof InteractiveGraphState.State,
    typeof InteractiveConfigurableAnnotation.State
  > {
    if (!this.memoryAgent) {
      throw new Error('MemoryAgent is not setup');
    }

    logger.debug(
      '[InteractiveAgent] Building workflow with initialized components'
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
      InteractiveGraphState,
      InteractiveConfigurableAnnotation
    )
      .addNode(InteractiveGraphNode.PLANNING_ORCHESTRATOR, planner_graph)
      .addNode(InteractiveGraphNode.MEMORY_ORCHESTRATOR, memory_graph)
      .addNode(InteractiveGraphNode.AGENT_EXECUTOR, executor_graph)
      .addNode(InteractiveGraphNode.END_GRAPH, this.end_graph.bind(this))
      .addEdge('__start__', InteractiveGraphNode.PLANNING_ORCHESTRATOR)
      .addConditionalEdges(
        InteractiveGraphNode.PLANNING_ORCHESTRATOR,
        this.orchestrationRouter.bind(this)
      )
      .addConditionalEdges(
        InteractiveGraphNode.MEMORY_ORCHESTRATOR,
        this.orchestrationRouter.bind(this)
      )
      .addConditionalEdges(
        InteractiveGraphNode.AGENT_EXECUTOR,
        this.orchestrationRouter.bind(this)
      )
      .addEdge(InteractiveGraphNode.END_GRAPH, END);

    return workflow as unknown as StateGraph<
      typeof InteractiveGraphState.State,
      typeof InteractiveConfigurableAnnotation.State
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
        '[InteractiveAgent] Successfully initialized interactive agent'
      );

      return {
        app: this.app,
        agent_config: this.agentConfig,
      };
    } catch (error) {
      logger.error(
        '[InteractiveAgent] Failed to create interactive agent:',
        error
      );
      throw error;
    }
  }
}

// ============================================
// FACTORY FUNCTION
// ============================================

export const createInteractiveAgent = async (
  snakAgent: SnakAgentInterface,
  modelSelector: ModelSelector | null
): Promise<AgentReturn> => {
  const agent = new InteractiveAgent(snakAgent, modelSelector);
  return agent.initialize();
};
