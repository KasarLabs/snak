import {
  SupervisorAgent,
  SupervisorAgentConfig,
} from './supervisor/supervisorAgent.js';
import { RpcProvider } from 'starknet';
import { logger } from '@snakagent/core';
import { JsonConfig } from '../config/jsonConfig.js';

/**
 * Configuration for the agent system initialization
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
 * Main class for initializing and managing the agent system
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
   * Initialize the agent system
   */
  public async init(): Promise<void> {
    try {
      logger.debug('AgentSystem: Starting initialization');

      // Load agent configuration if path is provided
      if (this.config.agentConfigPath) {
        logger.debug(
          `AgentSystem: Loading config from: ${this.config.agentConfigPath}`
        );
        try {
          this.agentConfig = await this.loadAgentConfig(
            this.config.agentConfigPath
          );
          logger.debug('AgentSystem: Successfully loaded agent configuration');
        } catch (loadError) {
          logger.error(
            `AgentSystem: Error during config loading: ${loadError}`
          );
          this.agentConfig = null;
        }
      } else {
        logger.warn('AgentSystem: No agentConfigPath provided');
        this.agentConfig = null;
      }

      // Create the config object for SupervisorAgent
      const supervisorConfigObject: SupervisorAgentConfig = {
        modelsConfigPath: this.config.modelsConfigPath,
        debug: this.config.debug,
        starknetConfig: {
          provider: this.config.starknetProvider,
          accountPrivateKey: this.config.accountPrivateKey,
          accountPublicKey: this.config.accountPublicKey,
          signature: this.config.signature,
          agentConfig: this.agentConfig || undefined,
          db_credentials: this.config.databaseCredentials,
        },
      };

      // Initialize the supervisor agent
      this.supervisorAgent = new SupervisorAgent(supervisorConfigObject);

      // Initialize the supervisor, which will initialize all other agents
      await this.supervisorAgent.init();

      logger.info('AgentSystem: Initialization complete');
    } catch (error) {
      logger.error(`AgentSystem: Initialization failed: ${error}`);
      throw new Error(`Failed to initialize agent system: ${error}`);
    }
  }

  /**
   * Load agent configuration from the specified path
   */
  private async loadAgentConfig(configPath: string): Promise<JsonConfig> {
    try {
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
   * Execute a command with the agent system
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
   * Get the supervisor agent
   */
  public getSupervisor(): SupervisorAgent | null {
    return this.supervisorAgent;
  }

  /**
   * Get the Starknet agent (main agent)
   */
  public getStarknetAgent(): any {
    if (!this.supervisorAgent) {
      throw new Error('Agent system not initialized. Call init() first.');
    }
    return this.supervisorAgent.getStarknetAgent();
  }

  /**
   * Get an operator by ID
   */
  public getOperator(id: string): any {
    if (!this.supervisorAgent) {
      throw new Error('Agent system not initialized. Call init() first.');
    }
    return this.supervisorAgent.getOperator(id);
  }

  /**
   * Release agent system resources
   */
  public async dispose(): Promise<void> {
    logger.debug('AgentSystem: Disposing resources');
    this.supervisorAgent = null;
    logger.info('AgentSystem: Resources disposed');
  }
}

/**
 * Helper function to create an agent system
 */
export async function createAgentSystem(
  config: AgentSystemConfig
): Promise<AgentSystem> {
  const system = new AgentSystem(config);
  await system.init();
  return system;
}
