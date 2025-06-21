import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigurationService } from '../../config/configuration.js';
import { DatabaseService } from './database.service.js';
import { AgentStorage } from '../agents.storage.js';
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
import { SystemMessage } from '@langchain/core/messages';

/**
 * Represents an agent to be registered
 */
interface AgentRegistration {
  id: string;
  agent: SnakAgent;
  metadata?: any;
}

/**
 * Service responsible for managing the supervisor agent and coordinating other agents
 */
@Injectable()
export class SupervisorService implements OnModuleInit {
  private readonly logger = new Logger(SupervisorService.name);
  private supervisor: SupervisorAgent | null = null;
  private initialized: boolean = false;
  private agentInstances: Map<string, SnakAgent> = new Map();

  constructor(
    private readonly config: ConfigurationService,
    private readonly databaseService: DatabaseService,
    private readonly agentStorage: AgentStorage
  ) {}

  async onModuleInit() {
    await this.initialize();
  }

  /**
   * Initialize the supervisor service
   * @private
   */
  private async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      this.logger.log('Initializing SupervisorService...');

      await this.waitForDependencies();

      await this.initializeSupervisorCore();

      const agentConfigs = await this.loadAgentConfigsFromStorage();

      await this.createAllSnakAgents(agentConfigs);

      await this.registerAllAgentsWithSupervisor();

