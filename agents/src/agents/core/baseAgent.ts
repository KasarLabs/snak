import { BaseMessage } from '@langchain/core/messages';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';

/**
 * Base interface for all agents in the system
 */
export interface IAgent {
  /**
   * Unique identifier of the agent
   */
  readonly id: string;

  /**
   * Type of agent
   */
  readonly type: AgentType;

  /**
   * Initializes the agent
   */
  init(): Promise<void>;

  /**
   * Executes an action with the agent
   * @param input Input to process
   * @param config Optional configuration
   */
  execute(input: any, config?: Record<string, any>): Promise<any>;
}

/**
 * Available agent types in the system
 */
export enum AgentType {
  SUPERVISOR = 'supervisor',
  OPERATOR = 'operator',
  MAIN = 'main',
}

/**
 * Interface for messages between agents
 */
export interface AgentMessage {
  from: string;
  to: string;
  content: any;
  metadata?: Record<string, any>;
  modelType?: string;
}

/**
 * Interface for operator agents that use LLM models
 */
export interface IModelAgent extends IAgent {
  /**
   * Gets the appropriate model for a task
   */
  getModelForTask(
    messages: BaseMessage[],
    forceModelType?: string
  ): Promise<BaseChatModel>;

  /**
   * Invokes a model with appropriate selection
   */
  invokeModel(messages: BaseMessage[], forceModelType?: string): Promise<any>;
}

/**
 * Abstract base class for all agents
 */
export abstract class BaseAgent implements IAgent {
  readonly id: string;
  readonly type: AgentType;

  constructor(id: string, type: AgentType) {
    this.id = id;
    this.type = type;
  }

  abstract init(): Promise<void>;
  abstract execute(input: any, config?: Record<string, any>): Promise<any>;
}
