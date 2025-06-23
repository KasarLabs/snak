import { AgentType, BaseAgent } from './baseAgent.js';
import { RpcProvider } from 'starknet';
import { ModelSelector } from '../operators/modelSelector.js';
import { logger, metrics, AgentConfig } from '@snakagent/core';
import {
  BaseMessage,
  HumanMessage,
  AIMessage,
  AIMessageChunk,
} from '@langchain/core/messages';
import { DatabaseCredentials } from '../../tools/types/database.js';
import { AgentMode, AGENT_MODES } from '../../config/agentConfig.js';
import { MemoryConfig } from '../operators/memoryAgent.js';
import { createInteractiveAgent } from '../modes/interactive.js';
import { AgentReturn, createAutonomousAgent } from '../modes/autonomous.js';
// import { Command } from '@langchain/langgraph';
import { FormatChunkIteration, ToolsChunk } from './utils.js';
import { RunnableConfig } from '@langchain/core/runnables';
import { Command } from '@langchain/langgraph';
/**
 * Configuration interface for SnakAgent initialization
 */

import readline from 'readline';

// Créez l'interface readline une seule fois au début de votre fichier
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

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
  modelSelector: ModelSelector | null;
}

/**
 * Main agent for interacting with the Starknet blockchain
 * Supports multiple execution modes: interactive, autonomous, and hybrid
 */
export class SnakAgent extends BaseAgent {
  private readonly provider: RpcProvider;
  private readonly accountPrivateKey: string;
  private readonly accountPublicKey: string;
  private readonly signature: string;
  private readonly agentMode: string;
  private readonly agentConfig: AgentConfig;
  private readonly db_credentials: DatabaseCredentials;
  // private memory: MemoryConfig;
  private currentMode: string;
  private agentReactExecutor: AgentReturn;
  private modelSelector: ModelSelector | null = null;

  constructor(config: SnakAgentConfig) {
    super('snak', AgentType.SNAK);

    this.provider = config.provider;
    this.accountPrivateKey = config.accountPrivateKey;
    this.accountPublicKey = config.accountPublicKey;
    this.agentMode = AGENT_MODES[config.agentConfig.mode];
    this.db_credentials = config.db_credentials;
    this.currentMode = AGENT_MODES[config.agentConfig.mode];
    this.agentConfig = config.agentConfig;
    this.modelSelector = config.modelSelector;

    if (!config.accountPrivateKey) {
      throw new Error('STARKNET_PRIVATE_KEY is required');
    }

    metrics.metricsAgentConnect(
      config.agentConfig?.name ?? 'agent',
      config.agentConfig?.mode === AgentMode.AUTONOMOUS
        ? AGENT_MODES[AgentMode.AUTONOMOUS]
        : AGENT_MODES[AgentMode.INTERACTIVE]
    );
  }

  /**
   * Initialize the SnakAgent and create the appropriate executor
   * @throws {Error} If initialization fails
   */
  public async init(): Promise<void> {
    try {
      logger.debug('Initializing SnakAgent...');

      if (!this.modelSelector) {
        logger.warn(
          'SnakAgent: No ModelSelector provided, functionality will be limited.'
        );
      }

      if (this.agentConfig) {
        this.agentConfig.plugins = this.agentConfig.plugins || [];
      } else {
        logger.warn('SnakAgent: No agent configuration available.');
      }

      try {
        await this.createAgentReactExecutor();
        if (!this.agentReactExecutor) {
          logger.warn(
            'SnakAgent: Agent executor creation succeeded but result is null or undefined.'
          );
        }
      } catch (executorError) {
        logger.error(
          `SnakAgent: Failed to create agent executor during init: ${executorError}`
        );
        logger.warn(
          'SnakAgent: Will attempt to recover during execute() calls.'
        );
      }

      logger.debug('SnakAgent initialized successfully.');
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
      logger.debug(
        `SnakAgent: Creating agent executor for mode: ${this.currentMode}`
      );

      switch (this.currentMode) {
        case AGENT_MODES[AgentMode.AUTONOMOUS]:
          this.agentReactExecutor = await createAutonomousAgent(
            this,
            this.modelSelector
          );
          console.log(
            JSON.stringify(this.agentReactExecutor.agent_config, null, 2)
          );
          break;
        case AGENT_MODES[AgentMode.INTERACTIVE]:
          this.agentReactExecutor = await createInteractiveAgent(
            this,
            this.modelSelector
          );
          break;
        // case AGENT_MODES[AgentMode.HYBRID]:
        // this.agentReactExecutor = await createHybridAgent(
        //   this,
        //   this.modelSelector
        // );
        // break;
        default:
          throw new Error(`Invalid mode: ${this.currentMode}`);
      }

      if (!this.agentReactExecutor) {
        throw new Error(
          `Failed to create agent executor for mode ${this.currentMode}: result is null or undefined`
        );
      }
    } catch (error) {
      logger.error(
        `SnakAgent: Failed to create Agent React Executor: ${error}`
      );
      if (error instanceof Error && error.stack) {
        logger.error(`Stack trace: ${error.stack}`);
      }
      throw error;
    }
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
    return this.db_credentials;
  }

