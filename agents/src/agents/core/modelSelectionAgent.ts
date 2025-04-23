import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { BaseMessage, HumanMessage } from '@langchain/core/messages';
import { logger } from '@hijox/core';

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
 * Options for the ModelSelectionAgent
 */
export interface ModelSelectionOptions {
  debugMode?: boolean;
  useMetaSelection?: boolean;
}

/**
 * Agent responsible for selecting the appropriate model for different tasks
 */
export class ModelSelectionAgent {
  private models: Record<string, BaseChatModel>;
  private debugMode: boolean;
  private useMetaSelection: boolean;

  /**
   * Creates a new ModelSelectionAgent
   * @param models - Map of available models by type (fast, smart, cheap)
   * @param options - Configuration options
   */
  constructor(
    models: Record<string, BaseChatModel>,
    options: ModelSelectionOptions = {}
  ) {
    this.models = models;
    this.debugMode = options.debugMode || false;
    this.useMetaSelection = options.useMetaSelection || false;

    // Add debug logging to verify useMetaSelection option
    if (this.debugMode) {
      logger.debug(
        `ModelSelectionAgent constructor called with options: ${JSON.stringify({
          debugMode: options.debugMode,
          useMetaSelection: options.useMetaSelection,
        })}`
      );
      logger.debug(
        `ModelSelectionAgent initialized with useMetaSelection=${this.useMetaSelection}`
      );
    }

    // Validate that required models exist
    const requiredModels = ['fast', 'smart', 'cheap'];
    const missingModels = requiredModels.filter((model) => !this.models[model]);

    if (missingModels.length > 0) {
      logger.warn(
        `ModelSelectionAgent initialized with missing models: ${missingModels.join(
          ', '
        )}`
      );
    }

    if (this.debugMode) {
      logger.debug(
        `ModelSelectionAgent initialized with models: ${Object.keys(
          this.models
        ).join(
          ', '
        )} (Meta selection: ${this.useMetaSelection ? 'enabled' : 'disabled'})`
      );
    }
  }

  /**
   * Analyzes the provided messages and determines which model to use
   * @param messages - The messages to analyze
   * @returns The selected model type
   */
  public async selectModelForMessages(
    messages: BaseMessage[]
  ): Promise<string> {
    // If meta-selection is disabled, always use the smart model
    if (!this.useMetaSelection) {
      if (this.debugMode) {
        logger.debug('Meta-selection disabled, using smart model');
        logger.debug(
          `Current useMetaSelection value: ${this.useMetaSelection}`
        );
      }
      return 'smart';
    }

    if (!messages || messages.length === 0) {
      if (this.debugMode) {
        logger.debug(
          'No messages provided for model selection, defaulting to "fast"'
        );
      }
      return 'fast';
    }

    // Use the fast model to determine which model to use for the actual task
    try {
      if (this.debugMode) {
        logger.debug(
          'Meta-selection enabled, analyzing message with fast model'
        );
      }

      // CRITICAL CHECK: Make sure the fast model exists
      if (!this.models.fast) {
        logger.error(
          'Meta-selection is enabled but fast model is not available'
        );
        return 'smart'; // Fallback to smart if fast model isn't available
      }

      const lastMessage = messages[messages.length - 1];
      const content =
        typeof lastMessage.content === 'string'
          ? lastMessage.content
          : JSON.stringify(lastMessage.content);

      // Check for the NEXT STEPS section in the message content
      let analysisContent = content;
      let nextStepsSection = '';

      // For autonomous agent responses, extract the NEXT STEPS section
      const nextStepsMatch = content.match(/NEXT STEPS:(.*?)($|(?=\n\n))/s);
      if (nextStepsMatch && nextStepsMatch[1]) {
        nextStepsSection = nextStepsMatch[1].trim();
        if (this.debugMode) {
          logger.debug(`Found NEXT STEPS section: "${nextStepsSection}"`);
        }

        // If we have NEXT STEPS, use it as the primary content for analysis
        // but also keep a shortened version of the original content for context
        const truncatedContent = content.substring(0, 300) + '...';
        analysisContent = `Next planned actions: ${nextStepsSection}\n\nContext: ${truncatedContent}`;
      }

      // Use fast model to analyze which model should handle this request
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

      // Validate the response
      if (['fast', 'smart', 'cheap'].includes(modelChoice)) {
        if (this.debugMode) {
          logger.debug(`Meta-selection chose model: ${modelChoice}`);
        }
        return modelChoice;
      } else {
        // Fallback if response is invalid
        logger.warn(
          `Invalid model selection response: ${modelChoice}, defaulting to smart`
        );
        return 'smart';
      }
    } catch (error) {
      logger.warn(
        `Error in meta-selection: ${error}, falling back to heuristics`
      );
      // Fall back to heuristic selection
      return this.selectModelUsingHeuristics(messages);
    }
  }

