import { AiConfig, IAgent } from '../../common/index.js';
import { createAgent } from '../interactive/agent.js';
import { RpcProvider } from 'starknet';
import { createAutonomousAgent } from '../autonomous/autonomousAgents.js';
import { JsonConfig } from '../../config/jsonConfig.js';
import { HumanMessage } from '@langchain/core/messages';
import { logger } from '@hijox/core';
import { metrics } from '@hijox/core';
import { createBox } from '../../prompt/formatting.js';
import {
  addTokenInfoToBox,
  truncateToTokenLimit,
  estimateTokens,
} from '../../token/tokenTracking.js';

/**
 * Memory configuration for the agent
 */
export interface MemoryConfig {
  enabled?: boolean; // Controls if memory is enabled
  shortTermMemorySize?: number; // Controls maximum number of messages in conversation history; oldest messages are pruned when this limit is reached
  recursionLimit?: number; // Controls the recursion limit for autonomous iterations; 0 = no limit, undefined = use shortTermMemorySize
}

/**
 * Configuration for the StarknetAgent
 */
export interface StarknetAgentConfig {
  aiProviderApiKey: string;
  aiModel: string;
  aiProvider: string;
  provider: RpcProvider;
  accountPublicKey: string;
  accountPrivateKey: string;
  signature: string;
  agentMode: string;
  agentconfig?: JsonConfig;
  memory?: MemoryConfig;
}

/**
 * Options for configuring logging behavior
 */
export interface LoggingOptions {
  langchainVerbose?: boolean;
  tokenLogging?: boolean;
  disabled?: boolean;
}

/**
 * Error response structure for execution failures
 */
interface ErrorResponse {
  status: string;
  error: string;
  step?: string;
}

/**
 * Agent for interacting with Starknet blockchain with AI capabilities
 */
export class StarknetAgent implements IAgent {
  private readonly provider: RpcProvider;
  private readonly accountPrivateKey: string;
  private readonly accountPublicKey: string;
  private readonly aiModel: string;
  private readonly aiProviderApiKey: string;
  private agentReactExecutor: any;
  private currentMode: string;
  private loggingOptions: LoggingOptions = {
    langchainVerbose: true,
    tokenLogging: true,
    disabled: false,
  };
  private originalLoggerFunctions: Record<string, any> = {};
  private memory: MemoryConfig;

  public readonly signature: string;
  public readonly agentMode: string;
  public readonly agentconfig?: JsonConfig;

  /**
   * Creates a new StarknetAgent instance
   * @param config - Configuration for the StarknetAgent
   */
  constructor(private readonly config: StarknetAgentConfig) {
    // Check environment variables for logging configuration
    const disableLogging = process.env.DISABLE_LOGGING === 'true';
    const enableDebugLogging = process.env.DEBUG_LOGGING === 'true';

    if (disableLogging) {
      this.disableLogging();
    } else if (enableDebugLogging) {
      logger.debug('Debug logging enabled via environment variables');
      this.loggingOptions.disabled = false;
    } else {
      this.disableLogging();
    }

    try {
      this.validateConfig(config);

      this.provider = config.provider;
      this.accountPrivateKey = config.accountPrivateKey;
      this.accountPublicKey = config.accountPublicKey;
      this.aiModel = config.aiModel;
      this.aiProviderApiKey = config.aiProviderApiKey;
      this.signature = config.signature;
      this.agentMode = config.agentMode;

      // Set the current mode - ensure it's properly set for autonomous mode
      this.currentMode =
        config.agentMode === 'auto' ||
        config.agentconfig?.mode?.autonomous === true
          ? 'auto'
          : config.agentMode || 'agent';

      this.agentconfig = config.agentconfig;
      this.memory = config.memory || {};

      metrics.metricsAgentConnect(
        config.agentconfig?.name ?? 'agent',
        config.agentMode
      );
    } catch (error) {
      throw error;
    }
  }

