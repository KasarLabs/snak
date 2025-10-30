import { AgentType } from '@enums/agent.enum.js';
import { ChunkOutput } from '../../shared/types/streaming.type.js';
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import { CompiledStateGraph } from '@langchain/langgraph';
import { logger, AgentConfig, DatabaseConfigService } from '@snakagent/core';

/**
 * Abstract base class for all agents
 */
export abstract class BaseAgent {
  readonly id: string;
  readonly type: AgentType;
  readonly description: string;
  protected controller: AbortController | null = null;
  protected pgCheckpointer: PostgresSaver | null = null;
  protected readonly agentConfig: AgentConfig.Runtime;
  protected compiledStateGraph: CompiledStateGraph<
    any,
    any,
    any,
    any,
    any
  > | null = null;

  constructor(id: string, type: AgentType, agentConfig: AgentConfig.Runtime) {
    // CLEAN-UP Don't think the description is very usefull and more don't think that the super() constructor is not necessary because of no utilisation of different fields
    this.id = id;
    this.type = type;
    this.agentConfig = agentConfig;
  }

  abstract init(): Promise<void>;
  abstract execute(
    input: any,
    isInterrupted?: boolean,
    config?: Record<string, any>
  ): AsyncGenerator<ChunkOutput> | Promise<any>;

  public getAgentConfig(): AgentConfig.Runtime {
    return this.agentConfig;
  }

  public getController(): AbortController | undefined {
    if (!this.controller) {
      logger.warn(
        `[BaseAgent] Controller is not initialized for agent ${this.id}`
      );
      return undefined;
    }
    return this.controller;
  }

  public getPgCheckpointer(): PostgresSaver | undefined {
    if (!this.pgCheckpointer) {
      logger.warn(
        `[BaseAgent] Checkpointer is not initialized for agent ${this.id}`
      );
      return undefined;
    }
    return this.pgCheckpointer;
  }

  public getCompiledStateGraph():
    | CompiledStateGraph<any, any, any, any, any>
    | undefined {
    if (!this.compiledStateGraph) {
      logger.warn(
        `[BaseAgent] CompiledStateGraph is not initialized for agent ${this.id}`
      );
      return undefined;
    }
    return this.compiledStateGraph;
  }

  /**
   * Get database credentials
   * @returns The database credentials object
   */
  public getDatabaseCredentials() {
    return DatabaseConfigService.getInstance().getCredentials();
  }

  public async dispose(): Promise<void> {
    // Default implementation does nothing
    return Promise.resolve();
  }
  public stop(): void {
    if (this.controller) {
      this.controller.abort();
      logger.info('[SnakAgent] Execution stopped');
    }
  }
}
