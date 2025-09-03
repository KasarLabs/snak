import { AgentType, BaseAgent } from './baseAgent.js';
import { RpcProvider } from 'starknet';
import {
  ModelSelectorConfig,
  ModelSelector,
} from '../operators/modelSelector.js';
import {
  logger,
  AgentConfig,
  CustomHuggingFaceEmbeddings,
} from '@snakagent/core';
import { metrics } from '@snakagent/metrics';
import {
  BaseMessage,
  HumanMessage,
  AIMessage,
  AIMessageChunk,
} from '@langchain/core/messages';
import { DatabaseCredentials } from '../../tools/types/database.js';
import { AgentMode, AGENT_MODES } from '../../config/agentConfig.js';
import { MemoryAgent, MemoryConfig } from '../operators/memoryAgent.js';
import { createGraph, ExecutionMode } from '../modes/graph.js';
import { RunnableConfig } from '@langchain/core/runnables';
import { Command } from '@langchain/langgraph';
import {
  ChunkOutput,
  FormatChunkIteration,
  isInEnum,
  ToolsChunk,
} from './utils.js';
import { iterations } from '@snakagent/database/queries';
import { RagAgent } from '../operators/ragAgent.js';
import { MCPAgent } from '../operators/mcp-agent/mcpAgent.js';
import { ConfigurationAgent } from '../operators/config-agent/configAgent.js';
import { Agent, AgentReturn } from '../../agents/modes/types/index.js';
import { v4 as uuidv4 } from 'uuid';
import { promises as fs } from 'fs';
import { IterableReadableStream } from '@langchain/core/utils/stream';
import { StreamEvent } from '@langchain/core/tracers/log_stream';
import { ChatPromptValue } from '@langchain/core/prompt_values';
import {
  ExecutorNode,
  GraphNode,
  MemoryNode,
  PlannerNode,
} from '../../agents/modes/config/default-config.js';

export interface Output<EventType> {
  event_name: EventType;
  timestamps: string;
}

export interface BaseEvent {
  event: EventType;
  name: string;
  agent_id: string;
  run_id: string;
  tags?: string[];
  metadata?: {
    langgraph_step?: number;
    langgraph_node?: string;
    langgraph_triggers?: string[];
    langgraph_task_idx?: number;
    checkpoint_id?: string;
    checkpoint_ns?: string;
    [key: string]: any;
  };
  /** IDs des événements parents */
  parent_ids?: string[];
}

export interface ChatModelStartEvent extends BaseEvent {
  event: EventType.ON_CHAT_MODEL_START;
  data: {
    input: {
      messages: BaseMessage[];
    };
  };
}

export interface ChatModelStreamEvent extends BaseEvent {
  event: EventType.ON_CHAT_MODEL_STREAM;
  data: {
    chunk: AIMessageChunk;
  };
}

export interface ChatModelEndEvent extends BaseEvent {
  event: EventType.ON_CHAT_MODEL_END;
  data: {
    input: {
      messages: BaseMessage[];
    };
    output: AIMessageChunk;
  };
}

/**
 * Événements LLM
 */
export interface LLMStartEvent extends BaseEvent {
  event: EventType.ON_LLM_START;
  data: {
    input: string;
  };
}

export interface LLMStreamEvent extends BaseEvent {
  event: EventType.ON_LLM_STREAM;
  data: {
    chunk: string;
  };
}

export interface LLMEndEvent extends BaseEvent {
  event: EventType.ON_LLM_END;
  data: {
    output: string;
  };
}

export interface ChainStartEvent extends BaseEvent {
  event: EventType.ON_CHAIN_START;
  data: {
    input?: any;
  };
}

export interface ChainStreamEvent extends BaseEvent {
  event: EventType.ON_CHAIN_STREAM;
  data: {
    chunk: any;
  };
}

export interface ChainEndEvent extends BaseEvent {
  event: EventType.ON_CHAIN_END;
  data: {
    input?: any;
    output: any;
  };
}

/**
 * Événements Tool
 */
export interface ToolStartEvent extends BaseEvent {
  event: EventType.ON_TOOL_START;
  data: {
    input: Record<string, any>;
  };
}

export interface ToolStreamEvent extends BaseEvent {
  event: EventType.ON_TOOL_STREAM;
  data: {
    chunk: any;
  };
}