  /**
   * Get agent signature
   * @returns Object containing the agent's signature
   */
  public getSignature() {
    return {
      signature: this.signature,
    };
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

  public async *executeAsyncGenerator(
    input: string,
    config?: Record<string, any>
  ): AsyncGenerator<any> {
    logger.debug(`SnakAgent executing with mode: ${this.currentMode}`);
    try {
      if (!this.agentReactExecutor) {
        throw new Error('Agent executor is not initialized. Cannot execute.');
      }

      console.log(
        `SnakAgent: Input type is ${typeof input}, checking conversion.`
      );

      const graphState = {
        messages: [new HumanMessage(input)],
      };

      const runnableConfig: Record<string, any> = {};
      const threadId =
        config?.threadId || config?.metadata?.threadId || 'default';

      if (threadId) {
        runnableConfig.configurable = { thread_id: threadId };
      }

      runnableConfig.version = 'v2';

      if (config?.recursionLimit) {
        runnableConfig.recursionLimit = config.recursionLimit;
      }

      if (config?.originalUserQuery) {
        if (!runnableConfig.configurable) runnableConfig.configurable = {};
        runnableConfig.configurable.originalUserQuery =
          config.originalUserQuery;
      }

      logger.debug(
        `SnakAgent: Invoking agent executor with ${graphState.messages.length} messages. Thread ID: ${threadId || 'N/A'}`
      );

      const app = this.agentReactExecutor.app;
      let chunk_to_save;
      let iteration_number = 0;

      for await (const chunk of await app.streamEvents(
        graphState,
        runnableConfig
      )) {
        if (
          chunk.name === 'Branch<agent>' &&
          chunk.event === 'on_chain_start'
        ) {
          iteration_number++;
        }
        if (chunk.name === 'Branch<agent>' && chunk.event === 'on_chain_end') {
          chunk_to_save = chunk;
        }

        logger.debug(
          `SnakAgent : ${chunk.event}, iteration : ${iteration_number}`
        );
        if (
          chunk.event === 'on_chat_model_stream' ||
          chunk.event === 'on_chat_model_start' ||
          chunk.event === 'on_chat_model_end'
        ) {
          const formatted = FormatChunkIteration(chunk);
          if (!formatted) {
            throw new Error(
              `SnakAgent: Failed to format chunk: ${JSON.stringify(chunk)}`
            );
          }
          const formattedChunk: IterationResponse = {
            event: chunk.event as AgentIterationEvent,
            kwargs: formatted,
          };
          yield {
            chunk: formattedChunk,
            iteration_number: iteration_number,
            final: false,
          };
        }
      }
      yield {
        chunk: {
          event: chunk_to_save.event,
          kwargs: {
            iteration: chunk_to_save,
          },
        },
        iteration_number: iteration_number,
        final: true,
      };
      return;
    } catch (error) {
      console.error('ExecuteAsyncGenerator :', error);
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
  ): AsyncGenerator<any> | Promise<any> {
    try {
      console.log(
        `Execute called with input type: ${typeof input}, value: ${input}`
      );
      if (!this.agentReactExecutor) {
        throw new Error('Agent executor is not initialized. Cannot execute.');
      }
      if (this.currentMode == AGENT_MODES[AgentMode.INTERACTIVE]) {
        for await (const chunk of this.executeAsyncGenerator(input, config)) {
          if (chunk.final) {
            yield chunk;
            return;
          }
          yield chunk;
        }
      } else if (this.currentMode == AGENT_MODES[AgentMode.AUTONOMOUS]) {
        for await (const chunk of this.execute_autonomous()) {
          if (chunk.final) {
            yield chunk;
            return;
          }
          yield chunk;
        }
      } else {
        return 'Hybrid mode is not supported in this method. Please use execute_hybrid() instead.';
      }
    } catch (error) {
      console.error('Execute :', error);
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
  public async *execute_autonomous(
    input?: string,
    config?: RunnableConfig
  ): AsyncGenerator<any> {
    let responseContent: string | any;
    let fallbackAttempted = false;
    let originalMode = this.currentMode;
    let iterationCount = 0;

    try {
      logger.debug(
        `SnakAgent starting autonomous execution. Current mode: ${this.currentMode}`
      );

      if (!this.agentReactExecutor) {
        throw new Error('Agent executor is not initialized. Cannot execute.');
      }

      const app = this.agentReactExecutor.app;
      const agentJsonConfig = this.agentReactExecutor.agent_config;
      const maxGraphIterations = 10;

      const initialHumanMessage = new HumanMessage(
        'Start executing the primary objective defined in your system prompt.'
      );
      let conversationHistory: BaseMessage[] = [initialHumanMessage];

      logger.info(
        `Thread ID: , ${agentJsonConfig?.chatId || 'autonomous_session'}`
      );
      const threadConfig = {
        configurable: {
          thread_id: agentJsonConfig?.chatId || 'autonomous_session',
          config: {
            max_graph_steps: maxGraphIterations,
            short_term_memory: 5,
            human_in_the_loop: true,
          },
        },
      };

      logger.info(
        `Starting autonomous graph execution with max iterations: ${maxGraphIterations}.`
      );
      try {
        let finalState: any = null;
        let chunk_to_save;
        let iteration_number = 0;
        let isInterrupted = false;
        let command: Command | undefined;
        let graphState = { messages: conversationHistory };
        let config = {
          ...threadConfig,
          recursionLimit: 500,
          version: 'v2',
        };
        while (-1) {
          let userInput = !isInterrupted ? graphState : command;
          for await (const chunk of await app.streamEvents(userInput, config)) {
            if (chunk.event === 'on_chat_model_stream') {
              iteration_number = chunk.metadata.langgraph_step;
            }
            isInterrupted = false;
            if (
              chunk.name === 'Branch<tools,tools,agent,end>' &&
              chunk.event === 'on_chain_start'
            ) {
              const messages = chunk.data.input.messages;
              iteration_number =
                messages[messages.length - 1].additional_kwargs
                  .iteration_number;
              console.log('Iteration number:', iteration_number);
              // console.log(JSON.stringify(chunk, null, 2));
              // iteration_number++;
            }
            if (
              chunk.name === 'Branch<tools,tools,agent,end>' &&
              chunk.event === 'on_chain_end'
            ) {
              chunk_to_save = chunk;
            }
            if (
              chunk.event === 'on_chat_model_start' ||
              chunk.event === 'on_chat_model_end'
            ) {
              const formatted = FormatChunkIteration(chunk);
              if (!formatted) {
                throw new Error(
                  `SnakAgent: Failed to format chunk: ${JSON.stringify(chunk, null, 2)}`
                );
              }
              const formattedChunk: IterationResponse = {
                event: chunk.event as AgentIterationEvent,
                kwargs: formatted,
              };
              yield {
                chunk: formattedChunk,
                iteration_number: iteration_number,
                langraphh_step: chunk.metadata.langgraph_step,
                final: false,
              };
            }
          }
          console.log('--- GRAPH INTERRUPTED ---');

          const state = await app.getState(config);
          if (state.tasks.length > 0 && state.tasks[0]?.interrupts) {
            logger.debug(
              `SnakAgent: Graph interrupted, checking for next steps.`
            );
            if (state.tasks[0].interrupts.length > 0) {
              logger.debug(
                `SnakAgent: Interrupts found, waiting for user input.`
              );
              yield {
                chunk: {
                  event: 'on_graph_interrupted',
                  kwargs: {
                    iteration: chunk_to_save || 'Hello',
                  },
                },
                iteration_number: iteration_number,
                langraphh_step: 0,
                final: true,
              };
              return;
            }
          } else {
            logger.debug(`SnakAgent: No interrupts found, ending execution.`);
            break;
          }
        }

        logger.debug('Autonomous graph invocation complete.');
        iterationCount = finalState?.iterations || iterationCount;
        console.log('iterationCount : ', iterationCount);
        yield {
          chunk: {
            event: chunk_to_save.event,
            kwargs: {
              iteration: chunk_to_save,
            },
          },
          iteration_number: iteration_number,
          langraphh_step: chunk_to_save.metadata.langgraph_step,
          final: true,
        };
        return;
      } catch (graphExecError: any) {
        logger.error(
          `Error during autonomous graph execution: ${graphExecError}`
        );
        if (this.isTokenRelatedError(graphExecError)) {
          responseContent =
            'Error: Token limit likely exceeded during autonomous execution.';
        }
        logger.error(
          `SnakAgent (autonomous): Catastrophic error, using fallback: ${graphExecError}`
        );
      }

      return new AIMessage({
        content: responseContent,
        additional_kwargs: {
          from: 'snak',
          final: true,
          agent_mode: this.currentMode,
          iterations: iterationCount,
        },
      });
    } catch (error: any) {
      logger.error(`SnakAgent autonomous execution failed: ${error}`);

      if (!fallbackAttempted) {
        logger.error(
          `SnakAgent (autonomous): Catastrophic error, using fallback: ${error}`
        );
      }

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
        logger.debug(`Restoring original agent mode: ${originalMode}`);
        this.currentMode = originalMode;
      }
    }
  }
}
