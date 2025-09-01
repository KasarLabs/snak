import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import {
  BaseMessage,
  HumanMessage,
  SystemMessage,
} from '@langchain/core/messages';
import { logger } from '@snakagent/core';
import { AgentType, BaseAgent } from '../core/baseAgent.js';
import { ModelsConfig, ApiKeys } from '@snakagent/core';
import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { modelSelectorSystemPrompt } from '../../prompt/prompts.js';
import { TokenTracker } from '../../token/tokenTracking.js';

// CLEAN-UP Need to put in private every function who check the validity of the model selection instead of what we do now
/**
 * Criteria for model selection.
 */

export interface ModelSelectorReturn {
  model: BaseChatModel;
  model_name: string;
  token?: {
    intput_token: number;
    output_token: number;
    total_token: number;
  };
}
export interface ModelSelectionCriteria {
  complexity: 'high' | 'medium' | 'low';
  urgency: 'high' | 'medium' | 'low';
  creativeRequirement: 'high' | 'medium' | 'low';
  taskType: 'reasoning' | 'generation' | 'classification' | 'general';
}

/**
 * Options for the ModelSelector.
 */
export interface ModelSelectorConfig {
  debugMode?: boolean;
  useModelSelector?: boolean;
  modelsConfig: ModelsConfig;
}

/**
 * Represents an operator agent responsible for selecting the appropriate model for different tasks.
 */
export class ModelSelector extends BaseAgent {
  private models: Record<string, BaseChatModel> = {};
  private debugMode: boolean;
  private useModelSelector: boolean;
  private modelsConfig: ModelsConfig | null = null;
  private apiKeys: ApiKeys = {};

  private static instance: ModelSelector | null = null;

  /**
   * Creates an instance of ModelSelector.
   * @param {ModelSelectorConfig} options - The options for the agent.
   */
  constructor(options: ModelSelectorConfig) {
    super('model-selector', AgentType.OPERATOR);
    this.debugMode = options.debugMode || false;
    this.useModelSelector = options.useModelSelector || false;
    this.modelsConfig = options.modelsConfig;

    ModelSelector.instance = this;

    if (this.debugMode) {
      logger.debug(
        `ModelSelector initialized with options: ${JSON.stringify({
          debugMode: options.debugMode,
          useModelSelector: options.useModelSelector,
        })}`
      );
    }
  }

  protected getApiKey(provider: string): string | undefined {
    return this.apiKeys[provider];
  }

  protected get allApiKeys(): Readonly<ApiKeys> {
    return { ...this.apiKeys };
  }

  /**
   * Gets the singleton instance of the ModelSelector.
   * @returns {ModelSelector | null} The singleton instance or null if not initialized.
   */
  public static getInstance(): ModelSelector | null {
    return ModelSelector.instance;
  }

  /**
   * Initializes the model selection agent by loading configurations, API keys, and models.
   * @throws {Error} If initialization fails.
   */
  public async init(): Promise<void> {
    try {
      this.loadApiKeys();
      await this.initializeModels();
      this.validateModels();
      logger.debug('ModelSelector initialized successfully');
    } catch (error) {
      logger.error(`ModelSelector initialization failed: ${error}`);
      throw new Error(`ModelSelector initialization failed: ${error}`);
    }
  }

  /**
   * Loads API keys from environment variables.
   */
  protected loadApiKeys(): void {
    if (this.debugMode) {
      logger.debug('Loading API keys from environment variables...');
    }
    const PROVIDER_ENV_VAR_MAP: Record<string, string> = {
      openai: 'OPENAI_API_KEY',
      anthropic: 'ANTHROPIC_API_KEY',
      gemini: 'GEMINI_API_KEY',
      deepseek: 'DEEPSEEK_API_KEY',
    };

    this.apiKeys = {};
    for (const [provider, envVar] of Object.entries(PROVIDER_ENV_VAR_MAP)) {
      const apiKey = process.env[envVar];
      if (apiKey) {
        this.apiKeys[provider] = apiKey;
        if (this.debugMode) {
          logger.debug(`Loaded API key for provider: ${provider}`);
        }
      } else {
        logger.warn(
          `API key environment variable not found for provider: ${provider} (expected: ${envVar})`
        );
      }
    }
  }

