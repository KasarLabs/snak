import { AgentConfig, AgentMode, logger } from '@snakagent/core';
import {
  StateGraph,
  MemorySaver,
  Annotation,
  END,
  task,
} from '@langchain/langgraph';
import {
  DynamicStructuredTool,
  StructuredTool,
  Tool,
} from '@langchain/core/tools';
import { AnyZodObject, object, z } from 'zod';
import { BaseMessage } from '@langchain/core/messages';
import { ModelSelector } from '../operators/modelSelector.js';
import { RunnableConfig } from '@langchain/core/runnables';
import { MemoryAgent } from '../operators/memoryAgent.js';
import { RagAgent } from '../operators/ragAgent.js';
import {
  DEFAULT_GRAPH_CONFIG,
  ConfigValidator,
} from './config/default-config.js';
import {
  GraphNode,
  ExecutorNode,
  PlannerNode,
  MemoryNode,
  VerifierNode,
} from '../../shared/enums/agent-modes.enum.js';
import { AgentReturn } from '../../shared/types/agents.types.js';
import {
  GraphErrorType,
  Memories,
  TasksType,
  TaskType,
} from '../../shared/types/index.js';
import { MemoryStateManager } from './manager/memory/memory-utils.js';
import { MemoryGraph } from './sub-graph/memory-graph.js';
import { PlannerGraph } from './sub-graph/planner-graph.js';
import { AgentExecutorGraph } from './sub-graph/executor-graph.js';
import { TaskVerifierGraph } from './sub-graph/task-verifier-graph.js';
import { isInEnum, ExecutionMode } from '../../shared/enums/index.js';
import { initializeDatabase } from '../../agents/utils/database.utils.js';
import { initializeToolsList } from '../../tools/tools.js';
import { SnakAgentInterface } from '../../shared/types/tools.types.js';
import { STMManager } from '@lib/memory/index.js';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';

// export async function appendToRunFile(content: string): Promise<void> {
//   const fileName = 'run.txt';
//   const filePath = path.resolve(fileName);

//   try {
//     // Vérifie si le fichier existe
//     const fileExists = await fs.promises
//       .access(filePath, fs.constants.F_OK)
//       .then(() => true)
//       .catch(() => false);

//     if (!fileExists) {
//       console.log(`Le fichier ${fileName} n'existe pas. Création en cours...`);
//       // Crée le fichier vide s'il n'existe pas
//       await fs.promises.writeFile(filePath, '');
//       console.log(`Fichier ${fileName} créé avec succès.`);
//     }

//     // Ajoute le contenu au fichier (avec un retour à la ligne)
//     await fs.promises.appendFile(filePath, content + '\n');
//     console.log(`Contenu ajouté au fichier ${fileName}.`);
//   } catch (error) {
//     console.error(
//       `Erreur lors de l'opération sur le fichier ${fileName}:`,
//       error
//     );
//     throw error;
//   }
// }

