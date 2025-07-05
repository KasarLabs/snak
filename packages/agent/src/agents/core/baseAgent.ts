import { BaseMessage } from '@langchain/core/messages';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { StreamChunk } from './snakAgent.js';
import type { IAgent, IModelAgent } from './baseAgent.types.js';

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
 * Abstract base class for all agents
 */
export abstract class BaseAgent implements IAgent {
  readonly id: string;
  readonly type: AgentType;
  readonly description: string;

  constructor(id: string, type: AgentType, description?: string) {
    this.id = id;
    this.type = type;
    this.description = description || 'No description';
  }

  abstract init(): Promise<void>;
  abstract execute(
    input: unknown,
    isInterrupted?: boolean,
    config?: Record<string, unknown>
  ): AsyncGenerator<StreamChunk> | Promise<unknown>;

  /**
   * Default dispose method. Subclasses should override this if they
   * need to perform specific cleanup tasks.
   */
  public async dispose(): Promise<void> {
    // Default implementation does nothing
    return Promise.resolve();
  }
}
