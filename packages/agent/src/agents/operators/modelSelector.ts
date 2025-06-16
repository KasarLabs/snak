import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import {
  BaseMessage,
  HumanMessage,
  AIMessage,
  SystemMessage,
} from '@langchain/core/messages';
import { logger } from '@snakagent/core';
import { BaseAgent, AgentType, IModelAgent } from '../core/baseAgent.js';
import { ModelsConfig, ApiKeys } from '@snakagent/core';
import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { modelSelectorSystemPrompt } from '../../prompt/prompts.js';
import { TokenTracker } from '../../token/tokenTracking.js';

/**
 * Criteria for model selection.
 */

export interface ModelSelectorReturn {
  model :BaseChatModel ;
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
export interface ModelSelectionOptions {
  debugMode?: boolean;
  useModelSelector?: boolean;
  modelsConfig: ModelsConfig;
}

/**
 * Represents an operator agent responsible for selecting the appropriate model for different tasks.
 */
export class ModelSelector extends BaseAgent implements IModelAgent {
  private models: Record<string, BaseChatModel> = {};
  private debugMode: boolean;
  private useModelSelector: boolean;
  private modelsConfig: ModelsConfig | null = null;
  private apiKeys: ApiKeys = {};

  private static instance: ModelSelector | null = null;

  /**
   * Creates an instance of ModelSelector.
   * @param {ModelSelectionOptions} options - The options for the agent.
   */
  constructor(options: ModelSelectionOptions) {
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
  private loadApiKeys(): void {
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
  private async initializeModels(): Promise<void> {
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
        console.log(analysisContent);
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
          return { this.models['smart'] };
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

      // TODO add this when its autonomous mode
      // Extract "NEXT STEPS" section for more focused analysis if present
      // const nextStepsMatch = analysisContent.match(
      //   /NEXT STEPS:(.*?)($|(?=\n\n))/s
      // );
      // if (nextStepsMatch && nextStepsMatch[1]) {
      //   nextStepsSection = nextStepsMatch[1].trim();
      //   if (this.debugMode) {
      //     logger.debug(`Extracted NEXT STEPS section: "${nextStepsSection}"`);
      //   }
      //   // Prioritize NEXT STEPS for analysis, with some context
      //   const truncatedContext = analysisContent.substring(0, 300) + '...';
      //   analysisContent = `Next planned actions: ${nextStepsSection}\n\nContext: ${truncatedContext}`;
      // }

      const systemPrompt = new SystemMessage(
        modelSelectorSystemPrompt(nextStepsSection)
      );
      const humanMessage = new HumanMessage(analysisContent);

      if (this.debugMode) {
        logger.debug(`Invoking "fast" model for meta-selection analysis.`);
        logger.debug(
          `Using ${nextStepsSection ? 'NEXT STEPS-focused' : 'full content'} analysis.`
        );
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
          model: modelChoice,
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
        return { model: 'smart' };
      }
    } catch (error) {
      logger.warn(
        `Error during meta-selection: ${error}. Falling back to heuristics.`
      );
      throw error;
    }
  }

  /**
   * Gets the appropriate model instance for a given task, based on messages or a forced type.
   * @param {BaseMessage[]} messages - The messages to analyze for model selection.
   * @param {string} [forceModelType] - Optional. If provided, this model type will be used, bypassing selection logic.
   * @returns {Promise<BaseChatModel>} The selected model instance. Falls back to 'smart' or the first available model if the selection is invalid.
   */
  public async getModelForTask(
    messages: BaseMessage[],
    forceModelType?: string
  ): Promise<BaseChatModel> {
    const modelType: string =
      forceModelType || (await this.selectModelForMessages(messages)).model;

    if (this.models[modelType]) {
      return this.models[modelType];
    } else {
      logger.warn(
        `Selected model "${modelType}" is not available. Falling back to "smart" or the first available model.`
      );
      // Fallback logic: try 'smart', then the first model in the list, or throw error if none.
      if (this.models['smart']) {
        return this.models['smart'];
      }
      const availableModels = Object.values(this.models);
      if (availableModels.length > 0) {
        return availableModels[0];
      }
      throw new Error('No models available in ModelSelector.');
    }
  }

  /**
   * Directly invokes a model, performing selection logic if a model type is not forced.
   * @param {BaseMessage[]} messages - The messages to process.
   * @param {string} [forceModelType] - Optional. If provided, forces the use of a specific model type.
   * @returns {Promise<any>} The model's response.
   * @throws {Error} If the selected or fallback model is unavailable or fails to invoke.
   */
  public async invokeModel(
    messages: BaseMessage[],
    forceModelType?: string
  ): Promise<any> {
    const modelType =
      forceModelType || (await this.selectModelForMessages(messages)).model;

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
        `Invoking model: ${modelType} (Forced: ${Boolean(forceModelType)}, Actual: ${selectedModel === this.models.smart ? 'smart (fallback)' : modelType})`
      );
    }
    return selectedModel.invoke(messages);
  }