  /**
   * Disables all logging by replacing logger methods with no-ops
   */
  private disableLogging(): void {
    // Store the original methods in case we want to restore them later
    this.originalLoggerFunctions = {
      info: logger.info,
      debug: logger.debug,
      warn: logger.warn,
      error: logger.error,
    };

    // Replace with no-op functions that respect the logger method signature
    const noop = (message: any, ...meta: any[]): any => logger;
    logger.info = noop;
    logger.debug = noop;
    logger.warn = noop;
    logger.error = noop;

    this.loggingOptions.disabled = true;
  }

  /**
   * Restores original logging functions
   */
  public enableLogging(): void {
    if (!this.originalLoggerFunctions.info) return;

    logger.info = this.originalLoggerFunctions.info;
    logger.debug = this.originalLoggerFunctions.debug;
    logger.warn = this.originalLoggerFunctions.warn;
    logger.error = this.originalLoggerFunctions.error;

    this.loggingOptions.disabled = false;
  }

  /**
   * Creates an agent executor based on the current mode
   */
  public async createAgentReactExecutor(): Promise<void> {
    try {
      const config: AiConfig = {
        aiModel: this.aiModel,
        aiProviderApiKey: this.aiProviderApiKey,
        aiProvider: this.config.aiProvider,
        langchainVerbose: this.loggingOptions.langchainVerbose,
      };

      if (this.currentMode === 'auto') {
        this.agentReactExecutor = await createAutonomousAgent(this, config);
      } else if (this.currentMode === 'agent') {
        this.agentReactExecutor = await createAgent(this, config);
      }

      // Apply logging settings to the created executor if it exists
      this.applyLoggerVerbosityToExecutor();
    } catch (error) {
      throw error;
    }
  }

  /**
   * Applies the logging verbosity setting to the executor if it exists
   */
  private applyLoggerVerbosityToExecutor(): void {
    if (!this.agentReactExecutor) return;

    // Update main LLM if available
    if (this.agentReactExecutor.agent?.llm) {
      this.agentReactExecutor.agent.llm.verbose =
        this.loggingOptions.langchainVerbose === true;
    }

    // Update model in graph nodes if available
    if (this.agentReactExecutor.graph?._nodes?.agent?.data?.model) {
      this.agentReactExecutor.graph._nodes.agent.data.model.verbose =
        this.loggingOptions.langchainVerbose === true;
    }
  }

  /**
   * Validates the configuration provided
   * @param config - Configuration to validate
   */
  private validateConfig(config: StarknetAgentConfig): void {
    if (!config) {
      throw new Error('Configuration object is required');
    }

    if (!config.accountPrivateKey) {
      throw new Error('STARKNET_PRIVATE_KEY is required');
    }

    if (config.aiModel !== 'ollama' && !config.aiProviderApiKey) {
      throw new Error('AAI_PROVIDER_API_KEY is required');
    }
  }

  /**
   * Connects to an existing PostgreSQL database
   * @param databaseName - Name of the database to connect to
   */
  private async switchMode(newMode: string): Promise<string> {
    if (newMode === 'auto' && !this.agentconfig?.mode?.autonomous) {
      return 'Cannot switch to autonomous mode - not enabled in configuration';
    }

    if (this.currentMode === newMode) {
      return `Already in ${newMode} mode`;
    }

    this.currentMode = newMode;
    this.createAgentReactExecutor();
    return `Switched to ${newMode} mode`;
  }

  /**
   * @function getAccountCredentials
   * @description Gets the Starknet account credentials
   * @returns {{accountPrivateKey: string, accountPublicKey: string}} Account credentials
   */
  public getAccountCredentials() {
    return {
      accountPrivateKey: this.accountPrivateKey,
      accountPublicKey: this.accountPublicKey,
    };
  }

  /**
   * Gets the AI model credentials
   */
  public getModelCredentials() {
    return {
      aiModel: this.aiModel,
      aiProviderApiKey: this.aiProviderApiKey,
    };
  }