export interface ToolEndEvent extends BaseEvent {
  event: EventType.ON_TOOL_END;
  data: {
    input: Record<string, any>;
    output: any;
  };
}

export interface ToolErrorEvent extends BaseEvent {
  event: EventType.ON_TOOL_ERROR;
  data: {
    input: Record<string, any>;
    error: Error | string;
  };
}

/**
 * Événements Retriever
 */
export interface RetrieverStartEvent extends BaseEvent {
  event: EventType.ON_RETRIEVER_START;
  data: {
    input: {
      query: string;
    };
  };
}

export interface RetrieverEndEvent extends BaseEvent {
  event: EventType.ON_RETRIEVER_END;
  data: {
    input: {
      query: string;
    };
    output: Document[];
  };
}

export interface RetrieverErrorEvent extends BaseEvent {
  event: EventType.ON_RETRIEVER_ERROR;
  data: {
    input: {
      query: string;
    };
    error: Error | string;
  };
}

/**
 * Événements Prompt
 */
export interface PromptStartEvent extends BaseEvent {
  event: EventType.ON_PROMPT_START;
  data: {
    input: Record<string, any>;
  };
}

export interface PromptEndEvent extends BaseEvent {
  event: EventType.ON_PROMPT_END;
  data: {
    input: Record<string, any>;
    output: ChatPromptValue;
  };
}

/**
 * Événement personnalisé (custom)
 */
export interface CustomEvent extends BaseEvent {
  event: EventType.ON_CUSTOM_EVENT;
  data: any;
}

export type LangGraphEvent =
  | ChatModelStartEvent
  | ChatModelStreamEvent
  | ChatModelEndEvent
  | LLMStartEvent
  | LLMStreamEvent
  | LLMEndEvent
  | ChainStartEvent
  | ChainStreamEvent
  | ChainEndEvent
  | ToolStartEvent
  | ToolStreamEvent
  | ToolEndEvent
  | ToolErrorEvent
  | RetrieverStartEvent
  | RetrieverEndEvent
  | RetrieverErrorEvent
  | PromptStartEvent
  | PromptEndEvent
  | CustomEvent;

export type EventTypeMap = {
  [EventType.ON_CHAT_MODEL_START]: ChatModelStartEvent;
  [EventType.ON_CHAT_MODEL_STREAM]: ChatModelStreamEvent;
  [EventType.ON_CHAT_MODEL_END]: ChatModelEndEvent;
  [EventType.ON_LLM_START]: LLMStartEvent;
  [EventType.ON_LLM_STREAM]: LLMStreamEvent;
  [EventType.ON_LLM_END]: LLMEndEvent;
  [EventType.ON_CHAIN_START]: ChainStartEvent;
  [EventType.ON_CHAIN_STREAM]: ChainStreamEvent;
  [EventType.ON_CHAIN_END]: ChainEndEvent;
  [EventType.ON_TOOL_START]: ToolStartEvent;
  [EventType.ON_TOOL_STREAM]: ToolStreamEvent;
  [EventType.ON_TOOL_END]: ToolEndEvent;
  [EventType.ON_TOOL_ERROR]: ToolErrorEvent;
  [EventType.ON_RETRIEVER_START]: RetrieverStartEvent;
  [EventType.ON_RETRIEVER_END]: RetrieverEndEvent;
  [EventType.ON_RETRIEVER_ERROR]: RetrieverErrorEvent;
  [EventType.ON_PROMPT_START]: PromptStartEvent;
  [EventType.ON_PROMPT_END]: PromptEndEvent;
  [EventType.ON_CUSTOM_EVENT]: CustomEvent;
};

export function isEventType<T extends LangGraphEvent>(
  event: LangGraphEvent,
  eventType: EventType
): event is T {
  return event.event === eventType;
}

/**
 * Récupère le type d'un événement LangGraph
 * @param event - L'événement LangGraph
 * @returns Le type de l'événement (EventType)
 */
export function getEventType(event: LangGraphEvent): EventType {
  return event.event as EventType;
}

/*
 * Configuration interface for SnakAgent initialization
 */

export enum EventType {
  // Chat Model Events
  ON_CHAT_MODEL_START = 'on_chat_model_start',
  ON_CHAT_MODEL_STREAM = 'on_chat_model_stream',
  ON_CHAT_MODEL_END = 'on_chat_model_end',

