import { BaseAgent } from './baseAgent.js';
import { logger, AgentConfig } from '@snakagent/core';
import { AgentType } from '../../shared/enums/agent.enum.js';
import { ChunkOutput } from '../../shared/types/streaming.types.js';
import { createSupervisorGraph } from '@agents/graphs/core-graph/supervisor.graph.js';
import { CheckpointerService } from '@agents/graphs/manager/checkpointer/checkpointer.js';
import { HumanMessage } from '@langchain/core/messages';
import { UserRequest } from '@stypes/graph.types.js';

/**
 * Supervisor agent for managing and coordinating multiple agents
 */
export class SupervisorAgent extends BaseAgent {
  constructor(agent_config: AgentConfig.Runtime) {
    super('supervisor', AgentType.SUPERVISOR, agent_config);
  }

  /**
   * Initialize the SupervisorAgent
   * @throws {Error} If initialization fails
   */
  public async init(): Promise<void> {
    try {
      if (!this.agentConfig) {
        throw new Error('Agent configuration is required for initialization');
      }

      this.pgCheckpointer = await CheckpointerService.getInstance();
      if (!this.pgCheckpointer) {
        throw new Error('Failed to initialize Postgres checkpointer');
      }
      const graph = await createSupervisorGraph(this);
      if (!graph) {
        throw new Error('Failed to create supervisor graph');
      }
      this.compiledStateGraph = graph;
      // Initialize components here
      // TODO: Implement initialization logic

      logger.info('[SupervisorAgent] Initialized successfully');
    } catch (error) {
      logger.error(`[SupervisorAgent] Initialization failed: ${error}`);
      throw error;
    }
  }

  /**
   * Execute the supervisor agent
   * @param input - The input for execution
   * @returns AsyncGenerator yielding ChunkOutput
   */
  public async *execute(userRequest: UserRequest): AsyncGenerator<any> {
    // TODO: Implement execution logic
    if (!this.compiledStateGraph) {
      throw new Error('SupervisorAgent is not initialized');
    }
    if (!this.controller || this.controller.signal.aborted) {
      this.controller = new AbortController();
    }
    const threadId = this.agentConfig.id;
    const configurable = {
      thread_id: threadId,
      agent_config: this.agentConfig,
    };
    const threadConfig = {
      configurable: configurable,
    };
    const executionConfig = {
      ...threadConfig,
      signal: this.controller.signal,
      recursionLimit: 500,
      version: 'v2' as const,
    };

    for await (const chunk of this.compiledStateGraph.streamEvents(
      {
        messages: [new HumanMessage(userRequest.request || '')],
      },
      executionConfig
    )) {
      yield chunk;
    }
    throw new Error('Execute method not yet implemented');
  }
}
