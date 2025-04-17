import { AiConfig, IAgent } from '../common/index.js';
import { createAgent } from './agent.js';
import { RpcProvider } from 'starknet';
import { createAutonomousAgent } from './autonomousAgents.js';
import { JsonConfig, ModelsConfig, loadModelsConfig } from './jsonConfig.js';
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
import {
  ADAPTIVE_PROMPT_NORMAL,
  ADAPTIVE_PROMPT_TOKEN_LIMIT,
} from './prompts/prompts.js';
import { Tool, DynamicStructuredTool, StructuredTool } from '@langchain/core/tools';
import { createAllowedTools } from './tools/tools.js';
import { createSignatureTools } from './tools/signatureTools.js';
// Import monitor prompts and types
import { formatMonitorPrompt, parseMonitorResponse } from './prompts/monitor_prompts.js';
import { BaseMessage, AIMessage, SystemMessage } from '@langchain/core/messages';
import { BaseChatModel } from '@langchain/core/language_models/chat_models'; // Import BaseChatModel
import { selectModel } from './agent.js'; // Import selectModel to create monitor model instance

// Define the type for model levels explicitly
type ModelLevel = 'fast' | 'smart' | 'cheap';

// Interface for storing multiple API keys
interface ApiKeys {
  openai?: string;
  anthropic?: string;
  gemini?: string;
  deepseek?: string;
  // Add other providers as needed
}

/**
 * Configuration for the StarknetAgent
 */
export interface StarknetAgentConfig {
  aiProviderApiKey?: string; // Keep as optional, primarily for primary key loading
  provider: RpcProvider;
  accountPublicKey: string;
  accountPrivateKey: string;
  signature: string;
  agentMode: string;
  agentconfig?: JsonConfig;
  modelsConfig: ModelsConfig; // Add modelsConfig
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
 * Interface for StarknetAgent that implements tool selection strategy
 */
export interface StarknetAgentInterface {
  getSignature(): { signature: string };
  getAgentConfig(): JsonConfig | undefined;
  createDatabase(databaseName: string): Promise<PostgresAdaptater | undefined>;
  // Add other required methods
}

/**
 * Agent for interacting with Starknet blockchain with AI capabilities
 */
export class StarknetAgent implements IAgent {
  private readonly provider: RpcProvider;
  private readonly accountPrivateKey: string;
  private readonly accountPublicKey: string;
  private agentReactExecutor: any;
  private currentMode: string;
  private database: PostgresAdaptater[] = [];
  private loggingOptions: LoggingOptions = {
    langchainVerbose: true,
    tokenLogging: true,
    disabled: false,
  };
  private originalLoggerFunctions: Record<string, any> = {};
  private readonly modelsConfig: ModelsConfig; // Make modelsConfig readonly
  private apiKeys: ApiKeys = {}; // Store loaded API keys
  private toolsModelStrategy: 'adaptive' | 'fixed' = 'fixed'; // Strategy for model selection based on tools

  // Add properties to store pre-configured model instances
  private fastModel?: BaseChatModel;
  private smartModel?: BaseChatModel;
  private cheapModel?: BaseChatModel;
  private monitorModel?: BaseChatModel; // Dedicated model for the monitor agent

  public readonly signature: string;
  public readonly agentMode: string;
  public readonly agentconfig?: JsonConfig;

  /**
   * Creates a new StarknetAgent instance
   * @param config - Configuration for the StarknetAgent
   */
  constructor(private readonly config: StarknetAgentConfig) {
    // Only disable logging if DEBUG_LOGGING is not explicitly set to true
    if (process.env.DEBUG_LOGGING !== 'true') {
      this.disableLogging();
    } else {
      // If debug logging is enabled, ensure we have proper flags set
      this.loggingOptions = {
        langchainVerbose: true,
        tokenLogging: true,
        disabled: false,
      };
      logger.debug('StarknetAgent initialized with debug logging enabled');
    }

    try {
      this.validateConfig(config);

      this.provider = config.provider;
      this.accountPrivateKey = config.accountPrivateKey;
      this.accountPublicKey = config.accountPublicKey;
      this.modelsConfig = config.modelsConfig; // Store passed modelsConfig

      // Load API keys from environment during initialization
      // Pass optional primary API key from config if provided
      this.loadApiKeys(config.aiProviderApiKey);

      this.signature = config.signature;
      this.agentMode = config.agentMode;
      this.currentMode = config.agentMode;
      this.agentconfig = config.agentconfig;

      // Initialize pre-configured models (moved to a separate method for clarity)
      this.initializeModels();

      // Enable adaptive tool selection strategy by default
      this.toolsModelStrategy = 'adaptive';

      metrics.metricsAgentConnect(
        config.agentconfig?.name ?? 'agent',
        config.agentMode
      );
    } catch (error) {
      this.enableLogging();
      logger.error('Failed to initialize StarknetAgent:', error);
      throw error;
    }
  }

