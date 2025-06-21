import { BaseAgent, AgentType, IModelAgent } from './baseAgent.js';
import { RpcProvider } from 'starknet';
import { ModelSelector } from '../operators/modelSelector.js';
import { logger, metrics, AgentConfig } from '@snakagent/core';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { BaseMessage, HumanMessage, AIMessage } from '@langchain/core/messages';
import { DatabaseCredentials } from '../../tools/types/database.js';
import { AgentMode, AGENT_MODES } from '../../config/agentConfig.js';
import { MemoryConfig } from '../operators/memoryAgent.js';
import { CustomHuggingFaceEmbeddings } from '../../memory/customEmbedding.js';
import { iterations } from '@snakagent/database/queries';
import { createInteractiveAgent } from '../modes/interactive.js';
import { createAutonomousAgent } from '../modes/autonomous.js';
import { createHybridAgent } from '../modes/hybrid.js';
import { Command } from '@langchain/langgraph';

/**
 * Configuration interface for SnakAgent initialization
 */
export interface SnakAgentConfig {
  provider: RpcProvider;
  accountPublicKey: string;
  accountPrivateKey: string;
  db_credentials: DatabaseCredentials;
  agentConfig: AgentConfig;
  memory?: MemoryConfig;
  modelSelector?: ModelSelector;
}

/**
 * Main agent for interacting with the Starknet blockchain
 * Supports multiple execution modes: interactive, autonomous, and hybrid
 */