  // LLM Events
  ON_LLM_START = 'on_llm_start',
  ON_LLM_STREAM = 'on_llm_stream',
  ON_LLM_END = 'on_llm_end',

  // Chain Events
  ON_CHAIN_START = 'on_chain_start',
  ON_CHAIN_STREAM = 'on_chain_stream',
  ON_CHAIN_END = 'on_chain_end',

  // Tool Events
  ON_TOOL_START = 'on_tool_start',
  ON_TOOL_STREAM = 'on_tool_stream',
  ON_TOOL_END = 'on_tool_end',
  ON_TOOL_ERROR = 'on_tool_error',

  // Retriever Events
  ON_RETRIEVER_START = 'on_retriever_start',
  ON_RETRIEVER_END = 'on_retriever_end',
  ON_RETRIEVER_ERROR = 'on_retriever_error',

  // Prompt Events
  ON_PROMPT_START = 'on_prompt_start',
  ON_PROMPT_END = 'on_prompt_end',

  // Custom Events
  ON_CUSTOM_EVENT = 'on_custom_event',
  ON_GRAPH_ABORTED = 'on_graph_aborted',
  ON_GRAPH_INTERRUPTED = 'on_graph_interrupted',
}

export interface StreamChunk {
  chunk: any;
  graph_step: number;
  langgraph_step: number;
  from?: Agent;
  retry_count: number;
  final: boolean;
}

export interface FormattedOnChatModelStream {
  chunk: {
    content: string;
    tools: ToolsChunk | undefined;
  };
}

export type MessagesLangraph = {
  lc: number;
  type: string;
  id: string[];
  kwargs: {
    content: string;
    additional_kwargs?: any;
    response_metadata?: any;
  };
};

export type ResultModelEnd = {
  output: {
    content: string;
  };
  input: {
    messages: MessagesLangraph[][];
  };
};

export interface FormattedOnChatModelStart {
  iteration: {
    name: string;
    messages: MessagesLangraph[][];
    metadata?: any;
  };
}

export interface FormattedOnChatModelEnd {
  iteration: {
    name: string;
    result: ResultModelEnd;
  };
}

export interface IterationResponse {
  event: EventType;
  kwargs:
    | FormattedOnChatModelEnd
    | FormattedOnChatModelStart
    | FormattedOnChatModelStream;
}

export interface SnakAgentConfig {
  provider: RpcProvider;
  accountPublicKey: string;
  accountPrivateKey: string;
  db_credentials: DatabaseCredentials;
  agentConfig: AgentConfig;
  memory?: MemoryConfig;
  modelSelectorConfig: ModelSelectorConfig;
}

/**
 * Main agent for interacting with the Starknet blockchain
 * Supports multiple execution modes: interactive, autonomous, and hybrid
 */
export class SnakAgent extends BaseAgent {
  private readonly provider: RpcProvider;
  private readonly accountPrivateKey: string;
  private readonly accountPublicKey: string;
  private readonly agentMode: string;
  private readonly agentConfig: AgentConfig;
  private readonly databaseCredentials: DatabaseCredentials;
  private readonly modelSelectorConfig: ModelSelectorConfig;
  private memoryAgent: MemoryAgent | null = null;
  private ragAgent: RagAgent | null = null;
  private mcpAgent: MCPAgent | null = null;
  private configAgent: ConfigurationAgent | null = null;

  private currentMode: string;
  private agentReactExecutor: AgentReturn;
  private modelSelector: ModelSelector | null = null;
  private controller: AbortController;
  private iterationEmbeddings: CustomHuggingFaceEmbeddings;
  private pendingIteration?: { question: string; embedding: number[] };

  constructor(config: SnakAgentConfig) {
    super('snak', AgentType.SNAK);

    this.provider = config.provider;
    this.accountPrivateKey = config.accountPrivateKey;
    this.accountPublicKey = config.accountPublicKey;
    this.agentMode = AGENT_MODES[config.agentConfig.mode];
    this.databaseCredentials = config.db_credentials;
    this.currentMode = AGENT_MODES[config.agentConfig.mode];
    this.agentConfig = config.agentConfig;
    this.modelSelectorConfig = config.modelSelectorConfig;

    if (!config.accountPrivateKey) {
      throw new Error('STARKNET_PRIVATE_KEY is required');
    }

    this.iterationEmbeddings = new CustomHuggingFaceEmbeddings({
      model:
        this.agentConfig.memory?.embeddingModel || 'Xenova/all-MiniLM-L6-v2',
      dtype: 'fp32',
    });
  }

