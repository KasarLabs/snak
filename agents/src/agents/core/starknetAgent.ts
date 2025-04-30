// agents/main/starknetAgent.ts
import { BaseAgent, AgentType, IModelAgent } from '../core/baseAgent.js';
import { RpcProvider } from 'starknet';
import { ModelSelectionAgent } from '../operators/modelSelectionAgent.js';
import { logger, metrics } from '@snakagent/core';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import {
  BaseMessage,
  HumanMessage,
  AIMessage,
  SystemMessage,
} from '@langchain/core/messages';
import { createBox } from '../../prompt/formatting.js';
import { addTokenInfoToBox } from '../../token/tokenTracking.js';
import { DatabaseCredentials } from '../../tools/types/database.js';
import { JsonConfig } from '../../config/jsonConfig.js';

/**
 * Memory configuration for the agent
 */
export interface MemoryConfig {
  enabled?: boolean;
  shortTermMemorySize?: number;
  recursionLimit?: number;
}

/**
 * Configuration for StarknetAgent
 */
export interface StarknetAgentConfig {
  provider: RpcProvider;
  accountPublicKey: string;
  accountPrivateKey: string;
  signature: string;
  agentMode: string;
  db_credentials: DatabaseCredentials;
  agentconfig?: JsonConfig;
  memory?: MemoryConfig;
  modelSelector?: ModelSelectionAgent;
}

/**
 * Logging options
 */
export interface LoggingOptions {
  langchainVerbose?: boolean;
  tokenLogging?: boolean;
  disabled?: boolean;
  modelSelectionDebug?: boolean;
}

/**
 * Main agent for interacting with the Starknet blockchain
 */
export class StarknetAgent extends BaseAgent implements IModelAgent {
  private readonly provider: RpcProvider;
  private readonly accountPrivateKey: string;
  private readonly accountPublicKey: string;
  private readonly signature: string;
  private readonly agentMode: string;
  private readonly agentconfig?: JsonConfig;
  private readonly db_credentials: DatabaseCredentials;
  private memory: MemoryConfig;
  private currentMode: string;
  private agentReactExecutor: any;
  private modelSelector: ModelSelectionAgent | null = null;
  private loggingOptions: LoggingOptions = {
    langchainVerbose: false,
    tokenLogging: true,
    disabled: false,
    modelSelectionDebug: false,
  };
  private originalLoggerFunctions: Record<string, any> = {};

  constructor(config: StarknetAgentConfig) {
    super('starknet', AgentType.MAIN);

    // Logging configuration
    const disableLogging = process.env.DISABLE_LOGGING === 'true';
    const enableDebugLogging =
      process.env.DEBUG_LOGGING === 'true' ||
      process.env.LOG_LEVEL === 'debug' ||
      process.env.NODE_ENV === 'development';

    if (disableLogging) {
      this.disableLogging();
    } else if (enableDebugLogging) {
      this.loggingOptions.disabled = false;
      this.loggingOptions.modelSelectionDebug = true;
    } else {
      this.disableLogging();
    }

    // Initialize properties
    this.provider = config.provider;
    this.accountPrivateKey = config.accountPrivateKey;
    this.accountPublicKey = config.accountPublicKey;
    this.signature = config.signature;
    this.agentMode = config.agentMode;
    this.db_credentials = config.db_credentials;
    this.currentMode =
      config.agentMode === 'auto' ||
      config.agentconfig?.mode?.autonomous === true
        ? 'auto'
        : config.agentMode || 'agent';
    this.agentconfig = config.agentconfig;
    this.memory = config.memory || {};
    this.modelSelector = config.modelSelector || null;

    // Check for required configurations
    if (!config.accountPrivateKey) {
      throw new Error('STARKNET_PRIVATE_KEY is required');
    }

    metrics.metricsAgentConnect(
      config.agentconfig?.name ?? 'agent',
      config.agentMode
    );
  }

