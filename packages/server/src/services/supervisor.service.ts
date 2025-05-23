// packages/server/src/services/supervisor.service.ts
import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigurationService } from '../../config/configuration.js';
import { DatabaseService } from './database.service.js';
import {
  AgentSystem,
  SupervisorAgent,
  AgentMode,
  SnakAgent,
  SnakAgentConfig,
} from '@snakagent/agents';
import { Postgres } from '@snakagent/database';
import { AgentConfig, ModelsConfig, ModelLevelConfig } from '@snakagent/core';
import { AgentConfigSQL } from '../interfaces/sql_interfaces.js';
import { createContextFromJson } from '@snakagent/agents';
import { SystemMessage } from '@langchain/core/messages';

@Injectable()
export class SupervisorService implements OnModuleInit {
  private readonly logger = new Logger(SupervisorService.name);
  private supervisor: SupervisorAgent | null = null;
  private initialized: boolean = false;

  constructor(
    private readonly config: ConfigurationService,
    private readonly databaseService: DatabaseService
  ) {}

  async onModuleInit() {
    await this.initialize();
  }

  private async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      this.logger.log('Initializing SupervisorService...');

      // Wait for database to be initialized with retry logic
      if (!this.databaseService.isInitialized()) {
        this.logger.log('Waiting for database initialization...');
        let attempts = 0;
        const maxAttempts = 10;
        const waitTime = 500; // 500ms

        while (
          !this.databaseService.isInitialized() &&
          attempts < maxAttempts
        ) {
          await new Promise((resolve) => setTimeout(resolve, waitTime));
          attempts++;
          this.logger.debug(
            `Database initialization attempt ${attempts}/${maxAttempts}`
          );
        }

        if (!this.databaseService.isInitialized()) {
          throw new Error(
            `Database not initialized after ${maxAttempts} attempts`
          );
        }
      }

      // Add a small delay to ensure database is fully ready
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Initialize supervisor agent
      await this.initializeSupervisor();

      // Register existing agents from database
      await this.registerExistingAgents();

