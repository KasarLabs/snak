import { logger } from '@snakagent/core';
import { IAgent } from '../../shared/types/agents.types.js';

/**
 * Registry for managing available operator agents
 */
export class OperatorRegistry {
  private static instance: OperatorRegistry;
  private registry: Map<string, IAgent> = new Map();

  private constructor() {}

  public static getInstance(): OperatorRegistry {
    if (!OperatorRegistry.instance) {
      OperatorRegistry.instance = new OperatorRegistry();
    }
    return OperatorRegistry.instance;
  }

  /**
   * Register a new operator agent
   * @param agentId - Unique identifier for the agent
   * @param agent - The agent instance to register
   */
  public register(agentId: string, agent: IAgent): void {
    if (this.registry.has(agentId)) {
      logger.warn(
        `OperatorRegistry: Operator agent "${agentId}" already registered. Overwriting.`
      );
    }
    this.registry.set(agentId, agent);
    logger.debug(`OperatorRegistry: Registered operator agent "${agentId}"`);
  }¡¡

  /**
   * Unregister an operator agent
   * @param agentId - Unique identifier of the agent to unregister
   * @returns True if the agent was successfully unregistered, false otherwise
   */
  public unregister(agentId: string): boolean {
    const result = this.registry.delete(agentId);
    if (result) {
      logger.debug(
        `OperatorRegistry: Unregistered operator agent "${agentId}"`
      );
    } else {
      logger.warn(
        `OperatorRegistry: Failed to unregister "${agentId}". Agent not found.`
      );
    }
    return result;
  }

  /**
   * Get an operator agent by ID
   * @param agentId - Unique identifier of the agent
   * @returns The agent instance or undefined if not found
   */
  public getAgent(agentId: string): IAgent | undefined {
    return this.registry.get(agentId);
  }

  /**
   * Get all registered operator agents
   * @returns Record containing all registered agents with their IDs as keys
   */
  public getAllAgents(): Record<string, IAgent> {
    const agents: Record<string, IAgent> = {};
    this.registry.forEach((agent, id) => {
      agents[id] = agent;
    });
    return agents;
  }

  /**
   * Get the number of registered agents
   * @returns The count of registered agents
   */
  public size(): number {
    return this.registry.size;
  }

  /**
   * Clear all registered agents from the registry
   */
  public clear(): void {
    this.registry.clear();
    logger.debug('OperatorRegistry: Cleared all operator agents');
  }
}