  /**
   * Initialize the Starknet agent
   */
  public async init(): Promise<void> {
    try {
      logger.debug('Initializing StarknetAgent...');

      if (!this.modelSelector) {
        logger.warn(
          'StarknetAgent: No ModelSelectionAgent provided, functionality will be limited'
        );
      }

      try {
        logger.debug(
          'StarknetAgent: Testing agent executor creation during init...'
        );
        await this.createAgentReactExecutor();

        if (!this.agentReactExecutor) {
          logger.warn(
            'StarknetAgent: Agent executor creation succeeded but returned null/undefined'
          );
        }
      } catch (executorError) {
        logger.error(
          `StarknetAgent: Failed to create agent executor during init: ${executorError}`
        );
        logger.warn(
          'StarknetAgent: Will attempt to recover during execute() calls'
        );
      }

      logger.debug('StarknetAgent initialized successfully.');
    } catch (error) {
      logger.error(`StarknetAgent initialization failed: ${error}`);
      throw error;
    }
  }

  /**
   * Disable logging by replacing logger methods with no-ops
   */
  private disableLogging(): void {
    if (!this.originalLoggerFunctions.info) {
      this.originalLoggerFunctions = {
        info: logger.info,
        debug: logger.debug,
        warn: logger.warn,
        error: logger.error,
      };
    }

    const noop = (message: any, ...meta: any[]): any => logger;
    logger.info = noop;
    logger.debug = noop;
    logger.warn = noop;
    logger.error = noop;

    this.loggingOptions.disabled = true;
    console.log('Logging has been disabled');
  }

  /**
   * Restore original logging functions
   */
  public enableLogging(): void {
    if (!this.originalLoggerFunctions.info) {
      console.log('No original logger functions to restore');
      return;
    }

    logger.info = this.originalLoggerFunctions.info;
    logger.debug = this.originalLoggerFunctions.debug;
    logger.warn = this.originalLoggerFunctions.warn;
    logger.error = this.originalLoggerFunctions.error;

    this.loggingOptions.disabled = false;
    console.log('Logging has been enabled');
  }

  /**
   * Set logging options for the agent
   */
  public setLoggingOptions(options: LoggingOptions): void {
    this.loggingOptions = { ...this.loggingOptions, ...options };

    if (options.disabled === true && !this.loggingOptions.disabled) {
      this.disableLogging();
      return;
    } else if (options.disabled === false && this.loggingOptions.disabled) {
      this.enableLogging();
    }

    if (this.modelSelector && options.modelSelectionDebug !== undefined) {
      const useMetaSelection = this.agentconfig?.mode?.metaSelection === true;
      logger.debug(
        `Updated ModelSelectionAgent: debug mode=${this.loggingOptions.modelSelectionDebug}, meta selection=${useMetaSelection}`
      );
    }

    if (!this.loggingOptions.disabled && this.agentReactExecutor) {
      this.applyLoggerVerbosityToExecutor();
    }
  }