  /**
   * Gets the agent signature
   */
  public getSignature() {
    return {
      signature: this.signature,
    };
  }

  /**
   * Gets the current agent mode
   */
  public getAgent() {
    return {
      agentMode: this.currentMode,
    };
  }

  /**
   * Gets the agent configuration
   */
  public getAgentConfig(): JsonConfig | undefined {
    return this.agentconfig;
  }

  /**
   * Gets the original agent mode from initialization
   */
  public getAgentMode(): string {
    return this.agentMode;
  }

  /**
   * Gets the Starknet RPC provider
   */
  public getProvider(): RpcProvider {
    return this.provider;
  }

  /**
   * Validates an input request
   * @param request - Request to validate
   */
  public async validateRequest(request: string): Promise<boolean> {
    return Boolean(request && typeof request === 'string');
  }

  /**
   * Executes a request in agent mode
   * @param input - Input to execute
   * @returns Result of the execution
   */
  public async execute(input: string): Promise<unknown> {
    if (this.currentMode !== 'agent') {
      throw new Error(
        `Need to be in agent mode to execute (current mode: ${this.currentMode})`
      );
    }

    try {
      if (!this.agentReactExecutor) {
        throw new Error('Agent executor is not initialized');
      }

      const humanMessage = new HumanMessage(input);
      const invokeOptions: any = {
        configurable: { thread_id: this.agentconfig?.chat_id as string },
      };

      // Only apply recursion limit if memory is enabled
      if (this.memory.enabled !== false) {
        // Use mode.recursionLimit if available, otherwise fallback to memory config
        const recursionLimit =
          this.agentconfig?.mode?.recursionLimit !== undefined
            ? this.agentconfig.mode.recursionLimit
            : this.memory.recursionLimit !== undefined
              ? this.memory.recursionLimit
              : this.memory.shortTermMemorySize || 15;

        // Only apply recursion limit if it's not zero (0 means no limit)
        if (recursionLimit !== 0) {
          invokeOptions.recursionLimit = recursionLimit;

          // Add a messageHandler to prune oldest messages when reaching the limit
          invokeOptions.messageHandler = (messages: any[]) => {
            if (messages.length > recursionLimit) {
              logger.debug(
                `Message pruning: ${messages.length} messages exceeds limit ${recursionLimit}, pruning oldest messages`
              );
              const prunedMessages = [
                messages[0],
                ...messages.slice(-(recursionLimit - 1)),
              ];
              logger.debug(
                `Pruned from ${messages.length} to ${prunedMessages.length} messages`
              );
              return prunedMessages;
            }
            return messages;
          };

          logger.debug(
            `Execute: configured with recursionLimit=${recursionLimit}, memory enabled=${this.memory.enabled}`
          );
        } else {
          logger.debug(
            `Execute: running without recursion limit, memory enabled=${this.memory.enabled}`
          );
        }
      }

      const result = await this.agentReactExecutor.invoke(
        {
          messages: [humanMessage],
        },
        invokeOptions
      );

      if (!result.messages || result.messages.length === 0) {
        return '';
      }

      return result.messages[result.messages.length - 1].content;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Validates that the current mode is set to autonomous
   */
  private validateAutonomousMode(): void {
    logger.debug(`Current mode is: ${this.currentMode}, comparing with 'auto'`);

    if (this.currentMode !== 'auto') {
      // Check if agentconfig has autonomous mode enabled as a fallback
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
      throw new Error(
        'Agent executor is not initialized for autonomous execution'
      );
    }
  }

  /**
   * Gets an adaptive prompt message based on recent execution context
   */
  private getAdaptivePromptMessage(tokensErrorCount: number): string {
    if (tokensErrorCount > 0) {
      // If recent token errors, specifically request simpler actions
      return 'Due to recent token limit issues, choose a very simple action now. Prefer actions that require minimal context and processing.';
    }

    return 'Based on my objectives, You should take action now without seeking permission. Choose what to do.';
  }

  /**
   * Executes in autonomous mode continuously
   * @returns Result if execution fails
   */
  public async execute_autonomous(): Promise<unknown> {
    try {
      this.validateAutonomousMode();

      let iterationCount = 0;
      let consecutiveErrorCount = 0;
      let tokensErrorCount = 0;

      // Use an error message queue to avoid repeating the same error message
      const lastErrors = new Set<string>();
      const addError = (error: string) => {
        lastErrors.add(error);
        if (lastErrors.size > 3) {
          // Keep only the 3 most recent unique errors
          const iterator = lastErrors.values();
          lastErrors.delete(iterator.next().value);
        }
      };

      while (true) {
        iterationCount++;

        try {
          // Reset consecutive error counter on success
          consecutiveErrorCount = 0;

          // Gradually reduce token error count
          if (tokensErrorCount > 0) {
            tokensErrorCount--;
          }

          // Periodically recreate the agent to avoid context accumulation
          this.handlePeriodicAgentRefresh(iterationCount, tokensErrorCount);

          if (!this.agentReactExecutor.agent) {
            throw new Error('Agent property is missing from executor');
          }

          // Adjust the message based on recent error context
          const promptMessage = this.getAdaptivePromptMessage(tokensErrorCount);

          // Prepare invoke options with message handler for pruning
          const agentConfig = { ...this.agentReactExecutor.agentConfig };

          // Add message pruning handler if memory is enabled
          if (this.memory.enabled !== false) {
            // Use mode.recursionLimit if available, otherwise fallback to memory config
            const recursionLimit =
              this.agentconfig?.mode?.recursionLimit !== undefined
                ? this.agentconfig.mode.recursionLimit
                : this.memory.recursionLimit !== undefined
                  ? this.memory.recursionLimit
                  : this.memory.shortTermMemorySize || 15;

            if (!agentConfig.configurable) {
              agentConfig.configurable = {};
            }

            // Only set recursionLimit if it's not zero (0 means no limit)
            if (recursionLimit !== 0) {
              agentConfig.recursionLimit = recursionLimit;
              agentConfig.messageHandler = (messages: any[]) => {
                if (messages.length > recursionLimit) {
                  logger.debug(
                    `Autonomous - message pruning: ${messages.length} messages exceeds limit ${recursionLimit}`
                  );
                  const prunedMessages = [
                    messages[0],
                    ...messages.slice(-(recursionLimit - 1)),
                  ];
                  logger.debug(
                    `Autonomous - pruned from ${messages.length} to ${prunedMessages.length} messages`
                  );
                  return prunedMessages;
                }
                return messages;
              };

              logger.debug(
                `Autonomous iteration ${iterationCount}: configured with recursionLimit=${recursionLimit}`
              );
            } else {
              logger.debug(
                `Autonomous iteration ${iterationCount}: running without recursion limit`
              );
            }
          }

          logger.debug(
            `Autonomous iteration ${iterationCount}: invoking agent (tokensErrorCount=${tokensErrorCount})`
          );
          const result = await this.agentReactExecutor.agent.invoke(
            { messages: promptMessage },
            agentConfig
          );
          logger.debug(
            `Autonomous iteration ${iterationCount}: agent invocation complete`
          );

          if (!result.messages || result.messages.length === 0) {
            logger.warn(
              'Agent returned an empty response, continuing to next iteration'
            );
            continue;
          }

          // Process and display agent response
          await this.processAgentResponse(result);
        } catch (loopError) {
          // Handle errors in autonomous execution
          await this.handleAutonomousExecutionError(
            loopError,
            iterationCount,
            consecutiveErrorCount,
            tokensErrorCount,
            addError
          );

          // Update error counters for next iteration
          consecutiveErrorCount++;
          if (this.isTokenRelatedError(loopError)) {
            tokensErrorCount += 2;
          }
        }
      }
    } catch (error) {
      return error;
    }
  }

  /**
   * Handles periodic agent refresh to prevent context buildup
   */
  private async handlePeriodicAgentRefresh(
    iterationCount: number,
    tokensErrorCount: number
  ): Promise<void> {
    // Periodically recreate the agent to avoid context accumulation
    // More frequent if there have been recent token errors
    const refreshInterval = tokensErrorCount > 0 ? 3 : 5;
    if (iterationCount > 1 && iterationCount % refreshInterval === 0) {
      logger.info(`Periodic agent refresh (iteration ${iterationCount})`);
      logger.debug(
        `Agent refresh triggered: iteration=${iterationCount}, tokensErrorCount=${tokensErrorCount}, refreshInterval=${refreshInterval}`
      );
      await this.createAgentReactExecutor();
      logger.debug('Agent refresh complete: new executor created');
    }
  }

  /**
   * Processes and displays the agent response
   */
  private async processAgentResponse(result: any): Promise<void> {
    // Get and check the content of the last message
    const lastMessage = result.messages[result.messages.length - 1];
    const agentResponse = lastMessage.content;

    // If the message contains tools and large results, it may need to be truncated
    // Limit of 20,000 tokens to avoid expensive requests during the next iteration
    const MAX_RESPONSE_TOKENS = 20000;
    const responseString =
      typeof agentResponse === 'string'
        ? agentResponse
        : JSON.stringify(agentResponse);
    const estimatedTokens = estimateTokens(responseString);

    logger.debug(
      `Processing agent response: estimatedTokens=${estimatedTokens}, maxLimit=${MAX_RESPONSE_TOKENS}`
    );

    let formattedAgentResponse;
    if (estimatedTokens > MAX_RESPONSE_TOKENS) {
      // Truncate the response to respect the token limit
      logger.warn(
        `Response exceeds token limit: ${estimatedTokens} > ${MAX_RESPONSE_TOKENS}. Truncating...`
      );
      formattedAgentResponse = truncateToTokenLimit(
        responseString,
        MAX_RESPONSE_TOKENS
      );
      logger.debug(`Response truncated to fit token limit`);
    } else {
      formattedAgentResponse = agentResponse;
    }

    // Format the response for display
    const formattedContent = this.formatResponseForDisplay(
      formattedAgentResponse
    );

    // Display the response even with logs disabled
    const boxContent = createBox('Agent Response', formattedContent);
    // Add token information to the box
    const boxWithTokens = addTokenInfoToBox(boxContent);
    process.stdout.write(boxWithTokens);

    // Wait for an adaptive interval based on the complexity of the last response
    await this.waitAdaptiveInterval(estimatedTokens, MAX_RESPONSE_TOKENS);
  }

  /**
   * Formats the agent response for display
   */
  private formatResponseForDisplay(response: string | any): string | any {
    if (typeof response !== 'string') {
      return response;
    }

    return response.split('\n').map((line: string) => {
      if (line.includes('•')) {
        return `  ${line.trim()}`;
      }
      return line;
    });
  }

  /**
   * Waits for an adaptive interval based on response complexity
   */
  private async waitAdaptiveInterval(
    estimatedTokens: number,
    maxTokens: number
  ): Promise<void> {
    // Wait for an adaptive interval based on the complexity of the last response
    // If the response was large, wait longer to give resources time to free up
    const baseInterval = this.agentReactExecutor.json_config?.interval || 5000;
    let interval = baseInterval;

    // Increase the interval if the response was large to avoid overload
    if (estimatedTokens > maxTokens / 2) {
      interval = baseInterval * 1.5;
      logger.debug(
        `Increasing wait interval due to large response: ${interval}ms (base: ${baseInterval}ms)`
      );
    }

    logger.debug(`Waiting for ${interval}ms before next iteration`);
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  /**
   * Checks if an error is token-related
   */
  private isTokenRelatedError(error: any): boolean {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isTokenError =
      errorMessage.includes('token limit') ||
      errorMessage.includes('tokens exceed') ||
      errorMessage.includes('context length') ||
      errorMessage.includes('prompt is too long') ||
      errorMessage.includes('maximum context length');

    if (isTokenError) {
      logger.debug(
        `Token-related error detected: "${errorMessage.substring(0, 100)}${errorMessage.length > 100 ? '...' : ''}"`
      );
    }

    return isTokenError;
  }

  /**
   * Handles errors in autonomous execution mode
   */
  private async handleAutonomousExecutionError(
    error: any,
    iterationCount: number,
    consecutiveErrorCount: number,
    tokensErrorCount: number,
    addError: (error: string) => void
  ): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : String(error);
    addError(errorMessage);

    // Detailed error message to help with debugging
    logger.error(
      `Error in autonomous agent (iteration ${iterationCount}): ${errorMessage}`
    );
    logger.debug(
      `Error stats: iterationCount=${iterationCount}, consecutiveErrorCount=${consecutiveErrorCount}, tokensErrorCount=${tokensErrorCount}`
    );

    if (this.isTokenRelatedError(error)) {
      await this.handleTokenLimitError(consecutiveErrorCount, tokensErrorCount);
    } else {
      await this.handleGeneralError(consecutiveErrorCount);
    }
  }

  /**
   * Handles token limit errors in autonomous mode
   */
  private async handleTokenLimitError(
    consecutiveErrorCount: number,
    tokensErrorCount: number
  ): Promise<void> {
    try {
      // Display warning message
      logger.warn(
        'Token limit reached - abandoning current action without losing context'
      );
      logger.debug(
        `Token limit error handler: consecutiveErrorCount=${consecutiveErrorCount}, tokensErrorCount=${tokensErrorCount}`
      );

      const warningMessage = createBox(
        'Action Abandoned',
        'Current action was abandoned due to a token limit. The agent will try a different action.'
      );
      process.stdout.write(warningMessage);

      // Wait before resuming to avoid error loops
      const pauseDuration = Math.min(
        5000 + consecutiveErrorCount * 1000,
        15000
      );
      logger.debug(`Pausing for ${pauseDuration}ms after token limit error`);
      await new Promise((resolve) => setTimeout(resolve, pauseDuration));

      // Forced reset if multiple token-related errors
      if (consecutiveErrorCount >= 2 || tokensErrorCount >= 3) {
        logger.warn('Too many token-related errors, complete agent reset...');
        logger.debug(
          `Forced agent reset triggered: consecutiveErrorCount=${consecutiveErrorCount}, tokensErrorCount=${tokensErrorCount}`
        );

        // Force the agent to forget its context to avoid accumulating tokens
        await this.createAgentReactExecutor();
        logger.debug('Agent executor recreated after token errors');

        const resetMessage = createBox(
          'Agent Reset',
          'Due to persistent token issues, the agent has been reset. This may clear some context information but will allow execution to continue.'
        );
        process.stdout.write(resetMessage);

        // Wait longer after a reset
        logger.debug('Waiting 8 seconds after agent reset');
        await new Promise((resolve) => setTimeout(resolve, 8000));
      }
    } catch (recreateError) {
      logger.error(`Failed to handle token limit gracefully: ${recreateError}`);
      logger.debug(
        `Error during token limit handling: ${recreateError instanceof Error ? recreateError.stack : recreateError}`
      );
      // Progressive waiting in case of error
      const waitTime = consecutiveErrorCount >= 3 ? 15000 : 5000;
      logger.debug(`Error recovery wait: ${waitTime}ms`);
      await new Promise((resolve) => setTimeout(resolve, waitTime));

      // If nothing works, try an emergency reset
      if (consecutiveErrorCount >= 5) {
        try {
          // Force a complete reset with a new executor
          logger.debug('Attempting emergency reset after multiple failures');
          await this.createAgentReactExecutor();
          logger.warn('Emergency reset performed after multiple failures');
        } catch (e) {
          // Just continue - we've tried everything
          logger.debug(
            `Even emergency reset failed: ${e instanceof Error ? e.message : String(e)}`
          );
        }
      }
    }
  }

  /**
   * Handles general errors in autonomous mode
   */
  private async handleGeneralError(
    consecutiveErrorCount: number
  ): Promise<void> {
    // Progressive waiting time for general errors
    let waitTime = 3000; // Base waiting time
    logger.debug(
      `General error handler: consecutiveErrorCount=${consecutiveErrorCount}, base wait=${waitTime}ms`
    );

    // Increase waiting time with the number of consecutive errors
    if (consecutiveErrorCount >= 5) {
      waitTime = 30000; // 30 seconds for 5+ errors
      logger.warn(
        `${consecutiveErrorCount} errors in a row, waiting much longer before retry...`
      );
      logger.debug(
        `Extended wait time (30s) due to high error count: ${consecutiveErrorCount}`
      );
    } else if (consecutiveErrorCount >= 3) {
      waitTime = 10000; // 10 seconds for 3-4 errors
      logger.warn(
        `${consecutiveErrorCount} errors in a row, waiting longer before retry...`
      );
      logger.debug(
        `Increased wait time (10s) due to multiple errors: ${consecutiveErrorCount}`
      );
    }

    // Apply a pause to avoid rapid error loops
    logger.debug(`Pausing for ${waitTime}ms after general error`);
    await new Promise((resolve) => setTimeout(resolve, waitTime));

    // If too many errors accumulate, reset the agent
    if (consecutiveErrorCount >= 7) {
      try {
        logger.warn(
          'Too many consecutive errors, attempting complete reset...'
        );
        logger.debug(
          `Critical error threshold reached (${consecutiveErrorCount} errors), full agent reset initiated`
        );
        await this.createAgentReactExecutor();
        logger.debug(
          'Agent executor successfully recreated after multiple errors'
        );
        await new Promise((resolve) => setTimeout(resolve, 5000));
      } catch (e) {
        // Continue even if reset fails
        logger.debug(
          `Failed to reset agent after multiple errors: ${e instanceof Error ? e.message : String(e)}`
        );
      }
    }
  }

  /**
   * Executes a call data (signature mode) request in agent mode
   * @param input - Input to execute
   * @returns Parsed result or error
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

      // Prepare invoke options with message pruning
      const invokeOptions: any = {};

      // Add message pruning if memory is enabled
      if (this.memory.enabled !== false) {
        // Use mode.recursionLimit if available, otherwise fallback to memory config
        const recursionLimit =
          this.agentconfig?.mode?.recursionLimit !== undefined
            ? this.agentconfig.mode.recursionLimit
            : this.memory.recursionLimit !== undefined
              ? this.memory.recursionLimit
              : this.memory.shortTermMemorySize || 15;

        // Only apply recursion limit if it's not zero (0 means no limit)
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
   * Sets logging options for the agent
   * @param options - Logging options to set
   */
  public setLoggingOptions(options: LoggingOptions): void {
    this.loggingOptions = { ...this.loggingOptions, ...options };

    if (options.disabled === true && !this.loggingOptions.disabled) {
      this.disableLogging();
      return;
    } else if (options.disabled === false && this.loggingOptions.disabled) {
      this.enableLogging();
    }

    // Only update LLM verbosity settings if we have an executor and logging is enabled
    if (!this.loggingOptions.disabled && this.agentReactExecutor) {
      this.applyLoggerVerbosityToExecutor();
    }
  }

  /**
   * Gets the memory configuration
   */
  public getMemoryConfig(): MemoryConfig {
    return this.memory;
  }

  /**
   * Sets the memory configuration
   * @param config - Memory configuration to set
   */
  public setMemoryConfig(config: MemoryConfig): void {
    this.memory = { ...this.memory, ...config };
  }
}