  /**
   * Selects model using simple heuristics as a fallback
   * @param messages - The messages to analyze
   * @returns The selected model type
   */
  private selectModelUsingHeuristics(messages: BaseMessage[]): string {
    const lastMessage = messages[messages.length - 1];
    const content =
      typeof lastMessage.content === 'string'
        ? lastMessage.content
        : JSON.stringify(lastMessage.content);

    // Extract NEXT STEPS section if present
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
      // If we have next steps, prioritize analyzing them
      analysisContent = nextStepsContent;
    }

    // Quick heuristics based on message content
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
   * Analyzes message content to determine task characteristics
   * @param content - The message content to analyze
   * @returns The analysis criteria
   */
  private analyzeMessageContent(content: string): ModelSelectionCriteria {
    // Default criteria
    const criteria: ModelSelectionCriteria = {
      complexity: 'medium',
      urgency: 'medium',
      creativeRequirement: 'medium',
      taskType: 'general',
    };

    // Check content length as a basic complexity indicator
    if (content.length > 1500) {
      criteria.complexity = 'high';
    } else if (content.length < 300) {
      criteria.complexity = 'low';
    }

    // Look for keywords indicating reasoning tasks
    if (
      content.match(
        /reason|analyze|explain why|consider|determine|evaluate|assess/i
      )
    ) {
      criteria.taskType = 'reasoning';
      criteria.complexity = 'high';
    }

    // Look for keywords indicating generation tasks
    if (
      content.match(/generate|create|write|draft|compose|design|develop|build/i)
    ) {
      criteria.taskType = 'generation';
      criteria.creativeRequirement = 'high';
    }

    // Look for keywords indicating classification tasks
    if (
      content.match(
        /categorize|classify|identify|determine if|is this|should I|yes or no/i
      )
    ) {
      criteria.taskType = 'classification';
      criteria.complexity = 'low';
    }

    // Look for urgency indicators
    if (content.match(/urgent|quickly|immediate|asap|now|fast/i)) {
      criteria.urgency = 'high';
    }

    // Special keywords for next step complexity
    if (
      content.match(
        /complicated|complex|difficult|challenging|advanced|multiple steps|in-depth/i
      )
    ) {
      criteria.complexity = 'high';
    }

    // Check for multiple actions in a single step (indicates too much complexity)
    if (
      content.match(
        /and then|after that|followed by|next,|subsequently|finally,/i
      ) ||
      content.match(/\d+\.\s.*\d+\.\s/s) // Looks for numbered lists with multiple items
    ) {
      if (this.debugMode) {
        logger.debug(
          'Detected multiple actions in a single step - marking as high complexity'
        );
      }
      criteria.complexity = 'high';
    }

    // Check for simpler, more focused task indicators
    if (
      content.match(
        /simple|straightforward|basic|single|focused|one step|easy/i
      )
    ) {
      // Don't downgrade high complexity tasks, but mark medium ones as low
      if (criteria.complexity !== 'high') {
        criteria.complexity = 'low';
      }
    }

    return criteria;
  }

  /**
   * Selects the appropriate model based on task criteria
   * @param criteria - The task criteria
   * @returns The selected model type
   */
  private selectModelBasedOnCriteria(criteria: ModelSelectionCriteria): string {
    // High complexity reasoning tasks go to smart model
    if (criteria.complexity === 'high' && criteria.taskType === 'reasoning') {
      return 'smart';
    }

    // High creativity generation tasks go to smart model
    if (
      criteria.creativeRequirement === 'high' &&
      criteria.taskType === 'generation'
    ) {
      return 'smart';
    }

    // Low complexity, high urgency tasks go to fast model
    if (criteria.complexity === 'low' && criteria.urgency === 'high') {
      return 'fast';
    }

    // Classification tasks typically go to fast model
    if (criteria.taskType === 'classification') {
      return 'fast';
    }

    // If budget is a concern and task is not complex, use cheap model
    if (criteria.complexity === 'low') {
      return 'cheap';
    }

    // Default to smart for medium complexity tasks
    if (criteria.complexity === 'medium') {
      return 'smart';
    }

    // Default fallback
    return 'smart';
  }

  /**
   * Gets the appropriate model for a given task based on messages
   * @param messages - The messages to analyze
   * @returns The selected model instance
   */
  public async getModelForTask(
    messages: BaseMessage[]
  ): Promise<BaseChatModel> {
    const modelType = await this.selectModelForMessages(messages);

    // Ensure the selected model exists
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
   * @param messages - The messages to process
   * @param forceModelType - Optional parameter to force using a specific model type
   * @returns The model response
   */
  public async invokeModel(
    messages: BaseMessage[],
    forceModelType?: string
  ): Promise<any> {
    // Use forced type if provided, otherwise select model
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
}
