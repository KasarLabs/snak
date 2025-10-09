import { BaseAgent } from './baseAgent.js';
import { RpcProvider } from 'starknet';
import {
  logger,
  AgentConfig,
  StarknetConfig,
  DatabaseConfigService,
} from '@snakagent/core';
import { BaseMessage, HumanMessage, AIMessage } from '@langchain/core/messages';
import { AgentType } from '../../shared/enums/agent.enum.js';
import {
  createGraph,
  GraphConfigurableType,
} from '../graphs/core-graph/agent.graph.js';
import {
  Command,
  CompiledStateGraph,
  StateSnapshot,
} from '@langchain/langgraph';
import { RagAgent } from '../operators/ragAgent.js';
import {
  TaskExecutorNode,
  GraphNode,
  TaskMemoryNode,
  TaskManagerNode,
} from '../../shared/enums/agent.enum.js';
import {
  ChunkOutput,
  ChunkOutputMetadata,
} from '../../shared/types/streaming.types.js';
import { EventType } from '@enums/event.enums.js';
import { isInEnum } from '@enums/utils.js';
import { StreamEvent } from '@langchain/core/tracers/log_stream';
import { GraphErrorType, UserRequest } from '@stypes/graph.types.js';
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import { CheckpointerService } from '@agents/graphs/manager/checkpointer/checkpointer.js';
import { notify } from '@snakagent/database/queries';

/**
 * Main agent for interacting with the Starknet blockchain
 * Supports multiple execution modes: interactive, autonomous, and hybrid
 */
export class SnakAgent extends BaseAgent {
  private readonly provider: RpcProvider;
  private ragAgent: RagAgent | null = null;
  constructor(
    starknet_config: StarknetConfig,
    agent_config: AgentConfig.Runtime
  ) {
    super('snak', AgentType.SNAK, agent_config);
    this.provider = starknet_config.provider;
  }
  /**
   * Initialize the SnakAgent and create the appropriate executor
   * @throws {Error} If initialization fails
   */
  public async init(): Promise<void> {
    try {
      if (!this.agentConfig) {
        throw new Error('Agent configuration is required for initialization');
      }
      await this.initializeRagAgent(this.agentConfig);
      try {
        this.pgCheckpointer = await CheckpointerService.getInstance();
        if (!this.pgCheckpointer) {
          throw new Error('Failed to initialize Postgres checkpointer');
        }
        await this.createAgentReactExecutor();
      } catch (executorError) {
        logger.error(
          `[SnakAgent] Failed to create agent executor: ${executorError}`
        );
        throw executorError;
      }

      logger.info('[SnakAgent]  Initialized successfully');
    } catch (error) {
      logger.error(`[SnakAgent]  Initialization failed: ${error}`);
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
      this.compiledStateGraph = await createGraph(this);
      if (!this.compiledStateGraph) {
        throw new Error(
          `Failed to create graph for agent: ${this.agentConfig.profile.name}`
        );
      }
    } catch (error) {
      logger.error(`[SnakAgent] Failed to create graph: ${error}`);
      if (error instanceof Error && error.stack) {
        logger.error(`[SnakAgent] Stack trace: ${error.stack}`);
      }
      throw error;
    }
  }

  /**
   * Initializes the RagAgent component if enabled
   * @param agentConfig - Agent configuration
   * @private
   */
  private async initializeRagAgent(
    agentConfig: AgentConfig.Runtime | undefined
  ): Promise<void> {
    const ragConfig = agentConfig?.rag;
    if (!ragConfig || ragConfig.enabled !== true) {
      return;
    }
    this.ragAgent = new RagAgent(
      {
        top_k: ragConfig?.top_k,
      },
      this.agentConfig // TODO CHANGE THIS HE DON'T NEED IT
    );
    await this.ragAgent.init();
  }

  public getRagAgent(): RagAgent | null {
    if (!this.ragAgent) {
      logger.warn('[SnakAgent]  RagAgent is not initialized');
      return null;
    }
    return this.ragAgent;
  }

  /**
   * Get Starknet RPC provider
   * @returns The RpcProvider instance
   */
  public getProvider(): RpcProvider {
    return this.provider;
  }

  public async dispose(): Promise<void> {
    this.stop();
    if (this.pgCheckpointer) {
      await this.pgCheckpointer?.end();
    }
    if (this.ragAgent) {
      await this.ragAgent.dispose();
    }
    this.compiledStateGraph = null;
  }

