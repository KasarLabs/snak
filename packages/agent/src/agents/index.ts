import {
  SupervisorAgent,
  SupervisorAgentConfig,
} from './supervisor/supervisorAgent.js';
import { RpcProvider } from 'starknet';
import { logger, AgentConfig, ModelsConfig } from '@snakagent/core';
import { AgentMode } from '../config/agentConfig.js';
import { Postgres } from '@snakagent/database';
import { SnakAgent, SnakAgentConfig } from './core/snakAgent.js';
import { BaseMessage } from '@langchain/core/messages';
import { DatabaseCredentials } from 'tools/types/database.js';
import { ModelSelector } from './operators/modelSelector.js';
import { IAgent } from './core/baseAgent.types.js';

import type {
  Conversation,
  AgentIterations,
  MessageRequest,
  Message,
  ConversationResponse,
  OutputResponse,
  Response,
  ErrorResponse,
  ServerState,
  ExecutionState,
} from './types.js';

/**
 * Configuration for the agent system initialization
 */
export interface AgentSystemConfig {
  starknetProvider: RpcProvider;
  accountPrivateKey: string;
  accountPublicKey: string;
  modelsConfig: ModelsConfig;
  agentMode: AgentMode;
  databaseCredentials: DatabaseCredentials;
  agentConfigPath?: AgentConfig;
  debug?: boolean;
}

/**
 * Main class for initializing and managing the agent system
 */
export class AgentSystem {
  private readonly supervisorAgent: SupervisorAgent;
  private readonly config: AgentSystemConfig;
  private readonly snakAgent: SnakAgent;
  private agentConfig!: AgentConfig;

  constructor(
    config: AgentSystemConfig,
    supervisorAgent: SupervisorAgent,
    snakAgent: SnakAgent
  ) {
    this.config = config;
    this.supervisorAgent = supervisorAgent;
    this.snakAgent = snakAgent;
    logger.info('Initializing Agent System\n');
  }

  /**
   * Initializes the agent system by loading configuration and setting up agents
   * @throws {Error} When agent configuration is missing or initialization fails
   */
  public async init(): Promise<void> {
    try {
      await this.supervisorAgent.init();
      await this.snakAgent.init();
      this.agentConfig = this.snakAgent.getAgentConfig();

      await this.registerSnakAgent();

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
  private async registerSnakAgent(): Promise<void> {
    try {
      logger.debug('AgentSystem: Registering SnakAgent...');

      const agentId = this.agentConfig.id || 'main-agent';
      const metadata = {
        name: this.agentConfig.name || 'Main SnakAgent',
        description: `Main Snak agent for ${this.agentConfig.name || 'the system'}`,
        group: this.agentConfig.group || 'snak',
      };

      this.supervisorAgent.registerSnakAgent(this.snakAgent, metadata);

      await this.supervisorAgent.refreshWorkflowController();
      logger.debug(`AgentSystem: SnakAgent registered with ID: ${agentId}`);
    } catch (error) {
      logger.error(
        `AgentSystem: Failed to create and register SnakAgent: ${error}`
      );
      throw error;
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
    config?: Record<string, unknown>
  ): Promise<string> {
    try {
      this.connectDatabase();
      const content = this.extractContent(message);
      const result = await this.runSupervisorExecution(content, config);
      return this.formatExecutionResult(result);
    } catch (error) {
      logger.error(`AgentSystem: Execution error: ${error}`);
      throw error;
    }
  }

  private connectDatabase(): void {
    Postgres.connect(this.config.databaseCredentials);
  }

  private extractContent(message: MessageRequest | string): string {
    return typeof message === 'string' ? message : message.user_request;
  }

  private async runSupervisorExecution(
    content: string,
    config?: Record<string, unknown>
  ): Promise<OutputResponse | Response> {
    let result: OutputResponse | Response | undefined;
    for await (const chunk of this.supervisorAgent.execute(
      content,
      false,
      config
    )) {
      if (chunk.final === true) {
        result = chunk.chunk;
      }
    }
    if (!result) {
      throw new Error('No result received from supervisor execution');
    }
    return result;
  }

  private formatExecutionResult(result: OutputResponse | Response): string {
    return this.supervisorAgent.formatResponse(result);
  }

  /**
   * Retrieves the supervisor agent instance
   * @returns The SupervisorAgent instance, or null if not initialized
   */
  public getSupervisor(): SupervisorAgent {
    return this.supervisorAgent;
  }

  /**
   * Retrieves the Snak agent (main agent)
   * @returns The Snak agent instance
   * @throws {Error} When the agent system is not initialized
   */
  public getSnakAgent(): SnakAgent {
    return this.snakAgent;
  }

  /**
   * Retrieves an operator by its ID
   * @param id The ID of the operator to retrieve
   * @returns The operator instance
   * @throws {Error} When the agent system is not initialized
   */
  public getOperator(id: string): IAgent | undefined {
    return this.supervisorAgent.getOperator(id);
  }

  /**
   * Releases resources used by the agent system
   */
  public async dispose(): Promise<void> {
    logger.debug('AgentSystem: Disposing resources');

    try {
      await this.snakAgent.dispose();
    } catch (error) {
      logger.error('AgentSystem: Error disposing SnakAgent:', error);
    }

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
  public isExecutionComplete(state: ExecutionState): boolean {
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
  let agentConfig: AgentConfig;
  if (config.agentConfigPath) {
    logger.debug(
      `AgentSystem: Loading agent configuration from: ${config.agentConfigPath}`
    );
    if (typeof config.agentConfigPath === 'string') {
      try {
        const fs = await import('fs/promises');
        const content = await fs.readFile(config.agentConfigPath, 'utf-8');
        agentConfig = JSON.parse(content);
      } catch (error) {
        throw new Error(`Failed to load agent configuration from ${config.agentConfigPath}: ${error}`);
      }
    } else {
      agentConfig = config.agentConfigPath;
    }
  } else {
    throw new Error('Agent configuration is required');
  }

  const supervisorConfig: SupervisorAgentConfig = {
    modelsConfig: config.modelsConfig,
    debug: config.debug,
    starknetConfig: {
      provider: config.starknetProvider,
      accountPrivateKey: config.accountPrivateKey,
      accountPublicKey: config.accountPublicKey,
      agentConfig,
      db_credentials: config.databaseCredentials,
      modelSelector: null,
    },
  };

  const supervisorAgent = new SupervisorAgent(supervisorConfig);
  await supervisorAgent.init();

  const modelSelector = supervisorAgent.getOperator(
    'model-selector'
  ) as ModelSelector | null;

  const snakAgentConfig: SnakAgentConfig = {
    provider: config.starknetProvider,
    accountPrivateKey: config.accountPrivateKey,
    accountPublicKey: config.accountPublicKey,
    db_credentials: config.databaseCredentials,
    agentConfig,
    memory: agentConfig.memory,
    modelSelector,
  };

  const snakAgent = new SnakAgent(snakAgentConfig);
  await snakAgent.init();

  const system = new AgentSystem(config, supervisorAgent, snakAgent);
  await system.init();
  return system;
}
