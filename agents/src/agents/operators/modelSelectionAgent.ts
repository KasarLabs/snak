import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { BaseMessage, HumanMessage, AIMessage } from '@langchain/core/messages';
import { logger } from '@snakagent/core';
import { BaseAgent, AgentType, IModelAgent } from '../core/baseAgent.js';
import { loadModelsConfig, ModelsConfig, ApiKeys } from '@snakagent/core';
import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';

/**
 * Criteria for model selection
 */
export interface ModelSelectionCriteria {
  complexity: 'high' | 'medium' | 'low';
  urgency: 'high' | 'medium' | 'low';
  creativeRequirement: 'high' | 'medium' | 'low';
  taskType: 'reasoning' | 'generation' | 'classification' | 'general';
}

/**
 * Options for the model selection agent
 */
export interface ModelSelectionOptions {
  debugMode?: boolean;
  useMetaSelection?: boolean;
  modelsConfigPath: string;
}

/**
 * Represents an operator agent responsible for selecting the appropriate model for different tasks
 */
export class ModelSelectionAgent extends BaseAgent implements IModelAgent {
  private models: Record<string, BaseChatModel> = {};
  private debugMode: boolean;
  private useMetaSelection: boolean;
  private modelsConfig: ModelsConfig | null = null;
  private apiKeys: ApiKeys = {};
  private modelsConfigPath: string;

  // Add a static instance for singleton access
  private static instance: ModelSelectionAgent | null = null;

  constructor(options: ModelSelectionOptions) {
    super('model-selector', AgentType.OPERATOR);
    this.debugMode = options.debugMode || false;
    this.useMetaSelection = options.useMetaSelection || false;
    this.modelsConfigPath = options.modelsConfigPath;

    // Set this instance as the global instance for singleton access
    ModelSelectionAgent.instance = this;

    if (this.debugMode) {
      logger.debug(
        `ModelSelectionAgent initialized with options: ${JSON.stringify({
          debugMode: options.debugMode,
          useMetaSelection: options.useMetaSelection,
        })}`
      );
    }
  }

  // Static method to get the current instance
  public static getInstance(): ModelSelectionAgent | null {
    return ModelSelectionAgent.instance;
  }

