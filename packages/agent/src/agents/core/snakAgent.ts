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
  MemoryConfig,
} from '@snakagent/core';
import { metrics } from '@snakagent/metrics';
import { BaseMessage, HumanMessage, AIMessage } from '@langchain/core/messages';
import { DatabaseCredentials } from '../../tools/types/database.js';
import { AgentMode, AGENT_MODES } from '../../config/agentConfig.js';
import { MemoryAgent } from '../operators/memoryAgent.js';
import { createInteractiveAgent } from '../modes/interactive.js';
import { AgentReturn, createAutonomousAgent } from '../modes/autonomous.js';
import { RunnableConfig } from '@langchain/core/runnables';
import { Command } from '@langchain/langgraph';
import { FormatChunkIteration, ToolsChunk } from './utils.js';
import { iterations } from '@snakagent/database/queries';
import { RagAgent } from '../operators/ragAgent.js';
import { MCPAgent } from '../operators/mcp-agent/mcpAgent.js';
import { ConfigurationAgent } from '../operators/config-agent/configAgent.js';
/**
 * Configuration interface for SnakAgent initialization
 */

export interface StreamChunk {
  chunk: any;
  iteration_number: number;
  langgraph_step: number;
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

export enum AgentIterationEvent {
  ON_CHAT_MODEL_STREAM = 'on_chat_model_stream',
  ON_CHAT_MODEL_START = 'on_chat_model_start',
  ON_CHAT_MODEL_END = 'on_chat_model_end',
  ON_CHAIN_START = 'on_chain_start',
  ON_CHAIN_END = 'on_chain_end',
  ON_CHAIN_STREAM = 'on_chain_stream',
}

export interface IterationResponse {
  event: AgentIterationEvent;
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