  /**
   * Execute the agent with the given input
   * @param input - The input message or string
   * @param agent_config - Optional configuration for execution
   * @returns Promise resolving to the agent response
   */
  public async *execute(userRequest: UserRequest): AsyncGenerator<ChunkOutput> {
    try {
      if (!this.compiledStateGraph) {
        throw new Error('Agent executor is not initialized');
      }
      for await (const chunk of this.executeAsyncGenerator(userRequest)) {
        if (chunk.metadata.final) {
          yield chunk;
          return;
        }
        yield chunk;
      }
    } catch (error) {
      logger.error(`[SnakAgent] Execute failed: ${error}`);
      throw error;
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
   * Creates a standardized chunk output
   */
  private createChunkOutput(
    chunk: StreamEvent,
    state: StateSnapshot,
    user_request: string,
    currentTaskId: string | undefined,
    currentStepId: string | undefined,
    graphError: GraphErrorType | undefined,
    retryCount: number,
    from: GraphNode
  ): ChunkOutput {
    const metadata: ChunkOutputMetadata = {
      langgraph_step: chunk.metadata.langgraph_step,
      langgraph_node: chunk.metadata.langgraph_node,
      ls_provider: chunk.metadata.ls_provider,
      ls_model_name: chunk.metadata.ls_model_name,
      ls_model_type: chunk.metadata.ls_model_type,
      ls_temperature: chunk.metadata.ls_temperature,
      tokens: chunk.data.output?.usage_metadata?.total_tokens ?? null,
      user_request: user_request,
      error: graphError,
      retry: retryCount,
    };

    const chunkOutput: ChunkOutput = {
      event: chunk.event,
      run_id: chunk.run_id,
      checkpoint_id: state.config.configurable?.checkpoint_id,
      thread_id: state.config.configurable?.thread_id,
      from,
      tools:
        chunk.event === EventType.ON_CHAT_MODEL_END
          ? (chunk.data.output.tool_calls ?? null)
          : null,
      message:
        chunk.event === EventType.ON_CHAT_MODEL_END
          ? chunk.data.output.content.toLocaleString()
          : null,
      metadata,
      timestamp: new Date().toISOString(),
    };

    return chunkOutput;
  }

  /**
   * Processes chunk output for supported events and node types
   */
  private processChunkOutput(
    chunk: StreamEvent,
    state: any,
    user_request: string,
    currentTaskId: string | undefined,
    currentStepId: string | undefined,
    retryCount: number,
    graphError: GraphErrorType | undefined
  ): ChunkOutput | null {
    const nodeType = chunk.metadata?.langgraph_node;
    const eventType = chunk.event;

    // Only process chat model start/end events
    if (
      eventType !== EventType.ON_CHAT_MODEL_START &&
      eventType !== EventType.ON_CHAT_MODEL_END
    ) {
      return null;
    }

    // Map node types to graph nodes and determine if retry should be included
    if (isInEnum(TaskManagerNode, nodeType)) {
      return this.createChunkOutput(
        chunk,
        state,
        user_request,
        currentTaskId,
        currentStepId,
        graphError,
        retryCount,
        GraphNode.TASK_MANAGER
      );
    } else if (isInEnum(TaskExecutorNode, nodeType)) {
      return this.createChunkOutput(
        chunk,
        state,
        user_request,
        currentTaskId,
        currentStepId,
        graphError,
        retryCount,
        GraphNode.AGENT_EXECUTOR
      );
    } else if (isInEnum(TaskMemoryNode, nodeType)) {
      return this.createChunkOutput(
        chunk,
        state,
        user_request,
        currentTaskId,
        currentStepId,
        graphError,
        retryCount,
        GraphNode.MEMORY_ORCHESTRATOR
      );
    }

    return null;
  }

  private isInterrupt(stateSnapshot: StateSnapshot): boolean {
    if (
      stateSnapshot.tasks?.length > 0 &&
      stateSnapshot.tasks[0]?.interrupts?.length > 0
    ) {
      const interrupt = stateSnapshot.tasks[0].interrupts[0];
      logger.info(`[SnakAgent] Interrupt detected: ${interrupt?.value}`);
      return true;
    }
    return false;
  }

  private getInterruptCommand(request: string): Command {
    const command = new Command({
      resume: request,
    });
    return command;
  }

  /**
   * Executes the agent in autonomous mode
   * This mode allows the agent to operate continuously based on an initial goal or prompt
   * @returns Promise resolving to the result of the autonomous execution
   */
  public async *executeAsyncGenerator(
    request: UserRequest
  ): AsyncGenerator<ChunkOutput> {
    try {
      let lastChunk: StreamEvent | undefined = undefined;
      let retryCount: number = 0;
      let currentCheckpointId: string | undefined = undefined;
      let currentTaskId: string | undefined = undefined;
      let currentStepId: string | undefined = undefined;
      let graphError: GraphErrorType | undefined = undefined;
      let stateSnapshot: StateSnapshot;
      let isInterruptHandle = false;
      logger.info(`[SnakAgent] Starting execution: "${request.request}"`);
      if (!this.compiledStateGraph) {
        throw new Error('CompiledGraph is not initialized');
      }
      if (!this.controller || this.controller.signal.aborted) {
        this.controller = new AbortController();
      }
      const initialMessages: BaseMessage[] = [
        new HumanMessage(request.request),
      ];
      const threadId = this.agentConfig.id;
      const configurable = {
        thread_id: threadId,
        user_request: {
          request: request.request,
          hitl_threshold:
            request.hitl_threshold ??
            this.agentConfig.memory.thresholds.hitl_threshold,
        },
        agent_config: this.agentConfig,
      };
      const threadConfig = {
        configurable: configurable,
      };
      try {
        const executionConfig = {
          ...threadConfig,
          signal: this.controller.signal,
          recursionLimit: 500,
          version: 'v2' as const,
        };

        stateSnapshot = await this.compiledStateGraph.getState(executionConfig);
        if (!stateSnapshot) {
          throw new Error('Failed to retrieve initial graph state');
        }
        const executionInput = this.isInterrupt(stateSnapshot)
          ? this.getInterruptCommand(request.request)
          : { messages: initialMessages };
        for await (const chunk of this.compiledStateGraph.streamEvents(
          executionInput ?? {
            messages: [],
          },
          executionConfig
        )) {
          // Setter
          stateSnapshot =
            await this.compiledStateGraph.getState(executionConfig);
          if (!stateSnapshot) {
            throw new Error('Failed to retrieve graph state during execution');
          }
          lastChunk = chunk;
          retryCount = stateSnapshot.values.retry;
          currentCheckpointId =
            stateSnapshot.config.configurable?.checkpoint_id;
          currentTaskId =
            chunk.event === 'on_chat_model_end' &&
            chunk.data?.output?.additional_kwargs?.task_id
              ? chunk.data.output.additional_kwargs.task_id
              : null;
          currentStepId =
            chunk.event === 'on_chat_model_end' &&
            chunk.data?.output?.additional_kwargs?.task_id
              ? chunk.data.output.additional_kwargs.step_id
              : null;
          graphError = stateSnapshot.values.error;
          if (
            chunk.event === 'on_chain_end' &&
            isInterruptHandle === false &&
            this.isInterrupt(stateSnapshot)
          ) {
            await notify.insertNotify(
              this.agentConfig.user_id,
              this.agentConfig.id,
              stateSnapshot.tasks[0].interrupts[0].value
            );
            isInterruptHandle = true;
          }
          // Process chunk using the centralized handler
          const processedChunk = this.processChunkOutput(
            chunk,
            stateSnapshot,
            request.request,
            currentTaskId,
            currentStepId,
            retryCount,
            graphError
          );
          if (processedChunk) {
            yield processedChunk;
          }
        }
        logger.info('[SnakAgent] Execution completed');
        if (!lastChunk || !currentCheckpointId) {
          throw new Error('No output from autonomous execution');
        }
        yield {
          event: lastChunk.event,
          run_id: lastChunk.run_id,
          from: GraphNode.END_GRAPH,
          thread_id: threadId,
          checkpoint_id: currentCheckpointId,
          task_id: currentTaskId ? currentTaskId : undefined,
          step_id: currentStepId ? currentStepId : undefined,
          task_title: undefined,
          tools: lastChunk.data.output.tool_calls ?? undefined,
          message: lastChunk.data.output.content
            ? lastChunk.data.output.content.toLocaleString()
            : undefined,
          metadata: {
            error: graphError,
            final: true,
            is_human: isInterruptHandle,
            user_request: request.request,
          },
          timestamp: new Date().toISOString(),
        };
        return;
      } catch (error: any) {
        if (error?.message?.includes('Abort')) {
          logger.info('[SnakAgent] Execution aborted');
          return;
        }

        logger.error(`[SnakAgent] Execution error: ${error}`);
        if (this.isTokenRelatedError(error)) {
          logger.warn('[SnakAgent] Token limit exceeded');
          throw new Error(
            'The request could not be completed because it exceeded the token limit. Please try again with a shorter input or reduce the complexity of the task.'
          );
        }
      }
    } catch (error: any) {
      logger.error(`[SnakAgent] Execution failed: ${error}`);
      return;
    }
  }
}