  /**
   * Create agent executor based on current mode
   */
  private async createAgentReactExecutor(): Promise<void> {
    try {
      logger.debug(
        'StarknetAgent: Starting createAgentReactExecutor with mode=' +
          this.currentMode
      );

      let createAgentFunc, createAutonomousAgentFunc;

      try {
        const interactiveModule = await import('../modes/interactive.js');
        createAgentFunc = interactiveModule.createAgent;
      } catch (importError) {
        logger.error(
          `StarknetAgent: Failed to import interactive module: ${importError}`
        );
        throw new Error(`Failed to import interactive module: ${importError}`);
      }

      try {
        const autonomousModule = await import('../modes/autonomous.js');
        createAutonomousAgentFunc = autonomousModule.createAutonomousAgent;
      } catch (importError) {
        logger.error(
          `StarknetAgent: Failed to import autonomous module: ${importError}`
        );
        throw new Error(`Failed to import autonomous module: ${importError}`);
      }

      const tempAiConfig = {
        langchainVerbose: this.loggingOptions.langchainVerbose,
        aiProvider: 'anthropic',
        aiModel: 'claude-3-5-sonnet-latest',
        aiProviderApiKey: process.env.ANTHROPIC_API_KEY,
      };

      logger.debug(`StarknetAgent: Using current mode: ${this.currentMode}`);

      if (this.currentMode === 'auto') {
        logger.debug('StarknetAgent: Creating autonomous agent executor...');
        if (!createAutonomousAgentFunc) {
          throw new Error(
            'Autonomous agent creation function is not available'
          );
        }
        this.agentReactExecutor = await createAutonomousAgentFunc(
          this,
          tempAiConfig,
          this.modelSelector
        );
      } else if (
        this.currentMode === 'interactive' ||
        this.currentMode === 'agent'
      ) {
        logger.debug('StarknetAgent: Creating interactive agent executor...');
        if (!createAgentFunc) {
          throw new Error(
            'Interactive agent creation function is not available'
          );
        }
        this.agentReactExecutor = await createAgentFunc(
          this,
          tempAiConfig,
          this.modelSelector
        );
      } else {
        throw new Error(`Invalid mode: ${this.currentMode}`);
      }

      if (!this.agentReactExecutor) {
        throw new Error(
          `Failed to create agent executor for mode ${this.currentMode}: result is null/undefined`
        );
      }

      this.applyLoggerVerbosityToExecutor();
    } catch (error) {
      logger.error(
        `StarknetAgent: Failed to create Agent React Executor: ${error}`
      );
      if (error instanceof Error && error.stack) {
        logger.error(`Stack trace: ${error.stack}`);
      }
      throw error;
    }
  }

  /**
   * Apply logger verbosity settings to the agent executor
   */
  private applyLoggerVerbosityToExecutor(): void {
    if (!this.agentReactExecutor) return;

    if (this.agentReactExecutor.agent?.llm) {
      this.agentReactExecutor.agent.llm.verbose =
        this.loggingOptions.langchainVerbose === true;
    }

    if (this.agentReactExecutor.graph?._nodes?.agent?.data?.model) {
      this.agentReactExecutor.graph._nodes.agent.data.model.verbose =
        this.loggingOptions.langchainVerbose === true;
    }
  }

  /**
   * Get appropriate model for a task based on messages
   */
  public async getModelForTask(
    messages: BaseMessage[],
    forceModelType?: string
  ): Promise<BaseChatModel> {
    if (!this.modelSelector) {
      throw new Error('ModelSelectionAgent not available');
    }

    return this.modelSelector.getModelForTask(messages, forceModelType);
  }

  /**
   * Invoke model with appropriate selection logic
   */
  public async invokeModel(
    messages: BaseMessage[],
    forceModelType?: string
  ): Promise<any> {
    if (!this.modelSelector) {
      throw new Error('ModelSelectionAgent not available');
    }

    return this.modelSelector.invokeModel(messages, forceModelType);
  }

  /**
   * Get Starknet account credentials
   */
  public getAccountCredentials() {
    return {
      accountPrivateKey: this.accountPrivateKey,
      accountPublicKey: this.accountPublicKey,
    };
  }

  /**
   * Get database credentials
   */
  public getDatabaseCredentials() {
    return this.db_credentials;
  }

  /**
   * Get agent signature
   */
  public getSignature() {
    return {
      signature: this.signature,
    };
  }

  /**
   * Get current agent mode
   */
  public getAgent() {
    return {
      agentMode: this.currentMode,
    };
  }

  /**
   * Get agent configuration
   */
  public getAgentConfig(): JsonConfig | undefined {
    return this.agentconfig;
  }

  /**
   * Get original agent mode from initialization
   */
  public getAgentMode(): string {
    return this.agentMode;
  }

  /**
   * Get Starknet RPC provider
   */
  public getProvider(): RpcProvider {
    return this.provider;
  }

