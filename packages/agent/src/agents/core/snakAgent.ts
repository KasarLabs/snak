import { BaseAgent } from './baseAgent.js';
import { RpcProvider } from 'starknet';
import { logger, AgentConfig, Id, StarknetConfig } from '@snakagent/core';
import { BaseMessage, HumanMessage, AIMessage } from '@langchain/core/messages';
import { DatabaseCredentials } from '@snakagent/core';
import { AgentType } from '../../shared/enums/agent.enum.js';
import { createGraph } from '../graphs/graph.js';
import { Command, CompiledStateGraph } from '@langchain/langgraph';
import { RagAgent } from '../operators/ragAgent.js';
import {
  TaskExecutorNode,
  GraphNode,
  TaskMemoryNode,
  TaskManagerNode,
} from '../../shared/enums/agent.enum.js';
import { ChunkOutput } from '../../shared/types/streaming.types.js';
import { EventType } from '@enums/event.enums.js';
import { isInEnum } from '@enums/utils.js';
import { StreamEvent } from '@langchain/core/tracers/log_stream';

/**
 * Main agent for interacting with the Starknet blockchain
 * Supports multiple execution modes: interactive, autonomous, and hybrid
 */
export class SnakAgent extends BaseAgent {
  private readonly provider: RpcProvider;
  private readonly accountPrivateKey: string;
  private readonly accountPublicKey: string;
  private readonly agentMode: string;
  private readonly agentConfig: AgentConfig.Runtime;
  private readonly databaseCredentials: DatabaseCredentials;
  private ragAgent: RagAgent | null = null;
  private compiledGraph: CompiledStateGraph<any, any, any, any, any>;
  private controller: AbortController;
  constructor(
    starknet_config: StarknetConfig,
    agent_config: AgentConfig.Runtime,
    database_credentials: DatabaseCredentials
  ) {
    super('snak', AgentType.SNAK);

    this.provider = starknet_config.provider;
    this.accountPrivateKey = starknet_config.accountPrivateKey;
    this.accountPublicKey = starknet_config.accountPublicKey;
    this.databaseCredentials = database_credentials;
    this.agentConfig = agent_config;
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
        await this.createAgentReactExecutor();
        if (!this.compiledGraph) {
          logger.warn(
            '[SnakAgent]  Agent executor creation succeeded but result is null'
          );
        }
      } catch (executorError) {
        logger.error(
          `[SnakAgent]  Failed to create agent executor: ${executorError}`
        );
        logger.warn(
          '[SnakAgent]  Will attempt to recover during execute() calls'
        );
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
      logger.info(
        `[SnakAgent]  Creating Graph for agent : ${this.agentConfig.name}`
      );
      this.compiledGraph = await createGraph(this);
      if (!this.compiledGraph) {
        throw new Error(
          `Failed to create agent executor for agent : ${this.agentConfig.name}: result is null`
        );
      }
      logger.info(
        `[SnakAgent]  Agent executor created successfully for agent : ${this.agentConfig.name}`
      );

      if (!this.compiledGraph) {
        throw new Error(
          `Failed to create agent executor for agent : ${this.agentConfig.name}: result is null`
        );
      }
    } catch (error) {
      logger.error(
        `[SnakAgent]  Failed to create Agent React Executor: ${error}`
      );
      if (error instanceof Error && error.stack) {
        logger.error(`[SnakAgent] 📋 Stack trace: ${error.stack}`);
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
      logger.info(
        '[SnakAgent]  RagAgent initialization skipped (disabled or not configured)'
      );
      return;
    }
    logger.debug('[SnakAgent]  Initializing RagAgent...');
    this.ragAgent = new RagAgent({
      top_k: ragConfig?.top_k,
      embedding_model: ragConfig?.embedding_model,
    });
    await this.ragAgent.init();
    logger.debug('[SnakAgent]  RagAgent initialized');
  }