  /**
   * Initializes the model instances ('fast', 'smart', 'cheap', 'monitor') based on modelsConfig.
   */
  private initializeModels(): void {
    logger.debug('Initializing pre-configured model instances...');
    const levels: ModelLevel[] = ['fast', 'smart', 'cheap'];

    for (const level of levels) {
      const modelInfo = this.modelsConfig.models[level];
      if (!modelInfo) {
        logger.warn(`Model configuration for level '${level}' not found. Skipping initialization.`);
        continue;
      }

      const apiKey = this.getApiKeyForProvider(modelInfo.provider);
      if (!apiKey && modelInfo.provider !== 'ollama') {
        logger.warn(`API key for provider ${modelInfo.provider} (level ${level}) not found. Skipping initialization.`);
        continue;
      }

      try {
        const modelInstance = selectModel(
          apiKey,
          modelInfo.provider,
          modelInfo.model_name,
          this.loggingOptions.langchainVerbose,
          // Pass token limits from main config if available
          {
             maxInputTokens: (this.config as any).maxInputTokens,
             maxCompletionTokens: (this.config as any).maxCompletionTokens,
             maxTotalTokens: (this.config as any).maxTotalTokens,
          }
        );
        // Store the instance
        (this as any)[`${level}Model`] = modelInstance;
        logger.info(`Initialized model instance for level '${level}': ${modelInfo.provider}/${modelInfo.model_name}`);

        // Use the 'fast' or 'cheap' model as the monitor model (prefer 'fast', fallback to 'cheap')
        if (!this.monitorModel && (level === 'fast' || level === 'cheap')) {
            if (level === 'fast' || !this.fastModel) { // Prioritize fast, use cheap if fast wasn't available
                 this.monitorModel = modelInstance;
                 logger.info(`Using '${level}' model instance as the Monitor Agent model.`);
            }
        }

      } catch (error) {
        logger.error(`Failed to initialize model for level '${level}': ${error}`);
      }
    }
     // Fallback for Monitor Model if neither fast nor cheap were initialized
    if (!this.monitorModel) {
        logger.warn("Monitor model could not be initialized from 'fast' or 'cheap' levels. Monitoring will default to 'smart'.");
        // In invokeMonitorAgent, we'll default to 'smart' if this.monitorModel is undefined.
    }
  }

  /**
   * Creates tool selection executor with appropriate model based on tool count
   * @param useAdaptiveStrategy - Whether to use adaptive strategy based on tool count
   * @returns The tools list and selected model level
   */
  public async createToolSelectionExecutor(useAdaptiveStrategy = true): Promise<{
    toolsList: (Tool | DynamicStructuredTool<any> | StructuredTool)[];
    // modelLevel: ModelLevel; // REMOVED - No longer returns modelLevel
  }> {
    // this.toolsModelStrategy = useAdaptiveStrategy ? 'adaptive' : 'fixed'; // Strategy setting removed/managed elsewhere if needed

    try {
      // Get JSON config
      const jsonConfig = this.getAgentConfig();
      if (!jsonConfig) {
        throw new Error('Agent configuration is required');
      }

      // Initialize tools list
      let toolsList: (Tool | DynamicStructuredTool<any> | StructuredTool)[] = [];
      const isSignature = this.getSignature().signature === 'wallet';

      // Create appropriate tools
      if (isSignature) {
        toolsList = await createSignatureTools(jsonConfig.plugins);
      } else {
        const allowedTools = await createAllowedTools(this, jsonConfig.plugins, '');
        toolsList = [...allowedTools];
      }

      // Add MCP tools if configured
      if (jsonConfig.mcpServers && Object.keys(jsonConfig.mcpServers).length > 0) {
        try {
          const mcp = await import('./mcp/src/mcp.js').then(m => m.MCP_CONTROLLER.fromJsonConfig(jsonConfig));
          await mcp.initializeConnections();

          const mcpTools = mcp.getTools();
          logger.info(`Added ${mcpTools.length} MCP tools to the agent`);
          // Cast mcpTools to the expected type
          toolsList = [...toolsList, ...(mcpTools as (Tool | DynamicStructuredTool<any> | StructuredTool)[] )];
        } catch (error) {
          logger.error(`Failed to initialize MCP tools: ${error}`);
        }
      }

      // Select appropriate model level based on tool count - REMOVED
      // const modelLevel = this.getModelLevelForTools(toolsList);
      // logger.info(`Selected model level for tool operations: ${modelLevel}`); // REMOVED

      return { toolsList }; // Only return toolsList
    } catch (error) {
      logger.error(`Failed to initialize tools: ${error}`);
      // Fall back to empty list if there's an error
      return { toolsList: [] };
    }
  }