    metrics.agentConnect();

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
        logger.warn('No ModelSelector provided, functionality will be limited');
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
          logger.warn('Agent executor creation succeeded but result is null');
        }
      } catch (executorError) {
        logger.error(`Failed to create agent executor: ${executorError}`);
        logger.warn('Will attempt to recover during execute() calls');
      }

      logger.info('SnakAgent initialized successfully');
    } catch (error) {
      logger.error(`SnakAgent initialization failed: ${error}`);
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
      logger.info(`Creating agent executor for mode: ${this.currentMode}`);

      switch (this.currentMode) {
        case AGENT_MODES[AgentMode.AUTONOMOUS]:
          this.agentReactExecutor = await createAutonomousAgent(
            this,
            this.modelSelector
          );
          break;
        case AGENT_MODES[AgentMode.HYBRID]:
          this.agentReactExecutor = await createAutonomousAgent(
            this,
            this.modelSelector
          );
          break;
        case AGENT_MODES[AgentMode.INTERACTIVE]:
          this.agentReactExecutor = await createInteractiveAgent(
            this,
            this.modelSelector
          );
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
      logger.error(`Failed to create Agent React Executor: ${error}`);
      if (error instanceof Error && error.stack) {
        logger.error(`Stack trace: ${error.stack}`);
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
      logger.debug('SnakAgent: Initializing MemoryAgent...');
      this.memoryAgent = new MemoryAgent({
        shortTermMemorySize: agentConfig?.memory?.shortTermMemorySize || 15,
        memorySize: agentConfig?.memory?.memorySize || 20,
        embeddingModel: agentConfig?.memory?.embeddingModel,
      });
      await this.memoryAgent.init();
      // this.operators.set(this.memoryAgent.id, this.memoryAgent);
      logger.debug('SnakAgent: MemoryAgent initialized');
    } else {
      logger.info(
        'SnakAgent: MemoryAgent initialization skipped (disabled in config)'
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
    const ragCfg = agentConfig?.rag;
    if (!ragCfg || ragCfg.enabled !== true) {
      logger.info(
        'SnakAgent: RagAgent initialization skipped (disabled or not configured in config)'
      );
      return;
    }
    logger.debug('SnakAgent: Initializing RagAgent...');
    this.ragAgent = new RagAgent({
      topK: ragCfg?.topK,
      embeddingModel: ragCfg?.embeddingModel,
    });
    await this.ragAgent.init();
    // this.operators.set(this.ragAgent.id, this.ragAgent);
    logger.debug('SnakAgent: RagAgent initialized');
  }

  public getMemoryAgent(): MemoryAgent | null {
    if (!this.memoryAgent) {
      logger.warn('MemoryAgent is not initialized');
      return null;
    }
    return this.memoryAgent;
  }

  public getRagAgent(): RagAgent | null {
    if (!this.ragAgent) {
      logger.warn('RagAgent is not initialized');
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
      logger.warn('Controller is not initialized');
      return undefined;
    }
    return this.controller;
  }

  public async *executeAsyncGenerator(
    input: string,
    config?: Record<string, any>
  ): AsyncGenerator<StreamChunk> {
    try {
      if (!this.agentReactExecutor) {
        throw new Error('Agent executor is not initialized');
      }

      await this.captureQuestion(input);

      const graphState = {
        messages: [new HumanMessage(input)],
      };

      const runnableConfig: Record<string, any> = {};
      const threadId =
        config?.threadId || config?.metadata?.threadId || 'default';

      if (threadId) {
        runnableConfig.configurable = { thread_id: threadId };
      }

      if (!runnableConfig.configurable) runnableConfig.configurable = {};
      runnableConfig.configurable.userId =
        this.agentConfig.chatId || 'default_chat';
      runnableConfig.configurable.agentId = this.agentConfig.id;
      runnableConfig.configurable.memorySize =
        this.agentConfig.memory?.memorySize;

      runnableConfig.version = 'v2';

      if (config?.recursionLimit) {
        runnableConfig.recursionLimit = config.recursionLimit;
      }

      if (config?.originalUserQuery) {
        if (!runnableConfig.configurable) runnableConfig.configurable = {};
        runnableConfig.configurable.originalUserQuery =
          config.originalUserQuery;
      }

      this.controller = new AbortController();
      runnableConfig.signal = this.controller.signal;

      logger.debug(
        `Executing with thread ID: ${threadId}, message count: ${graphState.messages.length}`
      );

      const app = this.agentReactExecutor.app;
      let lastChunkToSave;
      let iterationNumber = 0;
      let finalAnswer = '';
      let lastKnownLangGraphStep = 0;

      for await (const chunk of await app.streamEvents(
        graphState,
        runnableConfig
      )) {
        // Track the last known langgraph_step from any chunk that has it
        if (chunk.metadata?.langgraph_step !== undefined) {
          lastKnownLangGraphStep = chunk.metadata.langgraph_step;
        }

        if (
          chunk.name === 'Branch<agent>' &&
          chunk.event === 'on_chain_start'
        ) {
          iterationNumber++;
        }
        if (chunk.name === 'Branch<agent>' && chunk.event === 'on_chain_end') {
          lastChunkToSave = chunk;
        }

        if (
          chunk.event === 'on_chat_model_stream' ||
          chunk.event === 'on_chat_model_start' ||
          chunk.event === 'on_chat_model_end'
        ) {
          const formatted = FormatChunkIteration(chunk);
          if (!formatted) {
            throw new Error(`Failed to format chunk: ${JSON.stringify(chunk)}`);
          }
          const formattedChunk: IterationResponse = {
            event: chunk.event as AgentIterationEvent,
            kwargs: formatted,
          };
          if (
            formattedChunk.event === AgentIterationEvent.ON_CHAT_MODEL_START
          ) {
            finalAnswer = '';
          }
          if (
            formattedChunk.event === AgentIterationEvent.ON_CHAT_MODEL_STREAM
          ) {
            finalAnswer += (formatted as FormattedOnChatModelStream).chunk
              .content;
          }
          if (
            formattedChunk.event === AgentIterationEvent.ON_CHAT_MODEL_END &&
            !finalAnswer
          ) {
            finalAnswer = (formatted as FormattedOnChatModelEnd).iteration
              .result.output.content;
          }
          yield {
            chunk: formattedChunk,
            iteration_number: iterationNumber,
            langgraph_step: chunk.metadata.langgraph_step,
            final: false,
          };
        }
      }

      if (finalAnswer) {
        await this.saveIteration(finalAnswer);
      }

      if (lastChunkToSave) {
        yield {
          chunk: {
            event: lastChunkToSave.event,
            kwargs: {
              iteration: lastChunkToSave,
            },
          },
          iteration_number: iterationNumber,
          langgraph_step: lastChunkToSave.metadata.langgraph_step,
          final: true,
        };
      } else {
        // Fallback if no on_chain_end chunk was found
        yield {
          chunk: {
            event: 'on_chain_end',
            kwargs: {
              iteration: { name: 'Branch<agent>', event: 'on_chain_end' },
            },
          },
          iteration_number: iterationNumber,
          langgraph_step: lastKnownLangGraphStep,
          final: true,
        };
      }
      return;
    } catch (error) {
      logger.error('ExecuteAsyncGenerator failed:', error);
      throw error;
    }
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
  ): AsyncGenerator<StreamChunk> {
    try {
      logger.debug(
        `Execute called - mode: ${this.currentMode}, interrupted: ${isInterrupted}`
      );

      if (!this.agentReactExecutor) {
        throw new Error('Agent executor is not initialized');
      }

      if (this.currentMode == AGENT_MODES[AgentMode.INTERACTIVE]) {
        for await (const chunk of this.executeAsyncGenerator(input, config)) {
          if (chunk.final) {
            yield chunk;
            return;
          }
          yield chunk;
        }
      } else if (
        this.currentMode == AGENT_MODES[AgentMode.AUTONOMOUS] ||
        this.currentMode == AGENT_MODES[AgentMode.HYBRID]
      ) {
        for await (const chunk of this.executeAutonomousAsyncGenerator(
          input,
          isInterrupted
        )) {
          if (chunk.final) {
            yield chunk;
            return;
          }
          yield chunk;
        }
      } else {
        throw new Error(
          `The mode : ${this.currentMode} is not supported in this method.`
        );
      }
    } catch (error) {
      logger.error('Execute failed:', error);
      throw error;
    }
  }

  public stop(): void {
    if (this.controller) {
      this.controller.abort();
      logger.info('SnakAgent execution stopped');
    } else {
      logger.warn('No controller found to stop execution');
    }
  }

  /**
   * Capture the latest user question for pairing with the next assistant answer
   * @param content - User question content
   */
  private async captureQuestion(content: string) {
    try {
      const limit = this.agentConfig.memory?.shortTermMemorySize ?? 15;
      if (
        limit <= 0 ||
        this.currentMode !== AGENT_MODES[AgentMode.INTERACTIVE] ||
        this.agentConfig.memory?.enabled === false
      ) {
        return;
      }

      const embedding = await this.iterationEmbeddings.embedQuery(content);
      this.pendingIteration = { question: content, embedding };
    } catch (err) {
      logger.error(`Failed to capture question iteration: ${err}`);
    }
  }

  /**
   * Save a question/answer pair and enforce FIFO limit
   * @param answer - Assistant answer content
   */
  private async saveIteration(answer: string) {
    try {
      const limit = this.agentConfig.memory?.shortTermMemorySize ?? 15;
      if (
        limit <= 0 ||
        this.currentMode !== AGENT_MODES[AgentMode.INTERACTIVE] ||
        !this.pendingIteration ||
        this.agentConfig.memory?.enabled === false
      ) {
        return;
      }

      const answerEmbedding = await this.iterationEmbeddings.embedQuery(answer);

      await iterations.insert_iteration({
        agent_id: this.agentConfig.id,
        question: this.pendingIteration.question,
        question_embedding: this.pendingIteration.embedding,
        answer,
        answer_embedding: answerEmbedding,
      });

      this.pendingIteration = undefined;

      const count = await iterations.count_iterations(this.agentConfig.id);
      if (count > limit) {
        await iterations.delete_oldest_iteration(this.agentConfig.id);
      }
    } catch (err) {
      logger.error(`Failed to save iteration pair: ${err}`);
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
  public async *executeAutonomousAsyncGenerator(
    input: string,
    isInterrupted: boolean = false,
    runnableConfig?: RunnableConfig
  ): AsyncGenerator<StreamChunk> {
    let autonomousResponseContent: string | any;
    const originalMode = this.currentMode;
    let totalIterationCount = 0;

    try {
      logger.info(
        `Starting autonomous execution - interrupted: ${isInterrupted}`
      );

      if (!this.agentReactExecutor) {
        throw new Error('Agent executor is not initialized');
      }

      const app = this.agentReactExecutor.app;
      const agentJsonConfig = this.agentReactExecutor.agent_config;
      const maxGraphIterations = this.agentConfig.maxIterations;
      const short_term_memory =
        this.agentConfig.memory.shortTermMemorySize || 5;
      const memory_size = this.agentConfig.memory?.memorySize || 20;
      const human_in_the_loop = this.agentConfig.mode === AgentMode.HYBRID;
      this.controller = new AbortController();
      const initialMessages: BaseMessage[] = [new HumanMessage(input)];

      const threadId = agentJsonConfig?.chatId || 'autonomous_session';
      logger.info(`Autonomous execution thread ID: ${threadId}`);

      const threadConfig = {
        configurable: {
          thread_id: threadId,
          config: {
            max_graph_steps: maxGraphIterations,
            short_term_memory: short_term_memory,
            memorySize: memory_size,
            human_in_the_loop: human_in_the_loop,
          },
        },
      };

      let lastChunkToSave;
      try {
        let currentIterationNumber = 0;
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

        while (true) {
          const executionInput = !isInterrupted ? graphState : command;

          for await (const chunk of await app.streamEvents(
            executionInput,
            executionConfig
          )) {
            isInterrupted = false;

            if (
              (chunk.name === 'Branch<tools,tools,agent,end>' ||
                chunk.name === 'Branch<agent,tools,agent,human,end>') &&
              chunk.event === 'on_chain_start'
            ) {
              const messages = chunk.data.input.messages;
              currentIterationNumber =
                messages[messages.length - 1].additional_kwargs
                  .iteration_number;
              logger.debug(`Iteration ${currentIterationNumber} started`);
            }

            if (
              (chunk.name === 'Branch<tools,tools,agent,end>' ||
                chunk.name === 'Branch<agent,tools,agent,human,end>') &&
              chunk.event === 'on_chain_end'
            ) {
              lastChunkToSave = chunk;
            }

            if (
              chunk.event === 'on_chat_model_start' ||
              chunk.event === 'on_chat_model_stream' ||
              chunk.event === 'on_chat_model_end'
            ) {
              const formatted = FormatChunkIteration(chunk);
              if (!formatted) {
                throw new Error(
                  `Failed to format chunk: ${JSON.stringify(chunk, null, 2)}`
                );
              }
              const formattedChunk: IterationResponse = {
                event: chunk.event as AgentIterationEvent,
                kwargs: formatted,
              };
              yield {
                chunk: formattedChunk,
                iteration_number: currentIterationNumber,
                langgraph_step: chunk.metadata.langgraph_step,
                final: false,
              };
            }
          }

          const state = await app.getState(executionConfig);
          if (state.tasks.length > 0 && state.tasks[0]?.interrupts) {
            if (state.tasks[0].interrupts.length > 0) {
              logger.info('Graph interrupted - waiting for user input');
              yield {
                chunk: {
                  event: 'on_graph_interrupted',
                  kwargs: {
                    iteration: lastChunkToSave,
                  },
                },
                iteration_number: currentIterationNumber,
                langgraph_step: lastChunkToSave?.metadata.langgraph_step || -1,
                final: true,
              };
              return;
            }
          } else {
            logger.info('Autonomous execution completed');
            break;
          }
        }

        totalIterationCount = currentIterationNumber;
        yield {
          chunk: {
            event: lastChunkToSave.event,
            kwargs: {
              iteration: lastChunkToSave,
            },
          },
          iteration_number: currentIterationNumber,
          langgraph_step: lastChunkToSave.metadata.langgraph_step,
          final: true,
        };
        return;
      } catch (error: any) {
        if (error?.message?.includes('Abort')) {
          logger.info('Execution aborted by user');
          if (lastChunkToSave) {
            yield {
              chunk: {
                event: 'on_graph_aborted',
                kwargs: {
                  iteration: lastChunkToSave,
                },
              },
              iteration_number: totalIterationCount,
              langgraph_step: lastChunkToSave.metadata.langgraph_step,
              final: true,
            };
          }
          return;
        }

        logger.error(`Autonomous execution error: ${error}`);
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
      logger.error(`Autonomous execution failed: ${error}`);
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
