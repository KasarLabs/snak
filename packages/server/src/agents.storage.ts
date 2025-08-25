import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigurationService } from '../config/configuration.js';
import { DatabaseService } from './services/database.service.js';
import { Postgres } from '@snakagent/database';
import {
  AgentConfig,
  ModelsConfig,
  ModelProviders,
  ModelLevelConfig,
  RawAgentConfig,
  AgentMode,
} from '@snakagent/core';
import {
  AgentConfigSQL,
  AgentRagSQL,
  AgentMemorySQL,
} from './interfaces/sql_interfaces.js';

// Add this import if ModelSelectorConfig is exported from @snakagent/core
import DatabaseStorage from '../common/database/database.js';
import {
  AgentSelector,
  ModelSelector,
  SnakAgent,
  SnakAgentConfig,
} from '@snakagent/agents';
import { SystemMessage } from '@langchain/core/messages';

const logger = new Logger('AgentStorage');

/**
 * Service responsible for managing agent storage, configuration, and lifecycle
 */
@Injectable()
export class AgentStorage implements OnModuleInit {
  private agentConfigs: AgentConfigSQL[] = [];
  private agentInstances: Map<string, SnakAgent> = new Map();
  private agentSelector: AgentSelector;
  private initialized: boolean = false;
  private initializationPromise: Promise<void> | null = null;

  constructor(
    private readonly config: ConfigurationService,
    private readonly databaseService: DatabaseService
  ) {}

  async onModuleInit() {
    await this.initialize();
  }

  /* ==================== PUBLIC GETTERS ==================== */

  /**
   * Get an agent configuration by ID
   * @param id - Agent ID
   * @param userId - User ID to verify ownership
   * @returns AgentConfigSQL | undefined - The agent configuration or undefined if not found or not owned by user
   */
  public getAgentConfig(
    id: string,
    userId: string
  ): AgentConfigSQL | undefined {
    if (!this.initialized) {
      return undefined;
    }

    const config = this.agentConfigs.find(
      (config) => config.id === id && config.user_id === userId
    );

    if (!config) {
      logger.debug(`Agent ${id} not found for user ${userId}`);
    }

    return config;
  }

  /**
   * Get all agent configurations
   * @returns AgentConfigSQL[] - Array of all agent configurations
   */
  public getAllAgentConfigs(): AgentConfigSQL[] {
    if (!this.initialized) {
      return [];
    }
    return [...this.agentConfigs];
  }

  /**
   * Get a SnakAgent instance by ID
   * @param {string} id - The agent ID
   * @param {string} userId - User ID to verify ownership (required)
   * @returns {SnakAgent | undefined} The agent instance or undefined if not found or not owned by user
   */
  public getAgentInstance(id: string, userId: string): SnakAgent | undefined {
    const compositeKey = `${id}:${userId}`;
    return this.agentInstances.get(compositeKey);
  }

  /**
   * Get all agent instances
   * @param userId - Optional user ID to filter instances
   * @returns {SnakAgent[]} Array of all agent instances
   */
  public getAllAgentInstances(userId?: string): SnakAgent[] {
    if (userId) {
      return this.getAgentInstancesByUser(userId);
    }
    logger.warn('Returning all agent instances across all users');
    return Array.from(this.agentInstances.values());
  }

  public getAgentSelector(): AgentSelector {
    if (!this.agentSelector) {
      throw new Error('AgentSelector is not initialized');
    }
    return this.agentSelector;
  }

  public getAgentInstancesByName(name: string): SnakAgent {
    const instance = Array.from(this.agentInstances.values()).find(
      (agent) => agent.getAgentConfig().name === name
    );
    if (!instance) {
      throw new Error(`No agent found with name: ${name}`);
    }
    return instance;
  }

  /**
   * Get all agent instances for a specific user
   * @param {string} userId - The user ID
   * @returns {SnakAgent[]} Array of agent instances owned by the user
   */
  public getAgentInstancesByUser(userId: string): SnakAgent[] {
    const userAgents: SnakAgent[] = [];
    for (const [key, instance] of this.agentInstances.entries()) {
      if (key.endsWith(`:${userId}`)) {
        userAgents.push(instance);
      }
    }
    return userAgents;
  }

  public isInitialized(): boolean {
    return this.initialized;
  }

  /* ==================== PUBLIC CRUD OPERATIONS ==================== */