      this.initialized = true;
      this.logger.log('SupervisorService initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize SupervisorService:', error);
      this.initialized = false;
      throw error;
    }
  }

  /**
   * Wait for all dependencies to be initialized
   * @private
   */
  private async waitForDependencies(): Promise<void> {
    this.logger.debug('Waiting for dependencies initialization...');

    try {
      this.logger.debug('Awaiting database service initialization...');
      await this.databaseService.onReady();
      this.logger.debug('Database service initialized');

      this.logger.debug('Awaiting agent storage initialization...');
      await this.agentStorage.onReady();
      this.logger.debug('Agent storage initialized');

      this.logger.debug('All dependencies initialized successfully');
    } catch (error) {
      this.logger.error('Failed to wait for dependencies:', error);
      throw error;
    }
  }

  /**
   * Initialize the supervisor agent core (without registering agents)
   * @private
   */
  private async initializeSupervisorCore(): Promise<void> {
    try {
      this.logger.debug('Initializing SupervisorAgent core...');

      const modelsConfig = await this.getModelsConfig();

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
            documents: { enabled: true },
            chatId: 'supervisor_chat',
            maxIterations: 15,
          } as AgentConfig,
        },
        debug: process.env.DEBUG === 'true',
      };

      this.supervisor = new SupervisorAgent(supervisorConfig);
      await this.supervisor.init();

      this.logger.debug('SupervisorAgent core initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize supervisor agent core:', error);
      throw error;
    }
  }

  /**
   * Get models configuration from database
   * @private
   * @returns {Promise<ModelsConfig>} The models configuration
   */
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

  /**
   * Parse model configuration string
   * @private
   * @param {any} config - The configuration string to parse
   * @returns {ModelLevelConfig} Parsed model configuration
   */
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

  /**
   * Load agent configurations from storage
   * @private
   * @returns {Promise<AgentConfigSQL[]>} Array of agent configurations
   */
  private async loadAgentConfigsFromStorage(): Promise<AgentConfigSQL[]> {
    try {
      this.logger.debug('Loading agent configurations from storage...');

      const agentConfigs = this.agentStorage.getAllAgentConfigs();
      this.logger.log(
        `Loaded ${agentConfigs.length} agent configurations from storage`
      );

      return agentConfigs;
    } catch (error) {
      this.logger.error(
        'Error loading agent configurations from storage:',
        error
      );
      throw error;
    }
  }

  /**
   * Create all SnakAgents from configurations
   * @private
   * @param {AgentConfigSQL[]} agentConfigs - Array of agent configurations
   */
  private async createAllSnakAgents(
    agentConfigs: AgentConfigSQL[]
  ): Promise<void> {
    try {
      this.logger.log(`Creating ${agentConfigs.length} SnakAgents...`);

      const creationPromises = agentConfigs.map(async (agentConfig) => {
        try {
          const snakAgent = await this.createSnakAgentFromConfig(agentConfig);
          this.agentInstances.set(agentConfig.id, snakAgent);

          this.logger.debug(
            `Created SnakAgent: ${agentConfig.name} (${agentConfig.id})`
          );
          return { success: true, id: agentConfig.id, name: agentConfig.name };
        } catch (error) {
          this.logger.error(
            `Failed to create SnakAgent ${agentConfig.id}:`,
            error
          );
          return {
            success: false,
            id: agentConfig.id,
            name: agentConfig.name,
            error,
          };
        }
      });

      const results = await Promise.allSettled(creationPromises);

      const successful = results.filter(
        (result) => result.status === 'fulfilled' && result.value.success
      ).length;

      const failed = results.length - successful;

      this.logger.log(
        `SnakAgent creation completed: ${successful} successful, ${failed} failed`
      );

      if (failed > 0) {
        this.logger.warn(
          `${failed} agents failed to initialize but continuing with workflow setup`
        );
      }
    } catch (error) {
      this.logger.error('Error creating SnakAgents:', error);
      throw error;
    }
  }

  /**
   * Register all created agents with supervisor using batch registration
   * @private
   */
  private async registerAllAgentsWithSupervisor(): Promise<void> {
    if (!this.supervisor) {
      throw new Error('Supervisor not initialized');
    }

    try {
      this.logger.log(
        'Registering all agents with supervisor using batch mode...'
      );

      const agentConfigs = this.agentStorage.getAllAgentConfigs();
      const agentsToRegister: AgentRegistration[] = [];

      // Prepare all agents for batch registration
      for (const agentConfig of agentConfigs) {
        const snakAgent = this.agentInstances.get(agentConfig.id);
        if (snakAgent) {
          const metadata = {
            name: agentConfig.name,
            description: agentConfig.description,
            group: agentConfig.group,
          };

          agentsToRegister.push({
            id: agentConfig.id,
            agent: snakAgent,
            metadata: metadata,
          });

          this.logger.debug(
            `Prepared agent for batch registration: ${agentConfig.name} (${agentConfig.id})`
          );
        } else {
          this.logger.warn(
            `SnakAgent instance not found for ${agentConfig.id}, skipping registration`
          );
        }
      }

      // Register all agents at once (without automatic refresh)
      if (agentsToRegister.length > 0) {
        (this.supervisor as any).registerMultipleSnakAgents(agentsToRegister, {
          updateRegistryAfter: true,
          refreshWorkflowAfter: false,
        });

        this.logger.log(
          `Batch registered ${agentsToRegister.length} agents with supervisor`
        );

        this.logger.log(
          'Refreshing WorkflowController after batch registration...'
        );
        await (this.supervisor as any).refreshWorkflowController(true); // Force full refresh
        this.logger.log('WorkflowController refresh completed');

        const workflowStatus = (this.supervisor as any).getWorkflowStatus();
        this.logger.debug(
          `WorkflowController status after registration: ${JSON.stringify(workflowStatus)}`
        );

        if (workflowStatus.nodeNames.length !== agentsToRegister.length) {
          this.logger.warn(
            `Mismatch: Registered ${agentsToRegister.length} agents but WorkflowController has ${workflowStatus.nodeNames.length} node names`
          );
        } else {
          this.logger.log(
            `WorkflowController successfully updated with ${workflowStatus.nodeNames.length} agents: ${workflowStatus.nodeNames.join(', ')}`
          );
        }
      } else {
        this.logger.warn('No agents available for batch registration');
      }
    } catch (error) {
      this.logger.error(
        'Error batch registering agents with supervisor:',
        error
      );
      throw error;
    }
  }

  /**
   * Get a SnakAgent instance by ID
   * @param {string} id - The agent ID
   * @returns {SnakAgent | undefined} The agent instance or undefined if not found
   */
  public getAgentInstance(id: string): SnakAgent | undefined {
    return this.agentInstances.get(id);
  }

  /**
   * Get all agent instances
   * @returns {SnakAgent[]} Array of all agent instances
   */
  public getAllAgentInstances(): SnakAgent[] {
    return Array.from(this.agentInstances.values());
  }

  /**
   * Add a new agent (create instance and register with supervisor)
   * @param {string} agentId - The agent ID
   * @param {AgentConfigSQL} agentConfig - The agent configuration
   */
  public async addAgentInstance(
    agentId: string,
    agentConfig: AgentConfigSQL
  ): Promise<void> {
    try {
      const snakAgent = await this.createSnakAgentFromConfig(agentConfig);

      if (this.supervisor) {
        const metadata = {
          name: agentConfig.name,
          description: agentConfig.description,
          group: agentConfig.group,
        };

        await this.supervisor.registerSnakAgent(snakAgent, metadata);
        await this.supervisor.refreshWorkflowController();

        this.agentInstances.set(agentId, snakAgent);

        this.logger.log(
          `Added and registered agent: ${agentConfig.name} (${agentId})`
        );
      } else {
        this.agentInstances.set(agentId, snakAgent);
      }
    } catch (error) {
      this.logger.error(`Failed to add agent instance ${agentId}:`, error);
      this.agentInstances.delete(agentId);
      throw error;
    }
  }

  /**
   * Remove an agent instance
   * @param {string} agentId - The agent ID to remove
   */
  public async removeAgentInstance(agentId: string): Promise<void> {
    try {
      const agent = this.agentInstances.get(agentId);

      if (agent) {
        if ('dispose' in agent && typeof agent.dispose === 'function') {
          await agent.dispose();
        }

        this.agentInstances.delete(agentId);
      }

      if (this.supervisor) {
        this.supervisor.unregisterSnakAgent(agentId);
        await this.supervisor.refreshWorkflowController();
      }

      this.logger.log(`Removed agent instance: ${agentId}`);
    } catch (error) {
      this.logger.error(`Failed to remove agent instance ${agentId}:`, error);
      throw error;
    }
  }

  /**
   * Create a SnakAgent from database configuration
   * @private
   * @param {AgentConfigSQL} agentConfig - The agent configuration from database
   * @returns {Promise<any>} The created SnakAgent instance
   */
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

      const systemPrompt =
        agentConfig.system_prompt ||
        this.buildSystemPromptFromConfig({
          name: agentConfig.name,
          description: agentConfig.description,
          lore: agentConfig.lore || [],
          objectives: agentConfig.objectives || [],
          knowledge: agentConfig.knowledge || [],
        });

      const systemMessage = new SystemMessage(systemPrompt);

      const jsonConfig: AgentConfig = {
        id: agentConfig.id,
        name: agentConfig.name,
        group: agentConfig.group,
        description: agentConfig.description,
        prompt: systemMessage,
        plugins: agentConfig.plugins,
        interval: agentConfig.interval,
        memory: {
          enabled: agentConfig.memory.enabled, // Always undefined
          shortTermMemorySize: agentConfig.memory.short_term_memory_size, // Always undefined
        },
        documents: {
          enabled: agentConfig.documents.enabled, // Always undefined
          embeddingModel: agentConfig.documents.embedding_model || undefined, // Always undefined
        },
        chatId: `agent_${agentConfig.id}`,
        maxIterations: agentConfig.max_iterations || 15,
        mode: agentConfig.mode || AgentMode.INTERACTIVE,
      };

      const modelSelector = this.supervisor?.getOperator(
        'model-selector'
      ) as any;

      if (!modelSelector) {
        throw new Error('ModelSelector not available in supervisor');
      }

      const snakAgentConfig: SnakAgentConfig = {
        provider: this.config.starknet.provider,
        accountPrivateKey: this.config.starknet.privateKey,
        accountPublicKey: this.config.starknet.publicKey,
        db_credentials: database,
        agentConfig: jsonConfig,
        memory: jsonConfig.memory,
        modelSelector: modelSelector,
      };

      const snakAgent = new SnakAgent(snakAgentConfig);
      await snakAgent.init();

      return snakAgent;
    } catch (error) {
      this.logger.error(`Error creating SnakAgent from config:`, error);
      throw error;
    }
  }

  /**
   * Build system prompt from configuration components
   * @private
   * @param {Object} promptComponents - The prompt components
   * @param {string} [promptComponents.name] - Agent name
   * @param {string} [promptComponents.description] - Agent description
   * @param {string[]} promptComponents.lore - Agent lore
   * @param {string[]} promptComponents.objectives - Agent objectives
   * @param {string[]} promptComponents.knowledge - Agent knowledge
   * @returns {string} The built system prompt
   */
  private buildSystemPromptFromConfig(promptComponents: {
    name?: string;
    description?: string;
    lore: string[];
    objectives: string[];
    knowledge: string[];
  }): string {
    const contextParts: string[] = [];

    if (promptComponents.name) {
      contextParts.push(`Your name : [${promptComponents.name}]`);
    }
    if (promptComponents.description) {
      contextParts.push(`Your Description : [${promptComponents.description}]`);
    }

    if (
      Array.isArray(promptComponents.lore) &&
      promptComponents.lore.length > 0
    ) {
      contextParts.push(`Your lore : [${promptComponents.lore.join(']\n[')}]`);
    }

    if (
      Array.isArray(promptComponents.objectives) &&
      promptComponents.objectives.length > 0
    ) {
      contextParts.push(
        `Your objectives : [${promptComponents.objectives.join(']\n[')}]`
      );
    }

    if (
      Array.isArray(promptComponents.knowledge) &&
      promptComponents.knowledge.length > 0
    ) {
      contextParts.push(
        `Your knowledge : [${promptComponents.knowledge.join(']\n[')}]`
      );
    }

    return contextParts.join('\n');
  }

  /**
   * Register a new agent with the supervisor
   * @param {string} agentId - The agent ID
   * @param {AgentSystem | SnakAgent} agent - The agent to register
   * @param {any} [metadata] - Optional metadata for the agent
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

      if (agent instanceof AgentSystem) {
        const extractedAgent = agent.getSnakAgent();

        if (!extractedAgent) {
          throw new Error('Failed to extract SnakAgent from AgentSystem');
        }
        snakAgent = extractedAgent;
      } else {
        snakAgent = agent;
      }

      await this.supervisor.registerSnakAgent(snakAgent, metadata);
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
   * @param {string} agentId - The agent ID to unregister
   */
  async unregisterAgentFromSupervisor(agentId: string): Promise<void> {
    if (!this.supervisor) {
      throw new Error('Supervisor not initialized');
    }

    try {
      this.supervisor.unregisterSnakAgent(agentId);
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
   * @param {string} input - The input request
   * @param {Record<string, any>} [config] - Optional configuration
   * @returns {Promise<any>} The execution result
   */
  async executeRequest(
    input: string,
    config?: Record<string, any>
  ): Promise<any> {
    if (!this.supervisor) {
      throw new Error('Supervisor not initialized');
    }

    try {
      this.logger.debug(
        `SupervisorService: Executing request with config: ${JSON.stringify(config)}`
      );
      return await this.supervisor.execute(input, config);
    } catch (error) {
      this.logger.error('Error executing request through supervisor:', error);
      throw error;
    }
  }

  /**
   * Get supervisor instance
   * @returns {SupervisorAgent | null} The supervisor agent instance
   */
  getSupervisor(): SupervisorAgent | null {
    return this.supervisor;
  }

  /**
   * Check if supervisor is initialized
   * @returns {boolean} True if initialized, false otherwise
   */
  isInitialized(): boolean {
    return this.initialized && this.supervisor !== null;
  }
}
