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
  ):
    | 'planning_orchestrator'
    | 'agent_executor'
    | 'memory_orchestrator'
    | 'end_graph' {
    if (state.skipValidation.skipValidation) {
      return state.skipValidation.goto as  // TODO Clean this with ENUM
        | 'planning_orchestrator'
        | 'agent_executor'
        | 'memory_orchestrator'
        | 'end_graph';
    }
    if (state.last_agent === Agent.EXEC_VALIDATOR) {
      if (
        (state.last_message as BaseMessage).additional_kwargs.final === 'true'
      ) {
        return 'planning_orchestrator';
      } else {
        return 'memory_orchestrator';
      }
    }
    if (state.last_agent === Agent.PLANNER_VALIDATOR) {
      return 'memory_orchestrator';
    }
    return 'agent_executor';
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

    // Ajouter les configurables depuis votre annotation
    return {
      ...baseOptions,
      configurable: {
        max_graph_steps: 100,
        short_term_memory: 7,
        memory_size: 20,
        human_in_the_loop: false,
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
    console.log('hELLO');
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
      .addNode('planning_orchestrator', planner_graph)
      .addNode('memory_orchestrator', memory_graph)
      .addNode('agent_executor', executor_graph)
      .addNode('end_graph', this.end_graph.bind(this))
      .addEdge('__start__', 'planning_orchestrator')
      .addConditionalEdges(
        'planning_orchestrator',
        this.orchestrationRouter.bind(this)
      )
      .addConditionalEdges(
        'memory_orchestrator',
        this.orchestrationRouter.bind(this)
      )
      .addConditionalEdges(
        'agent_executor',
        this.orchestrationRouter.bind(this)
      )
      .addEdge('end_graph', END);

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
