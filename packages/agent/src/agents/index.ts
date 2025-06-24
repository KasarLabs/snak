import {
  SupervisorAgent,
  SupervisorAgentConfig,
} from './supervisor/supervisorAgent.js';
import { RpcProvider } from 'starknet';
import { logger, AgentConfig, ModelsConfig } from '@snakagent/core';
import { AgentMode } from '../config/agentConfig.js';
import { Postgres } from '@snakagent/database';
import { SnakAgent, SnakAgentConfig } from './core/snakAgent.js';

export interface Conversation {
  conversation_name: string;
}

export interface AgentIterations {
  data: any;
}

export interface MessageRequest {
  agent_id: string;
  user_request: string;
}

export interface Message {
  agent_id: string;
  user_request: string;
  agent_iteration_id: string;
}

export interface ConversationResponse {
  conversation_id: number;
  conversation_name: string;
}

export interface OutputResponse {
  index: number;
  type: string;
  text: string;
}

export interface Response {
  output: Message;
  input: Message;
}

export interface ErrorResponse {
  statusCode: number;
  name: string;
  errorCode: string;
  errorMessage: string;
}

export interface ServerState {
  index: number;
  type: string;
  status: string;
  text: string;
}

/**
 * Configuration for the agent system initialization
 */
export interface AgentSystemConfig {
  starknetProvider: RpcProvider;
  accountPrivateKey: string;
  accountPublicKey: string;
  modelsConfig: ModelsConfig;
  agentMode: AgentMode;
  databaseCredentials: any;
  agentConfigPath?: AgentConfig;
  debug?: boolean;
}

/**
 * Main class for initializing and managing the agent system
 */
export class AgentSystem {
  private supervisorAgent: SupervisorAgent | null = null;
  private config: AgentSystemConfig;
  private agentConfig: AgentConfig;
  private snakAgent: SnakAgent | null = null;

  constructor(config: AgentSystemConfig) {
    this.config = config;
    logger.info('Initializing Agent System\n');
  }

  /**
   * Initializes the agent system by loading configuration and setting up agents
   * @throws {Error} When agent configuration is missing or initialization fails
   */
  public async init(): Promise<void> {
    try {
      if (this.config.agentConfigPath) {
        logger.debug(
          `AgentSystem: Loading agent configuration from: ${this.config.agentConfigPath}`
        );
        try {
          if (typeof this.config.agentConfigPath === 'string') {
            this.agentConfig = await this.loadAgentConfig(
              this.config.agentConfigPath
            );
          } else {
            this.agentConfig = this.config.agentConfigPath;
          }
        } catch (loadError) {
          logger.error(
            `AgentSystem: Failed to load agent configuration: ${loadError}`
          );
        }
      } else {
        logger.warn(
          'AgentSystem: No agentConfigPath provided, proceeding without agent-specific configuration.'
        );
      }

      if (!this.agentConfig) {
        throw new Error('Agent configuration is required');
      }

      const supervisorConfigObject: SupervisorAgentConfig = {
        modelsConfig: this.config.modelsConfig,
        debug: this.config.debug,
        starknetConfig: {
          provider: this.config.starknetProvider,
          accountPrivateKey: this.config.accountPrivateKey,
          accountPublicKey: this.config.accountPublicKey,
          agentConfig: this.agentConfig,
          db_credentials: this.config.databaseCredentials,
          modelSelector: null,
        },
      };

      this.supervisorAgent = new SupervisorAgent(supervisorConfigObject);
      await this.supervisorAgent.init();
      await this.createAndRegisterSnakAgent();

      logger.debug('AgentSystem: Initialization complete');
    } catch (error) {
      logger.error(`AgentSystem: Initialization failed: ${error}`);
      throw new Error(`Failed to initialize agent system: ${error}`);
    }
  }

  /**
   * Creates a SnakAgent and registers it with the SupervisorAgent
   * @throws {Error} When SnakAgent creation or registration fails
   */
  private async createAndRegisterSnakAgent(): Promise<void> {
    try {
      logger.debug('AgentSystem: Creating and registering SnakAgent...');

      const modelSelector = this.supervisorAgent?.getOperator(
        'model-selector'
      ) as any;

      const snakAgentConfig: SnakAgentConfig = {
        provider: this.config.starknetProvider,
        accountPrivateKey: this.config.accountPrivateKey,
        accountPublicKey: this.config.accountPublicKey,
        db_credentials: this.config.databaseCredentials,
        agentConfig: this.agentConfig,
        memory: this.agentConfig.memory,
        modelSelector: modelSelector,
      };

      const controller = new AbortController();
      this.snakAgent = new SnakAgent(snakAgentConfig);
      await this.snakAgent.init();

      if (this.supervisorAgent) {
        const agentId = this.agentConfig.id || 'main-agent';
        const metadata = {
          name: this.agentConfig.name || 'Main SnakAgent',
          description: `Main Snak agent for ${this.agentConfig.name || 'the system'}`,
          group: this.agentConfig.group || 'snak',
        };

        this.supervisorAgent.registerSnakAgent(this.snakAgent, metadata);

        await this.supervisorAgent.refreshWorkflowController();
        logger.debug(`AgentSystem: SnakAgent registered with ID: ${agentId}`);
      } else {
        throw new Error('SupervisorAgent not initialized');
      }
    } catch (error) {
      logger.error(
        `AgentSystem: Failed to create and register SnakAgent: ${error}`
      );
      throw error;
    }
  }