  /**
   * Loads API keys from environment variables.
   * Uses the primary provider/key from config as a starting point.
   * @param primaryKey - Optional primary API key from config.
   */
  private loadApiKeys(primaryKey?: string): void {
    logger.debug('Loading API keys from environment...');

    // Determine primary provider from 'smart' model if primaryKey is given
    // This logic might need refinement based on how primaryKey is intended to be used now
    let primaryProvider: string | undefined = undefined;
    if (primaryKey && this.modelsConfig.models.smart) {
      primaryProvider = this.modelsConfig.models.smart.provider;
      this.apiKeys[primaryProvider as keyof ApiKeys] = primaryKey;
      logger.debug(
        `Loaded primary key for provider: ${primaryProvider} (from smart model)`
      );
    } else if (primaryKey) {
      logger.warn(
        `Primary API key provided in config, but cannot determine primary provider (missing smart model?).`
      );
    }

    // Attempt to load keys for other known providers from environment variables
    const keyEnvVars: { [key in keyof ApiKeys]: string } = {
      openai: 'OPENAI_API_KEY',
      anthropic: 'ANTHROPIC_API_KEY',
      gemini: 'GEMINI_API_KEY',
      deepseek: 'DEEPSEEK_API_KEY',
      // Add mappings for other providers
    };

    for (const [provider, envVar] of Object.entries(keyEnvVars)) {
      // Only load if not already loaded as the primary key
      if (!this.apiKeys[provider as keyof ApiKeys]) {
        const key = process.env[envVar];
        if (key) {
          this.apiKeys[provider as keyof ApiKeys] = key;
          logger.debug(`Loaded API key for ${provider} from env var ${envVar}`);
        } else {
          // Don't warn for ollama as it might not need a key
          if (provider !== 'ollama') {
            logger.debug(
              `Environment variable ${envVar} not set for ${provider}.`
            );
          }
        }
      }
    }
    // Log loaded keys for verification (optional, might expose keys in logs)
    // logger.debug('Loaded API keys:', this.apiKeys);
  }

  /**
   * Retrieves the appropriate API key for a given provider.
   */
  public getApiKeyForProvider(provider: string): string | undefined {
    const key = this.apiKeys[provider as keyof ApiKeys];
    if (!key && provider !== 'ollama') {
      logger.warn(`API key for provider ${provider} not found.`);
    }
    return key;
  }

