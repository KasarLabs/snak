import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { BaseMessage, HumanMessage, AIMessage } from '@langchain/core/messages';
import { logger } from '@snakagent/core';
import { BaseAgent, AgentType, IModelAgent } from '../core/baseAgent.js';
import { loadModelsConfig, ModelsConfig, ApiKeys } from '@snakagent/core';
import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { modelSelectorRules } from '../../prompt/prompts.js';

/**
 * Criteria for model selection.
 */
export interface ModelSelectionCriteria {
  complexity: 'high' | 'medium' | 'low';
  urgency: 'high' | 'medium' | 'low';
  creativeRequirement: 'high' | 'medium' | 'low';
  taskType: 'reasoning' | 'generation' | 'classification' | 'general';
}

/**
 * Options for the ModelSelectionAgent.
 */
export interface ModelSelectionOptions {
  debugMode?: boolean;
  useModelSelector?: boolean;
  modelsConfigPath: string;
}

/**
 * Represents an operator agent responsible for selecting the appropriate model for different tasks.
 */
export class ModelSelectionAgent extends BaseAgent implements IModelAgent {
  private models: Record<string, BaseChatModel> = {};
  private debugMode: boolean;
  private useModelSelector: boolean;
  private modelsConfig: ModelsConfig | null = null;
  private apiKeys: ApiKeys = {};
  private modelsConfigPath: string;

  private static instance: ModelSelectionAgent | null = null;

  /**
   * Creates an instance of ModelSelectionAgent.
   * @param {ModelSelectionOptions} options - The options for the agent.
   */
  constructor(options: ModelSelectionOptions) {
    super('model-selector', AgentType.OPERATOR);
    this.debugMode = options.debugMode || false;
    this.useModelSelector = options.useModelSelector || false;
    this.modelsConfigPath = options.modelsConfigPath;

    ModelSelectionAgent.instance = this;

    if (this.debugMode) {
      logger.debug(
        `ModelSelectionAgent initialized with options: ${JSON.stringify({
          debugMode: options.debugMode,
          useModelSelector: options.useModelSelector,
        })}`
      );
    }
  }

  /**
   * Gets the singleton instance of the ModelSelectionAgent.
   * @returns {ModelSelectionAgent | null} The singleton instance or null if not initialized.
   */
  public static getInstance(): ModelSelectionAgent | null {
    return ModelSelectionAgent.instance;
  }

  /**
   * Initializes the model selection agent by loading configurations, API keys, and models.
   * @throws {Error} If initialization fails.
   */
  public async init(): Promise<void> {
    try {
      this.modelsConfig = await loadModelsConfig(this.modelsConfigPath);
      this.loadApiKeys();
      await this.initializeModels();
      this.validateModels();
      logger.debug('ModelSelectionAgent initialized successfully');
    } catch (error) {
      logger.error(`ModelSelectionAgent initialization failed: ${error}`);
      throw new Error(`ModelSelectionAgent initialization failed: ${error}`);
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
        `ModelSelectionAgent initialized with missing models: ${missingModels.join(', ')}`
      );
    }