  /**
   * Initialize the SnakAgent and create the appropriate executor
   * @throws {Error} If initialization fails
   */
  public async init(): Promise<void> {
    try {
      if (!this.modelSelector) {
        logger.warn(
          '[SnakAgent] ⚠️ No ModelSelector provided - functionality will be limited'
        );
      }

      if (this.agentConfig) {
        this.agentConfig.plugins = this.agentConfig.plugins || [];
      }

      this.modelSelector = new ModelSelector(this.modelSelectorConfig);
      await this.modelSelector.init();
      await this.initializeMemoryAgent(this.agentConfig);
      await this.initializeRagAgent(this.agentConfig);

      try {
        await this.createAgentReactExecutor();
        if (!this.agentReactExecutor) {
          logger.warn(
            '[SnakAgent] ⚠️ Agent executor creation succeeded but result is null'
          );
        }
      } catch (executorError) {
        logger.error(
          `[SnakAgent] ❌ Failed to create agent executor: ${executorError}`
        );
        logger.warn(
          '[SnakAgent] ⚠️ Will attempt to recover during execute() calls'
        );
      }

      logger.info('[SnakAgent] ✅ Initialized successfully');
    } catch (error) {
      logger.error(`[SnakAgent] ❌ Initialization failed: ${error}`);
      throw error;
    }
  }

  /**
   * Create agent executor based on current mode
   * @private
   * @throws {Error} If executor creation fails
   */
  private async createAgentReactExecutor(): Promise<void> {
    try {
      logger.info(
        `[SnakAgent] 🔧 Creating agent executor for mode: ${this.currentMode}`
      );

      switch (this.currentMode) {
        case AGENT_MODES[AgentMode.AUTONOMOUS]:
          this.agentReactExecutor = await createGraph(this, this.modelSelector);
          break;
        case AGENT_MODES[AgentMode.HYBRID]:
          this.agentReactExecutor = await createGraph(this, this.modelSelector);
          break;
        case AGENT_MODES[AgentMode.INTERACTIVE]:
          this.agentReactExecutor = await createGraph(this, this.modelSelector);
          break;
        default:
          throw new Error(`Invalid mode: ${this.currentMode}`);
      }

      if (!this.agentReactExecutor) {
        throw new Error(
          `Failed to create agent executor for mode ${this.currentMode}: result is null`
        );
      }
    } catch (error) {
      logger.error(
        `[SnakAgent] ❌ Failed to create Agent React Executor: ${error}`
      );
      if (error instanceof Error && error.stack) {
        logger.error(`[SnakAgent] 📋 Stack trace: ${error.stack}`);
      }
      throw error;
    }
  }

  /**
   * Initializes the MemoryAgent component if enabled
   * @param agentConfig - Agent configuration
   * @private
   */
  private async initializeMemoryAgent(
    agentConfig: AgentConfig | undefined
  ): Promise<void> {
    if (agentConfig?.memory?.enabled !== false) {
      logger.debug('[SnakAgent] 🧠 Initializing MemoryAgent...');
      this.memoryAgent = new MemoryAgent({
        shortTermMemorySize: agentConfig?.memory?.shortTermMemorySize || 15,
        memorySize: agentConfig?.memory?.memorySize || 20,
        maxIterations: agentConfig?.memory?.maxIterations,
        embeddingModel: agentConfig?.memory?.embeddingModel,
      });
      await this.memoryAgent.init();
      logger.debug('[SnakAgent] ✅ MemoryAgent initialized');
    } else {
      logger.info(
        '[SnakAgent] 🚫 MemoryAgent initialization skipped (disabled in config)'
      );
    }
  }

