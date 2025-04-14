import { AiConfig, IAgent } from '../common/index.js';
import { createAgent } from './agent.js';
import { RpcProvider } from 'starknet';
import { createAutonomousAgent } from './autonomousAgents.js';
import { JsonConfig } from './jsonConfig.js';
import { HumanMessage } from '@langchain/core/messages';
import { PostgresAdaptater } from './databases/postgresql/src/database.js';
import { PostgresDatabasePoolInterface } from './databases/postgresql/src/interfaces/interfaces.js';
import logger from './logger.js';
import * as metrics from '../metrics.js';
import { createBox } from './formatting.js';
import {
  addTokenInfoToBox,
  truncateToTokenLimit,
  estimateTokens,
} from './tokenTracking.js';

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
  private database: PostgresAdaptater[] = [];
  private loggingOptions: LoggingOptions = {
    langchainVerbose: true,
    tokenLogging: true,
    disabled: false,
  };
  private originalLoggerFunctions: Record<string, any> = {};

  public readonly signature: string;
  public readonly agentMode: string;
  public readonly agentconfig?: JsonConfig;

  /**
   * Creates a new StarknetAgent instance
   * @param config - Configuration for the StarknetAgent
   */
  constructor(private readonly config: StarknetAgentConfig) {
    this.disableLogging();

    try {
      this.validateConfig(config);

      this.provider = config.provider;
      this.accountPrivateKey = config.accountPrivateKey;
      this.accountPublicKey = config.accountPublicKey;
      this.aiModel = config.aiModel;
      this.aiProviderApiKey = config.aiProviderApiKey;
      this.signature = config.signature;
      this.agentMode = config.agentMode;
      this.currentMode = config.agentMode;
      this.agentconfig = config.agentconfig;

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
  public async createAgentReactExecutor(configPath?: string): Promise<void> {
    try {
      const config: AiConfig = {
        aiModel: this.aiModel,
        aiProviderApiKey: this.aiProviderApiKey,
        aiProvider: this.config.aiProvider,
        langchainVerbose: this.loggingOptions.langchainVerbose,
      };

      if (this.currentMode === 'auto') {
        this.agentReactExecutor = await createAutonomousAgent(
          this,
          config,
          configPath
        );
      } else if (this.currentMode === 'agent') {
        this.agentReactExecutor = await createAgent(this, config, configPath);
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
  public async connectDatabase(databaseName: string): Promise<void> {
    try {
      const params: PostgresDatabasePoolInterface = {
        user: process.env.POSTGRES_USER as string,
        password: process.env.POSTGRES_PASSWORD as string,
        database: databaseName,
        host: process.env.POSTGRES_HOST as string,
        port: parseInt(process.env.POSTGRES_PORT as string, 10),
      };

      const database = await new PostgresAdaptater(params).connectDatabase();

      if (!database) {
        throw new Error(
          'Error when trying to initialize your Postgres database'
        );
      }

      this.database.push(database);
    } catch (error) {
      // Silently fail and return
      return;
    }
  }

  /**
   * Creates a new PostgreSQL database and connects to it
   * @param databaseName - Name of the database to create
   * @returns The connected database or undefined if failed
   */
  public async createDatabase(
    databaseName: string
  ): Promise<PostgresAdaptater | undefined> {
    try {
      // Connect to root database first to create a new one
      const rootParams: PostgresDatabasePoolInterface = {
        user: process.env.POSTGRES_USER as string,
        password: process.env.POSTGRES_PASSWORD as string,
        database: process.env.POSTGRES_ROOT_DB as string,
        host: process.env.POSTGRES_HOST as string,
        port: parseInt(process.env.POSTGRES_PORT as string, 10),
      };

      const rootDatabase = await new PostgresAdaptater(
        rootParams
      ).connectDatabase();
      if (!rootDatabase) {
        throw new Error(
          'Error when trying to initialize your Postgres database'
        );
      }

      // Create new database
      const result = await rootDatabase.createDatabase(databaseName);
      if (!result) {
        throw new Error('Error when trying to create your Postgres database');
      }

      // Connect to the newly created database
      const newParams: PostgresDatabasePoolInterface = {
        user: process.env.POSTGRES_USER as string,
        password: process.env.POSTGRES_PASSWORD as string,
        database: databaseName,
        host: process.env.POSTGRES_HOST as string,
        port: parseInt(process.env.POSTGRES_PORT as string, 10),
      };

      const newDatabaseConnection = await new PostgresAdaptater(
        newParams
      ).connectDatabase();

      if (!newDatabaseConnection) {
        throw new Error('Error when trying to connect to your database');
      }

      // Setup vector extension if possible
      try {
        await newDatabaseConnection.query(
          'CREATE EXTENSION IF NOT EXISTS vector;'
        );
      } catch (extError) {
        // Vector functionality may not work properly. Make sure pgvector is installed.
      }

      this.database.push(newDatabaseConnection);
      return newDatabaseConnection;
    } catch (error) {
      return undefined;
    }
  }

  /**
   * Deletes a database connection
   * @param databaseName - Name of the database to delete from connections
   */
  public async deleteDatabase(databaseName: string): Promise<void> {
    try {
      const database = this.getDatabaseByName(databaseName);
      if (!database) {
        throw new Error(`Postgres Database: ${databaseName} not found`);
      }

      await database.closeDatabase();
      this.deleteDatabaseByName(databaseName);
    } catch (error) {
      // Silently fail and return
      return;
    }
  }

  /**
   * Gets the array of database adapters instance
   */
  public getDatabase(): PostgresAdaptater[] {
    return this.database;
  }

  /**
   * Gets a database adapter instance by name
   * @param name - Name of the database to get
   */
  public getDatabaseByName(name: string): PostgresAdaptater | undefined {
    return this.database.find((db) => db.getDatabaseName() === name);
  }

  /**
   * Removes a database from the array of database adapters
   * @param name - Name of the database to remove
   */
  public deleteDatabaseByName(name: string): void {
    if (!this.database || this.database.length === 0) {
      return;
    }

    this.database = this.database.filter((db) => db.getDatabaseName() !== name);
  }

  /**
   * Gets the Starknet account credentials
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
      const result = await this.agentReactExecutor.invoke(
        {
          messages: [humanMessage],
        },
        {
          recursionLimit: 15,
          configurable: { thread_id: this.agentconfig?.chat_id as string },
        }
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

          const result = await this.agentReactExecutor.agent.invoke(
            { messages: promptMessage },
            this.agentReactExecutor.agentConfig
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
   * Validates that the current mode is set to autonomous
   */
  private validateAutonomousMode(): void {
    if (this.currentMode !== 'auto') {
      throw new Error(
        `Need to be in autonomous mode to execute_autonomous (current mode: ${this.currentMode})`
      );
    }

    if (!this.agentReactExecutor) {
      throw new Error(
        'Agent executor is not initialized for autonomous execution'
      );
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
      await this.createAgentReactExecutor();
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
    }

    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  /**
   * Checks if an error is token-related
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
      await new Promise((resolve) => setTimeout(resolve, pauseDuration));

      // Forced reset if multiple token-related errors
      if (consecutiveErrorCount >= 2 || tokensErrorCount >= 3) {
        logger.warn('Too many token-related errors, complete agent reset...');

        // Force the agent to forget its context to avoid accumulating tokens
        await this.createAgentReactExecutor();

        const resetMessage = createBox(
          'Agent Reset',
          'Due to persistent token issues, the agent has been reset. This may clear some context information but will allow execution to continue.'
        );
        process.stdout.write(resetMessage);

        // Wait longer after a reset
        await new Promise((resolve) => setTimeout(resolve, 8000));
      }
    } catch (recreateError) {
      logger.error(`Failed to handle token limit gracefully: ${recreateError}`);
      // Progressive waiting in case of error
      const waitTime = consecutiveErrorCount >= 3 ? 15000 : 5000;
      await new Promise((resolve) => setTimeout(resolve, waitTime));

      // If nothing works, try an emergency reset
      if (consecutiveErrorCount >= 5) {
        try {
          // Force a complete reset with a new executor
          await this.createAgentReactExecutor();
          logger.warn('Emergency reset performed after multiple failures');
        } catch (e) {
          // Just continue - we've tried everything
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

    // Increase waiting time with the number of consecutive errors
    if (consecutiveErrorCount >= 5) {
      waitTime = 30000; // 30 seconds for 5+ errors
      logger.warn(
        `${consecutiveErrorCount} errors in a row, waiting much longer before retry...`
      );
    } else if (consecutiveErrorCount >= 3) {
      waitTime = 10000; // 10 seconds for 3-4 errors
      logger.warn(
        `${consecutiveErrorCount} errors in a row, waiting longer before retry...`
      );
    }

    // Apply a pause to avoid rapid error loops
    await new Promise((resolve) => setTimeout(resolve, waitTime));

    // If too many errors accumulate, reset the agent
    if (consecutiveErrorCount >= 7) {
      try {
        logger.warn(
          'Too many consecutive errors, attempting complete reset...'
        );
        await this.createAgentReactExecutor();
        await new Promise((resolve) => setTimeout(resolve, 5000));
      } catch (e) {
        // Continue even if reset fails
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

      const aiMessage = await this.agentReactExecutor.invoke({
        messages: input,
      });

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
}
