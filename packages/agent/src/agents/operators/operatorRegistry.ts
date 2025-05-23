import { IAgent } from '../core/baseAgent.js';
import { logger } from '@snakagent/core';

/**
 * Registre pour gérer les agents opérateurs disponibles
 */
export class OperatorRegistry {
  private static instance: OperatorRegistry;
  private registry: Map<string, IAgent> = new Map();

  private constructor() {
    // Constructeur privé pour le pattern singleton
  }

  public static getInstance(): OperatorRegistry {
    if (!OperatorRegistry.instance) {
      OperatorRegistry.instance = new OperatorRegistry();
    }
    return OperatorRegistry.instance;
  }

  /**
   * Enregistrer un nouvel agent opérateur
   */
  public register(agentId: string, agent: IAgent): void {
    if (this.registry.has(agentId)) {
      logger.warn(
        `OperatorRegistry: Operator agent "${agentId}" already registered. Overwriting.`
      );
    }
    this.registry.set(agentId, agent);
    logger.debug(`OperatorRegistry: Registered operator agent "${agentId}"`);
  }

  /**
   * Désinscrire un agent opérateur
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
   * Récupérer un agent opérateur par ID
   */
  public getAgent(agentId: string): IAgent | undefined {
    return this.registry.get(agentId);
  }

  /**
   * Récupérer tous les agents opérateurs enregistrés
   */
  public getAllAgents(): Record<string, IAgent> {
    const agents: Record<string, IAgent> = {};
    this.registry.forEach((agent, id) => {
      agents[id] = agent;
    });
    return agents;
  }

  /**
   * Obtenir le nombre d'agents enregistrés
   */
  public size(): number {
    return this.registry.size;
  }

  /**
   * Vider le registre
   */
  public clear(): void {
    this.registry.clear();
    logger.debug('OperatorRegistry: Cleared all operator agents');
  }
}
