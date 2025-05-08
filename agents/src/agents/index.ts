import {
  SupervisorAgent,
  SupervisorAgentConfig,
} from './supervisor/supervisorAgent.js';
import { RpcProvider } from 'starknet';
import { logger } from '@snakagent/core';
import { AgentConfig, AgentMode } from '../config/agentConfig.js';

/**
 * Configuration for the agent system initialization
 */
export interface AgentSystemConfig {
  starknetProvider: RpcProvider;
  accountPrivateKey: string;
  accountPublicKey: string;
  modelsConfigPath: string;
  agentMode: AgentMode;
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
  private agentConfig: AgentConfig;

  constructor(config: AgentSystemConfig) {
    this.config = config;
    logger.info('Initializing Agent System');
  }

  /**
   * Initializes the agent system.
   * This involves loading the agent configuration (if provided) and setting up the supervisor agent.
   */
  public async init(): Promise<void> {
    try {
      // Load agent configuration if path is provided
      if (this.config.agentConfigPath) {
        logger.debug(
          `AgentSystem: Loading agent configuration from: ${this.config.agentConfigPath}`
        );
        try {
          this.agentConfig = await this.loadAgentConfig(
            this.config.agentConfigPath
          );
        } catch (loadError) {
          logger.error(
            `AgentSystem: Failed to load agent configuration: ${loadError}`
          );
          // Continue without agentConfig if loading fails
          this.agentConfig = null;
        }
      } else {
        logger.warn(
          'AgentSystem: No agentConfigPath provided, proceeding without agent-specific configuration.'
        );
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
          agentConfig: this.agentConfig,
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
   * Loads agent configuration from the specified file path.
   * @param configPath The path to the agent configuration file.
   * @returns A promise that resolves with the parsed AgentConfig.
   * @throws Will throw an error if the configuration file cannot be read or parsed.
   */
  private async loadAgentConfig(configPath: string): Promise<AgentConfig> {
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
   * Executes a command using the agent system.
   * @param input The input string for the command.
   * @param config Optional configuration for the execution.
   * @returns A promise that resolves with the execution result.
   * @throws Will throw an error if the agent system is not initialized or if execution fails.
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
   * Retrieves the supervisor agent instance.
   * @returns The SupervisorAgent instance, or null if not initialized.
   */
  public getSupervisor(): SupervisorAgent | null {
    return this.supervisorAgent;
  }

  /**
   * Retrieves the Starknet agent (main agent).
   * @returns The Starknet agent instance.
   * @throws Will throw an error if the agent system is not initialized.
   */
  public getStarknetAgent(): any {
    if (!this.supervisorAgent) {
      throw new Error('Agent system not initialized. Call init() first.');
    }
    return this.supervisorAgent.getStarknetAgent();
  }

  /**
   * Retrieves an operator by its ID.
   * @param id The ID of the operator to retrieve.
   * @returns The operator instance.
   * @throws Will throw an error if the agent system is not initialized.
   */
  public getOperator(id: string): any {
    if (!this.supervisorAgent) {
      throw new Error('Agent system not initialized. Call init() first.');
    }
    return this.supervisorAgent.getOperator(id);
  }

  /**
   * Releases resources used by the agent system.
   * Sets the supervisor agent to null.
   */
  public async dispose(): Promise<void> {
    logger.debug('AgentSystem: Disposing resources');
    this.supervisorAgent = null;
    logger.info('AgentSystem: Resources disposed');
  }

  /**
   * Starts a hybrid execution flow.
   * @param initialInput The initial input to begin the autonomous execution.
   * @returns A promise that resolves with the initial state and a thread ID for further interaction.
   * @throws Will throw an error if the agent system is not initialized.
   */
  public async startHybridExecution(
    initialInput: string
  ): Promise<{ state: any; threadId: string }> {
    if (!this.supervisorAgent) {
      throw new Error('Agent system not initialized. Call init() first.');
    }

    return await this.supervisorAgent.startHybridExecution(initialInput);
  }

  /**
   * Provides input to a paused hybrid execution.
   * @param input The human input to provide to the execution.
   * @param threadId The thread ID of the paused execution.
   * @returns A promise that resolves with the updated state of the execution.
   * @throws Will throw an error if the agent system is not initialized.
   */
  public async provideHybridInput(
    input: string,
    threadId: string
  ): Promise<any> {
    if (!this.supervisorAgent) {
      throw new Error('Agent system not initialized. Call init() first.');
    }

    return await this.supervisorAgent.provideHybridInput(input, threadId);
  }

  /**
   * Checks if a hybrid execution is currently waiting for user input.
   * @param state The current execution state.
   * @returns True if the execution is waiting for input, false otherwise.
   * @throws Will throw an error if the agent system is not initialized.
   */
  public isWaitingForInput(state: any): boolean {
    if (!this.supervisorAgent) {
      throw new Error('Agent system not initialized. Call init() first.');
    }

    return this.supervisorAgent.isWaitingForInput(state);
  }

  /**
   * Checks if a hybrid execution has completed.
   * @param state The current execution state.
   * @returns True if the execution is complete, false otherwise.
   * @throws Will throw an error if the agent system is not initialized.
   */
  public isExecutionComplete(state: any): boolean {
    if (!this.supervisorAgent) {
      throw new Error('Agent system not initialized. Call init() first.');
    }

    return this.supervisorAgent.isExecutionComplete(state);
  }
}

/**
 * Helper function to create and initialize an instance of the AgentSystem.
 * @param config The configuration for the agent system.
 * @returns A promise that resolves with the initialized AgentSystem instance.
 */
export async function createAgentSystem(
  config: AgentSystemConfig
): Promise<AgentSystem> {
  const system = new AgentSystem(config);
  await system.init();
  return system;
}
