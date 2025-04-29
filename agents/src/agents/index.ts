// agents/index.ts
import {
  SupervisorAgent,
  SupervisorAgentConfig,
} from './supervisor/supervisorAgent.js';
import { RpcProvider } from 'starknet';
import { logger } from '@snakagent/core';
import { JsonConfig } from '../config/jsonConfig.js';

/**
 * Configuration pour l'initialisation du système d'agents
 */
export interface AgentSystemConfig {
  starknetProvider: RpcProvider;
  accountPrivateKey: string;
  accountPublicKey: string;
  modelsConfigPath: string;
  agentMode: 'interactive' | 'autonomous';
  signature: string;
  databaseCredentials: any;
  agentConfigPath?: string;
  debug?: boolean;
}

/**
 * Classe principale pour initialiser et gérer le système d'agents
 */
export class AgentSystem {
  private supervisorAgent: SupervisorAgent | null = null;
  private config: AgentSystemConfig;
  private agentConfig: JsonConfig | null = null;

  constructor(config: AgentSystemConfig) {
    this.config = config;
    logger.info('Initializing Agent System');
  }

  /**
   * Initialise le système d'agents
   */
  public async init(): Promise<void> {
    try {
      logger.debug('AgentSystem: Starting initialization');
      // Log the received config path
      logger.debug(
        `AgentSystem: Received agentConfigPath: ${this.config.agentConfigPath}`
      );

      // Charger la configuration de l'agent si le chemin est fourni
      if (this.config.agentConfigPath) {
        logger.debug(
          `AgentSystem: Attempting to load config from path: ${this.config.agentConfigPath}`
        );
        try {
          this.agentConfig = await this.loadAgentConfig(
            this.config.agentConfigPath
          );
          logger.debug(
            `AgentSystem: Successfully loaded agentConfig. Keys: ${this.agentConfig ? Object.keys(this.agentConfig).join(', ') : 'null'}`
          );
        } catch (loadError) {
          logger.error(
            `AgentSystem: Error during loadAgentConfig: ${loadError}`
          );
          this.agentConfig = null; // Ensure it's null on error
        }
      } else {
        logger.warn(
          'AgentSystem: No agentConfigPath provided in config, agentConfig will be null.'
        );
        this.agentConfig = null; // Ensure it's null if no path
      }

      // Initialiser l'agent superviseur
      logger.debug(
        'AgentSystem: ====> CHECKING this.agentConfig JUST BEFORE SupervisorAgent CREATION <===='
      );
      logger.debug(this.agentConfig); // Log direct de l'objet
      logger.debug('AgentSystem: ====> FINISHED CHECKING <====');

      // Create the config object for SupervisorAgent step-by-step
      logger.debug(
        'AgentSystem: Building supervisorConfigObject step-by-step...'
      );
      const supervisorConfigObject: Partial<SupervisorAgentConfig> = {}; // Start with partial

      supervisorConfigObject.modelsConfigPath = this.config.modelsConfigPath;
      logger.debug(
        `AgentSystem: Added modelsConfigPath. Current keys: ${Object.keys(supervisorConfigObject).join(', ')}`
      );

      supervisorConfigObject.agentMode = this.config.agentMode;
      logger.debug(
        `AgentSystem: Added agentMode. Current keys: ${Object.keys(supervisorConfigObject).join(', ')}`
      );

      supervisorConfigObject.debug = this.config.debug;
      logger.debug(
        `AgentSystem: Added debug. Current keys: ${Object.keys(supervisorConfigObject).join(', ')}`
      );

      supervisorConfigObject.agentConfig = this.agentConfig || undefined;
      logger.debug(
        `AgentSystem: Added agentConfig. Exists: ${!!supervisorConfigObject.agentConfig}. Current keys: ${Object.keys(supervisorConfigObject).join(', ')}`
      );

      supervisorConfigObject.starknetConfig = {
        provider: this.config.starknetProvider,
        accountPrivateKey: this.config.accountPrivateKey,
        accountPublicKey: this.config.accountPublicKey,
        signature: this.config.signature,
        agentMode: this.config.agentMode,
        db_credentials: this.config.databaseCredentials,
        agentconfig: this.agentConfig || undefined,
      };
      logger.debug(
        `AgentSystem: Added starknetConfig. Exists: ${!!supervisorConfigObject.starknetConfig}. Current keys: ${Object.keys(supervisorConfigObject).join(', ')}`
      );

      logger.debug('AgentSystem: Finished building supervisorConfigObject.');
      // logger.debug('AgentSystem: Prepared supervisorConfigObject. Keys:', Object.keys(supervisorConfigObject).join(', ')); // Old log
      // logger.debug('AgentSystem: supervisorConfigObject.agentConfig exists:', !!supervisorConfigObject.agentConfig); // Old log

      // Pass the step-by-step created object - need type assertion
      this.supervisorAgent = new SupervisorAgent(
        supervisorConfigObject as SupervisorAgentConfig
      );

      // Initialiser le superviseur, qui à son tour initialisera tous les autres agents
      await this.supervisorAgent.init();

      logger.info('AgentSystem: Initialization complete');
    } catch (error) {
      logger.error(`AgentSystem: Initialization failed: ${error}`);
      throw new Error(`Failed to initialize agent system: ${error}`);
    }
  }

  /**
   * Charge la configuration de l'agent à partir du chemin spécifié
   */
  private async loadAgentConfig(configPath: string): Promise<JsonConfig> {
    try {
      // Ici, nous importerions dynamiquement la configuration JSON
      // Pour simplifier, supposons que cela fonctionne comme suit:
      const fs = await import('fs/promises');
      const configContent = await fs.readFile(configPath, 'utf-8');
      return JSON.parse(configContent);
    } catch (error) {
      logger.error(
        `Failed to load agent configuration from ${configPath}: ${error}`
      );
      throw new Error(`Failed to load agent configuration: ${error}`);
    }
  }

  /**
   * Exécute une commande avec le système d'agents
   */
  public async execute(
    input: string,
    config?: Record<string, any>
  ): Promise<any> {
    if (!this.supervisorAgent) {
      throw new Error('Agent system not initialized. Call init() first.');
    }

    try {
      return await this.supervisorAgent.execute(input, config);
    } catch (error) {
      logger.error(`AgentSystem: Execution error: ${error}`);
      throw error;
    }
  }

  /**
   * Obtient l'agent superviseur
   */
  public getSupervisor(): SupervisorAgent | null {
    return this.supervisorAgent;
  }

  /**
   * Obtient l'agent Starknet (agent principal)
   */
  public getStarknetAgent(): any {
    if (!this.supervisorAgent) {
      throw new Error('Agent system not initialized. Call init() first.');
    }
    return this.supervisorAgent.getStarknetAgent();
  }

  /**
   * Obtient un opérateur par son ID
   */
  public getOperator(id: string): any {
    if (!this.supervisorAgent) {
      throw new Error('Agent system not initialized. Call init() first.');
    }
    return this.supervisorAgent.getOperator(id);
  }

  /**
   * Libère les ressources du système d'agents
   */
  public async dispose(): Promise<void> {
    // Ici, nous libérerions toutes les ressources utilisées par le système d'agents
    logger.debug('AgentSystem: Disposing resources');

    // Réinitialiser les références
    this.supervisorAgent = null;

    logger.info('AgentSystem: Resources disposed');
  }
}

// Fonction d'aide pour créer un système d'agents
export async function createAgentSystem(
  config: AgentSystemConfig
): Promise<AgentSystem> {
  const system = new AgentSystem(config);
  await system.init();
  return system;
}
