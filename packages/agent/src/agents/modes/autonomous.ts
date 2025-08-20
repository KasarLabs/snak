import { AgentConfig, AgentMode, logger } from '@snakagent/core';
import { SnakAgentInterface } from '../../tools/tools.js';
import { createAllowedTools } from '../../tools/tools.js';
import {
  StateGraph,
  MemorySaver,
  Annotation,
  END,
  START,
  interrupt,
  MessagesAnnotation,
} from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { MCP_CONTROLLER } from '../../services/mcp/src/mcp.js';
import {
  DynamicStructuredTool,
  StructuredTool,
  Tool,
} from '@langchain/core/tools';
import { AnyZodObject, z } from 'zod';
import {
  BaseMessage,
  ToolMessage,
  HumanMessage,
  AIMessageChunk,
} from '@langchain/core/messages';
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from '@langchain/core/prompts';
import { ModelSelector } from '../operators/modelSelector.js';
import { LangGraphRunnableConfig } from '@langchain/langgraph';
import {
  initializeDatabase,
  initializeToolsList,
  truncateToolResults,
} from '../core/utils.js';
import { TokenTracker } from '../../token/tokenTracking.js';
import { Runnable, RunnableConfig } from '@langchain/core/runnables';
import { MemoryAgent } from 'agents/operators/memoryAgent.js';
import { RagAgent } from 'agents/operators/ragAgent.js';
import {
  GraphNode,
  DEFAULT_AUTONOMOUS_CONFIG,
  ConfigValidator,
} from './config/autonomous-config.js';
import {
  Agent,
  AgentReturn,
  Memories,
  ParsedPlan,
  StepInfo,
} from './types/index.js';
import {
  calculateTotalTokenFromSteps,
  createMaxIterationsResponse,
  estimateTokens,
  filterMessagesByShortTermMemory,
  formatExecutionMessage,
  formatParsedPlanSimple,
  formatShortMemoryMessage,
  formatStepsForContext,
  formatToolResponse,
  formatValidatorToolsExecutor,
  getLatestMessageForMessage,
  handleModelError,
  isTerminalMessage,
  PlanSchema,
  ValidatorResponseSchema,
} from './utils.js';
import {
  ADAPTIVE_PLANNER_CONTEXT_PROMPT,
  ADAPTIVE_PLANNER_SYSTEM_PROMPT,
  AUTONOMOUS_PLAN_EXECUTOR_SYSTEM_PROMPT,
  AUTONOMOUS_PLANNER_CONTEXT_PROMPT,
  HYBRID_PLAN_EXECUTOR_SYSTEM_PROMPT,
  REPLAN_EXECUTOR_SYSTEM_PROMPT,
  REPLANNER_CONTEXT_PROMPT,
} from '../../prompt/planner_prompt.js';
import {
  MESSAGE_STEP_EXECUTOR_SYSTEM_PROMPT,
  RETRY_MESSAGE_STEP_EXECUTOR_SYSTEM_PROMPT,
  RETRY_STEP_EXECUTOR_CONTEXT_PROMPT,
  RETRY_TOOLS_STEP_EXECUTOR_SYSTEM_PROMPT,
  STEP_EXECUTOR_CONTEXT,
  STEP_EXECUTOR_CONTEXT_PROMPT,
  TOOLS_STEP_EXECUTOR_SYSTEM_PROMPT,
} from '../../prompt/executor_prompts.js';
import {
  AUTONOMOUS_PLAN_VALIDATOR_SYSTEM_PROMPT,
  TOOLS_STEP_VALIDATOR_SYSTEM_PROMPT,
  VALIDATOR_EXECUTOR_CONTEXT,
} from '../../prompt/validator_prompt.js';
import { SUMMARIZE_AGENT } from '../../prompt/summary_prompts.js';
import {
  BaseChatModel,
  BaseChatModelCallOptions,
} from '@langchain/core/language_models/chat_models';
import { MemoryGraph } from './sub-graph/memory.js';
import { PlannerGraph } from './sub-graph/planner_graph.js';
import { AgentExecutorGraph } from './sub-graph/executor_graph.js';
import { exec } from 'child_process';

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
    default: () => ({ ltm: '', stm: [{ content: '', memories_id: '' }] }),
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
    default: () => 3,
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
        logger.debug(
          '[AutonomousAgent] ✅ Memory agent retrieved successfully'
        );
        const memoryTools = this.memoryAgent.prepareMemoryTools();
        this.toolsList.push(...memoryTools);
      } else {
        logger.warn(
          '[AutonomousAgent] ⚠️ Memory agent not available - memory features will be limited'
        );
      }
    } catch (error) {
      logger.error(
        `[AutonomousAgent] ❌ Failed to retrieve memory agent: ${error}`
      );
    }
  }

  private async initializeRagAgent(): Promise<void> {
    try {
      this.ragAgent = this.snakAgent.getRagAgent();
      if (!this.ragAgent) {
        logger.warn(
          '[AutonomousAgent] ⚠️ RAG agent not available - RAG context will be skipped'
        );
      }
    } catch (error) {
      logger.error(
        `[AutonomousAgent] ❌ Failed to retrieve RAG agent: ${error}`
      );
    }
  }

  // --- END GRAPH NODE ---
  private end_graph(state: typeof AutonomousGraphState): {
    plan: ParsedPlan;
    currentStepIndex: number;
    retry: number;
  } {
    logger.info('[EndGraph] 🏁 Cleaning up state for graph termination');
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
  ): GraphNode {
    logger.debug(`[Orchestration Router] Last agent: ${state.last_agent}`);

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
      if (
        (state.last_message as BaseMessage).additional_kwargs.final === 'true'
      ) {
        logger.debug(
          `[Orchestration Router] Final execution reached, routing to planner`
        );
        return GraphNode.PLANNING_ORCHESTRATOR;
      } else {
        logger.debug(
          `[Orchestration Router] Execution complete, routing to memory`
        );
        return GraphNode.MEMORY_ORCHESTRATOR;
      }
    }

    if (state.last_agent === Agent.PLANNER_VALIDATOR) {
      logger.debug(`[Orchestration Router] Plan validated, routing to memory`);
      return GraphNode.MEMORY_ORCHESTRATOR;
    }

    logger.debug(`[Orchestration Router] Default routing to executor`);
    return GraphNode.AGENT_EXECUTOR;
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

    // Use validated configuration
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
      .addNode(GraphNode.PLANNING_ORCHESTRATOR, planner_graph)
      .addNode(GraphNode.MEMORY_ORCHESTRATOR, memory_graph)
      .addNode(GraphNode.AGENT_EXECUTOR, executor_graph)
      .addNode(GraphNode.END_GRAPH, this.end_graph.bind(this))
      .addEdge('__start__', GraphNode.PLANNING_ORCHESTRATOR)
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
        '[AutonomousAgent] ✅ Successfully initialized autonomous agent'
      );

      return {
        app: this.app,
        agent_config: this.agentConfig,
      };
    } catch (error) {
      logger.error(
        '[AutonomousAgent] ❌ Failed to create autonomous agent:',
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