  /**
   * Execute the agent with the given input
   * @param input The input message or string
   * @param config Optional configuration for execution, can include `agentMode` to temporarily change mode
   * @returns The agent response
   */
  public async execute(
    input: string | BaseMessage | any,
    config?: Record<string, any>
  ): Promise<unknown> {
    let responseContent: string | any;
    let errorCount = 0;
    const maxErrors = 3;
    let fallbackAttempted = false;
    let originalMode = this.currentMode;

    try {
      logger.debug(`StarknetAgent executing with mode: ${this.currentMode}`);

      // Extract model type from config if available
      const modelType = config?.modelType || null;
      logger.debug(
        `StarknetAgent: Using model type from config: ${modelType || 'not specified'}`
      );

      // Retrieve the original user query if it exists in config metadata
      let originalUserQuery = null;
      if (config && config.originalUserQuery) {
        originalUserQuery = config.originalUserQuery;
        logger.debug(
          `StarknetAgent: Retrieved original user query from config: "${originalUserQuery}"`
        );
      }

      // Also extract from the input if it's a message from ModelSelectionAgent
      if (
        input instanceof BaseMessage &&
        input.additional_kwargs?.from === 'model-selector' &&
        input.additional_kwargs?.originalUserQuery
      ) {
        originalUserQuery = input.additional_kwargs.originalUserQuery;
        logger.debug(
          `StarknetAgent: Retrieved original user query from model-selector: "${originalUserQuery}"`
        );
      }

      // Check if we need to temporarily adjust mode for this execution
      const requestedMode = config?.agentMode;

      // Temporarily change mode if needed for this execution
      if (requestedMode && requestedMode !== this.currentMode) {
        logger.debug(
          `Temporarily switching mode from ${this.currentMode} to ${requestedMode} for this execution`
        );
        this.currentMode = requestedMode;
      }

      // Ensure executor is created for current mode
      if (!this.agentReactExecutor) {
        logger.debug(
          'StarknetAgent: No executor exists, attempting to create one...'
        );
        try {
          await this.createAgentReactExecutor();
        } catch (initError) {
          logger.error(
            `StarknetAgent: Initial attempt to initialize executor failed: ${initError}`
          );
          errorCount++;
          // Return formatted error message on initial failure
          const errorMessage = new AIMessage({
            content: `I cannot process your request at this time because the agent failed to initialize properly. Error: ${initError}`,
            additional_kwargs: {
              from: 'starknet',
              final: true,
              error: 'initialization_failed',
            },
          });

          // Check if we should retry or fallback
          if (errorCount >= maxErrors) {
            logger.warn(
              'StarknetAgent: Maximum initialization attempts reached, using fallback mode'
            );
            fallbackAttempted = true;
            return this.executeSimpleFallback(input);
          } else {
            // If not max errors, return the init error message but allow retry on next call
            return errorMessage;
          }
        }
      }

      // Retry logic within execute if executor is still null after initial attempt or becomes null later
      while (!this.agentReactExecutor && errorCount < maxErrors) {
        errorCount++;
        logger.warn(
          `StarknetAgent: Attempt ${errorCount} to initialize executor failed, trying again...`
        );
        try {
          await this.createAgentReactExecutor();
        } catch (retryError) {
          logger.error(
            `StarknetAgent: Retry attempt ${errorCount} failed: ${retryError}`
          );
        }
        if (this.agentReactExecutor) {
          logger.debug(
            `StarknetAgent: Executor successfully created on attempt ${errorCount}`
          );
          break; // Exit loop if successful
        }
      }

      // If still no executor after retries, use fallback
      if (
        !this.agentReactExecutor &&
        errorCount >= maxErrors &&
        !fallbackAttempted
      ) {
        logger.warn(
          'StarknetAgent: Maximum initialization attempts reached after retries, using fallback mode'
        );
        fallbackAttempted = true;
        return this.executeSimpleFallback(input);
      }

      // Ensure we have a valid executor now before proceeding
      if (!this.agentReactExecutor) {
        logger.error(
          'StarknetAgent: Failed to create a valid executor after attempts'
        );
        return new AIMessage({
          content:
            'Failed to initialize execution agent after multiple attempts. Please try again or contact an administrator.',
          additional_kwargs: {
            from: 'starknet',
            final: true,
            error: 'executor_creation_failed_retries',
          },
        });
      }

      // Check if we need to recreate the executor for a different mode
      else if (originalMode !== this.currentMode) {
        logger.debug(`Re-creating executor for mode: ${this.currentMode}`);
        try {
          await this.createAgentReactExecutor();
          if (!this.agentReactExecutor) {
            throw new Error(
              `Failed to initialize Agent React Executor for mode: ${this.currentMode}`
            );
          }
          logger.debug(
            `Executor successfully re-created for mode: ${this.currentMode}`
          );
        } catch (modeChangeError) {
          logger.error(
            `StarknetAgent: Failed to recreate executor for mode ${this.currentMode}: ${modeChangeError}`
          );

          // Restore original mode on failure
          this.currentMode = originalMode;

          return new AIMessage({
            content: `Unable to change agent mode to "${requestedMode}". Error: ${modeChangeError}`,
            additional_kwargs: {
              from: 'starknet',
              final: true,
              error: 'mode_change_failed',
            },
          });
        }
      }

      // ----- Main execution logic starts here -----
      // Ensure input is a BaseMessage for LangChain compatibility
      let currentMessages: BaseMessage[];
      if (input instanceof BaseMessage) {
        currentMessages = [input];
      } else if (typeof input === 'string') {
        currentMessages = [new HumanMessage({ content: input })];
      } else {
        logger.error(`StarknetAgent: Unsupported input type: ${typeof input}`);
        return new AIMessage({
          content: 'Unsupported input type.',
          additional_kwargs: {
            from: 'starknet',
            final: true,
            error: 'unsupported_input_type',
          },
        });
      }

      logger.debug(
        `StarknetAgent: Invoking agent executor with input: ${JSON.stringify(currentMessages)}`
      );

      // If we have an original query, use it as the main input
      if (
        originalUserQuery &&
        currentMessages.length > 0 &&
        currentMessages[0].additional_kwargs?.from === 'model-selector'
      ) {
        logger.debug(
          `StarknetAgent: Using original user query instead of model-selector message`
        );
        currentMessages = [new HumanMessage(originalUserQuery)];
      }

      let result: any;
      try {
        result = await this.agentReactExecutor.invoke(
          { messages: currentMessages },
          { configurable: { thread_id: 'default' } }
        );

        if (result && result.messages && result.messages.length > 0) {
          // Get the last non-empty AIMessage from the result
          for (let i = result.messages.length - 1; i >= 0; i--) {
            const msg = result.messages[i];
            if (msg instanceof AIMessage && msg.content) {
              if (
                typeof msg.content === 'string' &&
                msg.content.trim() !== ''
              ) {
                responseContent = msg.content;
                break;
              } else if (Array.isArray(msg.content) && msg.content.length > 0) {
                responseContent = msg.content;
                break;
              }
            }
          }

          // If we still don't have content, use the last message or a default
          if (!responseContent) {
            const lastMsg = result.messages[result.messages.length - 1];
            responseContent =
              lastMsg && lastMsg.content
                ? lastMsg.content
                : "I couldn't generate a specific response for this request.";
          }
        } else {
          // Default response if no valid messages found
          responseContent =
            'No response could be generated. Please try again with a different request.';
        }
      } catch (agentExecError: any) {
        logger.error(
          `StarknetAgent: Agent execution failed: ${agentExecError}`
        );
        // Check for specific error types if needed
        if (this.isTokenRelatedError(agentExecError)) {
          logger.warn('Token related error detected during execution.');
          responseContent = 'Error: Token validation or processing failed.';
        } else {
          responseContent = `Error during agent execution: ${agentExecError.message}`;
        }
        // Decide if we should fallback even on execution error
        logger.error(
          `StarknetAgent: Catastrophic error in execute, using fallback: ${agentExecError}`
        );
        return this.executeSimpleFallback(input); // Using fallback for execution errors too
      }

      // Format response if needed (e.g., removing backticks)
      const finalResponse = this.formatResponseForDisplay(responseContent);

      // Always return a properly formatted AIMessage with required metadata
      return new AIMessage({
        content: finalResponse,
        additional_kwargs: {
          from: 'starknet',
          final: true,
          agent_mode: this.currentMode,
        },
      });
    } catch (error: any) {
      logger.error(`StarknetAgent main execution failed: ${error}`);
      // In case of catastrophic error outside agent invocation, use fallback
      if (!fallbackAttempted) {
        logger.error(
          `StarknetAgent: Catastrophic error in execute, using fallback: ${error}`
        );
        // Ensure fallback returns directly
        return this.executeSimpleFallback(input);
      }
      // If fallback was attempted or error happened after fallback check, create error AIMessage
      return new AIMessage({
        content: `Error: ${error.message}`,
        additional_kwargs: {
          from: 'starknet',
          final: true,
          error: 'execution_error',
        },
      });
    } finally {
      // Restore original mode if temporarily changed
      if (config?.agentMode && this.currentMode !== originalMode) {
        logger.debug(`Restoring original agent mode: ${originalMode}`);
        this.currentMode = originalMode;
      }
    }
  }

