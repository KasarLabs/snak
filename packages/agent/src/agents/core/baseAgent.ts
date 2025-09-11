import { IAgent } from '../../shared/types/agents.types.js';
import { AgentType } from '@enums/agent-modes.enum.js';
import { ChunkOutput } from '../../shared/types/streaming.types.js';

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