  /**
   * Initialize the model selection agent
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
   * Load API keys from environment variables
   */
  private loadApiKeys(): void {
    logger.debug('Loading API keys from environment variables...');
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
        logger.debug(`Loaded API key for provider: ${provider}`);
      } else {
        logger.warn(
          `API key environment variable not found for provider: ${provider} (expected: ${envVar})`
        );
      }
    }
  }

  /**
   * Initialize model instances based on loaded configuration
   */
  private async initializeModels(): Promise<void> {
    logger.debug('Initializing AI models...');
    if (!this.modelsConfig) {
      logger.error(
        'Models configuration is not loaded. Cannot initialize models.'
      );
      throw new Error('Models configuration is not loaded.');
    }

    this.models = {};
    for (const [levelName, levelConfig] of Object.entries(this.modelsConfig)) {
      const { provider, model_name } = levelConfig as any;
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
          verbose: this.debugMode,
        };

        switch (provider.toLowerCase()) {
          case 'openai':
            modelInstance = new ChatOpenAI({
              ...commonConfig,
              openAIApiKey: apiKey,
            });
            break;
          case 'anthropic':
            modelInstance = new ChatAnthropic({
              ...commonConfig,
              anthropicApiKey: apiKey,
            });
            break;
          case 'gemini':
            modelInstance = new ChatGoogleGenerativeAI({
              ...commonConfig,
              apiKey: apiKey,
            });
            break;
          default:
            logger.warn(
              `Unsupported AI provider '${provider}' for model level '${levelName}'. Skipping.`
            );
            continue;
        }

        if (modelInstance) {
          this.models[levelName] = modelInstance;
          logger.debug(
            `Initialized model for level '${levelName}': ${provider} - ${model_name}`
          );
        }
      } catch (error) {
        logger.error(
          `Failed to initialize model for level '${levelName}' (${provider} - ${model_name}): ${error}`
        );
      }
    }
  }

  /**
   * Verify that required models exist
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
        `ModelSelectionAgent initialized with models: ${Object.keys(this.models).join(', ')} (Meta selection: ${this.useMetaSelection ? 'enabled' : 'disabled'})`
      );
    }
  }

  /**
   * Analyze provided messages and determine which model to use
   * @param messages The messages to analyze
   * @returns The selected model type
   */
  public async selectModelForMessages(
    messages: BaseMessage[]
  ): Promise<string> {
    if (!this.useMetaSelection) {
      if (this.debugMode) {
        logger.debug('Meta-selection disabled, using smart model');
      }
      return 'smart';
    }

    if (!messages || messages.length === 0) {
      if (this.debugMode) {
        logger.debug(
          'No messages provided for model selection, defaulting to "smart"'
        );
      }
      return 'smart';
    }

    try {
      if (this.debugMode) {
        logger.debug(
          'Meta-selection enabled, analyzing message with fast model'
        );
      }

      if (!this.models.fast) {
        logger.error(
          'Meta-selection is enabled but fast model is not available'
        );
        return 'smart';
      }

      const lastMessage = messages[messages.length - 1];
      if (!lastMessage) {
        logger.warn(
          'ModelSelectionAgent: Could not get last message, defaulting to smart.'
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

      const nextStepsMatch = content.match(/NEXT STEPS:(.*?)($|(?=\n\n))/s);
      if (nextStepsMatch && nextStepsMatch[1]) {
        nextStepsSection = nextStepsMatch[1].trim();
        if (this.debugMode) {
          logger.debug(`Found NEXT STEPS section: "${nextStepsSection}"`);
        }

        const truncatedContent = content.substring(0, 300) + '...';
        analysisContent = `Next planned actions: ${nextStepsSection}\n\nContext: ${truncatedContent}`;
      }

      const prompt = new HumanMessage(
        `Analyze this content and determine which AI model should handle it.
${nextStepsSection ? "Focus primarily on the 'Next planned actions' which represents upcoming tasks." : ''}
Select 'fast' for simple, focused tasks that involve a single action or basic operations.
Select 'smart' for complex reasoning, creativity, or tasks that might take multiple steps to complete.
Select 'cheap' for non-urgent, simple tasks that don't require sophisticated reasoning.

Priority is on simplicity - if the task appears to be trying to do too much at once, select 'smart'.
If the task is properly broken down into one simple step, prefer 'fast' or 'cheap'.

Respond with only one word: 'fast', 'smart', or 'cheap'.

${analysisContent}`
      );

      if (this.debugMode) {
        logger.debug(`Invoking fast model for meta-selection analysis`);
        logger.debug(
          `Using ${nextStepsSection ? 'NEXT STEPS-focused' : 'regular'} analysis`
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
          `Invalid model selection response: ${modelChoice}, defaulting to smart`
        );
        return 'smart';
      }
    } catch (error) {
      logger.warn(
        `Error in meta-selection: ${error}, falling back to heuristics`
      );
      return this.selectModelUsingHeuristics(messages);
    }
  }

  /**
   * Select the model using simple heuristics as a fallback mechanism
   * @param messages The messages to analyze
   * @returns The selected model type
   */
  private selectModelUsingHeuristics(messages: BaseMessage[]): string {
    if (!messages || messages.length === 0) {
      logger.warn(
        'Heuristic selection called with no messages, defaulting to smart.'
      );
      return 'smart';
    }

    const lastMessage = messages[messages.length - 1];
    if (!lastMessage) {
      logger.warn(
        'Heuristic selection: Could not get last message, defaulting to smart.'
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
    let nextStepsContent = '';

    const nextStepsMatch = content.match(/NEXT STEPS:(.*?)($|(?=\n\n))/s);
    if (nextStepsMatch && nextStepsMatch[1]) {
      nextStepsContent = nextStepsMatch[1].trim();
      if (this.debugMode) {
        logger.debug(
          `Heuristic analysis found NEXT STEPS: "${nextStepsContent}"`
        );
      }
      analysisContent = nextStepsContent;
    }

    const criteria = this.analyzeMessageContent(analysisContent);
    const modelType = this.selectModelBasedOnCriteria(criteria);

    if (this.debugMode) {
      logger.debug(
        `Heuristic model selection for task: ${modelType} (complexity: ${criteria.complexity}, urgency: ${criteria.urgency}, creativity: ${criteria.creativeRequirement}, type: ${criteria.taskType})`
      );
      if (nextStepsContent) {
        logger.debug(`Selection was based on NEXT STEPS content`);
      }
    }

    return modelType;
  }

  /**
   * Analyze message content to determine task characteristics
   * @param content The message content to analyze
   * @returns The analysis criteria
   */
  private analyzeMessageContent(content: string): ModelSelectionCriteria {
    if (content == null) {
      logger.warn(
        'analyzeMessageContent received null/undefined content, returning default criteria.'
      );
      content = '';
    }

    const criteria: ModelSelectionCriteria = {
      complexity: 'medium',
      urgency: 'medium',
      creativeRequirement: 'medium',
      taskType: 'general',
    };

    if (content.length > 1500) {
      criteria.complexity = 'high';
    } else if (content.length < 300) {
      criteria.complexity = 'low';
    }

    if (
      content.match(
        /reason|analyze|explain why|consider|determine|evaluate|assess/i
      )
    ) {
      criteria.taskType = 'reasoning';
      criteria.complexity = 'high';
    }

    if (
      content.match(/generate|create|write|draft|compose|design|develop|build/i)
    ) {
      criteria.taskType = 'generation';
      criteria.creativeRequirement = 'high';
    }

    if (
      content.match(
        /categorize|classify|identify|determine if|is this|should I|yes or no/i
      )
    ) {
      criteria.taskType = 'classification';
      criteria.complexity = 'low';
    }

    if (content.match(/urgent|quickly|immediate|asap|now|fast/i)) {
      criteria.urgency = 'high';
    }

    if (
      content.match(
        /complicated|complex|difficult|challenging|advanced|multiple steps|in-depth/i
      )
    ) {
      criteria.complexity = 'high';
    }

    if (
      content.match(
        /and then|after that|followed by|next,|subsequently|finally,/i
      ) ||
      content.match(/\d+\.\s.*\d+\.\s/s)
    ) {
      if (this.debugMode) {
        logger.debug(
          'Detected multiple actions in a single step - marking as high complexity'
        );
      }
      criteria.complexity = 'high';
    }

    if (
      content.match(
        /simple|straightforward|basic|single|focused|one step|easy/i
      )
    ) {
      if (criteria.complexity !== 'high') {
        criteria.complexity = 'low';
      }
    }

    return criteria;
  }

  /**
   * Select the appropriate model based on task criteria
   * @param criteria The task criteria
   * @returns The selected model type
   */
  private selectModelBasedOnCriteria(criteria: ModelSelectionCriteria): string {
    if (criteria.complexity === 'high' && criteria.taskType === 'reasoning') {
      return 'smart';
    }

    if (
      criteria.creativeRequirement === 'high' &&
      criteria.taskType === 'generation'
    ) {
      return 'smart';
    }

    if (criteria.complexity === 'low' && criteria.urgency === 'high') {
      return 'fast';
    }

    if (criteria.taskType === 'classification') {
      return 'fast';
    }

    if (criteria.complexity === 'low') {
      return 'cheap';
    }

    if (criteria.complexity === 'medium') {
      return 'smart';
    }

    return 'smart';
  }

  /**
   * Get the appropriate model for a given task based on messages
   * @param messages The messages to analyze
   * @returns The selected model instance
   */
  public async getModelForTask(
    messages: BaseMessage[],
    forceModelType?: string
  ): Promise<BaseChatModel> {
    const modelType =
      forceModelType || (await this.selectModelForMessages(messages));

    if (!this.models[modelType]) {
      logger.warn(
        `Selected model "${modelType}" not available, falling back to "smart"`
      );
      return this.models['smart'] || Object.values(this.models)[0];
    }

    return this.models[modelType];
  }

  /**
   * Directly invoke a model with selection logic
   * @param messages The messages to process
   * @param forceModelType Optional parameter to force using a specific model type
   * @returns The model response
   */
  public async invokeModel(
    messages: BaseMessage[],
    forceModelType?: string
  ): Promise<any> {
    const modelType =
      forceModelType || (await this.selectModelForMessages(messages));

    if (!this.models[modelType]) {
      logger.warn(
        `Selected model "${modelType}" not available, falling back to "smart"`
      );
      return this.models['smart'].invoke(messages);
    }

    if (this.debugMode) {
      logger.debug(`Invoking model: ${modelType}`);
    }

    return this.models[modelType].invoke(messages);
  }

  /**
   * Main entry point for agent execution
   */
  public async execute(input: any): Promise<AIMessage> {
    const messages: BaseMessage[] = Array.isArray(input)
      ? input
      : [typeof input === 'string' ? new HumanMessage(input) : input];

    if (messages.length === 0) {
      logger.warn(
        'ModelSelectionAgent received empty message array. Returning default model.'
      );
      return new AIMessage({
        content: 'Selected model type: smart (default due to empty input)',
        additional_kwargs: {
          modelType: 'smart',
          nextAgent: 'snak',
          from: 'model-selector',
          final: false,
          originalUserQuery: '',
        },
      });
    }

    const originalUserMessage = messages.find(
      (msg) => msg instanceof HumanMessage
    );
    const originalQuery = originalUserMessage
      ? typeof originalUserMessage.content === 'string'
        ? originalUserMessage.content
        : JSON.stringify(originalUserMessage.content)
      : '';

    const modelType = await this.selectModelForMessages(messages);
    const nextAgent = 'snak';

    if (this.debugMode) {
      logger.debug(
        `ModelSelectionAgent selected model: ${modelType}, routing to: ${nextAgent}`
      );
      logger.debug(
        `ModelSelectionAgent preserved original query: "${originalQuery}"`
      );
    }

    return new AIMessage({
      content: `Selected model type: ${modelType}`,
      additional_kwargs: {
        modelType,
        nextAgent,
        from: 'model-selector',
        final: false,
        originalUserQuery: originalQuery,
      },
    });
  }

  /**
   * Get available models
   */
  public getModels(): Record<string, BaseChatModel> {
    return this.models;
  }
}