  /**
   * Loads agent configuration from the specified file path
   * @param configPath The path to the agent configuration file
   * @returns A promise that resolves with the parsed AgentConfig
   * @throws {Error} When the configuration file cannot be read or parsed
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
   * Executes a command using the agent system
   * @param message The input message or string for the command
   * @param config Optional configuration for the execution
   * @returns A promise that resolves with the execution result
   * @throws {Error} When the agent system is not initialized or execution fails
   */
  public async execute(
    message: MessageRequest | string,
    isInterrupted: boolean = false,
    config?: Record<string, any>
  ): Promise<any> {
    if (!this.supervisorAgent) {
      throw new Error('Agent system not initialized. Call init() first.');
    }

    try {
      Postgres.connect(this.config.databaseCredentials);
      const content =
        typeof message === 'string' ? message : message.user_request;
      let result;
      for await (const chunk of this.supervisorAgent.execute(
        content,
        false,
        config
      )) {
        if (chunk.final === true) {
          result = chunk.chunk;
        }
      }

      return this.supervisorAgent.formatResponse(result);
    } catch (error) {
      logger.error(`AgentSystem: Execution error: ${error}`);
      throw error;
    }
  }

  /**
   * Retrieves the supervisor agent instance
   * @returns The SupervisorAgent instance, or null if not initialized
   */
  public getSupervisor(): SupervisorAgent | null {
    return this.supervisorAgent;
  }

  /**
   * Retrieves the Snak agent (main agent)
   * @returns The Snak agent instance
   * @throws {Error} When the agent system is not initialized
   */
  public getSnakAgent(): any {
    if (!this.supervisorAgent) {
      throw new Error('Agent system not initialized. Call init() first.');
    }
    return this.snakAgent;
  }

  /**
   * Retrieves an operator by its ID
   * @param id The ID of the operator to retrieve
   * @returns The operator instance
   * @throws {Error} When the agent system is not initialized
   */
  public getOperator(id: string): any {
    if (!this.supervisorAgent) {
      throw new Error('Agent system not initialized. Call init() first.');
    }
    return this.supervisorAgent.getOperator(id);
  }

  /**
   * Releases resources used by the agent system
   */
  public async dispose(): Promise<void> {
    logger.debug('AgentSystem: Disposing resources');

    if (this.snakAgent) {
      try {
        await this.snakAgent.dispose();
      } catch (error) {
        logger.error('AgentSystem: Error disposing SnakAgent:', error);
      }
      this.snakAgent = null;
    }

    this.supervisorAgent = null;
    logger.info('AgentSystem: Resources disposed');
  }

  // /**
  //  * Starts a hybrid execution flow
  //  * @param initialInput The initial input to begin the autonomous execution
  //  * @returns A promise that resolves with the initial state and a thread ID for further interaction
  //  * @throws {Error} When the agent system is not initialized
  //  */
  // public async startHybridExecution(
  //   initialInput: string
  // ): Promise<{ state: any; threadId: string }> {
  //   if (!this.supervisorAgent) {
  //     throw new Error('Agent system not initialized. Call init() first.');
  //   }

  //   return await this.supervisorAgent.startHybridExecution(initialInput);
  // }

  /**
   * Provides input to a paused hybrid execution
   * @param input The human input to provide to the execution
   * @param threadId The thread ID of the paused execution
   * @returns A promise that resolves with the updated state of the execution
   * @throws {Error} When the agent system is not initialized
   */
  // public async provideHybridInput(
  //   input: string,
  //   threadId: string
  // ): Promise<any> {
  //   if (!this.supervisorAgent) {
  //     throw new Error('Agent system not initialized. Call init() first.');
  //   }

  //   return await this.supervisorAgent.provideHybridInput(input, threadId);
  // }

  // /**
  //  * Checks if a hybrid execution is currently waiting for user input
  //  * @param state The current execution state
  //  * @returns True if the execution is waiting for input, false otherwise
  //  * @throws {Error} When the agent system is not initialized
  //  */
  // public isWaitingForInput(state: any): boolean {
  //   if (!this.supervisorAgent) {
  //     throw new Error('Agent system not initialized. Call init() first.');
  //   }

  //   return this.supervisorAgent.isWaitingForInput(state);
  // }

  /**
   * Checks if a hybrid execution has completed
   * @param state The current execution state
   * @returns True if the execution is complete, false otherwise
   * @throws {Error} When the agent system is not initialized
   */
  public isExecutionComplete(state: any): boolean {
    if (!this.supervisorAgent) {
      throw new Error('Agent system not initialized. Call init() first.');
    }

    return this.supervisorAgent.isExecutionComplete(state);
  }
}

/**
 * Helper function to create and initialize an instance of the AgentSystem
 * @param config The configuration for the agent system
 * @returns A promise that resolves with the initialized AgentSystem instance
 */
export async function createAgentSystem(
  config: AgentSystemConfig
): Promise<AgentSystem> {
  const system = new AgentSystem(config);
  await system.init();
  return system;
}