  /**
   * Initializes the RagAgent component if enabled
   * @param agentConfig - Agent configuration
   * @private
   */
  private async initializeRagAgent(
    agentConfig: AgentConfig | undefined
  ): Promise<void> {
    const ragConfig = agentConfig?.rag;
    if (!ragConfig || ragConfig.enabled !== true) {
      logger.info(
        '[SnakAgent] 🚫 RagAgent initialization skipped (disabled or not configured)'
      );
      return;
    }
    logger.debug('[SnakAgent] 📚 Initializing RagAgent...');
    this.ragAgent = new RagAgent({
      topK: ragConfig?.topK,
      embeddingModel: ragConfig?.embeddingModel,
    });
    await this.ragAgent.init();
    logger.debug('[SnakAgent] ✅ RagAgent initialized');
  }

  public getMemoryAgent(): MemoryAgent | null {
    if (!this.memoryAgent) {
      logger.warn('[SnakAgent] ⚠️ MemoryAgent is not initialized');
      return null;
    }
    return this.memoryAgent;
  }

  public getRagAgent(): RagAgent | null {
    if (!this.ragAgent) {
      logger.warn('[SnakAgent] ⚠️ RagAgent is not initialized');
      return null;
    }
    return this.ragAgent;
  }

  /**
   * Get Starknet account credentials
   * @returns Object containing the account's private and public keys
   */
  public getAccountCredentials() {
    return {
      accountPrivateKey: this.accountPrivateKey,
      accountPublicKey: this.accountPublicKey,
    };
  }

  /**
   * Get database credentials
   * @returns The database credentials object
   */
  public getDatabaseCredentials() {
    return this.databaseCredentials;
  }

  /**
   * Get current agent mode
   * @returns Object containing the current agent mode string
   */
  public getAgent() {
    return {
      agentMode: this.currentMode,
    };
  }

  /**
   * Get agent configuration
   * @returns The agent configuration object
   */
  public getAgentConfig(): AgentConfig {
    return this.agentConfig;
  }

  /**
   * Get original agent mode from initialization
   * @returns The agent mode string set during construction
   */
  public getAgentMode(): string {
    return this.agentMode;
  }

  /**
   * Get Starknet RPC provider
   * @returns The RpcProvider instance
   */
  public getProvider(): RpcProvider {
    return this.provider;
  }

  public getController(): AbortController | undefined {
    if (!this.controller) {
      logger.warn('[SnakAgent] ⚠️ Controller is not initialized');
      return undefined;
    }
    return this.controller;
  }

  /**
   * Execute the agent with the given input
   * @param input - The input message or string
   * @param config - Optional configuration for execution
   * @returns Promise resolving to the agent response
   */
  public async *execute(
    input: string,
    isInterrupted: boolean = false,
    config?: Record<string, any>
  ): AsyncGenerator<ChunkOutput> {
    try {
      logger.debug(
        `[SnakAgent] 🚀 Execute called - mode: ${this.currentMode}, interrupted: ${isInterrupted}`
      );

      if (!this.agentReactExecutor) {
        throw new Error('Agent executor is not initialized');
      }
      if (
        this.currentMode == AGENT_MODES[AgentMode.AUTONOMOUS] ||
        this.currentMode == AGENT_MODES[AgentMode.HYBRID] ||
        this.currentMode == AGENT_MODES[AgentMode.INTERACTIVE]
      ) {
        for await (const chunk of this.executeAsyncGenerator(
          input,
          isInterrupted
        )) {
          if (chunk.metadata.final) {
            yield chunk;
            return;
          }
          yield chunk;
        }
      } else {
        return `The mode: ${this.currentMode} is not supported in this method.`;
      }
    } catch (error) {
      logger.error(`[SnakAgent] ❌ Execute failed: ${error}`);
      throw error;
    }
  }

  public stop(): void {
    if (this.controller) {
      this.controller.abort();
      logger.info('[SnakAgent] ⏹️ Execution stopped');
    } else {
      logger.warn('[SnakAgent] ⚠️ No controller found to stop execution');
    }
  }

  /**
   * Check if an error is token-related
   * @private
   * @param error - The error to check
   * @returns True if the error is token-related
   */
  private isTokenRelatedError(error: any): boolean {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return (
      errorMessage.includes('token limit') ||
      errorMessage.includes('tokens exceed') ||
      errorMessage.includes('context length') ||
      errorMessage.includes('prompt is too long') ||
      errorMessage.includes('maximum context length')
    );
  }