export class SnakAgent extends BaseAgent implements IModelAgent {
  private readonly provider: RpcProvider;
  private readonly accountPrivateKey: string;
  private readonly accountPublicKey: string;
  private readonly signature: string;
  private readonly agentMode: string;
  private readonly agentConfig: AgentConfig;
  private readonly db_credentials: DatabaseCredentials;
  private memory: MemoryConfig;
  private currentMode: string;
  private agentReactExecutor: any;
  private modelSelector: ModelSelector | null = null;
  private iterationEmbeddings: CustomHuggingFaceEmbeddings;
  private pendingIteration?: {
    question: string;
    embedding: number[];
  };
  constructor(config: SnakAgentConfig) {
    super('snak', AgentType.SNAK);

    this.provider = config.provider;
    this.accountPrivateKey = config.accountPrivateKey;
    this.accountPublicKey = config.accountPublicKey;
    this.agentMode =
      AGENT_MODES[config.agentConfig?.mode || AgentMode.INTERACTIVE];
    this.db_credentials = config.db_credentials;
    this.currentMode =
      AGENT_MODES[config.agentConfig?.mode || AgentMode.INTERACTIVE];
    this.agentConfig = config.agentConfig;
    this.memory = config.memory || {};
    this.modelSelector = config.modelSelector || null;
    this.iterationEmbeddings = new CustomHuggingFaceEmbeddings({
      model:
        this.agentConfig?.memory?.embeddingModel || 'Xenova/all-MiniLM-L6-v2',
      dtype: 'fp32',
    });

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

      if (
        this.agentConfig?.mode === AgentMode.HYBRID ||
        (this.agentMode === AGENT_MODES[AgentMode.AUTONOMOUS] &&
          this.agentConfig?.mode === AgentMode.AUTONOMOUS)
      ) {
        this.currentMode = AGENT_MODES[AgentMode.HYBRID];
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
          break;
        case AGENT_MODES[AgentMode.INTERACTIVE]:
          this.agentReactExecutor = await createInteractiveAgent(
            this,
            this.modelSelector
          );
          break;
        case AGENT_MODES[AgentMode.HYBRID]:
          this.agentReactExecutor = await createHybridAgent(
            this,
            this.modelSelector
          );
          break;
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
   * Get appropriate model for a task based on messages
   * @param messages - Array of messages to analyze
   * @param forceModelType - Optional model type to force
   * @returns Promise resolving to the selected chat model
   * @throws {Error} If ModelSelector is not available
   */
  public async getModelForTask(
    messages: BaseMessage[],
    forceModelType?: string
  ): Promise<BaseChatModel> {
    if (!this.modelSelector) {
      throw new Error('ModelSelector not available');
    }
    return this.modelSelector.getModelForTask(messages, forceModelType);
  }

  /**
   * Invoke model with appropriate selection logic
   * @param messages - Array of messages to process
   * @param forceModelType - Optional model type to force
   * @returns Promise resolving to the model response
   * @throws {Error} If ModelSelector is not available
   */
  public async invokeModel(
    messages: BaseMessage[],
    forceModelType?: string
  ): Promise<any> {
    if (!this.modelSelector) {
      throw new Error('ModelSelector not available');
    }
    return this.modelSelector.invokeModel(messages, forceModelType);
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

  /**
   * Validates the user request before execution
   * @param request - The user's request string
   * @returns Promise resolving to true if the request is valid, false otherwise
   */
  public async validateRequest(request: string): Promise<boolean> {
    return !(!request || request.trim() === '');
  }

  /**
   * Execute the agent with the given input
   * @param input - The input message or string
   * @param config - Optional configuration for execution
   * @returns Promise resolving to the agent response
   */
  public async execute(
    input: BaseMessage[] | any,
    config?: Record<string, any>
  ): Promise<unknown> {
    logger.debug(`SnakAgent executing with mode: ${this.currentMode}`);

    if (!this.agentReactExecutor) {
      logger.warn(
        'SnakAgent: Agent executor not available. Attempting to recreate.'
      );
      try {
        await this.createAgentReactExecutor();
        if (!this.agentReactExecutor) {
          logger.error(
            'SnakAgent: Failed to recreate agent executor. Cannot proceed.'
          );
          const fallbackInput =
            Array.isArray(input) && input.length > 0
              ? input[input.length - 1]
              : input;
          return this.executeSimpleFallback(
            fallbackInput as string | BaseMessage
          );
        }
      } catch (recreateError) {
        logger.error(
          `SnakAgent: Critical error recreating agent executor: ${recreateError}`
        );
        const fallbackInput =
          Array.isArray(input) && input.length > 0
            ? input[input.length - 1]
            : input;
        return this.executeSimpleFallback(
          fallbackInput as string | BaseMessage
        );
      }
    }

    let messagesForGraph: BaseMessage[];

    if (
      Array.isArray(input) &&
      input.every((msg) => msg instanceof BaseMessage)
    ) {
      messagesForGraph = input;
      if (messagesForGraph.length === 0) {
        logger.warn(
          'SnakAgent: Received empty message array for execution. Initializing with a placeholder.'
        );
        messagesForGraph = [new HumanMessage('Starting interaction...')];
      }
    } else {
      logger.warn(
        `SnakAgent: Unexpected input type for 'messages'. Expected BaseMessage[], received ${typeof input}. Attempting to convert.`
      );

      if (input instanceof BaseMessage) {
        messagesForGraph = [input];
      } else if (typeof input === 'string') {
        messagesForGraph = [new HumanMessage(input)];
      } else if (
        typeof input === 'object' &&
        input &&
        'content' in input &&
        typeof input.content === 'string'
      ) {
        messagesForGraph = [new HumanMessage(input.content)];
      } else {
        logger.error(
          'SnakAgent: Could not convert input to BaseMessage[]. Using simple fallback.'
        );
        let fallbackContent = 'Unprocessable input for agent execution';

        try {
          if (typeof input === 'string') fallbackContent = input;
          else if (
            input instanceof BaseMessage &&
            typeof input.content === 'string'
          )
            fallbackContent = input.content;
          else if (
            input &&
            typeof input.toString === 'function' &&
            input.toString() !== '[object Object]'
          )
            fallbackContent = input.toString();
          else if (input && input.content && typeof input.content === 'string')
            fallbackContent = input.content;
        } catch {}

        return this.executeSimpleFallback(new HumanMessage(fallbackContent));
      }
    }

    const originalUserQuery = config?.originalUserQuery;
    let currentMessages = messagesForGraph;

    if (
      originalUserQuery &&
      currentMessages.length > 0 &&
      currentMessages[0].additional_kwargs?.from === 'model-selector'
    ) {
      logger.debug(
        `SnakAgent: Using original user query "${originalUserQuery}" instead of model-selector message.`
      );
      currentMessages = [new HumanMessage(originalUserQuery)];
    }

    const lastHuman = [...currentMessages]
      .reverse()
      .find((m): m is HumanMessage => m instanceof HumanMessage);
    if (lastHuman && typeof lastHuman.content === 'string') {
      await this.captureQuestion(lastHuman.content);
    }

    const graphState = {
      messages: currentMessages,
    };

    const runnableConfig: Record<string, any> = {};
    const threadId = config?.threadId || config?.metadata?.threadId;

    if (threadId) {
      runnableConfig.configurable = { thread_id: threadId };
    }

    if (config?.recursionLimit) {
      runnableConfig.recursionLimit = config.recursionLimit;
    }

    if (config?.originalUserQuery) {
      if (!runnableConfig.configurable) runnableConfig.configurable = {};
      runnableConfig.configurable.originalUserQuery = config.originalUserQuery;
    }

    logger.debug(
      `SnakAgent: Invoking agent executor with ${currentMessages.length} messages. Thread ID: ${threadId || 'N/A'}`
    );

    try {
      let responseContent: string | any;

      if (config?.enableStreaming) {
        try {
          const app = this.agentReactExecutor;
          const stream = await app.stream(graphState, runnableConfig);
          const chunks = [];
          for await (const chunk of stream) {
            chunks.push(chunk);
            logger.debug(`Stream chunk: ${chunk.content}|`);
          }
        } catch (streamError) {
          logger.error(`Streaming error: ${streamError}`);
        }
      }

      const app = this.agentReactExecutor;
      const result = await app.invoke(graphState, runnableConfig);

      if (result?.messages?.length > 0) {
        for (let i = result.messages.length - 1; i >= 0; i--) {
          const msg = result.messages[i];
          if (msg instanceof AIMessage && msg.content) {
            if (typeof msg.content === 'string' && msg.content.trim() !== '') {
              responseContent = msg.content;
              break;
            } else if (Array.isArray(msg.content) && msg.content.length > 0) {
              responseContent = msg.content;
              break;
            }
          }
        }
      }

      if (!responseContent) {
        const lastMsg = result.messages[result.messages.length - 1];
        responseContent =
          lastMsg?.content ||
          "I couldn't generate a specific response for this request.";
      }

      const aiMsg = new AIMessage({
        content: responseContent,
        additional_kwargs: {
          from: 'snak',
          final: true,
          agent_mode: this.currentMode,
        },
      });
      if (typeof responseContent === 'string') {
        await this.saveIteration(responseContent);
      } else {
        await this.saveIteration(JSON.stringify(responseContent));
      }

      return aiMsg;
    } catch (agentExecError: any) {
      logger.error(`SnakAgent: Agent execution failed: ${agentExecError}`);
      if (this.isTokenRelatedError(agentExecError)) {
        logger.warn('Token related error detected during execution.');
      }
      logger.error(
        `SnakAgent: Catastrophic error in execute, using fallback: ${agentExecError}`
      );
      return this.executeSimpleFallback(input as string | BaseMessage);
    }
  }

  /**
   * Simple fallback execution mode when main executor fails
   * @private
   * @param input - The original input received by the execute method
   * @returns AIMessage indicating fallback mode
   */
  private async executeSimpleFallback(
    input: string | BaseMessage
  ): Promise<AIMessage> {
    logger.warn('SnakAgent: Executing in simple fallback mode.');

    let queryContent = 'Unavailable';
    try {
      if (typeof input === 'string') {
        queryContent = input;
      } else if (
        input instanceof BaseMessage &&
        typeof input.content === 'string'
      ) {
        queryContent = input.content;
      } else if (input && typeof input.toString === 'function') {
        queryContent = input.toString();
      }
    } catch (e) {
      logger.error(`Error extracting content in fallback mode: ${e}`);
    }

    const truncatedQuery =
      queryContent.substring(0, 100) + (queryContent.length > 100 ? '...' : '');
    const responseMessage = `I cannot process your request completely as I am in fallback mode. Your query was: "${truncatedQuery}"`;

    const aiMsg = new AIMessage({
      content: responseMessage,
      additional_kwargs: {
        from: 'snak',
        final: true,
        error: 'fallback_mode_activated',
      },
    });
    await this.saveIteration(responseMessage);
    return aiMsg;
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
   * Capture the latest user question for pairing with the next assistant answer
   * @param content - User question content
   */
  private async captureQuestion(content: string) {
    try {
      const limit = this.memory.shortTermMemorySize ?? 15;
      if (
        limit <= 0 ||
        this.currentMode !== AGENT_MODES[AgentMode.INTERACTIVE]
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
      const limit = this.memory.shortTermMemorySize ?? 15;
      if (
        limit <= 0 ||
        this.currentMode !== AGENT_MODES[AgentMode.INTERACTIVE] ||
        !this.pendingIteration
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
   * Executes a call data request in agent mode, typically for signature requests
   * Requires the agent to be in interactive mode
   * @param input - The input string for the call data execution
   * @returns Promise resolving to the parsed JSON response or an error object
   */
  public async execute_call_data(input: string): Promise<unknown> {
    try {
      if (this.currentMode !== AGENT_MODES[AgentMode.INTERACTIVE]) {
        throw new Error(
          `Must be in interactive mode to execute call_data (current mode: ${this.currentMode}).`
        );
      }

      if (!this.agentReactExecutor) {
        throw new Error('Agent executor is not initialized.');
      }

      const invokeOptions: any = {};

      if (this.memory.enabled !== false) {
        const maxIterations =
          this.agentConfig?.maxIterations ??
          this.memory.maxIterations ??
          this.memory.shortTermMemorySize ??
          15;
        if (maxIterations !== 0) {
          invokeOptions.maxIterations = maxIterations;
          invokeOptions.messageHandler = (messages: BaseMessage[]) => {
            if (messages.length > maxIterations) {
              logger.debug(
                `Call data - message pruning: ${messages.length} messages exceeds limit ${maxIterations}.`
              );
              const prunedMessages = [
                messages[0],
                ...messages.slice(-(maxIterations - 1)),
              ];
              logger.debug(
                `Call data - pruned from ${messages.length} to ${prunedMessages.length} messages.`
              );
              return prunedMessages;
            }
            return messages;
          };
          logger.debug(
            `execute_call_data: Configured with maxIterations=${maxIterations}.`
          );
        } else {
          logger.debug(`execute_call_data: Running without recursion limit.`);
        }
      }

      logger.debug('execute_call_data: Invoking agent with input message.');
      const app = this.agentReactExecutor;
      const result = await app.invoke(
        {
          messages: [new HumanMessage({ content: input })],
        },
        invokeOptions
      );
      logger.debug('execute_call_data: Agent invocation complete.');

      try {
        if (!result?.messages?.length) {
          throw new Error('No messages returned from call data execution.');
        }

        const lastAiMessage = result.messages
          .slice()
          .reverse()
          .find((m: BaseMessage) => m instanceof AIMessage);

        if (!lastAiMessage || typeof lastAiMessage.content !== 'string') {
          throw new Error(
            'Could not find valid AIMessage content in the result.'
          );
        }

        return JSON.parse(lastAiMessage.content);
      } catch (parseError) {
        const lastMessageContent =
          result?.messages?.[result.messages.length - 1]?.content;
        logger.error(
          `Failed to parse observation JSON: ${parseError}. Content was: ${lastMessageContent}`
        );
        return {
          status: 'failure',
          error: `Failed to parse observation: ${parseError instanceof Error ? parseError.message : String(parseError)}. Raw content: ${lastMessageContent}`,
        };
      }
    } catch (error) {
      logger.error(`execute_call_data error: ${error}`);
      return {
        status: 'failure',
        error: `Execution error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Executes the agent in autonomous mode
   * This mode allows the agent to operate continuously based on an initial goal or prompt
   * @returns Promise resolving to the result of the autonomous execution
   */
  public async execute_autonomous(): Promise<unknown> {
    let responseContent: string | any;
    let errorCount = 0;
    const maxErrors = 3;
    let fallbackAttempted = false;
    let originalMode = this.currentMode;
    let iterationCount = 0;

    try {
      logger.debug(
        `SnakAgent starting autonomous execution. Current mode: ${this.currentMode}`
      );

      if (this.currentMode !== AGENT_MODES[AgentMode.AUTONOMOUS]) {
        if (this.agentConfig?.mode === AgentMode.AUTONOMOUS) {
          logger.info(
            `Overriding current mode to '${AGENT_MODES[AgentMode.AUTONOMOUS]}' based on agent configuration for autonomous execution.`
          );
          this.currentMode = AGENT_MODES[AgentMode.AUTONOMOUS];
        } else {
          throw new Error(
            `Agent must be in autonomous mode or configured for autonomous execution. Current mode: ${this.currentMode}`
          );
        }
      }

      if (!this.agentReactExecutor) {
        logger.debug(
          'SnakAgent (autonomous): No executor exists, attempting to create one.'
        );
        try {
          await this.createAgentReactExecutor();
        } catch (initError) {
          logger.error(
            `SnakAgent (autonomous): Initial attempt to initialize executor failed: ${initError}`
          );
          errorCount++;

          if (errorCount >= maxErrors) {
            logger.warn(
              'SnakAgent (autonomous): Maximum initialization attempts reached, using fallback mode.'
            );
            fallbackAttempted = true;
            return this.executeSimpleFallback(
              'Autonomous execution initialization failed'
            );
          } else {
            return new AIMessage({
              content: `Cannot start autonomous execution: agent initialization failed. Error: ${initError}`,
              additional_kwargs: {
                from: 'snak',
                final: true,
                error: 'initialization_failed_autonomous',
              },
            });
          }
        }
      }

      while (!this.agentReactExecutor && errorCount < maxErrors) {
        errorCount++;
        logger.warn(
          `SnakAgent (autonomous): Attempt ${errorCount} to initialize executor, trying again...`
        );
        try {
          await this.createAgentReactExecutor();
        } catch (retryError) {
          logger.error(
            `SnakAgent (autonomous): Retry attempt ${errorCount} failed: ${retryError}`
          );
        }
        if (this.agentReactExecutor) {
          logger.debug(
            `SnakAgent (autonomous): Executor successfully created on attempt ${errorCount}.`
          );
          break;
        }
      }

      if (
        !this.agentReactExecutor &&
        errorCount >= maxErrors &&
        !fallbackAttempted
      ) {
        logger.warn(
          'SnakAgent (autonomous): Maximum initialization attempts after retries, using fallback mode.'
        );
        fallbackAttempted = true;
        return this.executeSimpleFallback(
          'Autonomous execution initialization failed after retries'
        );
      }

      if (!this.agentReactExecutor) {
        logger.error(
          'SnakAgent (autonomous): Failed to create a valid executor after multiple attempts.'
        );
        return new AIMessage({
          content:
            'Failed to initialize the autonomous execution agent after multiple attempts. Please try again or contact an administrator.',
          additional_kwargs: {
            from: 'snak',
            final: true,
            error: 'executor_creation_failed_retries_autonomous',
          },
        });
      }

      if (!this.agentReactExecutor?.app) {
        logger.error(
          'SnakAgent (autonomous): Executor created, but the app is missing.'
        );
        return new AIMessage({
          content:
            'Failed to initialize autonomous execution: agent structure is incomplete.',
          additional_kwargs: {
            from: 'snak',
            final: true,
            error: 'executor_app_missing_autonomous',
          },
        });
      }

      const app = this.agentReactExecutor.app;
      const agentJsonConfig = this.agentReactExecutor.json_config;
      const maxGraphIterations = this.agentReactExecutor.maxIterations;

      const initialHumanMessage = new HumanMessage({
        content:
          agentJsonConfig?.prompt?.initial_goal ||
          'Start executing the primary objective defined in your system prompt.',
      });
      let conversationHistory: BaseMessage[] = [initialHumanMessage];

      const threadConfig = {
        configurable: {
          thread_id: agentJsonConfig?.chatId || 'autonomous_session',
        },
      };

      logger.info(
        `Starting autonomous graph execution with max iterations: ${maxGraphIterations}.`
      );

      try {
        let finalState: any = null;

        finalState = await app.invoke(
          { messages: conversationHistory },
          { ...threadConfig, recursionLimit: maxGraphIterations }
        );

        logger.debug('Autonomous graph invocation complete.');
        iterationCount = finalState?.iterations || iterationCount;

        if (finalState?.messages?.length > 0) {
          const lastMsg = finalState.messages[finalState.messages.length - 1];
          if (
            lastMsg instanceof AIMessage &&
            lastMsg.additional_kwargs?.error
          ) {
            logger.error(
              `Autonomous Agent: Error detected in final graph state: ${lastMsg.additional_kwargs.error}`
            );
            responseContent =
              lastMsg.content ||
              `Execution stopped due to error: ${lastMsg.additional_kwargs.error}`;
            if (!lastMsg.additional_kwargs.final) {
              if (!lastMsg.additional_kwargs) lastMsg.additional_kwargs = {};
              lastMsg.additional_kwargs.final = true;
            }
          }
        }

        logger.info(
          `Autonomous session finished. Iteration count from graph: ${iterationCount}.`
        );

        if (!responseContent) {
          if (finalState?.messages?.length > 0) {
            const lastMessage =
              finalState.messages[finalState.messages.length - 1];
            if (lastMessage instanceof AIMessage) {
              responseContent = lastMessage.content;
              if (!lastMessage.additional_kwargs?.final) {
                if (!lastMessage.additional_kwargs)
                  lastMessage.additional_kwargs = {};
                lastMessage.additional_kwargs.final = true;
              }
            } else {
              logger.warn(
                `Autonomous execution ended with a non-AI message: ${lastMessage._getType()}`
              );
              responseContent =
                'Autonomous execution finished, but the final message was not from the AI.';
            }
          } else {
            responseContent =
              'Autonomous execution completed, but no final state or messages were found.';
          }
        }
      } catch (graphExecError: any) {
        logger.error(
          `Error during autonomous graph execution: ${graphExecError}`
        );
        if (this.isTokenRelatedError(graphExecError)) {
          responseContent =
            'Error: Token limit likely exceeded during autonomous execution.';
        } else {
          responseContent = `Error during autonomous execution: ${graphExecError.message}`;
        }
        logger.error(
          `SnakAgent (autonomous): Catastrophic error, using fallback: ${graphExecError}`
        );
        return this.executeSimpleFallback(
          'Autonomous execution failed during graph processing'
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
        return this.executeSimpleFallback('Autonomous execution failed');
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

  /**
   * Executes the agent in hybrid mode
   * Hybrid mode typically involves an initial autonomous phase followed by interactive steps
   * @param initialInput - The initial input string to start the hybrid execution
   * @returns Promise resolving to an object containing the execution state and thread ID
   */
  public async execute_hybrid(initialInput: string): Promise<unknown> {
    let errorCount = 0;
    const maxErrors = 3;
    let fallbackAttempted = false;
    let originalMode = this.currentMode;
    const threadId = `hybrid_${Date.now()}`;

    try {
      logger.debug('SnakAgent: Starting hybrid mode execution.');

      this.currentMode = AGENT_MODES[AgentMode.HYBRID];

      if (
        !this.agentReactExecutor ||
        this.agentConfig?.mode !== AgentMode.HYBRID
      ) {
        logger.debug(
          'SnakAgent: Creating or re-creating hybrid agent executor.'
        );
        try {
          const agentConfig = this.getAgentConfig();
          if (!agentConfig) {
            logger.warn(
              'SnakAgent (hybrid): Agent configuration is missing, which is required for hybrid mode.'
            );
            throw new Error('Agent configuration is required for hybrid mode.');
          }

          if (!agentConfig.name) {
            logger.warn(
              'SnakAgent (hybrid): Agent name is missing in configuration.'
            );
          }
          if (!(agentConfig as any).description) {
            logger.warn(
              'SnakAgent (hybrid): Agent description is missing in configuration.'
            );
          }
          if (
            !Array.isArray((agentConfig as any).objectives) ||
            (agentConfig as any).objectives.length === 0
          ) {
            logger.warn(
              'SnakAgent (hybrid): Agent objectives are missing or empty.'
            );
          }

          agentConfig.plugins = agentConfig.plugins || [];

          this.agentReactExecutor = await createHybridAgent(
            this,
            this.modelSelector
          );

          if (!this.agentReactExecutor) {
            throw new Error(
              'Failed to create hybrid agent executor: creation returned null or undefined.'
            );
          }
        } catch (initError) {
          logger.error(`Failed to initialize hybrid executor: ${initError}`);
          errorCount++;

          if (errorCount >= maxErrors) {
            logger.warn(
              'SnakAgent (hybrid): Maximum initialization attempts reached, using fallback mode.'
            );
            fallbackAttempted = true;
            return this.executeSimpleFallback(
              'Hybrid execution initialization failed'
            );
          } else {
            throw initError;
          }
        }
      }

      if (!this.agentReactExecutor?.app) {
        logger.error(
          'SnakAgent (hybrid): Executor created, but app is missing.'
        );
        return new AIMessage({
          content:
            'Failed to initialize hybrid execution: agent structure is incomplete.',
          additional_kwargs: {
            from: 'snak',
            final: true,
            error: 'executor_app_missing_hybrid',
          },
        });
      }

      const app = this.agentReactExecutor.app;
      const threadConfig = {
        configurable: {
          thread_id: threadId,
        },
        recursionLimit: this.agentReactExecutor.maxIterations,
      };

      const initialHumanMessage = new HumanMessage({
        content: initialInput || 'Start executing the primary objective.',
      });

      logger.info(`Starting hybrid execution with thread ID: ${threadId}.`);
      let state = await app.invoke(
        { messages: [initialHumanMessage] },
        threadConfig
      );

      logger.debug('Initial hybrid invocation complete.');

      return {
        state,
        threadId,
      };
    } catch (error: any) {
      logger.error(`SnakAgent hybrid execution failed: ${error}`);

      const errorMsg = error.message || String(error);
      if (
        errorMsg.includes('trailing whitespace') ||
        errorMsg.includes('invalid_request_error')
      ) {
        logger.warn(
          'SnakAgent (hybrid): Detected API format error (e.g., trailing whitespace).'
        );
        return new AIMessage({
          content:
            'An error occurred with the AI communication (possible formatting issue). Please try rephrasing your request.',
          additional_kwargs: {
            from: 'snak',
            final: true,
            error: 'api_format_error',
          },
        });
      }

      if (!fallbackAttempted) {
        logger.error(
          `SnakAgent (hybrid): Catastrophic error, using fallback: ${error}`
        );
        return this.executeSimpleFallback('Hybrid execution failed');
      }

      return new AIMessage({
        content: `Hybrid execution error: ${error.message}`,
        additional_kwargs: {
          from: 'snak',
          final: true,
          error: 'hybrid_execution_error',
        },
      });
    } finally {
      if (this.currentMode !== originalMode) {
        logger.debug(`Restoring original agent mode: ${originalMode}`);
        this.currentMode = originalMode;
      }
    }
  }

  /**
   * Resumes a paused hybrid execution with new human input
   * @param input - The human input to provide to the paused execution
   * @param threadId - The thread ID of the hybrid execution to resume
   * @returns Promise resolving to an object containing the updated execution state and thread ID
   * @throws {Error} If the hybrid agent is not initialized or if an error occurs during resumption
   */
  public async resume_hybrid(
    input: string,
    threadId: string
  ): Promise<unknown> {
    try {
      logger.debug(`Resuming hybrid execution with thread ID: ${threadId}.`);

      if (!this.agentReactExecutor?.app) {
        throw new Error('Hybrid agent application is not initialized.');
      }

      const app = this.agentReactExecutor.app;
      const threadConfig = {
        configurable: {
          thread_id: threadId,
        },
        recursionLimit: this.agentReactExecutor.maxIterations,
      };

      const state = await app.invoke(
        new Command({ resume: input }),
        threadConfig
      );

      logger.debug('Hybrid execution resumed successfully.');
      return {
        state,
        threadId,
      };
    } catch (error) {
      logger.error(`Error resuming hybrid execution: ${error}`);
      throw error;
    }
  }
}