  /**
   * Simple fallback execution mode when main executor fails
   * @param input The original input received by execute method
   * @returns A simple AIMessage indicating fallback mode
   */
  private async executeSimpleFallback(
    input: string | BaseMessage
  ): Promise<AIMessage> {
    logger.warn('StarknetAgent: Executing in simple fallback mode');

    // Safely extract query content
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
        queryContent = input.toString(); // Fallback to toString()
      }
    } catch (e) {
      logger.error(`Error extracting content in fallback mode: ${e}`);
    }

    // Simplified response
    const truncatedQuery =
      queryContent.substring(0, 100) + (queryContent.length > 100 ? '...' : '');
    const responseMessage = `I cannot process your request completely because I'm in fallback mode. Your query was: "${truncatedQuery}"`;

    return new AIMessage({
      content: responseMessage,
      additional_kwargs: {
        from: 'starknet',
        final: true,
        error: 'fallback_mode_activated',
      },
    });
  }

  /**
   * Format agent response for display
   */
  private formatResponseForDisplay(response: string | any): string | any {
    if (typeof response !== 'string') {
      // If it's already an AIMessage or object, return as is
      if (
        response instanceof AIMessage ||
        (typeof response === 'object' && response !== null)
      ) {
        return response;
      }
      // Otherwise, try to stringify
      try {
        return JSON.stringify(response);
      } catch {
        return String(response); // Fallback to basic string conversion
      }
    }

    // If it's a string, format bullet points
    const lines = response.split('\n');
    const formattedLines = lines.map((line: string) => {
      if (line.trim().startsWith('•')) {
        // Check for trimmed line start
        return `  ${line.trim()}`;
      }
      return line;
    });
    return formattedLines.join('\n');
  }

  /**
   * Check if an error is token-related
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
   * Execute call data request (signature mode) in agent mode
   */
  public async execute_call_data(input: string): Promise<unknown> {
    try {
      if (this.currentMode !== 'agent') {
        throw new Error(
          `Need to be in agent mode to execute_call_data (current mode: ${this.currentMode})`
        );
      }

      if (!this.agentReactExecutor) {
        throw new Error('Agent executor is not initialized');
      }

      // Prepare invocation options with message pruning
      const invokeOptions: any = {};

      // Add message pruning if memory is enabled
      if (this.memory.enabled !== false) {
        // Use mode.recursionLimit if available, otherwise fall back to memory config
        const recursionLimit =
          this.agentconfig?.mode?.recursionLimit !== undefined
            ? this.agentconfig.mode.recursionLimit
            : this.memory.recursionLimit !== undefined
              ? this.memory.recursionLimit
              : this.memory.shortTermMemorySize || 15;

        // Only apply recursion limit if it's not null (0 means no limit)
        if (recursionLimit !== 0) {
          invokeOptions.recursionLimit = recursionLimit;
          invokeOptions.messageHandler = (messages: any[]) => {
            if (messages.length > recursionLimit) {
              logger.debug(
                `Call data - message pruning: ${messages.length} messages exceeds limit ${recursionLimit}`
              );
              const prunedMessages = [
                messages[0],
                ...messages.slice(-(recursionLimit - 1)),
              ];
              logger.debug(
                `Call data - pruned from ${messages.length} to ${prunedMessages.length} messages`
              );
              return prunedMessages;
            }
            return messages;
          };
          logger.debug(
            `Execute call data: configured with recursionLimit=${recursionLimit}`
          );
        } else {
          logger.debug(`Execute call data: running without recursion limit`);
        }
      }

      logger.debug('Execute call data: invoking agent');
      const aiMessage = await this.agentReactExecutor.invoke(
        {
          messages: input,
        },
        invokeOptions
      );
      logger.debug('Execute call data: agent invocation complete');

      try {
        if (!aiMessage.messages || aiMessage.messages.length < 2) {
          throw new Error(
            'Insufficient messages returned from call data execution'
          );
        }

        const messageContent =
          aiMessage.messages[aiMessage.messages.length - 2].content;
        return JSON.parse(messageContent);
      } catch (parseError) {
        return {
          status: 'failure',
          error: `Failed to parse observation: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
        };
      }
    } catch (error) {
      return {
        status: 'failure',
        error: `Execution error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Execute in autonomous mode continuously
   */
  public async execute_autonomous(): Promise<unknown> {
    try {
      // Validate that we're in autonomous mode
      if (this.currentMode !== 'auto') {
        if (this.agentconfig?.mode?.autonomous) {
          logger.info(
            `Overriding mode to 'auto' based on config settings (autonomous=${this.agentconfig?.mode?.autonomous})`
          );
          this.currentMode = 'auto';
        } else {
          throw new Error(
            `Need to be in autonomous mode to execute_autonomous (current mode: ${this.currentMode})`
          );
        }
      }

      if (!this.agentReactExecutor) {
        await this.createAgentReactExecutor();
        if (!this.agentReactExecutor) {
          throw new Error(
            'Agent executor is not initialized for autonomous execution'
          );
        }
      }

      // Use autonomous implementation from original file
      const result = await this._executeAutonomous();
      return result;
    } catch (error) {
      return {
        status: 'failure',
        error: `Autonomous execution error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Internal implementation of autonomous execution
   */
  private async _executeAutonomous(): Promise<any> {
    try {
      let iterationCount = 0;
      let consecutiveErrorCount = 0;
      let tokensErrorCount = 0;
      let lastNextSteps: string | null = null;
      const MAX_ITERATIONS = 50;

      // Keep complete conversation history for invoking the graph
      let conversationHistory: BaseMessage[] = [];

      // Add initial system prompt if available in configuration
      if (
        this.agentReactExecutor &&
        this.agentReactExecutor.agent &&
        this.agentconfig?.prompt?.content
      ) {
        // Ensure content is a string
        const systemPromptContent =
          typeof this.agentconfig.prompt.content === 'string'
            ? this.agentconfig.prompt.content
            : JSON.stringify(this.agentconfig.prompt.content);
        const systemPrompt = new SystemMessage(systemPromptContent);
        conversationHistory.push(systemPrompt);
      }

      // Main autonomous loop
      while (iterationCount < MAX_ITERATIONS) {
        iterationCount++;

        try {
          // Determine input message for THIS iteration
          let currentTurnInput: BaseMessage;

          if (lastNextSteps) {
            logger.debug(
              `Using previous NEXT STEPS as prompt: "${lastNextSteps}"`
            );
            // Use NEXT STEPS as user input for this turn
            currentTurnInput = new HumanMessage({
              content: `Execute the following planned action based on the previous turn: "${lastNextSteps}". Ensure it's a single, simple action.`,
              name: 'Planner',
            });
          } else {
            logger.debug(
              'No previous NEXT STEPS found, generating adaptive prompt.'
            );
            // Fall back to general adaptive prompt
            const promptMessage =
              'Based on your objectives and the recent conversation history, determine the next best action to take.';
            currentTurnInput = new HumanMessage(promptMessage);
          }

          // Add input for this turn to history
          conversationHistory.push(currentTurnInput);

          // Prepare invocation options
          const agentConfig = this.agentReactExecutor.agentConfig || {
            configurable: { thread_id: 'autonomous_session' },
          };

          logger.debug(
            `Autonomous iteration ${iterationCount}: invoking graph with ${conversationHistory.length} messages`
          );

          // Invoke graph with current complete history
          const result = await this.agentReactExecutor.agent.invoke(
            { messages: conversationHistory },
            agentConfig
          );

          logger.debug(
            `Autonomous iteration ${iterationCount}: graph invocation complete`
          );

          // Process graph result
          if (!result || !result.messages || result.messages.length === 0) {
            logger.warn(
              'Graph returned empty or invalid state, stopping loop.'
            );
            break;
          }

          // result.messages contains state *after* graph has completed.
          // The last message(s) should be agent response or tool results.
          conversationHistory = result.messages;

          // Find the very last message added by graph execution (should be AIMessage or ToolMessage)
          const lastMessageFromGraph =
            conversationHistory[conversationHistory.length - 1];

          if (lastMessageFromGraph instanceof AIMessage) {
            // Process and display AI response
            lastNextSteps = this.extractNextSteps(lastMessageFromGraph.content);

            // Check if agent reported a final answer
            if (
              typeof lastMessageFromGraph.content === 'string' &&
              lastMessageFromGraph.content
                .toUpperCase()
                .includes('FINAL ANSWER')
            ) {
              logger.info('Detected FINAL ANSWER. Ending autonomous session.');
              break;
            }
          } else {
            // Handle other unexpected message types
            logger.warn(
              `Graph ended with unexpected message type: ${lastMessageFromGraph.constructor.name}`
            );
            lastNextSteps = null;
            break;
          }
        } catch (loopError) {
          // Handle errors in autonomous execution
          logger.error(
            `Error in autonomous iteration ${iterationCount}: ${loopError}`
          );

          consecutiveErrorCount++;
          if (this.isTokenRelatedError(loopError)) {
            tokensErrorCount += 2;
          }

          if (consecutiveErrorCount > 3) {
            logger.error(
              'Too many consecutive errors. Stopping autonomous execution.'
            );
            break;
          }

          // Wait before next attempt
          const waitTime = Math.min(2000 + consecutiveErrorCount * 1000, 10000);
          await new Promise((resolve) => setTimeout(resolve, waitTime));
        }
      }

      logger.info('Autonomous session finished.');
      return { status: 'success', iterations: iterationCount };
    } catch (error) {
      logger.error(`Fatal error in autonomous execution: ${error}`);
      return {
        status: 'failure',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Extract "NEXT STEPS" section from content
   */
  private extractNextSteps(content: string | any): string | null {
    if (typeof content !== 'string') {
      return null;
    }

    const nextStepsMatch = content.match(/NEXT STEPS:(.*?)($|(?=\n\n))/s);
    if (nextStepsMatch && nextStepsMatch[1]) {
      return nextStepsMatch[1].trim();
    }
    return null;
  }

  /**
   * Get memory configuration
   */
  public getMemoryConfig(): MemoryConfig {
    return this.memory;
  }

  /**
   * Set memory configuration
   */
  public setMemoryConfig(config: MemoryConfig): void {
    this.memory = { ...this.memory, ...config };
  }

  /**
   * Validates the user request before execution
   * @param request The user's request string
   * @returns Promise<boolean> indicating if request is valid
   */
  public async validateRequest(request: string): Promise<boolean> {
    logger.debug(`Validating request (currently always true): ${request}`);
    return true;
  }

  public async getModelForCurrentTask(
    messages: BaseMessage[],
    forceModelType?: string
  ): Promise<BaseChatModel> {
    if (!this.modelSelector) {
      logger.warn(
        'StarknetAgent: No ModelSelectionAgent available, using default model'
      );
      throw new Error(
        'ModelSelectionAgent is not available and no default model is configured'
      );
    }

    // Use the model selector to determine the best model
    const selectedModelType =
      forceModelType ||
      (await this.modelSelector.selectModelForMessages(messages));

    logger.debug(
      `StarknetAgent: Selected model type for current task: ${selectedModelType}`
    );
    return this.modelSelector.getModelForTask(messages, selectedModelType);
  }
}