export const GraphState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => {
      console.log('Inserting message to state: ', y.length);
      return y;
    },
    default: () => [],
  }),
  last_node: Annotation<
    ExecutorNode | PlannerNode | MemoryNode | GraphNode | VerifierNode
  >({
    reducer: (x, y) => y,
    default: () => GraphNode.START,
  }),
  memories: Annotation<Memories>({
    reducer: (x, y) => y,
    default: () => MemoryStateManager.createInitialState(5),
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
  skipValidation: Annotation<{ skipValidation: boolean; goto: string }>({
    reducer: (x, y) => y,
    default: () => ({ skipValidation: false, goto: '' }),
  }),
  error: Annotation<GraphErrorType | null>({
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
    default: () => 1000,
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
  objectives: Annotation<string>({
    reducer: (x, y) => y,
    default: () => 'undefined',
  }),
  summarization_threshold: Annotation<number>({
    reducer: (x, y) => y,
    default: () => 5000,
  }),
  memory_config: Annotation<{
    max_insert_episodic_size: number;
    max_insert_semantic_size: number;
    max_retrieve_episodic_memory: number;
    max_retrieve_semantic_memory: number;
  } | null>({
    reducer: (x, y) => y,
    default: () => null,
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
    currentTaskIndex: number;
    retry: number;
  } {
    logger.info('[EndGraph] Cleaning up state for graph termination');
    return {
      currentTaskIndex: 0,
      retry: 0,
    };
  }

  private orchestrationRouter(
    state: typeof GraphState.State,
    config: RunnableConfig<typeof GraphConfigurableAnnotation.State>
  ): GraphNode {
    logger.debug(`[Orchestration Router] Last agent: ${state.last_node}`);
    const executionMode = config.configurable?.executionMode;
    if (!executionMode) {
      throw new Error(
        '[Orchestration Router] ExecutionMode is undefined in configurable state.'
      );
    }
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

    if (isInEnum(VerifierNode, state.last_node))
      if (state.last_node === VerifierNode.TASK_UPDATER) {
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
    if (isInEnum(MemoryNode, state.last_node)) {
      if (
        currentTask.status === 'completed' ||
        currentTask.status === 'failed'
      ) {
        logger.debug(
          `[Orchestration Router] Memory operations complete, routing to planner`
        );
        return GraphNode.PLANNING_ORCHESTRATOR;
      } else {
        logger.debug(
          `[Orchestration Router] Memory operations complete, routing to agent executor`
        );
        return GraphNode.AGENT_EXECUTOR;
      }
    }
    if (isInEnum(ExecutorNode, state.last_node)) {
      // Check if a task was just completed (end_task tool was called)
      if (state.error && state.error.hasError) {
        logger.error(
          `[Orchestration Router] Error detected from ${state.error.source}: ${state.error.message}`
        );
        if (state.error.type === 'blocked_task') {
          logger.warn(
            `[Orchestration Router] Blocked task detected, routing to END node`
          );
          return GraphNode.PLANNING_ORCHESTRATOR;
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

    if (isInEnum(PlannerNode, state.last_node)) {
      logger.debug(`[Orchestration Router] Plan validated, routing to memory`);
      return GraphNode.MEMORY_ORCHESTRATOR;
    }

    logger.debug(`[Orchestration Router] Default routing to executor`);
    return GraphNode.AGENT_EXECUTOR;
  }

  private startOrchestrationRouter(
    state: typeof GraphState.State,
    config: RunnableConfig<typeof GraphConfigurableAnnotation.State>
  ): GraphNode {
    try {
      const agentConfig = config.configurable?.agent_config;
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

    logger.debug('[Agent] Building workflow with initialized components');
    const memory = new MemoryGraph(this.modelSelector, this.memoryAgent);
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

    const taskVerifier = new TaskVerifierGraph(this.modelSelector);

    executor.createAgentExecutorGraph();
    memory.createGraphMemory();
    planner.createPlannerGraph();
    taskVerifier.createTaskVerifierGraph();

    const executor_graph = executor.getExecutorGraph();
    const memory_graph = memory.getMemoryGraph();
    const planner_graph = planner.getPlannerGraph();
    const task_verifier_graph = taskVerifier.getVerifierGraph();
    const workflow = new StateGraph(GraphState, GraphConfigurableAnnotation)
      .addNode(GraphNode.PLANNING_ORCHESTRATOR, planner_graph)
      .addNode(GraphNode.MEMORY_ORCHESTRATOR, memory_graph)
      .addNode(GraphNode.AGENT_EXECUTOR, executor_graph)
      .addNode(GraphNode.TASK_VERIFIER, task_verifier_graph)
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
      this.toolsList = this.toolsList.filter(
        (tool) =>
          tool.name !== 'mobile_take_screenshot' &&
          tool.name !== 'mobile_save_screenshot'
      );
      this.toolsList.forEach((tool) => {
        logger.debug(`[Agent] Tool initialized: ${tool.name}`);
      });
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