  /**
   * Initializes model instances based on the loaded configuration.
   * @throws {Error} If models configuration is not loaded.
   */
  protected async initializeModels(): Promise<void> {
    if (this.debugMode) {
      logger.debug('Initializing AI models...');
    }
    if (!this.modelsConfig) {
      logger.error(
        'Models configuration is not loaded. Cannot initialize models.'
      );
      throw new Error('Models configuration is not loaded.');
    }

    this.models = {};
    for (const [levelName, levelConfig] of Object.entries(this.modelsConfig)) {
      const { provider, model_name } = levelConfig as any; // Cast to any if structure is dynamic
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
          verbose: this.debugMode, // Pass debugMode for model verbosity
        };

        switch (provider.toLowerCase()) {
          case 'openai':
            modelInstance = new ChatOpenAI({
              ...commonConfig,
              openAIApiKey: apiKey, // Specific key name for OpenAI
            });
            break;
          case 'anthropic':
            modelInstance = new ChatAnthropic({
              ...commonConfig,
              anthropicApiKey: apiKey, // Specific key name for Anthropic
            });
            break;
          case 'gemini':
            modelInstance = new ChatGoogleGenerativeAI({
              ...commonConfig,
            });
            break;
          // Add case for 'deepseek' if a Langchain integration exists or becomes available
          default:
            logger.warn(
              `Unsupported AI provider '${provider}' for model level '${levelName}'. Skipping.`
            );
            continue;
        }

        if (modelInstance) {
          this.models[levelName] = modelInstance;
          if (this.debugMode) {
            logger.debug(
              `Initialized model for level '${levelName}': ${provider} - ${model_name}`
            );
          }
        }
      } catch (error) {
        logger.error(
          `Failed to initialize model for level '${levelName}' (${provider} - ${model_name}): ${error}`
        );
      }
    }
  }

  /**
   * Verifies that all required models ('fast', 'smart', 'cheap') are initialized.
   * Logs a warning if any required models are missing.
   */
  private validateModels(): void {
    const requiredModels = ['fast', 'smart', 'cheap'];
    const missingModels = requiredModels.filter((model) => !this.models[model]);

    if (missingModels.length > 0) {
      logger.warn(
        `ModelSelector initialized with missing models: ${missingModels.join(', ')}`
      );
    }

    if (this.debugMode) {
      logger.debug(
        `ModelSelector initialized with models: ${Object.keys(this.models).join(', ')} (Meta selection: ${this.useModelSelector ? 'enabled' : 'disabled'})`
      );
    }
  }

  /**
   * Selects a model type ('fast', 'smart', 'cheap') based on the provided messages.
   * If `useModelSelector` is true, it uses the 'fast' model to analyze the messages.
   * Otherwise, it defaults to 'smart' or uses heuristics if the 'fast' model fails.
   * @param {BaseMessage[]} messages - The messages to analyze for model selection.
   * @param {Record<string, any>} [config] - Optional configuration containing additional context like originalUserQuery.
   * @returns {Promise<string>} The selected model type.
   */
  public async selectModelForMessages(
    messages: BaseMessage[],
    config?: Record<string, any>
  ): Promise<ModelSelectorReturn> {
    try {
      let analysisContent = '';
      if (
        config?.originalUserQuery &&
        typeof config.originalUserQuery === 'string'
      ) {
        // Use originalUserQuery from config if available
        analysisContent = config.originalUserQuery;
        if (this.debugMode) {
          logger.debug(
            `Using originalUserQuery for model selection: "${analysisContent.substring(0, 100)}..."`
          );
        }
      } else {
        // TODO Never reach need to had something to know if we are in autonomous mode to use this instead of this
        // Fall back to using the last message
        const lastMessage = messages[messages.length - 1];
        if (!lastMessage) {
          logger.warn(
            'ModelSelector: Could not get the last message; defaulting to "smart".'
          );
          return { model: this.models['smart'], model_name: 'smart' };
        }

        const content =
          lastMessage.content != null
            ? typeof lastMessage.content === 'string'
              ? lastMessage.content
              : JSON.stringify(lastMessage.content)
            : '';

        analysisContent = content;
      }

      let nextStepsSection = '';

      const systemPrompt = new SystemMessage(
        modelSelectorSystemPrompt(nextStepsSection)
      );
      const humanMessage = new HumanMessage(analysisContent);

      if (this.debugMode) {
        logger.debug(`Invoking "fast" model for meta-selection analysis.`);
        logger.debug(`Using full content analysis.`);
      }

      const response = await this.models.fast.invoke([
        systemPrompt,
        humanMessage,
      ]);
      const modelChoice = response.content
        .toString()
        .toLowerCase()
        .trim()
        .replace(/^["']|["']$/g, '');

      const token = TokenTracker.trackCall(response, 'fast_meta_selector');

      if (['fast', 'smart', 'cheap'].includes(modelChoice)) {
        if (this.debugMode) {
          logger.debug(`Meta-selection chose model: ${modelChoice}`);
        }
        return {
          model: this.models[modelChoice],
          model_name: modelChoice,
          token: {
            intput_token: token.promptTokens,
            output_token: token.responseTokens,
            total_token: token.totalTokens,
          },
        };
      } else {
        logger.warn(
          `Invalid model selection response: "${modelChoice}". Defaulting to "smart".`
        );
        return { model: this.models['smart'], model_name: 'smart' };
      }
    } catch (error) {
      logger.warn(
        `Error during meta-selection: ${error}. Falling back to heuristics.`
      );
      throw error;
    }
  }

  /**
   * Directly invokes a model, performing selection logic if a model type is not forced.
   * @param {BaseMessage[]} messages - The messages to process.
   * @returns {Promise<any>} The model's response.
   * @throws {Error} If the selected or fallback model is unavailable or fails to invoke.
   */
  public async execute(input: BaseMessage[]): Promise<any> {
    const modelType = (await this.selectModelForMessages(input)).model_name;

    let selectedModel = this.models[modelType];

    if (!selectedModel) {
      logger.warn(
        `Selected model "${modelType}" is not available. Attempting to fall back to "smart".`
      );
      selectedModel = this.models['smart'];
      if (!selectedModel) {
        logger.error(
          `Fallback model "smart" is also not available. Cannot invoke model.`
        );
        // Potentially throw an error or return a specific error message structure
        // depending on how the calling code expects to handle this.
        throw new Error(
          'Selected model and fallback "smart" model are unavailable.'
        );
      }
    }

    if (this.debugMode) {
      logger.debug(
        `Executing model: ${modelType} Actual: ${selectedModel === this.models.smart ? 'smart (fallback)' : modelType}`
      );
    }
    return selectedModel.invoke(input);
  }

  /**
   * Gets the record of available initialized models.
   * @returns {Record<string, BaseChatModel>} A map of model names to their instances.
   */
  public getModels(): Record<string, BaseChatModel> {
    return this.models;
  }
}