  /**
   * Add a new agent to the system
   * @param agent_config - Raw agent configuration
   * @returns Promise<AgentConfigSQL> - The newly created agent configuration
   */
  public async addAgent(agent_config: RawAgentConfig): Promise<AgentConfigSQL> {
    logger.debug(`Adding agent with config: ${JSON.stringify(agent_config)}`);

    if (!this.initialized) {
      await this.initialize();
    }

    const baseName = agent_config.name;
    const group = agent_config.group;

    let finalName = baseName;
    const nameCheckQuery = new Postgres.Query(
      `SELECT name FROM agents WHERE "group" = $1 AND (name = $2 OR name LIKE $2 || '-%') ORDER BY LENGTH(name) DESC, name DESC LIMIT 1`,
      [group, baseName]
    );
    logger.debug(`Name check query: ${nameCheckQuery}`);
    const nameCheckResult = await Postgres.query<{ name: string }>(
      nameCheckQuery
    );

    if (nameCheckResult.length > 0) {
      const existingName = nameCheckResult[0].name;
      if (existingName === baseName) {
        finalName = `${baseName}-1`;
      } else {
        const escapedBaseName = baseName.replace(/[.*+?^${}()|[\\]]/g, '\\$&');
        const suffixMatch = existingName.match(
          new RegExp(`^${escapedBaseName}-(\\d+)$`)
        );
        if (suffixMatch && suffixMatch[1]) {
          const lastIndex = parseInt(suffixMatch[1], 10);
          finalName = `${baseName}-${lastIndex + 1}`;
        } else {
          logger.warn(
            `Unexpected name format found: ${existingName} for baseName: ${baseName} in group: ${group}. Attempting to suffix with -1.`
          );
          finalName = `${baseName}-1`;
        }
      }
    }

    const systemPrompt = this.buildSystemPromptFromConfig({
      name: finalName,
      description: agent_config.description,
      lore: agent_config.lore,
      objectives: agent_config.objectives,
      knowledge: agent_config.knowledge,
    });

    const q = new Postgres.Query(
      `INSERT INTO agents (name, "group", description, lore, objectives, knowledge, system_prompt, interval, plugins, memory, rag, mode, max_iterations, "mcpServers", user_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, ROW($10, $11, $12), ROW($13, $14), $15, $16, $17, $18) RETURNING *`,
      [
        finalName,
        group,
        agent_config.description,
        agent_config.lore,
        agent_config.objectives,
        agent_config.knowledge,
        systemPrompt,
        agent_config.interval,
        agent_config.plugins,
        agent_config.memory.enabled || false,
        agent_config.memory.shortTermMemorySize || 5,
        agent_config.memory.memorySize || 20,
        agent_config.rag?.enabled || false,
        agent_config.rag?.embeddingModel || null,
        agent_config.mode,
        15,
        agent_config.mcpServers || '{}',
        agent_config.user_id,
      ]
    );
    const q_res = await Postgres.query<AgentConfigSQL>(q);
    logger.debug(`Agent added to database: ${JSON.stringify(q_res)}`);

    if (q_res.length > 0) {
      const newAgentDbRecord = {
        ...q_res[0],
        memory: this.parseMemoryConfig(q_res[0].memory),
        rag: this.parseRagConfig(q_res[0].rag),
      };
      this.agentConfigs.push(newAgentDbRecord);
      this.createSnakAgentFromConfig(newAgentDbRecord)
        .then((snakAgent) => {
          const compositeKey = `${newAgentDbRecord.id}:${newAgentDbRecord.user_id}`;
          this.agentInstances.set(compositeKey, snakAgent);
          this.agentSelector.updateAvailableAgents([
            newAgentDbRecord.id,
            snakAgent,
          ]);
        })
        .catch((error) => {
          logger.error(
            `Failed to create SnakAgent for new agent ${newAgentDbRecord.id}: ${error}`
          );
          throw error;
        });
      logger.debug(`Agent ${newAgentDbRecord.id} added to configuration`);
      return newAgentDbRecord;
    } else {
      logger.error('Failed to add agent to database, no record returned.');
      throw new Error('Failed to add agent to database.');
    }
  }

  /**
   * Delete an agent from the system
   * @param id - Agent ID to delete
   * @param userId - User ID to verify ownership
   * @returns Promise<void>
   */
  public async deleteAgent(id: string, userId: string): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    const q = new Postgres.Query(
      `DELETE FROM agents WHERE id = $1 AND user_id = $2 RETURNING *`,
      [id, userId]
    );
    const q_res = await Postgres.query<AgentConfigSQL>(q);
    logger.debug(`Agent deleted from database: ${JSON.stringify(q_res)}`);

