import { BaseMessage } from '@langchain/core/messages';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { ChunkOutput } from './utils.js';

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
  readonly description?: string;

  /**
   * Initializes the agent
   */
  init(): Promise<void>;

  /**
   * Executes an action with the agent
   * @param input Input to process
   * @param config Optional configuration
   */
  execute(
    input: any,
    isInterrupted?: boolean,

    config?: Record<string, any>
  ): Promise<any> | AsyncGenerator<ChunkOutput>;

  /**
   * Optional method to clean up resources used by the agent.
   */
  dispose?: () => Promise<void>;
}

/**
 * Available agent types in the system
 */
export enum AgentType {
  SUPERVISOR = 'supervisor',
  OPERATOR = 'operator',
  SNAK = 'snak',
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
  readonly description: string;

  constructor(id: string, type: AgentType, description?: string) {
    // CLEAN-UP Don't think the description is very usefull and more don't think that the super() constructor is not necessary because of no utilisation of different fields
    this.id = id;
    this.type = type;
    this.description = description || 'No description';
  }

  abstract init(): Promise<void>;
  abstract execute(
    input: any,
    isInterrupted?: boolean,
    config?: Record<string, any>
  ): AsyncGenerator<ChunkOutput> | Promise<any>;
  /**
   * Default dispose method. Subclasses should override this if they
   * need to perform specific cleanup tasks.
   */
  public async dispose(): Promise<void> {
    // Default implementation does nothing
    return Promise.resolve();
  }
}