      this.initialized = true;
      this.logger.log('SupervisorService initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize SupervisorService:', error);
      // Mark as not initialized so we can retry
      this.initialized = false;
      throw error;
    }
  }

  private async initializeSupervisor(): Promise<void> {
    try {
      // Get models configuration
      const modelsConfig = await this.getModelsConfig();

      // Create supervisor configuration
      const supervisorConfig = {
        modelsConfig: modelsConfig,
        starknetConfig: {
          provider: this.config.starknet.provider,
          accountPrivateKey: this.config.starknet.privateKey,
          accountPublicKey: this.config.starknet.publicKey,
          signature: '',
          db_credentials: {
            database: process.env.POSTGRES_DB as string,
            host: process.env.POSTGRES_HOST as string,
            user: process.env.POSTGRES_USER as string,
            password: process.env.POSTGRES_PASSWORD as string,
            port: parseInt(process.env.POSTGRES_PORT as string),
          },
          agentConfig: {
            name: 'supervisor',
            group: 'system',
            mode: AgentMode.INTERACTIVE,
            memory: { enabled: true, shortTermMemorySize: 15 },
            chatId: 'supervisor_chat',
            maxIterations: 15,
          } as AgentConfig,
        },
        debug: process.env.DEBUG === 'true',
      };

      // Create and initialize supervisor
      this.supervisor = new SupervisorAgent(supervisorConfig);
      await this.supervisor.init();

      this.logger.log('Supervisor agent initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize supervisor agent:', error);
      throw error;
    }
  }

  private async getModelsConfig(): Promise<ModelsConfig> {
    try {
      const q = new Postgres.Query(`SELECT * FROM models_config`);
      const q_res = await Postgres.query<ModelsConfig>(q);

      if (q_res.length === 0) {
        throw new Error('No models configuration found');
      }

      const fast = this.parseModelConfig(q_res[0].fast);
      const smart = this.parseModelConfig(q_res[0].smart);
      const cheap = this.parseModelConfig(q_res[0].cheap);

      return { fast, smart, cheap };
    } catch (error) {
      this.logger.error('Error getting models config:', error);
      throw error;
    }
  }

  private parseModelConfig(config: any): ModelLevelConfig {
    try {
      const content = config.trim().slice(1, -1);
      const parts = content.split(',');
      return {
        provider: parts[0],
        model_name: parts[1],
        description: parts[2],
      };
    } catch (error) {
      this.logger.error('Error parsing model config:', error);
      throw error;
    }
  }

  private async registerExistingAgents(): Promise<void> {
    try {
      this.logger.log('Registering existing agents from database...');

      const existingAgentsQuery = new Postgres.Query(`SELECT * FROM agents`);
      const existingAgents =
        await Postgres.query<AgentConfigSQL>(existingAgentsQuery);

      for (const agentConfig of existingAgents) {
        try {
          // Parse agent prompt if it's a string
          if (typeof agentConfig.prompt === 'string') {
            agentConfig.prompt = this.parseAgentPrompt(agentConfig.prompt);
          }

          // Create SnakAgent for this configuration
          const snakAgent = await this.createSnakAgentFromConfig(agentConfig);

          // Register with supervisor
          if (this.supervisor && snakAgent) {
            const metadata = {
              name: agentConfig.name,
              description: `Agent from group: ${agentConfig.group}`,
              group: agentConfig.group,
            };

            this.supervisor.registerSnakAgent(
              agentConfig.id,
              snakAgent,
              metadata
            );
            this.logger.log(
              `Registered existing agent: ${agentConfig.name} (${agentConfig.id})`
            );
          }
        } catch (error) {
          this.logger.error(
            `Failed to register existing agent ${agentConfig.id}:`,
            error
          );
        }
      }

      // Refresh workflow controller after registering all agents
      if (this.supervisor) {
        await this.supervisor.refreshWorkflowController();
        this.logger.log(
          `Registered ${existingAgents.length} existing agents with supervisor`
        );
      }
    } catch (error) {
      this.logger.error('Error registering existing agents:', error);
      throw error;
    }
  }

  private parseAgentPrompt(agent_prompt: any): any {
    const str_without_double_quote: string = agent_prompt.replace(/"/g, '');
    const agent_prompt_split: string[] = str_without_double_quote.split('{');

    for (let i = 0; i < agent_prompt_split.length; i++) {
      agent_prompt_split[i] = agent_prompt_split[i].replace(/}/g, '');
    }

    return {
      bio: agent_prompt_split[0],
      lore: agent_prompt_split[1].split(','),
      objectives: agent_prompt_split[2].split(','),
      knowledge: agent_prompt_split[3].split(','),
    };
  }

  private async createSnakAgentFromConfig(
    agentConfig: AgentConfigSQL
  ): Promise<any> {
    try {
      const database = {
        database: process.env.POSTGRES_DB as string,
        host: process.env.POSTGRES_HOST as string,
        user: process.env.POSTGRES_USER as string,
        password: process.env.POSTGRES_PASSWORD as string,
        port: parseInt(process.env.POSTGRES_PORT as string),
      };

      const systemMessage = new SystemMessage(
        createContextFromJson(agentConfig.prompt)
      );

      const jsonConfig: AgentConfig = {
        id: agentConfig.id,
        name: agentConfig.name,
        group: agentConfig.group,
        prompt: systemMessage,
        plugins: agentConfig.plugins,
        interval: agentConfig.interval,
        memory: {
          enabled: agentConfig.memory.enabled,
          shortTermMemorySize: agentConfig.memory.short_term_memory_size,
        },
        chatId: `agent_${agentConfig.id}`,
        maxIterations: 15,
        mode: AgentMode.INTERACTIVE,
      };

      // Get the ModelSelectionAgent from the existing supervisor
      const modelSelector = this.supervisor?.getOperator(
        'model-selector'
      ) as any;

      if (!modelSelector) {
        throw new Error('ModelSelectionAgent not available in supervisor');
      }

      // Create SnakAgent configuration
      const snakAgentConfig: SnakAgentConfig = {
        provider: this.config.starknet.provider,
        accountPrivateKey: this.config.starknet.privateKey,
        accountPublicKey: this.config.starknet.publicKey,
        db_credentials: database,
        agentConfig: jsonConfig,
        memory: jsonConfig.memory,
        modelSelector: modelSelector,
      };

      // Create the SnakAgent directly
      const snakAgent = new SnakAgent(snakAgentConfig);
      await snakAgent.init();

      return snakAgent;
    } catch (error) {
      this.logger.error(`Error creating SnakAgent from config:`, error);
      throw error;
    }
  }

  /**
   * Register a new agent with the supervisor
   */
  async registerAgentWithSupervisor(
    agentId: string,
    agentSystem: AgentSystem,
    metadata?: any
  ): Promise<void>;
  async registerAgentWithSupervisor(
    agentId: string,
    snakAgent: SnakAgent,
    metadata?: any
  ): Promise<void>;
  async registerAgentWithSupervisor(
    agentId: string,
    agent: AgentSystem | SnakAgent,
    metadata?: any
  ): Promise<void> {
    if (!this.supervisor) {
      throw new Error('Supervisor not initialized');
    }

    try {
      let snakAgent: SnakAgent;

      // Check if it's an AgentSystem or a SnakAgent
      if (agent instanceof AgentSystem) {
        // Extract the SnakAgent from the AgentSystem
        const extractedAgent = agent.getSupervisor()?.getSnakAgent();

        if (!extractedAgent) {
          throw new Error('Failed to extract SnakAgent from AgentSystem');
        }
        snakAgent = extractedAgent;
      } else {
        // It's already a SnakAgent
        snakAgent = agent;
      }

      // Register with supervisor
      this.supervisor.registerSnakAgent(agentId, snakAgent, metadata);

      // Refresh workflow controller
      await this.supervisor.refreshWorkflowController();

      this.logger.log(
        `Successfully registered agent ${agentId} with supervisor`
      );
    } catch (error) {
      this.logger.error(
        `Failed to register agent ${agentId} with supervisor:`,
        error
      );
      throw error;
    }
  }

  /**
   * Unregister an agent from the supervisor
   */
  async unregisterAgentFromSupervisor(agentId: string): Promise<void> {
    if (!this.supervisor) {
      throw new Error('Supervisor not initialized');
    }

    try {
      // Remove from supervisor's registry
      this.supervisor.unregisterSnakAgent(agentId);

      // Refresh workflow controller after unregistering
      await this.supervisor.refreshWorkflowController();

      this.logger.log(
        `Successfully unregistered agent ${agentId} from supervisor`
      );
    } catch (error) {
      this.logger.error(
        `Failed to unregister agent ${agentId} from supervisor:`,
        error
      );
      throw error;
    }
  }

  /**
   * Execute a request through the supervisor
   */
  async executeRequest(
    input: string,
    config?: Record<string, any>
  ): Promise<any> {
    if (!this.supervisor) {
      throw new Error('Supervisor not initialized');
    }

    try {
      return await this.supervisor.execute(input, config);
    } catch (error) {
      this.logger.error('Error executing request through supervisor:', error);
      throw error;
    }
  }

  /**
   * Get supervisor instance
   */
  getSupervisor(): SupervisorAgent | null {
    return this.supervisor;
  }

  /**
   * Check if supervisor is initialized
   */
  isInitialized(): boolean {
    return this.initialized && this.supervisor !== null;
  }
}