  /**
   * Disables all logging by replacing logger methods with no-ops
   */
  private disableLogging(): void {
    this.originalLoggerFunctions = {
      info: logger.info,
      debug: logger.debug,
      warn: logger.warn,
      error: logger.error,
    };

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
   * Creates an agent executor based on the current mode and a specific model level.
   * @param modelLevel - The desired model tier ('fast', 'smart', 'cheap'). Defaults to 'smart'.
   */
  public async createAgentReactExecutor(
    modelLevel: ModelLevel = 'smart'
  ): Promise<void> {
    logger.debug(
      `Attempting to create agent executor for model level: ${modelLevel}`
    );
    try {
      // Use model config - it MUST be available now
      if (!this.modelsConfig || !this.modelsConfig.models[modelLevel]) {
        // No fallback - throw an error if the requested level is not defined
        throw new Error(
          `Model level '${modelLevel}' not found in the provided models configuration.`
        );
      }

      const targetProvider = this.modelsConfig.models[modelLevel].provider;
      const targetModelName = this.modelsConfig.models[modelLevel].model_name;
      logger.info(
        `Using model level '${modelLevel}': ${targetProvider}/${targetModelName}`
      );

      // Get the correct API key for the target provider
      const targetApiKey = this.getApiKeyForProvider(targetProvider);

      // Ensure API key exists before creating config (unless Ollama)
      if (!targetApiKey && targetProvider !== 'ollama') {
        throw new Error(
          `Required API key for provider ${targetProvider} (level ${modelLevel}) was not found. Ensure ${targetProvider.toUpperCase()}_API_KEY is set.`
        );
      }

      // Base AiConfig definition
      const baseAiConfig: AiConfig = {
        aiModel: targetModelName,
        aiProvider: targetProvider,
        // Pass the specific key found (or undefined/empty string for ollama)
        aiProviderApiKey: targetApiKey ?? '', // Use empty string if undefined
        langchainVerbose: this.loggingOptions.langchainVerbose,
        // Access these via config if they exist, otherwise allow undefined
        maxInputTokens: (this.config as any).maxInputTokens,
        maxCompletionTokens: (this.config as any).maxCompletionTokens,
        maxTotalTokens: (this.config as any).maxTotalTokens,
      };

      // Log the config object right before passing it to the agent creation functions
      logger.debug(
        'AiConfig being passed to createAgent/createAutonomousAgent:',
        baseAiConfig
      );

      // Create agent with the selected model details and the correct API key
      if (this.currentMode === 'auto') {
        // createAutonomousAgent now receives AiConfig containing the correct key
        const autonomousAgentResult = await createAutonomousAgent(
          this,
          baseAiConfig
        );
        this.agentReactExecutor = autonomousAgentResult.agent; // Correctly assign the agent executor
      } else if (this.currentMode === 'agent') {
        // createAgent now receives AiConfig containing the correct key
        this.agentReactExecutor = await createAgent(this, baseAiConfig);
      }

      this.applyLoggerVerbosityToExecutor();
    } catch (error) {
      logger.error(`Failed to create agent executor: ${error}`);
      throw error;
    }
  }

  /**
   * Applies the logging verbosity setting to the executor if it exists
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
   * Validates the configuration provided
   * @param config - Configuration to validate
   */
  private validateConfig(config: StarknetAgentConfig): void {
    if (!config) {
      throw new Error('Configuration object is required');
    }
    if (!config.provider) {
      throw new Error('Starknet Provider is required in config');
    }
    if (!config.accountPrivateKey) {
      throw new Error('STARKNET_PRIVATE_KEY is required');
    }
    if (!config.accountPublicKey) {
      throw new Error('STARKNET_PUBLIC_ADDRESS is required');
    }
    if (
      !config.modelsConfig ||
      !config.modelsConfig.models ||
      Object.keys(config.modelsConfig.models).length === 0
    ) {
      throw new Error(
        'Valid modelsConfig (with defined models) is required in config'
      );
    }
    // Validate that required model levels exist in the provided config
    if (!config.modelsConfig.models.smart) {
      throw new Error(
        "modelsConfig must define a model for the 'smart' level."
      );
    }
    // Add checks for 'fast' and 'cheap' if they are strictly required
    // if (!config.modelsConfig.models.fast) { ... }
    // if (!config.modelsConfig.models.cheap) { ... }

    // Remove checks for aiProvider and aiModel
    // if (!config.aiProvider) { ... }
    // if (!config.aiModel) { ... }

    // The check for API keys is now effectively done within createAgentReactExecutor
    // when a specific model level is chosen.
    // The initial primary key check in loadApiKeys is optional.
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

      const result = await rootDatabase.createDatabase(databaseName);
      if (!result) {
        throw new Error('Error when trying to create your Postgres database');
      }

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
   * Gets the AI model credentials (returns info for the 'smart' level)
   */
  public getModelCredentials() {
    // Return credentials for the 'smart' model as a default/primary representation
    const smartModelInfo = this.modelsConfig?.models?.smart;
    if (!smartModelInfo) {
      throw new Error("'smart' model configuration not found.");
    }

    const apiKey = this.getApiKeyForProvider(smartModelInfo.provider);
    if (!apiKey && smartModelInfo.provider !== 'ollama') {
      // Attempt to get primary API key if specific one not found
      const primaryKey = this.config.aiProviderApiKey || this.apiKeys.openai || this.apiKeys.anthropic || this.apiKeys.gemini || this.apiKeys.deepseek;
      if (!primaryKey) {
        throw new Error(`API key for provider ${smartModelInfo.provider} not found and no primary key available.`);
      }
       logger.warn(`API key for provider ${smartModelInfo.provider} not found. Using primary key.`);
       return {
        aiModel: smartModelInfo.model_name,
        aiProvider: smartModelInfo.provider,
        aiProviderApiKey: primaryKey,
      };
    }

    return {
      aiModel: smartModelInfo.model_name,
      aiProvider: smartModelInfo.provider,
      aiProviderApiKey: apiKey || '',
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
   * Gets the agent configuration (JSON part)
   */
  public getAgentConfig(): JsonConfig | undefined {
    return this.agentconfig;
  }

  /**
   * Gets the models configuration object
   */
  public getModelsConfig(): ModelsConfig {
    return this.modelsConfig;
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
   * Executes a request in agent mode using the default ('smart') executor.
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
      // Executor should have been created with 'smart' level by default in constructor or start.ts
      if (!this.agentReactExecutor) {
        // Attempt to create it if somehow missing
        logger.warn(
          'Agent executor not initialized. Attempting to create default (smart) executor...'
        );
        await this.createAgentReactExecutor('smart'); // Uses 'smart' by default
        if (!this.agentReactExecutor) {
          throw new Error('Failed to initialize agent executor on demand');
        }
      }

      // Log which model is being used to process this request
      if (this.modelsConfig && this.modelsConfig.models.smart) {
        const modelInfo = this.modelsConfig.models.smart;
        logger.debug(
          `Executing request with model level: 'smart', Provider: ${modelInfo.provider}, Model: ${modelInfo.model_name}`
        );
      } else {
        logger.debug('Executing request with unknown model (smart level)');
      }

      const humanMessage = new HumanMessage(input);
      const threadId = this.agentconfig?.chat_id || 'default_thread';

      const result = await this.agentReactExecutor.invoke(
        {
          messages: [humanMessage],
        },
        {
          recursionLimit: 15,
          configurable: { thread_id: threadId },
        }
      );

      if (!result.messages || result.messages.length === 0) {
        return '';
      }

      const lastMessage = result.messages[result.messages.length - 1];
      return lastMessage.content;
    } catch (error) {
      logger.error(`Error during agent execution: ${error}`);
      throw error;
    }
  }

  /**
   * Executes a request using a specific model level by creating a temporary agent executor.
   * @param input - Input to execute
   * @param modelLevel - The desired model tier ('fast', 'smart', 'cheap').
   * @returns Result of the execution
   */
  public async executeWithLevel(
    input: string,
    modelLevel: ModelLevel
  ): Promise<unknown> {
    logger.debug(`Executing request with explicit model level: ${modelLevel}`);
    // Check if the level exists in the loaded config
    if (!this.modelsConfig || !this.modelsConfig.models[modelLevel]) {
      logger.error(
        `Model level '${modelLevel}' not found in loaded config. Cannot execute with level.`
      );
      throw new Error(
        `Invalid or unavailable model level in configuration: ${modelLevel}`
      );
    }

    try {
      const targetProvider = this.modelsConfig.models[modelLevel].provider;
      const targetModelName = this.modelsConfig.models[modelLevel].model_name;
      logger.debug(
        `Resolved model for level '${modelLevel}': ${targetProvider}/${targetModelName}`
      );
      logger.debug(
        `Using specific model level: '${modelLevel}', Provider: ${targetProvider}, Model: ${targetModelName}`
      );

      const targetApiKey = this.getApiKeyForProvider(targetProvider);

      // Check if the required API key was found
      if (!targetApiKey && targetProvider !== 'ollama') {
        throw new Error(
          `API key for provider ${targetProvider} (level ${modelLevel}) is missing. Ensure ${targetProvider.toUpperCase()}_API_KEY is set.`
        );
      }

      // Define AiConfig for the temporary agent executor
      const tempAiConfig: AiConfig = {
        aiModel: targetModelName,
        aiProvider: targetProvider,
        aiProviderApiKey: targetApiKey ?? '', // Use empty string if undefined
        langchainVerbose: this.loggingOptions.langchainVerbose,
        maxInputTokens: (this.config as any).maxInputTokens,
        maxCompletionTokens: (this.config as any).maxCompletionTokens,
        maxTotalTokens: (this.config as any).maxTotalTokens,
      };

      let tempAgentExecutor: any;
      // Create a temporary standard agent executor regardless of the main mode
      // executeWithLevel implies a single, non-autonomous run.
      logger.debug(
        `Creating temporary agent executor for level ${modelLevel}...`
      );
      // Use the createAgent function, passing the temporary config
      tempAgentExecutor = await createAgent(this, tempAiConfig);

      if (!tempAgentExecutor) {
        throw new Error(
          `Failed to create temporary agent executor for level ${modelLevel}`
        );
      }

      const humanMessage = new HumanMessage(input);
      // Use a unique thread ID for temporary executions
      const threadId = `${this.agentconfig?.chat_id || 'temp'}_${modelLevel}_${Date.now()}`;

      const result = await tempAgentExecutor.invoke(
        {
          messages: [humanMessage],
        },
        {
          recursionLimit: 15,
          configurable: { thread_id: threadId },
        }
      );

      if (!result.messages || result.messages.length === 0) {
        return '';
      }

      const lastMessage = result.messages[result.messages.length - 1];
      return lastMessage.content;
    } catch (error) {
      logger.error(`Error during execution with level ${modelLevel}: ${error}`);
      throw error;
    }
  }

  /**
   * Executes in autonomous mode continuously using the default ('smart') level executor
   * @returns Result if execution fails
   */
  public async execute_autonomous(): Promise<unknown> {
    try {
      this.validateAutonomousMode(); // Ensures mode is 'auto' and executor exists

      // Executor should already be initialized with 'smart' level from start.ts
      if (!this.agentReactExecutor) {
        // This case should ideally not be reached if start.ts succeeded
        logger.error(
          'Autonomous mode started but agent executor is missing. Attempting recovery...'
        );
        await this.createAgentReactExecutor('smart'); // Try creating the default
        if (!this.agentReactExecutor) {
          throw new Error(
            'Critical error: Failed to initialize agent executor for autonomous mode.'
          );
        }
      }

      // Log the model being used for autonomous execution
      if (this.modelsConfig && this.modelsConfig.models.smart) {
        const modelInfo = this.modelsConfig.models.smart;
        logger.info(
          `Starting autonomous execution with model level: 'smart', Provider: ${modelInfo.provider}, Model: ${modelInfo.model_name}`
        );
      } else {
        logger.info(
          'Starting autonomous execution with unknown model (smart level)'
        );
      }

      let iterationCount = 0;
      let consecutiveErrorCount = 0;
      let tokensErrorCount = 0;

      const lastErrors = new Set<string>();
      const addError = (error: string) => {
        lastErrors.add(error);
        if (lastErrors.size > 3) {
          const iterator = lastErrors.values();
          lastErrors.delete(iterator.next().value);
        }
      };

      while (true) {
        iterationCount++;

        try {
          consecutiveErrorCount = 0;
          if (tokensErrorCount > 0) {
            tokensErrorCount--;
          }

          // Periodic refresh now always uses the 'smart' level defined in modelsConfig
          await this.handlePeriodicAgentRefresh(
            iterationCount,
            tokensErrorCount
          );

          if (!this.agentReactExecutor) {
            logger.error(
              'Agent executor missing during autonomous loop. Attempting recovery...'
            );
            await this.createAgentReactExecutor();
            if (!this.agentReactExecutor) {
              throw new Error(
                'Critical error: Agent executor recovery failed during autonomous loop.'
              );
            }
            logger.info('Agent executor recovered.');
          }

          const promptMessage = this.getAdaptivePromptMessage(tokensErrorCount);
          // Get the config associated with the current executor - this might be less relevant
          // if the executor holds the compiled graph which manages internal state.
          // const agentConfigForInvoke = (this.agentReactExecutor as any).agentConfig || {}; // May need adjustment

          // Invoke the agent executor (which contains the graph with the monitor node)
          // The graph will internally handle monitor decision and model selection.
          const result = await this.agentReactExecutor.invoke(
            { messages: [new HumanMessage(promptMessage)] },
            {
              recursionLimit: 15, // Apply recursion limit here
              configurable: {
                thread_id: this.agentconfig?.chat_id || 'autonomous_thread',
              }, // Use a consistent thread ID
              // ...agentConfigForInvoke, // Spread any other config if needed - review if still needed
            }
          );

          if (!result || !result.messages || result.messages.length === 0) {
            logger.warn(
              'Agent returned an empty or invalid response in autonomous mode, continuing to next iteration'
            );
            continue;
          }

          await this.processAgentResponse(result);
        } catch (loopError) {
          await this.handleAutonomousExecutionError(
            loopError,
            iterationCount,
            consecutiveErrorCount,
            tokensErrorCount,
            addError
          );
          consecutiveErrorCount++;
          if (this.isTokenRelatedError(loopError)) {
            tokensErrorCount += 2;
          }
        }
      }
    } catch (error) {
      logger.error(`Fatal error in autonomous execution: ${error}`);
      return error; // Return the error object itself
    }
  }

  /**
   * Validates that the current mode is set to autonomous and executor exists
   */
  private validateAutonomousMode(): void {
    if (this.currentMode !== 'auto') {
      throw new Error(
        `Need to be in autonomous mode to execute_autonomous (current mode: ${this.currentMode})`
      );
    }
    // Check if executor exists - it should have been created in start.ts
    if (!this.agentReactExecutor) {
      throw new Error(
        'Agent executor is not initialized for autonomous execution. Initialization failed earlier.'
      );
    }
  }

  /**
   * Handles periodic agent refresh to prevent context buildup.
   * Always refreshes using the agent's standard creation logic (which includes the monitor graph).
   * @param iterationCount - Current iteration number.
   * @param tokensErrorCount - Count of recent token errors.
   */
  private async handlePeriodicAgentRefresh(
    iterationCount: number,
    tokensErrorCount: number
  ): Promise<void> {
    const refreshInterval = tokensErrorCount > 0 ? 3 : 5;
    if (iterationCount > 1 && iterationCount % refreshInterval === 0) {
      logger.info(
        `Periodic agent refresh (iteration ${iterationCount}), recreating executor with standard monitor-enabled graph.`
      );

      // Log details before refresh - maybe log the default/smart model as the base config used
      if (this.modelsConfig && this.modelsConfig.models.smart) {
        const modelInfo = this.modelsConfig.models.smart;
        logger.debug(
          `Agent refresh initiated. Base config uses: 'smart', Provider: ${modelInfo.provider}, Model: ${modelInfo.model_name}. Actual model per turn decided by monitor.`
        );
      }

      // Recreate using the standard method - no specific level needed here
      await this.createAgentReactExecutor();
    }
  }

  /**
   * Gets an adaptive prompt message based on recent execution context
   */
  private getAdaptivePromptMessage(tokensErrorCount: number): string {
    if (tokensErrorCount > 0) {
      return ADAPTIVE_PROMPT_TOKEN_LIMIT;
    }

    return ADAPTIVE_PROMPT_NORMAL;
  }

  /**
   * Processes and displays the agent response
   */
  private async processAgentResponse(result: any): Promise<void> {
    const lastMessage = result.messages[result.messages.length - 1];
    const agentResponse = lastMessage.content;

    const MAX_RESPONSE_TOKENS = 20000;
    const responseString =
      typeof agentResponse === 'string'
        ? agentResponse
        : JSON.stringify(agentResponse);
    const estimatedTokens = estimateTokens(responseString);

    let formattedAgentResponse;
    if (estimatedTokens > MAX_RESPONSE_TOKENS) {
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

    const formattedContent = this.formatResponseForDisplay(
      formattedAgentResponse
    );

    const boxContent = createBox('Agent Response', formattedContent);
    const boxWithTokens = addTokenInfoToBox(boxContent);
    process.stdout.write(boxWithTokens);

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
    const baseInterval = this.agentReactExecutor.json_config?.interval || 5000;
    let interval = baseInterval;

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
   * Handles token limit errors in autonomous mode.
   * Resets using the standard agent creation logic (monitor-enabled graph).
   */
  private async handleTokenLimitError(
    consecutiveErrorCount: number,
    tokensErrorCount: number
  ): Promise<void> {
    try {
      logger.warn(
        'Token limit reached - abandoning current action without losing context'
      );
      const warningMessage = createBox(
        'Action Abandoned',
        'Current action was abandoned due to a token limit. The agent will try a different action.'
      );
      process.stdout.write(warningMessage);

      const pauseDuration = Math.min(
        5000 + consecutiveErrorCount * 1000,
        15000
      );
      await new Promise((resolve) => setTimeout(resolve, pauseDuration));

      if (consecutiveErrorCount >= 2 || tokensErrorCount >= 3) {
        logger.warn(
          "Too many token-related errors, resetting agent using standard configuration..."
        );
        // Reset using the standard method
        await this.createAgentReactExecutor();

        const resetMessage = createBox(
          'Agent Reset',
          "Due to persistent token issues, the agent executor has been reset. This may clear some intermediate context but allows execution to continue with the monitor deciding the model."
        );
        process.stdout.write(resetMessage);

        await new Promise((resolve) => setTimeout(resolve, 8000));
      }
    } catch (recreateError) {
      logger.error(`Failed to handle token limit gracefully: ${recreateError}`);
      const waitTime = consecutiveErrorCount >= 3 ? 15000 : 5000;
      await new Promise((resolve) => setTimeout(resolve, waitTime));

      if (consecutiveErrorCount >= 5) {
        try {
          // Emergency reset using standard method
          await this.createAgentReactExecutor();
          logger.warn(
            'Emergency reset performed after multiple failures'
          );
        } catch (e) {
          logger.error(
            'Emergency reset failed',
            e
          ); /* Ignore secondary error */
        }
      }
    }
  }

  /**
   * Handles general errors in autonomous mode.
   * Resets using the standard agent creation logic if too many errors occur.
   */
  private async handleGeneralError(
    consecutiveErrorCount: number
  ): Promise<void> {
    let waitTime = 3000;

    if (consecutiveErrorCount >= 5) {
      waitTime = 30000;
      logger.warn(
        `${consecutiveErrorCount} errors in a row, waiting much longer before retry...`
      );
    } else if (consecutiveErrorCount >= 3) {
      waitTime = 10000;
      logger.warn(
        `${consecutiveErrorCount} errors in a row, waiting longer before retry...`
      );
    }

    await new Promise((resolve) => setTimeout(resolve, waitTime));

    if (consecutiveErrorCount >= 7) {
      try {
        logger.warn(
          "Too many consecutive errors, attempting complete reset using standard configuration..."
        );
        // Reset using the standard method
        await this.createAgentReactExecutor();
        await new Promise((resolve) => setTimeout(resolve, 5000));
      } catch (e) {
        logger.error(
          'Emergency reset failed during general error handling',
          e
        ); /* Ignore secondary error */
      }
    }
  }

  /**
   * Executes a call data (signature mode) request in agent mode.
   * Uses the default ('smart') executor.
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

      // Executor should exist, created with 'smart' level
      if (!this.agentReactExecutor) {
        // This should not happen if initialization was successful
        throw new Error(
          'Agent executor is not initialized for execute_call_data'
        );
      }

      // Log which model is being used for call data processing
      if (this.modelsConfig && this.modelsConfig.models.smart) {
        const modelInfo = this.modelsConfig.models.smart;
        logger.debug(
          `Processing call data with model level: 'smart', Provider: ${modelInfo.provider}, Model: ${modelInfo.model_name}`
        );
      } else {
        logger.debug('Processing call data with unknown model (smart level)');
      }

      // Invoke the default ('smart') executor
      const aiMessage = await this.agentReactExecutor.invoke(
        {
          messages: [new HumanMessage(input)], // Pass input as HumanMessage
        },
        {
          configurable: {
            thread_id: this.agentconfig?.chat_id || 'calldata_thread',
          }, // Use a specific thread_id if needed
        }
      );

      try {
        // Assuming the relevant content is in the last message
        if (!aiMessage.messages || aiMessage.messages.length === 0) {
          throw new Error('No messages returned from call data execution');
        }
        const lastMessage = aiMessage.messages[aiMessage.messages.length - 1];
        const messageContent = lastMessage.content;

        // Try parsing if it looks like JSON, otherwise return as string
        if (
          typeof messageContent === 'string' &&
          messageContent.trim().startsWith('{') &&
          messageContent.trim().endsWith('}')
        ) {
          return JSON.parse(messageContent);
        }
        return messageContent; // Return content directly if not JSON
      } catch (parseError) {
        logger.error(`Failed to parse call_data response: ${parseError}`);
        // Return the raw content if parsing fails but content exists
        const rawContent =
          aiMessage?.messages?.[aiMessage.messages.length - 1]?.content;
        return {
          status: 'failure',
          error: `Failed to parse observation: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
          raw_content: rawContent ?? 'No content returned',
        };
      }
    } catch (error) {
      logger.error(`Error during execute_call_data: ${error}`);
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
    // Keep track of previous state to log changes
    const wasDisabled = this.loggingOptions.disabled;
    const prevVerbose = this.loggingOptions.langchainVerbose;
    const prevTokenLogging = this.loggingOptions.tokenLogging;

    // Update options
    this.loggingOptions = { ...this.loggingOptions, ...options };

    // Handle enabling/disabling of logging
    if (options.disabled === true && !wasDisabled) {
      // Log before disabling
      logger.info('Logging is being disabled');
      this.disableLogging();
      return;
    } else if (options.disabled === false && wasDisabled) {
      this.enableLogging();
      logger.info('Logging has been enabled');
    }

    // Apply verbosity settings to executor if it exists
    if (!this.loggingOptions.disabled && this.agentReactExecutor) {
      this.applyLoggerVerbosityToExecutor();
    }

    // Log the new settings
    if (!this.loggingOptions.disabled) {
      logger.debug(
        `Logging options set - langchainVerbose: ${this.loggingOptions.langchainVerbose}, tokenLogging: ${this.loggingOptions.tokenLogging}`
      );
    }
  }

  /**
   * Executes a request with the appropriate model level based on tools count
   * @param input - Input to execute
   * @returns Result of the execution
   */
  public async executeWithAdaptiveModel(input: string): Promise<unknown> {
    if (this.currentMode !== 'agent') {
      throw new Error(
        `Need to be in agent mode to execute with adaptive model (current mode: ${this.currentMode})`
      );
    }

    try {
      // First, determine which model should be used based on tools count
      const { toolsList } = await this.createToolSelectionExecutor(true);
      
      logger.info(`Executing with ${toolsList.length} tools`);
      
      // Now execute with the selected model level
      return this.executeWithLevel(input, 'smart');
    } catch (error) {
      logger.error(`Error during adaptive model execution: ${error}`);
      
      // Fall back to smart model if there's an error
      logger.warn(`Falling back to 'smart' model due to error`);
      return this.execute(input);  // Use default smart executor
    }
  }
  
  /**
   * Sets the tool model selection strategy
   * @param useAdaptiveStrategy - Whether to use adaptive strategy based on tool count
   */
  public setToolModelStrategy(useAdaptiveStrategy: boolean): void {
    this.toolsModelStrategy = useAdaptiveStrategy ? 'adaptive' : 'fixed';
    logger.info(`Set tool model strategy to: ${this.toolsModelStrategy}`);
  }

  /**
   * Invokes the Monitor Agent to decide the model level for the next step.
   * @param history - Recent conversation history.
   * @param currentInput - The latest user input or agent task.
   * @returns The decided ModelLevel ('fast', 'smart', 'cheap').
   */
  public async invokeMonitorAgent(history: BaseMessage[], currentInput: string): Promise<ModelLevel> {
      if (!this.monitorModel) {
          logger.warn("Monitor model not available, defaulting to 'smart' level.");
          return 'smart';
      }

      try {
          const historyLimit = 10; // Limit history length for monitor prompt
          const recentHistory = history.slice(-historyLimit);

          // Simple string representation of history
          const historyStr = recentHistory.map(msg => {
              const prefix = msg instanceof HumanMessage ? 'Human:' : msg instanceof AIMessage ? 'AI:' : 'System:';
              const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
              return `${prefix} ${content}`;
          }).join('\n');

          const prompt = formatMonitorPrompt(historyStr, currentInput);

          logger.debug('Invoking Monitor Agent...');
          // Use invoke with a string prompt for simplicity here
          const response = await this.monitorModel.invoke(prompt);

          const responseText = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
          logger.debug(`Monitor Agent response: ${responseText}`);

          return parseMonitorResponse(responseText);

      } catch (error) {
          logger.error(`Error invoking Monitor Agent: ${error}. Defaulting to 'smart'.`);
          return 'smart';
      }
  }
}
