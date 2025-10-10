import { BaseAgent } from './baseAgent.js';
import { logger, AgentConfig } from '@snakagent/core';
import { AgentType, SupervisorNode } from '../../shared/enums/agent.enum.js';
import {
  ChunkOutput,
  ChunkOutputMetadata,
} from '../../shared/types/streaming.types.js';
import { createSupervisorGraph } from '@agents/graphs/core-graph/supervisor.graph.js';
import { CheckpointerService } from '@agents/graphs/manager/checkpointer/checkpointer.js';
import {
  AIMessage,
  AIMessageChunk,
  HumanMessage,
} from '@langchain/core/messages';
import { GraphErrorType, UserRequest } from '@stypes/graph.types.js';
import { EventType } from '@enums/event.enums.js';
import { StreamEvent } from '@langchain/core/tracers/log_stream';
import { StateSnapshot } from '@langchain/langgraph';
import {
  getInterruptCommand,
  getLatestMessageForMessage,
  isInterrupt,
} from '@agents/graphs/utils/graph.utils.js';
import { notify } from '@snakagent/database/queries';

/**
 * Supervisor agent for managing and coordinating multiple agents
 */
export class SupervisorAgent extends BaseAgent {
  constructor(agent_config: AgentConfig.Runtime) {
    super('supervisor', AgentType.SUPERVISOR, agent_config);
  }

  /**
   * Initialize the SupervisorAgent
   * @throws {Error} If initialization fails
   */
  public async init(): Promise<void> {
    try {
      if (!this.agentConfig) {
        throw new Error('Agent configuration is required for initialization');
      }

      this.pgCheckpointer = await CheckpointerService.getInstance();
      if (!this.pgCheckpointer) {
        throw new Error('Failed to initialize Postgres checkpointer');
      }
      const graph = await createSupervisorGraph(this);
      if (!graph) {
        throw new Error('Failed to create supervisor graph');
      }
      this.compiledStateGraph = graph;
      logger.info('[SupervisorAgent] Initialized successfully');
    } catch (error) {
      logger.error(`[SupervisorAgent] Initialization failed: ${error}`);
      throw error;
    }
  }

  /**
   * Creates a standardized chunk output
   */
  private createChunkOutput(
    chunk: StreamEvent,
    state: StateSnapshot,
    user_request: string,
    retryCount: number,
    from: SupervisorNode,
    currentTaskId?: string,
    currentStepId?: string,
    graphError?: GraphErrorType
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
      task_id: currentTaskId,
      step_id: currentStepId,
      task_title: chunk.data?.output?.additional_kwargs?.task_title ?? null,
      from,
      tools:
        chunk.event === EventType.ON_CHAT_MODEL_END
          ? (chunk.data.output.tool_calls ?? null)
          : undefined,
      message:
        chunk.event === EventType.ON_CHAT_MODEL_END
          ? typeof chunk.data.output.content === 'string'
            ? chunk.data.output.content
            : (() => {
                if (Array.isArray(chunk.data.output.content)) {
                  for (const item of chunk.data.output.content) {
                    if (item.type === 'text') {
                      return item.text;
                    }
                  }
                }
                return null;
              })()
          : undefined,
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
    state: StateSnapshot,
    user_request: string,
    retryCount: number,
    graphError?: GraphErrorType
  ): ChunkOutput | null {
    // For logging purposes
    const eventType = chunk.event;
    // Only process chat model start/end events
    if (
      eventType !== EventType.ON_CHAT_MODEL_START &&
      eventType !== EventType.ON_CHAT_MODEL_END
    ) {
      return null;
    }
    const nodeType =
      state.values.messages && state.values.messages.length > 0
        ? ((getLatestMessageForMessage(state.values.messages, AIMessage)
            ?.name as SupervisorNode) ?? ('supervisor' as SupervisorNode))
        : ('supervisor' as SupervisorNode);
    return this.createChunkOutput(
      chunk,
      state,
      user_request,
      retryCount,
      nodeType
    );
  }

  /**
   * Execute the supervisor agent
   * @param input - The input for execution
   * @returns AsyncGenerator yielding ChunkOutput
   */
  public async *execute(userRequest: UserRequest): AsyncGenerator<ChunkOutput> {
    try {
      let currentCheckpointId: string | undefined = undefined;
      let lastChunk: StreamEvent | undefined = undefined;
      let stateSnapshot: StateSnapshot;
      let isInterruptHandle = false;
      if (!this.compiledStateGraph) {
        throw new Error('SupervisorAgent is not initialized');
      }
      if (!this.controller || this.controller.signal.aborted) {
        this.controller = new AbortController();
      }
      if (this.pgCheckpointer === null) {
        throw new Error('Checkpointer is not initialized');
      }
      const threadId = this.agentConfig.id;
      const configurable = {
        thread_id: threadId,
        agent_config: this.agentConfig,
      };
      const threadConfig = {
        configurable: configurable,
      };
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
      const executionInput = isInterrupt(stateSnapshot)
        ? getInterruptCommand(userRequest.request)
        : { messages: [new HumanMessage(userRequest.request || '')] };

      for await (const chunk of this.compiledStateGraph.streamEvents(
        executionInput,
        executionConfig
      )) {
        stateSnapshot = await this.compiledStateGraph.getState(executionConfig);
        if (!stateSnapshot) {
          throw new Error('Failed to retrieve graph state during execution');
        }
        currentCheckpointId = stateSnapshot.config.configurable?.checkpoint_id;
        lastChunk = chunk;
        if (
          chunk.event === 'on_chain_end' &&
          isInterruptHandle === false &&
          isInterrupt(stateSnapshot)
        ) {
          await notify.insertNotify(
            this.agentConfig.user_id,
            this.agentConfig.id,
            stateSnapshot.tasks[0].interrupts[0].value
          );
          isInterruptHandle = true;
        }
        const chunkProcessed = this.processChunkOutput(
          chunk,
          stateSnapshot,
          userRequest.request,
          0
        );
        if (chunkProcessed) {
          yield chunkProcessed;
        }
      }

      const startTime = Date.now();
      if (isInterruptHandle === false) {
        const endTime = Date.now();
        const duration = endTime - startTime;
        await this.pgCheckpointer.deleteThread(threadId);
        logger.info(`[SupervisorAgent] deleteThread took ${duration}ms`);
      }
      if (!lastChunk || !currentCheckpointId) {
        throw new Error('No output from autonomous execution');
      }
      yield {
        event: lastChunk.event,
        run_id: lastChunk.run_id,
        from: SupervisorNode.END_GRAPH,
        thread_id: threadId,
        checkpoint_id: currentCheckpointId,
        message: lastChunk.data.output.content
          ? lastChunk.data.output.content.toLocaleString()
          : undefined,
        metadata: {
          error: undefined,
          final: true,
          is_human: isInterruptHandle,
          user_request: userRequest.request,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error(`[SupervisorAgent] Execution failed: ${error}`);
      throw error;
    }
  }
}
