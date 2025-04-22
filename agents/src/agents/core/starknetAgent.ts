import { AiConfig, IAgent } from '../../common/index.js';
import { createAgent } from '../interactive/agent.js';
import { RpcProvider } from 'starknet';
import { createAutonomousAgent } from '../autonomous/autonomousAgents.js';
import { JsonConfig } from '../../config/jsonConfig.js';
import { HumanMessage } from '@langchain/core/messages';
import {
  logger,
  loadModelsConfig,
  ModelsConfig,
  ApiKeys,
  ModelLevelConfig,
  metrics,
} from '@snakagent/core';
import { createBox } from '../../prompt/formatting.js';
import {
  addTokenInfoToBox,
  truncateToTokenLimit,
  estimateTokens,
} from '../../token/tokenTracking.js';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ModelSelectionAgent } from './modelSelectionAgent.js';

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
  modelsConfigPath: string;
  provider: RpcProvider;
  accountPublicKey: string;
  accountPrivateKey: string;
  aiModel?: string; // Optional for backward compatibility
  aiProvider?: string; // Optional for backward compatibility
  aiProviderApiKey?: string; // Optional for backward compatibility
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
  modelSelectionDebug?: boolean;
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
  private modelsConfig!: ModelsConfig;
  private apiKeys: ApiKeys = {};
  private models: Record<string, BaseChatModel> = {};
  private modelSelector: ModelSelectionAgent | null = null;
  private agentReactExecutor: any;
  private currentMode: string;
  private loggingOptions: LoggingOptions = {
    langchainVerbose: true,
    tokenLogging: true,
    disabled: false,
    modelSelectionDebug: false,
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

    try {
      // Basic validation checks (e.g., for config, accountPrivateKey, modelsConfigPath)
      if (!config) {
        throw new Error('Configuration object is required');
      }
      if (!config.accountPrivateKey) {
        throw new Error('STARKNET_PRIVATE_KEY is required');
      }
      if (!config.modelsConfigPath) {
        throw new Error('modelsConfigPath is required in the configuration');
      }

      this.provider = config.provider;
      this.accountPrivateKey = config.accountPrivateKey;
      this.accountPublicKey = config.accountPublicKey;
      this.signature = config.signature;
      this.agentMode = config.agentMode;
      this.currentMode =
        config.agentMode === 'auto' ||
        config.agentconfig?.mode?.autonomous === true
          ? 'auto'
          : config.agentMode || 'agent';
      this.agentconfig = config.agentconfig;
      this.memory = config.memory || {};

      // Load API Keys synchronously
      this.loadApiKeys();

      metrics.metricsAgentConnect(
        config.agentconfig?.name ?? 'agent',
        config.agentMode
      );
    } catch (error) {
      logger.error(`StarknetAgent constructor failed: ${error}`);
      throw error;
    }
  }

  /**
   * Asynchronously initializes the agent, loading configurations and models.
   * This method must be called after the constructor.
   */
  public async init(): Promise<void> {
    try {
      logger.info('Initializing StarknetAgent...');
      this.modelsConfig = await loadModelsConfig(this.config.modelsConfigPath);
      this.initializeModels();
      // Initialize model selector after models are available
      this.initializeModelSelector();
      // Perform validation AFTER models are initialized
      this.validateConfigPostInit();
      logger.info('StarknetAgent initialized successfully.');
    } catch (error) {
      logger.error(`StarknetAgent initialization failed: ${error}`);
      throw error;
    }
  }

  /**
   * Initializes the ModelSelectionAgent for intelligent model routing
   */
  private initializeModelSelector(): void {
    logger.debug('Initializing ModelSelectionAgent...');
    if (Object.keys(this.models).length === 0) {
      logger.error(
        'Cannot initialize ModelSelectionAgent: no models available'
      );
      return;
    }

    // Check if metaSelection is enabled in the agent config
    // DEBUGGING - Force enable meta-selection to test functionality
    const metaSelectionFromConfig =
      this.agentconfig?.mode?.metaSelection === true;
    const useMetaSelection = true; // Force true for debugging

    // Add detailed debugging info
    logger.debug(`Agent config: ${JSON.stringify(this.agentconfig, null, 2)}`);
    logger.debug(
      `Mode config from agent.json: ${JSON.stringify(this.agentconfig?.mode)}`
    );
    logger.debug(
      `Meta-selection from config: ${metaSelectionFromConfig} (Forced to ${useMetaSelection} for debugging)`
    );

    this.modelSelector = new ModelSelectionAgent(this.models, {
      debugMode: true, // Force debug mode on
      useMetaSelection: useMetaSelection,
    });

    // Explicitly verify what was passed to ModelSelectionAgent
    logger.debug(
      `ModelSelector options passed: debugMode=true, useMetaSelection=${useMetaSelection}`
    );

    logger.debug(
      `ModelSelectionAgent initialized successfully (Meta selection: ${useMetaSelection ? 'enabled' : 'disabled'})`
    );
  }

  /**
   * Gets the appropriate model for a task based on messages
   * @param messages - The messages to analyze for model selection
   * @param forceModelType - Optional model type to force using
   * @returns The selected model
   */
  public async getModelForTask(
    messages: any[],
    forceModelType?: string
  ): Promise<BaseChatModel> {
    if (!this.modelSelector) {
      logger.warn(
        'ModelSelectionAgent not initialized, defaulting to smart model'
      );
      return this.models.smart || Object.values(this.models)[0];
    }

    if (forceModelType && this.models[forceModelType]) {
      if (this.loggingOptions.modelSelectionDebug) {
        logger.debug(`Forced model selection: ${forceModelType}`);
      }
      return this.models[forceModelType];
    }

    return this.modelSelector.getModelForTask(messages);
  }

  /**
   * Invokes an AI model with the appropriate selection logic
   * @param messages - The messages to process
   * @param forceModelType - Optional model type to force using
   * @returns The model response
   */
  public async invokeModel(
    messages: any[],
    forceModelType?: string
  ): Promise<any> {
    if (!this.modelSelector) {
      logger.warn(
        'ModelSelectionAgent not initialized, defaulting to smart model'
      );
      return this.models.smart.invoke(messages);
    }

    return this.modelSelector.invokeModel(messages, forceModelType);
  }

  /**
   * Disables all logging by replacing logger methods with no-ops
   */
  private disableLogging(): void {
    // Store the original methods if we haven't already
    if (!this.originalLoggerFunctions.info) {
      this.originalLoggerFunctions = {
        info: logger.info,
        debug: logger.debug,
        warn: logger.warn,
        error: logger.error,
      };
    }

    // Replace with no-op functions that respect the logger method signature
    const noop = (message: any, ...meta: any[]): any => logger;
    logger.info = noop;
    logger.debug = noop;
    logger.warn = noop;
    logger.error = noop;

    this.loggingOptions.disabled = true;
    console.log('Logging has been disabled');
  }

  /**
   * Restores original logging functions
   */
  public enableLogging(): void {
    // Only restore if we have the original functions saved
    if (!this.originalLoggerFunctions.info) {
      console.log('No original logger functions to restore');
      return;
    }

    // Restore original functions
    logger.info = this.originalLoggerFunctions.info;
    logger.debug = this.originalLoggerFunctions.debug;
    logger.warn = this.originalLoggerFunctions.warn;
    logger.error = this.originalLoggerFunctions.error;

    this.loggingOptions.disabled = false;
    console.log('Logging has been enabled');
    logger.debug('Logger functions restored');
  }

  /**
   * Loads API keys from environment variables.
   */
  private loadApiKeys(): void {
    logger.debug('Loading API keys from environment variables...');
    const PROVIDER_ENV_VAR_MAP: Record<string, string> = {
      openai: 'OPENAI_API_KEY',
      anthropic: 'ANTHROPIC_API_KEY',
      gemini: 'GOOGLE_API_KEY', // Or GEMINI_API_KEY, adjust as needed
      deepseek: 'DEEPSEEK_API_KEY',
      // Add other providers here
    };

    this.apiKeys = {}; // Reset keys
    for (const [provider, envVar] of Object.entries(PROVIDER_ENV_VAR_MAP)) {
      const apiKey = process.env[envVar];
      if (apiKey) {
        this.apiKeys[provider] = apiKey;
        logger.debug(`Loaded API key for provider: ${provider}`);
      } else {
        logger.warn(
          `API key environment variable not found for provider: ${provider} (expected: ${envVar})`
        );
      }
    }
    logger.debug('Finished loading API keys.');
  }

  /**
   * Initializes chat model instances based on the loaded configuration.
   */
  private initializeModels(): void {
    logger.debug('Initializing AI models...');
    if (!this.modelsConfig) {
      logger.error(
        'Models configuration is not loaded. Cannot initialize models.'
      );
      throw new Error('Models configuration is not loaded.');
    }

    this.models = {}; // Reset models
    for (const [levelName, levelConfigUntyped] of Object.entries(
      this.modelsConfig
    )) {
      const levelConfig = levelConfigUntyped as ModelLevelConfig; // Cast to correct type
      const { provider, model_name } = levelConfig;
      const apiKey = this.apiKeys[provider];

      if (!apiKey) {
        logger.warn(
          `API key for provider '${provider}' not found. Skipping initialization for model level '${levelName}'.`
        );
        continue;
      }

      try {
        let modelInstance: BaseChatModel | null = null;
        const commonConfig = {
          modelName: model_name,
          apiKey: apiKey,
          verbose: this.loggingOptions.langchainVerbose,
          // Add other common config like temperature if needed
        };

        switch (provider.toLowerCase()) {
          case 'openai':
            modelInstance = new ChatOpenAI(commonConfig);
            break;
          case 'anthropic':
            modelInstance = new ChatAnthropic(commonConfig);
            break;
          case 'gemini':
            // Note: Gemini might use `googleApiKey` or a different config structure
            modelInstance = new ChatGoogleGenerativeAI({
              ...commonConfig,
              apiKey: apiKey, // Ensure correct property name
            });
            break;
          // Add cases for 'deepseek' and other providers
          default:
            logger.warn(
              `Unsupported AI provider '${provider}' for model level '${levelName}'. Skipping.`
            );
            continue; // Skip unsupported providers
        }

        if (modelInstance) {
          this.models[levelName] = modelInstance;
          logger.info(
            `Initialized model for level '${levelName}': ${provider} - ${model_name}`
          );
        }
      } catch (error) {
        logger.error(
          `Failed to initialize model for level '${levelName}' (${provider} - ${model_name}): ${error}`
        );
        // Decide if we should throw or just log and continue
      }
    }
    logger.debug('Finished initializing AI models.');

    // Validate that essential models were loaded
    if (!this.models.fast || !this.models.smart || !this.models.cheap) {
      logger.error(
        'One or more essential model levels (fast, smart, cheap) failed to initialize. Check API keys and configuration.'
      );
      // Potentially throw an error here if these are critical
      // throw new Error('Essential model levels failed to initialize.');
    }
  }

  /**
   * Creates an agent executor based on the current mode
   */
  public async createAgentReactExecutor(): Promise<void> {
    try {
      const smartModelConfig = this.modelsConfig?.['smart'];
      if (!smartModelConfig) {
        throw new Error(
          "The 'smart' model configuration is not loaded. Cannot create agent executor."
        );
      }
      const smartApiKey = this.apiKeys[smartModelConfig.provider];
      if (!smartApiKey) {
        throw new Error(
          `API key for the 'smart' model provider (${smartModelConfig.provider}) is missing.`
        );
      }

      // TEMPORARY FIX: Create the old AiConfig structure for compatibility.
      // TODO: Update createAgent and createAutonomousAgent to accept BaseChatModel directly.
      const tempAiConfig: AiConfig = {
        aiModel: smartModelConfig.model_name,
        aiProvider: smartModelConfig.provider,
        aiProviderApiKey: smartApiKey,
        langchainVerbose: this.loggingOptions.langchainVerbose,
        // Add ModelSelectionAgent reference for agent creation
        modelSelector: this.modelSelector,
      };

      if (this.currentMode === 'auto') {
        this.agentReactExecutor = await createAutonomousAgent(
          this,
          tempAiConfig
        );
      } else if (this.currentMode === 'agent') {
        this.agentReactExecutor = await createAgent(this, tempAiConfig);
      }

      this.applyLoggerVerbosityToExecutor();
    } catch (error) {
      logger.error(`Failed to create Agent React Executor: ${error}`);
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
   * Validates the configuration *after* asynchronous initialization.
   */
  private validateConfigPostInit(): void {
    logger.debug('Performing post-initialization validation...');
    if (!this.modelsConfig) {
      throw new Error(
        'Models configuration was not loaded during initialization.'
      );
    }
    if (Object.keys(this.models).length === 0) {
      throw new Error(
        'No models were initialized. Check configuration and API keys.'
      );
    }
    // Example: Ensure essential models are loaded
    if (!this.models.fast || !this.models.smart || !this.models.cheap) {
      logger.error(
        'One or more essential model levels (fast, smart, cheap) failed to initialize. Check API keys and configuration.'
      );
      // Decide whether to throw an error based on requirements
      // throw new Error('Essential model levels failed to initialize.');
    }
    logger.debug('Post-initialization validation complete.');
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

      // Create human message from input
      const humanMessage = new HumanMessage(input);

      // Get model selection if ModelSelectionAgent is available
      let selectedModel: BaseChatModel | undefined;
      let modelType: string | undefined;
      if (this.modelSelector) {
        // Get the model type first
        modelType = await this.modelSelector.selectModelForMessages([
          humanMessage,
        ]);
        if (this.loggingOptions.modelSelectionDebug) {
          logger.debug(`Model Selection for request: ${modelType}`);
        }

        // Get the model instance based on the already determined type
        if (modelType && this.models[modelType]) {
          selectedModel = this.models[modelType];
        } else {
          // Fall back to smart model if the selected model is not available
          selectedModel = this.models.smart;
          if (modelType && !this.models[modelType]) {
            logger.warn(
              `Selected model "${modelType}" not available, falling back to "smart"`
            );
          }
        }
      }

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

      let result;

      // If a model was selected by the ModelSelectionAgent, use it directly
      if (selectedModel) {
        logger.debug('Using model selected by ModelSelectionAgent');
        result = await selectedModel.invoke([humanMessage]);
      } else {
        // Fall back to using the agentReactExecutor if no model selection
        logger.debug('Using default agentReactExecutor (no model selection)');
        result = await this.agentReactExecutor.invoke(
          {
            messages: [humanMessage],
          },
          invokeOptions
        );
      }

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
      // If recent token errors, specifically request simpler actions and reference history/objectives
      return 'Recent actions caused token limit issues. Based on your objectives and the conversation history, prioritize a simple, low-context action now. Proceed without asking for permission.';
    }

    // Standard prompt referencing objectives and history
    return 'Based on your objectives and the recent conversation history, determine the next best action to take. Proceed without asking for permission.';
  }

  /**
   * Logs model selection information for a message if debug is enabled
   * @param message - The message to analyze
   */
  private logModelSelection(message: string): void {
    if (!this.modelSelector || !this.loggingOptions.modelSelectionDebug) {
      return;
    }

    const dummyMessage = new HumanMessage(message);
    const modelType = this.modelSelector.selectModelForMessages([dummyMessage]);
    logger.debug(`Model Selection for autonomous message: ${modelType}`);
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

          // Log model selection if debug is enabled
          this.logModelSelection(promptMessage);

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
    const rawAgentResponse = lastMessage.content; // Get the raw response first

    // If the message contains tools and large results, it may need to be truncated
    // Limit of 20,000 tokens to avoid expensive requests during the next iteration
    const MAX_RESPONSE_TOKENS = 20000;
    const responseString =
      typeof rawAgentResponse === 'string'
        ? rawAgentResponse
        : JSON.stringify(rawAgentResponse);
    const estimatedTokens = estimateTokens(responseString);

    logger.debug(
      `Processing agent response: estimatedTokens=${estimatedTokens}, maxLimit=${MAX_RESPONSE_TOKENS}`
    );

    let processedResponseString;
    if (estimatedTokens > MAX_RESPONSE_TOKENS) {
      // Truncate the response to respect the token limit
      logger.warn(
        `Response exceeds token limit: ${estimatedTokens} > ${MAX_RESPONSE_TOKENS}. Truncating...`
      );
      processedResponseString = truncateToTokenLimit(
        responseString,
        MAX_RESPONSE_TOKENS
      );
      logger.debug(`Response truncated to fit token limit`);
    } else {
      processedResponseString = responseString;
    }

    // --- Splitting Logic ---
    let mainResponse = processedResponseString;
    let nextStepsContent: string | null = null;
    const nextStepsMarkerRegex = /NEXT STEPS:|NEXT\\s+STEPS:\\s*/i;
    const parts = processedResponseString.split(nextStepsMarkerRegex);

    if (parts.length > 1) {
      mainResponse = parts[0].trim();
      nextStepsContent = parts[1].trim();
    }
    // --- End Splitting Logic ---

    // Check if modelSelector should be informed about the response complexity (use original if possible)
    if (this.modelSelector && typeof responseString === 'string') {
      // Analyze original untruncated response for better model selection decision
      this.analyzeResponseForModelSelection(responseString);
    }

    // Display the main response
    const mainFormattedContent = this.formatResponseForDisplay(mainResponse);
    const mainBoxContent = createBox('Agent Response', mainFormattedContent);
    const mainBoxWithTokens = addTokenInfoToBox(mainBoxContent); // Attach tokens here
    process.stdout.write(mainBoxWithTokens);

    // Display the next steps box if content exists
    if (nextStepsContent && nextStepsContent.length > 0) {
      const nextStepsFormattedContent =
        this.formatResponseForDisplay(nextStepsContent);
      const nextStepsBoxContent = createBox(
        'Agent Next Steps',
        nextStepsFormattedContent
      );
      process.stdout.write(nextStepsBoxContent); // No token info needed here
    }

    // Wait for an adaptive interval based on the complexity of the last response
    await this.waitAdaptiveInterval(estimatedTokens, MAX_RESPONSE_TOKENS);
  }

  /**
   * Analyzes the agent response to inform model selection
   * @param response - The agent response string
   */
  private analyzeResponseForModelSelection(response: string): void {
    // Check if modelSelector exists
    if (!this.modelSelector) {
      return;
    }

    // Extract NEXT STEPS section if present
    const nextStepsMatch = response.match(/NEXT STEPS:(.*?)($|(?=\n\n))/s);
    if (nextStepsMatch && nextStepsMatch[1]) {
      const nextStepsContent = nextStepsMatch[1].trim();

      if (this.loggingOptions.modelSelectionDebug) {
        logger.debug(
          `Found NEXT STEPS section for model selection: "${nextStepsContent}"`
        );
      }

      // Create a dummy message with the next steps for model selection analysis
      // This helps the model selector understand the upcoming complexity
      const dummyMessage = new HumanMessage(
        `Next planned action: ${nextStepsContent}`
      );
      this.modelSelector
        .selectModelForMessages([dummyMessage])
        .then((modelType) => {
          if (this.loggingOptions.modelSelectionDebug) {
            logger.debug(`Model selected for next steps: ${modelType}`);
          }
        })
        .catch((error) => {
          logger.debug(
            `Error analyzing next steps for model selection: ${error}`
          );
        });
    }
  }

  /**
   * Formats the agent response for display
   */
  private formatResponseForDisplay(response: string | any): string | any {
    if (typeof response !== 'string') {
      return response;
    }

    // Only format bullet points, remove NEXT STEPS specific formatting as it's handled by splitting
    const lines = response.split('\n');
    const formattedLines = lines.map((line: string) => {
      // Format bullet points
      if (line.includes('•')) {
        return `  ${line.trim()}`;
      }
      // Removed NEXT STEPS highlighting logic
      return line;
    });

    // Join lines back, ensuring consistent line breaks
    return formattedLines.join('\n');
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
    // Apply options
    this.loggingOptions = { ...this.loggingOptions, ...options };

    if (options.disabled === true && !this.loggingOptions.disabled) {
      this.disableLogging();
      return;
    } else if (options.disabled === false && this.loggingOptions.disabled) {
      this.enableLogging();
    }

    // Update model selector debug mode if it exists and the option has changed
    if (this.modelSelector && options.modelSelectionDebug !== undefined) {
      // Preserve the metaSelection setting from agent config
      const useMetaSelection = this.agentconfig?.mode?.metaSelection === true;

      this.modelSelector = new ModelSelectionAgent(this.models, {
        debugMode: this.loggingOptions.modelSelectionDebug,
        useMetaSelection: useMetaSelection,
      });
      logger.debug(
        `Updated ModelSelectionAgent: debug mode=${this.loggingOptions.modelSelectionDebug}, meta selection=${useMetaSelection}`
      );
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

  /**
   * @deprecated This method is deprecated and returns dummy data.
   * Use direct model access via `this.models` instead.
   */
  public getModelCredentials() {
    logger.warn(
      'getModelCredentials() is deprecated and should not be relied upon.'
    );
    // Return dummy data or throw an error to discourage use
    return {
      aiModel: 'deprecated',
      aiProviderApiKey: 'deprecated',
      // Consider adding a reference to the new models structure if possible
      // models: this.models // Maybe too verbose or complex for this context
    };
  }
}