  /**
   * Main execution entry point for the agent. Selects a model and returns an AIMessage with the selection.
   * @param {string | BaseMessage | BaseMessage[]} input - Can be a single message, a string (converted to HumanMessage), or an array of BaseMessages.
   * @param {Record<string, any>} [config] - Optional. Additional configuration options.
   * @returns {Promise<AIMessage>} An AIMessage indicating the selected model type and other relevant metadata.
   */
  public async execute(
    input: string | BaseMessage | BaseMessage[],
    config?: Record<string, any>
  ): Promise<AIMessage> {
    // Determine messages array from input
    const messages: BaseMessage[] = Array.isArray(input)
      ? input
      : [typeof input === 'string' ? new HumanMessage(input) : input];

    if (messages.length === 0) {
      logger.warn(
        'ModelSelector received an empty message array. Defaulting to "smart" model.'
      );
      return new AIMessage({
        content: 'Selected model type: smart (default due to empty input)',
        additional_kwargs: {
          modelType: 'smart',
          nextAgent: 'snak', // Assuming 'snak' is the default next agent
          from: 'model-selector',
          final: false,
          originalUserQuery: '',
        },
      });
    }

    // Extract original user query from config if it exists
    let originalQuery = '';

    if (
      config?.originalUserQuery &&
      typeof config.originalUserQuery === 'string'
    ) {
      // Use the original user query from config if available
      originalQuery = config.originalUserQuery;
      if (this.debugMode) {
        logger.debug(
          `ModelSelector: Using originalUserQuery from config for model selection: "${originalQuery.substring(0, 100)}..."`
        );
      }
    } else {
      // Otherwise, attempt to find the original user query from HumanMessages
      const originalUserMessage = messages.find(
        (msg): msg is HumanMessage => msg instanceof HumanMessage
      );
      originalQuery = originalUserMessage
        ? typeof originalUserMessage.content === 'string'
          ? originalUserMessage.content
          : JSON.stringify(originalUserMessage.content)
        : '';

      if (this.debugMode && originalQuery) {
        logger.debug(
          `ModelSelector: No originalUserQuery in config, extracted from messages: "${originalQuery.substring(0, 100)}..."`
        );
      }
    }

    const modelType = await this.selectModelForMessages(messages, config);
    const nextAgent = 'snak'; // Define the typical next agent

    if (this.debugMode) {
      logger.debug(
        `ModelSelector selected model: ${modelType}, routing to: ${nextAgent}.`
      );
    }

    return new AIMessage({
      content: `Selected model type: ${modelType}`,
      additional_kwargs: {
        modelType,
        nextAgent,
        from: 'model-selector',
        final: false, // This agent typically precedes another
        originalUserQuery: originalQuery,
      },
    });
  }

  /**
   * Gets the record of available initialized models.
   * @returns {Record<string, BaseChatModel>} A map of model names to their instances.
   */
  public getModels(): Record<string, BaseChatModel> {
    return this.models;
  }
}