  /**
   * Executes the agent in autonomous mode
   * This mode allows the agent to operate continuously based on an initial goal or prompt
   * @returns Promise resolving to the result of the autonomous execution
   */
  public async *executeAsyncGenerator(
    input?: string,
    isInterrupted: boolean = false,
    thread_id?: string,
    checkpoint_id?: string
  ): AsyncGenerator<ChunkOutput> {
    let autonomousResponseContent: string | any;
    const originalMode = this.currentMode;
    let totalIterationCount = 0;

    try {
      logger.info(
        `[SnakAgent] 🤖 Starting autonomous execution - interrupted: ${isInterrupted}`
      );

      if (!this.agentReactExecutor) {
        throw new Error('Agent executor is not initialized');
      }

      const app = this.agentReactExecutor.app;
      const agentJsonConfig = this.agentReactExecutor.agent_config;
      const maxGraphSteps = this.agentConfig.maxIterations;
      const shortTermMemory = this.agentConfig.memory.shortTermMemorySize || 5;
      const memorySize = this.agentConfig.memory?.memorySize || 20;
      const humanInTheLoop = this.agentConfig.mode === AgentMode.HYBRID;
      this.controller = new AbortController();
      const initialMessages: BaseMessage[] = [new HumanMessage(input ?? '')];

      const threadId = thread_id ?? agentJsonConfig?.id;
      logger.info(`[SnakAgent] 🔗 Autonomous execution thread ID: ${threadId}`);
      8;
      const threadConfig = {
        configurable: {
          thread_id: threadId,
          max_graph_steps: maxGraphSteps,
          short_term_memory: shortTermMemory,
          memory_size: memorySize,
          agent_config: this.agentConfig,
          human_in_the_loop: humanInTheLoop,
          executionMode:
            agentJsonConfig.mode === AgentMode.AUTONOMOUS
              ? ExecutionMode.PLANNING
              : ExecutionMode.REACTIVE,
          checkpoint_id: checkpoint_id ? checkpoint_id : undefined,
          user_request: input ?? undefined,
        },
      };
      let lastChunk;
      let graphStep: number = 0;
      let retryCount: number = 0;
      let currentAgent: Agent | undefined;
      let currentCheckpointId: string | undefined = undefined;

      try {
        let command: Command | undefined;
        const graphState = { messages: initialMessages };
        const executionConfig = {
          ...threadConfig,
          signal: this.controller.signal,
          recursionLimit: 500,
          version: 'v2',
        };

        if (isInterrupted) {
          command = new Command({
            resume: input,
          });
        }

        const executionInput = !isInterrupted ? graphState : command;
        let chunk: LangGraphEvent;
        for await (chunk of await app.streamEvents(
          executionInput,
          executionConfig
        )) {
          isInterrupted = false;
          lastChunk = chunk;
          const state = await app.getState(executionConfig);
          graphStep = state.values.currentGraphStep;
          retryCount = state.values.retry;
          currentAgent = state.values.last_agent as Agent;
          currentCheckpointId = state.config.configurable.checkpoint_id;
          if (
            chunk.metadata?.langgraph_node &&
            isInEnum(PlannerNode, chunk.metadata.langgraph_node)
          ) {
            if (chunk.event === EventType.ON_CHAT_MODEL_START) {
              console.log(chunk.metadata.ls_model);
              console.log(chunk.metadata);
              yield {
                event: chunk.event,
                run_id: chunk.run_id,
                checkpoint_id: state.config.configurable.checkpoint_id,
                thread_id: state.config.configurable.thread_id,
                from: GraphNode.PLANNING_ORCHESTRATOR,
                metadata: {
                  executionMode: chunk.metadata.executionMode,
                  agent_mode: agentJsonConfig.mode,
                  conversation_id: chunk.metadata.conversation_id,
                  langgraph_step: chunk.metadata.langgraph_step,
                  langgraph_node: chunk.metadata.langgraph_node,
                  ls_provider: chunk.metadata.ls_provider,
                  ls_model_name: chunk.metadata.ls_model_name,
                  ls_model_type: chunk.metadata.ls_model_type,
                  ls_temperature: chunk.metadata.ls_temperature,
                },
                timestamp: new Date().toISOString(),
              };
            }
            if (chunk.event === EventType.ON_CHAT_MODEL_END) {
              // Need to add an error verifyer from get State
              yield {
                event: chunk.event,
                run_id: chunk.run_id,
                plan: chunk.data.output.tool_calls?.[0]?.args, // this is in a ParsedPlan format object
                checkpoint_id: state.config.configurable.checkpoint_id,
                thread_id: state.config.configurable.thread_id,
                from: GraphNode.PLANNING_ORCHESTRATOR,
                metadata: {
                  tokens: chunk.data.output?.usage_metadata?.total_tokens,
                  executionMode: chunk.metadata.executionMode,
                  agent_mode: agentJsonConfig.mode,
                  conversation_id: chunk.metadata.conversation_id,
                  langgraph_step: chunk.metadata.langgraph_step,
                  langgraph_node: chunk.metadata.langgraph_node,
                  ls_provider: chunk.metadata.ls_provider,
                  ls_model_name: chunk.metadata.ls_model_name,
                  ls_model_type: chunk.metadata.ls_model_type,
                  ls_temperature: chunk.metadata.ls_temperature,
                },
                timestamp: new Date().toISOString(),
              };
            }
          } else if (
            chunk.metadata?.langgraph_node &&
            isInEnum(ExecutorNode, chunk.metadata.langgraph_node)
          ) {
            if (chunk.event === EventType.ON_CHAT_MODEL_START) {
              yield {
                event: chunk.event,
                run_id: chunk.run_id,
                checkpoint_id: state.config.configurable.checkpoint_id,
                thread_id: state.config.configurable.thread_id,
                from: GraphNode.AGENT_EXECUTOR,
                metadata: {
                  execution_mode: chunk.metadata.executionMode,
                  agent_mode: agentJsonConfig.mode,
                  retry: retryCount,
                  conversation_id: chunk.metadata.conversation_id,
                  langgraph_step: chunk.metadata.langgraph_step,
                  langgraph_node: chunk.metadata.langgraph_node,
                  ls_provider: chunk.metadata.ls_provider,
                  ls_model_name: chunk.metadata.ls_model_name,
                  ls_model_type: chunk.metadata.ls_model_type,
                  ls_temperature: chunk.metadata.ls_temperature,
                },
                timestamp: new Date().toISOString(),
              };
            }
            if (chunk.event === EventType.ON_CHAT_MODEL_END) {
              yield {
                event: chunk.event,
                run_id: chunk.run_id,
                tools: chunk.data.output.tool_calls,
                content: chunk.data.output.content.toLocaleString(), // Is an ParsedPlan object
                checkpoint_id: state.config.configurable.checkpoint_id,
                thread_id: state.config.configurable.thread_id,
                from: GraphNode.AGENT_EXECUTOR,
                metadata: {
                  tokens: chunk.data.output?.usage_metadata?.total_tokens,
                  execution_mode: chunk.metadata.executionMode,
                  agent_mode: agentJsonConfig.mode,
                  conversation_id: chunk.metadata.conversation_id,
                  retry: retryCount,
                  langgraph_step: chunk.metadata.langgraph_step,
                  langgraph_node: chunk.metadata.langgraph_node,
                  ls_provider: chunk.metadata.ls_provider,
                  ls_model_name: chunk.metadata.ls_model_name,
                  ls_model_type: chunk.metadata.ls_model_type,
                  ls_temperature: chunk.metadata.ls_temperature,
                },
                timestamp: new Date().toISOString(),
              };
            }
            if (chunk.event === EventType.ON_CHAT_MODEL_STREAM) {
              if (chunk.data.chunk.content && chunk.data.chunk.content != '') {
                yield {
                  event: chunk.event,
                  run_id: chunk.run_id,
                  content: chunk.data.chunk.content.toLocaleString(),
                  checkpoint_id: state.config.configurable.checkpoint_id,
                  thread_id: state.config.configurable.thread_id,
                  from: GraphNode.AGENT_EXECUTOR,
                  metadata: {
                    execution_mode: chunk.metadata.executionMode,
                    agent_mode: agentJsonConfig.mode,
                    retry: retryCount,
                    conversation_id: chunk.metadata.conversation_id,
                    langgraph_step: chunk.metadata.langgraph_step,
                    langgraph_node: chunk.metadata.langgraph_node,
                    ls_provider: chunk.metadata.ls_provider,
                    ls_model_name: chunk.metadata.ls_model_name,
                    ls_model_type: chunk.metadata.ls_model_type,
                    ls_temperature: chunk.metadata.ls_temperature,
                  },
                  timestamp: new Date().toISOString(),
                };
              }
            }
          } else if (
            chunk.metadata?.langgraph_node &&
            isInEnum(MemoryNode, chunk.metadata.langgraph_node)
          ) {
            if (chunk.event === EventType.ON_CHAT_MODEL_START) {
              yield {
                event: chunk.event,
                run_id: chunk.run_id,
                checkpoint_id: state.config.configurable.checkpoint_id,
                thread_id: state.config.configurable.thread_id,
                from: GraphNode.MEMORY_ORCHESTRATOR,
                metadata: {
                  execution_mode: chunk.metadata.executionMode,
                  agent_mode: agentJsonConfig.mode,
                  retry: retryCount,
                  conversation_id: chunk.metadata.conversation_id,
                  langgraph_step: chunk.metadata.langgraph_step,
                  langgraph_node: chunk.metadata.langgraph_node,
                  ls_provider: chunk.metadata.ls_provider,
                  ls_model_name: chunk.metadata.ls_model_name,
                  ls_model_type: chunk.metadata.ls_model_type,
                  ls_temperature: chunk.metadata.ls_temperature,
                },
                timestamp: new Date().toISOString(),
              };
            }
            if (chunk.event === EventType.ON_CHAT_MODEL_END) {
              yield {
                event: chunk.event,
                run_id: chunk.run_id,
                checkpoint_id: state.config.configurable.checkpoint_id,
                thread_id: state.config.configurable.thread_id,
                from: GraphNode.MEMORY_ORCHESTRATOR,
                metadata: {
                  tokens: chunk.data.output?.usage_metadata?.total_tokens,
                  agent_mode: agentJsonConfig.mode,
                  execution_mode: chunk.metadata.executionMode,
                  retry: retryCount,
                  conversation_id: chunk.metadata.conversation_id,
                  langgraph_step: chunk.metadata.langgraph_step,
                  langgraph_node: chunk.metadata.langgraph_node,
                  ls_provider: chunk.metadata.ls_provider,
                  ls_model_name: chunk.metadata.ls_model_name,
                  ls_model_type: chunk.metadata.ls_model_type,
                  ls_temperature: chunk.metadata.ls_temperature,
                },
                timestamp: new Date().toISOString(),
              };
            }
          }
        }
        logger.info('[SnakAgent] ✅ Autonomous execution completed');
        if (!lastChunk || !currentCheckpointId) {
          throw new Error('No output from autonomous execution');
        }
        yield {
          event: lastChunk.event,
          run_id: lastChunk.run_id,
          from: GraphNode.END_GRAPH,
          thread_id: threadId,
          checkpoint_id: currentCheckpointId,
          metadata: {
            conversation_id: lastChunk.metadata?.conversation_id,
            final: true,
          },
          timestamp: new Date().toISOString(),
        };
        return;
      } catch (error: any) {
        ('');
        if (error?.message?.includes('Abort')) {
          logger.info('[SnakAgent] 🛑 Execution aborted by user');
          if (lastChunk && currentCheckpointId) {
            yield {
              event: EventType.ON_GRAPH_ABORTED,
              run_id: lastChunk.run_id,
              checkpoint_id: currentCheckpointId,
              thread_id: threadId,
              from: GraphNode.END_GRAPH,
              metadata: {
                conversation_id: lastChunk.metadata?.conversation_id,
                final: true,
              },
              timestamp: new Date().toISOString(),
            };
          }
          return;
        }

        logger.error(`[SnakAgent] ❌ Autonomous execution error: ${error}`);
        if (this.isTokenRelatedError(error)) {
          autonomousResponseContent =
            'Error: Token limit likely exceeded during autonomous execution.';
        }
      }

      return new AIMessage({
        content: autonomousResponseContent,
        additional_kwargs: {
          from: 'snak',
          final: true,
          agent_mode: this.currentMode,
          iterations: totalIterationCount,
        },
      });
    } catch (error: any) {
      logger.error(`[SnakAgent] ❌ Autonomous execution failed: ${error}`);
      return new AIMessage({
        content: `Autonomous execution error: ${error.message}`,
        additional_kwargs: {
          from: 'snak',
          final: true,
          error: 'autonomous_execution_error',
        },
      });
    } finally {
      if (this.currentMode !== originalMode) {
        this.currentMode = originalMode;
      }
    }
  }
}