  public getRagAgent(): RagAgent | null {
    if (!this.ragAgent) {
      logger.warn('[SnakAgent]  RagAgent is not initialized');
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
   * Get agent configuration
   * @returns The agent configuration object
   */
  public getAgentConfig(): AgentConfig.Runtime {
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
      logger.warn('[SnakAgent]  Controller is not initialized');
      return undefined;
    }
    return this.controller;
  }

  /**
   * Execute the agent with the given input
   * @param input - The input message or string
   * @param agent_config - Optional configuration for execution
   * @returns Promise resolving to the agent response
   */
  public async *execute(
    input: string,
    isInterrupted: boolean = false,
    agent_config?: Record<string, any>
  ): AsyncGenerator<ChunkOutput> {
    try {
      logger.debug(
        `[SnakAgent] Execute called - agent : ${this.agentConfig.name}, interrupted: ${isInterrupted}`
      );

      if (!this.compiledGraph) {
        throw new Error('Agent executor is not initialized');
      }
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
    } catch (error) {
      logger.error(`[SnakAgent]  Execute failed: ${error}`);
      throw error;
    }
  }

  public stop(): void {
    if (this.controller) {
      this.controller.abort();
      logger.info('[SnakAgent]  Execution stopped');
    } else {
      logger.warn('[SnakAgent]  No controller found to stop execution');
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
    try {
      logger.info(
        `[SnakAgent]  Starting autonomous execution - interrupted: ${isInterrupted}`
      );

      if (!this.compiledGraph) {
        throw new Error('CompiledGraph is not initialized');
      }
      this.controller = new AbortController();
      const initialMessages: BaseMessage[] = [new HumanMessage(input ?? '')];
      this.compiledGraph;
      const threadId = this.agentConfig.id;

      logger.info(`[SnakAgent]  Autonomous execution thread ID: ${threadId}`);
      const threadConfig = {
        configurable: {
          thread_id: threadId,
          agent_config: this.agentConfig,
        },
      };
      let lastChunk;
      let retryCount: number = 0;
      let currentCheckpointId: string | undefined = undefined;

      try {
        let command: Command | undefined;
        const graphState = { messages: initialMessages };
        const executionConfig = {
          ...threadConfig,
          signal: this.controller.signal,
          recursionLimit: 500,
          version: 'v2' as const,
        };

        if (isInterrupted) {
          command = new Command({
            resume: input,
          });
        }

        const executionInput = !isInterrupted ? graphState : command;
        let chunk: StreamEvent;
        for await (chunk of this.compiledGraph.streamEvents(
          executionInput ?? { messages: [] },
          executionConfig
        )) {
          isInterrupted = false;
          lastChunk = chunk;
          const state = await this.compiledGraph.getState(executionConfig);
          retryCount = state.values.retry;
          currentCheckpointId = state.config.configurable?.checkpoint_id;
          if (
            chunk.metadata?.langgraph_node &&
            isInEnum(TaskManagerNode, chunk.metadata.langgraph_node)
          ) {
            if (chunk.event === EventType.ON_CHAT_MODEL_START) {
              yield {
                event: chunk.event,
                run_id: chunk.run_id,
                checkpoint_id: state.config.configurable?.checkpoint_id,
                thread_id: state.config.configurable?.thread_id,
                from: GraphNode.TASK_MANAGER,
                metadata: {
                  executionMode: chunk.metadata.executionMode,
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
                checkpoint_id: state.config.configurable?.checkpoint_id,
                thread_id: state.config.configurable?.thread_id,
                from: GraphNode.TASK_MANAGER,
                metadata: {
                  tokens: chunk.data.output?.usage_metadata?.total_tokens,
                  executionMode: chunk.metadata.executionMode,
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
            isInEnum(TaskExecutorNode, chunk.metadata.langgraph_node)
          ) {
            if (chunk.event === EventType.ON_CHAT_MODEL_START) {
              yield {
                event: chunk.event,
                run_id: chunk.run_id,
                checkpoint_id: state.config.configurable?.checkpoint_id,
                thread_id: state.config.configurable?.thread_id,
                from: GraphNode.AGENT_EXECUTOR,
                metadata: {
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
            if (chunk.event === EventType.ON_CHAT_MODEL_END) {
              yield {
                event: chunk.event,
                run_id: chunk.run_id,
                tools: chunk.data.output.tool_calls,
                content: chunk.data.output.content.toLocaleString(), // Is an ParsedPlan object
                checkpoint_id: state.config.configurable?.checkpoint_id,
                thread_id: state.config.configurable?.thread_id,
                from: GraphNode.AGENT_EXECUTOR,
                metadata: {
                  tokens: chunk.data.output?.usage_metadata?.total_tokens,
                  execution_mode: chunk.metadata.executionMode,
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
                  checkpoint_id: state.config.configurable?.checkpoint_id,
                  thread_id: state.config.configurable?.thread_id,
                  from: GraphNode.AGENT_EXECUTOR,
                  metadata: {
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
          } else if (
            chunk.metadata?.langgraph_node &&
            isInEnum(TaskMemoryNode, chunk.metadata.langgraph_node)
          ) {
            if (chunk.event === EventType.ON_CHAT_MODEL_START) {
              yield {
                event: chunk.event,
                run_id: chunk.run_id,
                checkpoint_id: state.config.configurable?.checkpoint_id,
                thread_id: state.config.configurable?.thread_id,
                from: GraphNode.MEMORY_ORCHESTRATOR,
                metadata: {
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
            if (chunk.event === EventType.ON_CHAT_MODEL_END) {
              yield {
                event: chunk.event,
                run_id: chunk.run_id,
                checkpoint_id: state.config.configurable?.checkpoint_id,
                thread_id: state.config.configurable?.thread_id,
                from: GraphNode.MEMORY_ORCHESTRATOR,
                metadata: {
                  tokens: chunk.data.output?.usage_metadata?.total_tokens,
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
        logger.info('[SnakAgent]  Autonomous execution completed');
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
        if (error?.message?.includes('Abort')) {
          logger.info('[SnakAgent]  Execution aborted by user');
          return;
        }

        logger.error(`[SnakAgent]  Autonomous execution error: ${error}`);
        if (this.isTokenRelatedError(error)) {
          autonomousResponseContent =
            'Error: Token limit likely exceeded during autonomous execution.';
        }
      }
    } catch (error: any) {
      logger.error(`[SnakAgent]  Autonomous execution failed: ${error}`);
      return new AIMessage({
        content: `Autonomous execution error: ${error.message}`,
        additional_kwargs: {
          from: 'snak',
          final: true,
          error: 'autonomous_execution_error',
        },
      });
    }
  }
}
