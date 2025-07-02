import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import {
  BaseMessage,
} from '@langchain/core/messages';
import { AgentType, BaseAgent } from '../core/baseAgent.js';
import { ModelsConfig } from '@snakagent/core';
import {
  ModelSelectorService,
  ModelSelectorReturn,
} from './services/modelSelectorService.js';
import { ExecuteConfig } from '../types.js';

// CLEAN-UP Need to put in private every function who check the validity of the model selection instead of what we do now
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
export class ModelSelector extends BaseAgent {
  private service: ModelSelectorService;

  private static instance: ModelSelector | null = null;

  /**
   * Creates an instance of ModelSelector.
   * @param {ModelSelectionOptions} options - The options for the agent.
   */
  constructor(options: ModelSelectionOptions) {
    super('model-selector', AgentType.OPERATOR);
    this.service = new ModelSelectorService(options);

    ModelSelector.instance = this;
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
    await this.service.init();
  }


  /**
   * Selects a model type ('fast', 'smart', 'cheap') based on the provided messages.
   * If `useModelSelector` is true, it uses the 'fast' model to analyze the messages.
   * Otherwise, it defaults to 'smart' or uses heuristics if the 'fast' model fails.
   * @param {BaseMessage[]} messages - The messages to analyze for model selection.
   * @param {ExecuteConfig} [config] - Optional configuration containing additional context like originalUserQuery.
   * @returns {Promise<string>} The selected model type.
   */
  public async selectModelForMessages(
    messages: BaseMessage[],
    config?: ExecuteConfig
  ): Promise<ModelSelectorReturn> {
    return this.service.selectModelForMessages(messages, config);
  }

  /**
   * Directly invokes a model, performing selection logic if a model type is not forced.
   * @param {BaseMessage[]} messages - The messages to process.
   * @returns {Promise<any>} The model's response.
   * @throws {Error} If the selected or fallback model is unavailable or fails to invoke.
   */
  public async execute(input: BaseMessage[]): Promise<any> {
    return this.service.execute(input);
  }

  /**
   * Gets the record of available initialized models.
   * @returns {Record<string, BaseChatModel>} A map of model names to their instances.
   */
  public getModels(): Record<string, BaseChatModel> {
    return this.service.getModels();
  }
}