    if (this.debugMode) {
      logger.debug(
        `ModelSelectionAgent initialized with models: ${Object.keys(this.models).join(', ')} (Meta selection: ${this.useModelSelector ? 'enabled' : 'disabled'})`
      );
    }
  }

  /**
   * Selects a model type ('fast', 'smart', 'cheap') based on the provided messages.
   * If `useModelSelector` is true, it uses the 'fast' model to analyze the messages.
   * Otherwise, it defaults to 'smart' or uses heuristics if the 'fast' model fails.
   * @param {BaseMessage[]} messages - The messages to analyze for model selection.
   * @returns {Promise<string>} The selected model type.
   */
  public async selectModelForMessages(
    messages: BaseMessage[]
  ): Promise<string> {
    if (!this.useModelSelector) {
      if (this.debugMode) {
        logger.debug('Meta-selection disabled, using smart model by default.');
      }
      return 'smart';
    }

    if (!messages || messages.length === 0) {
      if (this.debugMode) {
        logger.debug(
          'No messages provided for model selection; defaulting to "smart".'
        );
      }
      return 'smart';
    }

    try {
      if (this.debugMode) {
        logger.debug(
          'Meta-selection enabled. Analyzing messages with the "fast" model.'
        );
      }

      if (!this.models.fast) {
        logger.error(
          'Meta-selection is enabled, but the "fast" model is not available. Defaulting to "smart".'
        );
        return 'smart';
      }

      const lastMessage = messages[messages.length - 1];
      if (!lastMessage) {
        logger.warn(
          'ModelSelectionAgent: Could not get the last message; defaulting to "smart".'
        );
        return 'smart';
      }

      const content =
        lastMessage.content != null
          ? typeof lastMessage.content === 'string'
            ? lastMessage.content
            : JSON.stringify(lastMessage.content)
          : '';

      let analysisContent = content;
      let nextStepsSection = '';

      // Extract "NEXT STEPS" section for more focused analysis if present
      const nextStepsMatch = content.match(/NEXT STEPS:(.*?)($|(?=\n\n))/s);
      if (nextStepsMatch && nextStepsMatch[1]) {
        nextStepsSection = nextStepsMatch[1].trim();
        if (this.debugMode) {
          logger.debug(`Extracted NEXT STEPS section: "${nextStepsSection}"`);
        }
        // Prioritize NEXT STEPS for analysis, with some context
        const truncatedContext = content.substring(0, 300) + '...';
        analysisContent = `Next planned actions: ${nextStepsSection}\n\nContext: ${truncatedContext}`;
      }

      const prompt = new HumanMessage(
        modelSelectorRules(nextStepsSection, analysisContent)
      );

      if (this.debugMode) {
        logger.debug(`Invoking "fast" model for meta-selection analysis.`);
        logger.debug(
          `Using ${nextStepsSection ? 'NEXT STEPS-focused' : 'full content'} analysis.`
        );
      }

      const response = await this.models.fast.invoke([prompt]);
      const modelChoice = response.content.toString().toLowerCase().trim();

      if (['fast', 'smart', 'cheap'].includes(modelChoice)) {
        if (this.debugMode) {
          logger.debug(`Meta-selection chose model: ${modelChoice}`);
        }
        return modelChoice;
      } else {
        logger.warn(
          `Invalid model selection response: "${modelChoice}". Defaulting to "smart".`
        );
        return 'smart';
      }
    } catch (error) {
      logger.warn(
        `Error during meta-selection: ${error}. Falling back to heuristics.`
      );
      return this.selectModelUsingHeuristics(messages);
    }
  }

  /**
   * Selects a model using simple heuristics as a fallback mechanism.
   * This method is called if meta-selection fails or is disabled and a more nuanced choice than 'smart' is desired.
   * @param {BaseMessage[]} messages - The messages to analyze.
   * @returns {string} The selected model type ('fast', 'smart', 'cheap').
   */
  private selectModelUsingHeuristics(messages: BaseMessage[]): string {
    if (!messages || messages.length === 0) {
      logger.warn(
        'Heuristic selection called with no messages; defaulting to "smart".'
      );
      return 'smart';
    }

    const lastMessage = messages[messages.length - 1];
    if (!lastMessage) {
      logger.warn(
        'Heuristic selection: Could not get the last message; defaulting to "smart".'
      );
      return 'smart';
    }

    const content =
      lastMessage.content != null
        ? typeof lastMessage.content === 'string'
          ? lastMessage.content
          : JSON.stringify(lastMessage.content)
        : '';

    let analysisFocusContent = content; // Content used for heuristic analysis
    let nextStepsContent = '';

    const nextStepsMatch = content.match(/NEXT STEPS:(.*?)($|(?=\n\n))/s);
    if (nextStepsMatch && nextStepsMatch[1]) {
      nextStepsContent = nextStepsMatch[1].trim();
      if (this.debugMode) {
        logger.debug(
          `Heuristic analysis focusing on NEXT STEPS: "${nextStepsContent}"`
        );
      }
      analysisFocusContent = nextStepsContent; // Prioritize NEXT STEPS for heuristics
    }

    const criteria = this.analyzeMessageContent(analysisFocusContent);
    const modelType = this.selectModelBasedOnCriteria(criteria);

    if (this.debugMode) {
      logger.debug(
        `Heuristic model selection chose: ${modelType} (Complexity: ${criteria.complexity}, Urgency: ${criteria.urgency}, Creativity: ${criteria.creativeRequirement}, Type: ${criteria.taskType})`
      );
      if (nextStepsContent) {
        logger.debug(`Heuristic selection was based on NEXT STEPS content.`);
      }
    }

    return modelType;
  }

  /**
   * Analyzes message content to determine task characteristics for heuristic model selection.
   * @param {string} content - The message content to analyze.
   * @returns {ModelSelectionCriteria} The derived selection criteria.
   */
  private analyzeMessageContent(content: string): ModelSelectionCriteria {
    const normalizedContent = (content || '').toLowerCase(); // Ensure content is a string and normalize

    const criteria: ModelSelectionCriteria = {
      complexity: 'medium',
      urgency: 'medium',
      creativeRequirement: 'medium',
      taskType: 'general',
    };

    // Complexity based on length
    if (normalizedContent.length > 1500) {
      criteria.complexity = 'high';
    } else if (normalizedContent.length < 300) {
      criteria.complexity = 'low';
    }

    // Task type and complexity/creativity adjustments based on keywords
    if (
      /reason|analyze|explain why|consider|determine|evaluate|assess/.test(
        normalizedContent
      )
    ) {
      criteria.taskType = 'reasoning';
      criteria.complexity = 'high'; // Reasoning tasks are often complex
    }

    if (
      /generate|create|write|draft|compose|design|develop|build/.test(
        normalizedContent
      )
    ) {
      criteria.taskType = 'generation';
      criteria.creativeRequirement = 'high'; // Generation implies creativity
    }

    if (
      /categorize|classify|identify|determine if|is this|should i|yes or no/.test(
        normalizedContent
      )
    ) {
      criteria.taskType = 'classification';
      criteria.complexity = 'low'; // Classification is often simpler
    }

    // Urgency based on keywords
    if (/urgent|quickly|immediate|asap|now|fast/.test(normalizedContent)) {
      criteria.urgency = 'high';
    }

    // Complexity based on keywords
    if (
      /complicated|complex|difficult|challenging|advanced|multiple steps|in-depth/.test(
        normalizedContent
      )
    ) {
      criteria.complexity = 'high';
    }

    // Detect multiple actions or steps, indicating higher complexity
    if (
      /and then|after that|followed by|next,|subsequently|finally,|1\.\s.*\s*2\./.test(
        normalizedContent
      )
    ) {
      if (this.debugMode) {
        logger.debug(
          'Detected multiple actions or steps; marking as high complexity.'
        );
      }
      criteria.complexity = 'high';
    }

    // Simplicity keywords can lower complexity, unless already marked high for other reasons
    if (
      /simple|straightforward|basic|single|focused|one step|easy/.test(
        normalizedContent
      )
    ) {
      if (criteria.complexity !== 'high') {
        // Don't override if already determined as high
        criteria.complexity = 'low';
      }
    }
    return criteria;
  }

  /**
   * Selects the appropriate model type based on the analyzed task criteria.
   * @param {ModelSelectionCriteria} criteria - The task criteria.
   * @returns {string} The selected model type ('fast', 'smart', 'cheap').
   */
  private selectModelBasedOnCriteria(criteria: ModelSelectionCriteria): string {
    // Prioritize 'smart' for complex reasoning or creative generation
    if (criteria.complexity === 'high' && criteria.taskType === 'reasoning') {
      return 'smart';
    }
    if (
      criteria.creativeRequirement === 'high' &&
      criteria.taskType === 'generation'
    ) {
      return 'smart';
    }

    // Use 'fast' for low complexity, high urgency tasks or classifications
    if (criteria.complexity === 'low' && criteria.urgency === 'high') {
      return 'fast';
    }
    if (criteria.taskType === 'classification') {
      return 'fast'; // Classifications are generally suited for faster models
    }

    // Use 'cheap' for low complexity tasks if not urgent or classification
    if (criteria.complexity === 'low') {
      return 'cheap';
    }

    // Default to 'smart' for medium complexity or unclassified scenarios
    if (criteria.complexity === 'medium') {
      return 'smart';
    }

    return 'smart'; // Fallback to 'smart'
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
    const modelType =
      forceModelType || (await this.selectModelForMessages(messages));

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
      throw new Error('No models available in ModelSelectionAgent.');
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
      forceModelType || (await this.selectModelForMessages(messages));

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
   * @param {any} input - Can be a single message, a string (converted to HumanMessage), or an array of BaseMessages.
   * @returns {Promise<AIMessage>} An AIMessage indicating the selected model type and other relevant metadata.
   */
  public async execute(input: any): Promise<AIMessage> {
    const messages: BaseMessage[] = Array.isArray(input)
      ? input
      : [typeof input === 'string' ? new HumanMessage(input) : input];

    if (messages.length === 0) {
      logger.warn(
        'ModelSelectionAgent received an empty message array. Defaulting to "smart" model.'
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

    // Attempt to find the original user query from HumanMessages
    const originalUserMessage = messages.find(
      (msg): msg is HumanMessage => msg instanceof HumanMessage // Type guard
    );
    const originalQuery = originalUserMessage
      ? typeof originalUserMessage.content === 'string'
        ? originalUserMessage.content
        : JSON.stringify(originalUserMessage.content)
      : '';

    const modelType = await this.selectModelForMessages(messages);
    const nextAgent = 'snak'; // Define the typical next agent

    if (this.debugMode) {
      logger.debug(
        `ModelSelectionAgent selected model: ${modelType}, routing to: ${nextAgent}.`
      );
      if (originalQuery) {
        logger.debug(
          `ModelSelectionAgent preserved original query: "${originalQuery.substring(0, 100)}..."` // Log a snippet
        );
      }
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