    this.agentConfigs = this.agentConfigs.filter((config) => config.id !== id);
    this.agentInstances.delete(id);
    this.agentSelector.removeAgent(id);
    logger.debug(`Agent ${id} removed from local configuration`);
  }

  /* ==================== PUBLIC UTILITIES ==================== */

  /**
   * Returns a promise that resolves when the agent storage is fully initialized
   * @returns Promise<void> that resolves when initialization is complete
   */
  public async onReady(): Promise<void> {
    if (this.initialized) {
      return;
    }

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    // If not initialized and no promise exists, trigger initialization
    return this.initialize();
  }

  /* ==================== PRIVATE INITIALIZATION METHODS ==================== */

  /**
   * Initialize the agent storage service
   * @private
   */
  private async initialize() {
    if (this.initialized) {
      return;
    }

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    // Create and store the initialization promise
    this.initializationPromise = this.performInitialize();
    try {
      await this.initializationPromise;
      const modelConfig = await this.get_models_config();
      if (!modelConfig) {
        throw new Error('ModelConfig is not available.');
      }
      logger.debug(
        `Model configuration loaded: ${JSON.stringify(modelConfig)}`
      );

      // Init Agent Selector
      const modelSelector = new ModelSelector({
        debugMode: false,
        useModelSelector: false,
        modelsConfig: modelConfig,
      });
      await modelSelector.init();
      this.agentSelector = new AgentSelector({
        availableAgents: this.agentInstances,
        modelSelector: modelSelector,
      });
      await this.agentSelector.init();
    } catch (error) {
      // Reset promise on failure so we can retry
      this.initializationPromise = null;
      throw error;
    }
  }

  /**
   * Perform the actual initialization logic
   * @private
   */
  private async performInitialize(): Promise<void> {
    try {
      // Wait for database service to be ready instead of polling
      await this.databaseService.onReady();

      await DatabaseStorage.connect();
      await this.init_models_config();
      await this.init_agents_config();
      this.initialized = true;
    } catch (error) {
      logger.error('Error during agent storage initialization:', error);
      this.initialized = false;
      throw error;
    }
  }

  /**
   * Initialize models configuration with default values if not exists
   * @private
   */
  private async init_models_config() {
    try {
      logger.debug('Initializing models configuration');
      const q = new Postgres.Query(
        `SELECT EXISTS(SELECT * FROM models_config)`
      );
      const result = await Postgres.query<{ exists: boolean }>(q);

      if (!result[0].exists) {
        logger.debug('Models configuration not found, creating default config');

        const fast: ModelLevelConfig = {
          provider: ModelProviders.OpenAI,
          model_name: 'gpt-4o-mini',
          description: 'Optimized for speed and simple tasks.',
        };
        const smart: ModelLevelConfig = {
          provider: ModelProviders.OpenAI,
          model_name: 'gpt-4o-mini',
          description: 'Optimized for complex reasoning.',
        };
        const cheap: ModelLevelConfig = {
          provider: ModelProviders.OpenAI,
          model_name: 'gpt-4o-mini',
          description: 'Good cost-performance balance.',
        };

        const q = new Postgres.Query(
          `INSERT INTO models_config (fast, smart, cheap) VALUES (ROW($1, $2, $3), ROW($4, $5, $6), ROW($7, $8, $9))`,
          [
            fast.provider,
            fast.model_name,
            fast.description,
            smart.provider,
            smart.model_name,
            smart.description,
            cheap.provider,
            cheap.model_name,
            cheap.description,
          ]
        );
        await Postgres.query(q);
      } else {
        logger.debug('Models configuration already exists, skipping creation.');
      }
    } catch (error) {
      logger.error('Error during models configuration initialization:', error);
      throw error;
    }
  }

  /**
   * Initialize agents configuration from database
   * @private
   */
  private async init_agents_config() {
    try {
      logger.debug('Initializing agents configuration');
      const q = new Postgres.Query(`SELECT * FROM agents`);
      const q_res = await Postgres.query<AgentConfigSQL>(q);
      const parsed = q_res.map((cfg) => ({
        ...cfg,
        memory: this.parseMemoryConfig(cfg.memory),
        rag: this.parseRagConfig(cfg.rag),
      }));
      this.agentConfigs = [...parsed];
      await this.registerAgentInstance();
      logger.debug(
        `Agents configuration loaded: ${this.agentConfigs.length} agents`
      );
      return parsed;
    } catch (error) {
      logger.error('Error during agents configuration initialization:', error);
      throw error;
    }
  }

  /* ==================== PRIVATE PARSING METHODS ==================== */

  /**
   * Parse agent configuration from database format
   * @param config - Raw configuration string from database
   * @returns Parsed ModelLevelConfig
   * @private
   */
  private parseAgentConfig(config: any): ModelLevelConfig {
    try {
      const content = config.trim().slice(1, -1);
      const parts = content.split(',');
      const model: ModelLevelConfig = {
        provider: parts[0],
        model_name: parts[1],
        description: parts[2],
      };
      return model;
    } catch (error) {
      logger.error('Error parsing agent config:', error);
      throw error;
    }
  }

  /**
   * Parse memory configuration from composite type string
   * @param config - Raw memory config string e.g. "(true,5)"
   * @returns Parsed AgentMemorySQL
   * @private
   */
  private parseMemoryConfig(config: string | AgentMemorySQL): AgentMemorySQL {
    try {
      if (typeof config !== 'string') {
        return config as AgentMemorySQL;
      }
      const content = config.trim().slice(1, -1);
      const parts = content.split(',');
      return {
        enabled: parts[0] === 't' || parts[0] === 'true',
        short_term_memory_size: parseInt(parts[1], 10),
        memory_size: parseInt(parts[2] || '20', 10),
      };
    } catch (error) {
      logger.error('Error parsing memory config:', error);
      throw error;
    }
  }

  /**
   * Parse rag configuration from composite type string
   * @param config - Raw rag config string e.g. "(false,my-model)"
   * @returns Parsed AgentRagSQL
   * @private
   */
  private parseRagConfig(config: string | AgentRagSQL): AgentRagSQL {
    try {
      if (typeof config !== 'string') {
        return config as AgentRagSQL;
      }
      const content = config.trim().slice(1, -1);
      const parts = content.split(',');
      const embedding = parts[1]?.replace(/^"|"$/g, '') || null;
      return {
        enabled: parts[0] === 't' || parts[0] === 'true',
        embedding_model:
          embedding === '' || embedding?.toLowerCase() === 'null'
            ? null
            : embedding,
      };
    } catch (error) {
      logger.error('Error parsing rag config:', error);
      throw error;
    }
  }

  /* ==================== PRIVATE AGENT CREATION METHODS ==================== */

  private async createSnakAgentFromConfig(
    agentConfig: AgentConfigSQL
  ): Promise<SnakAgent> {
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
          enabled: agentConfig.memory.enabled,
          shortTermMemorySize: agentConfig.memory.short_term_memory_size,
          memorySize: agentConfig.memory.memory_size,
        },
        rag: agentConfig.rag
          ? {
              enabled: agentConfig.rag.enabled,
              embeddingModel: agentConfig.rag.embedding_model || undefined,
            }
          : undefined,
        chatId: `agent_${agentConfig.id}`,
        maxIterations: agentConfig.max_iterations || 15,
        mode: agentConfig.mode || AgentMode.INTERACTIVE,
      };

      // Creat model selector
      const modelConfig = await this.get_models_config();
      if (!modelConfig) {
        throw new Error('ModelConfig is not available.');
      }

      const snakAgentConfig: SnakAgentConfig = {
        provider: this.config.starknet.provider,
        accountPrivateKey: this.config.starknet.privateKey,
        accountPublicKey: this.config.starknet.publicKey,
        db_credentials: database,
        agentConfig: jsonConfig,
        memory: jsonConfig.memory,
        modelSelectorConfig: {
          debugMode: false,
          useModelSelector: false,
          modelsConfig: modelConfig,
        },
      };
      const snakAgent = new SnakAgent(snakAgentConfig);
      await snakAgent.init();

      return snakAgent;
    } catch (error) {
      logger.error(`Error creating SnakAgent from config:`, error);
      throw error;
    }
  }

  private async registerAgentInstance() {
    try {
      for (const agentConfig of this.agentConfigs) {
        const snakAgent = await this.createSnakAgentFromConfig(agentConfig);
        if (!snakAgent) {
          logger.warn(
            `Failed to create SnakAgent for agent ID: ${agentConfig.id}`
          );
          continue;
        }
        const compositeKey = `${agentConfig.id}:${agentConfig.user_id}`;
        this.agentInstances.set(compositeKey, snakAgent);
        logger.debug(
          `Created SnakAgent: ${agentConfig.name} (${agentConfig.id}) for user ${agentConfig.user_id}`
        );
      }
    } catch (error) {
      logger.error('Error registering agent instance:', error);
      throw error;
    }
  }

  /**
   * Build system prompt from configuration components
   * @param promptComponents - Components to build the prompt from
   * @returns string - The built system prompt
   * @private
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

  /* ==================== PRIVATE CONFIGURATION METHODS ==================== */

  /**
   * Get models configuration from database
   * @returns Promise<ModelsConfig> - The models configuration
   * @private
   */
  private async get_models_config(): Promise<ModelsConfig> {
    try {
      const q = new Postgres.Query(`SELECT * FROM models_config`);
      logger.debug(`Query to get models config: ${q}`);
      const q_res = await Postgres.query<ModelsConfig>(q);

      if (q_res.length === 0) {
        throw new Error('No models configuration found');
      }

      const fast = this.parseAgentConfig(q_res[0].fast);
      const smart = this.parseAgentConfig(q_res[0].smart);
      const cheap = this.parseAgentConfig(q_res[0].cheap);

      const modelsConfig: ModelsConfig = {
        fast: fast,
        smart: smart,
        cheap: cheap,
      };
      return modelsConfig;
    } catch (error) {
      logger.error('Error getting models configuration:', error);
      throw error;
    }
  }
}
