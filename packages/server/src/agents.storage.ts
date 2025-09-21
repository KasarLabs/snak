import { Injectable, Logger, OnModuleInit, Query } from '@nestjs/common';
import { ConfigurationService } from '../config/configuration.js';
import { DatabaseService } from './services/database.service.js';
import { Postgres } from '@snakagent/database';
import { AgentConfig, ModelConfig, Id, StarknetConfig } from '@snakagent/core';
// Add this import if ModelSelectorConfig is exported from @snakagent/core
import DatabaseStorage from '../common/database/database.js';
import { AgentSelector, SnakAgent } from '@snakagent/agents';
import { SystemMessage } from '@langchain/core/messages';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';

const logger = new Logger('AgentStorage');

/**
 * Service responsible for managing agent storage, configuration, and lifecycle
 */
@Injectable()
export class AgentStorage implements OnModuleInit {
  private agentConfigs: AgentConfig<Id.Id>[] = [];
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
   * @returns AgentConfig<Id.Id> | undefined - The agent configuration or undefined if not found
   */
  public getAgentConfig(id: string): AgentConfig<Id.Id> | undefined {
    if (!this.initialized) {
      return undefined;
    }
    return this.agentConfigs.find((config) => config.id === id);
  }

  /**
   * Get all agent configurations
   * @returns AgentConfig<Id.Id>[] - Array of all agent configurations
   */
  public getAllAgentConfigs(): AgentConfig<Id.Id>[] {
    if (!this.initialized) {
      return [];
    }
    return [...this.agentConfigs];
  }

  /**
   * Get a SnakAgent instance by ID
   * @param {string} id - The agent ID
   * @returns {SnakAgent | undefined} The agent instance or undefined if not found
   */
  public getAgentInstance(id: string): SnakAgent | undefined {
    const instance = this.agentInstances.get(id);
    return instance ? instance : undefined;
  }

  /**
   * Get all agent instances
   * @returns {SnakAgent[]} Array of all agent instances
   */
  public getAllAgentInstances(): SnakAgent[] {
    return Array.from(this.agentInstances.values()).map((instance) => instance);
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

  public async getModelFromUser(userId: string): Promise<ModelConfig> {
    if (!userId || userId.length === 0) {
      throw new Error('User ID is required to fetch model configuration');
    }
    const query = new Postgres.Query(
      `SELECT 
      (model).model_provider as provider,
      (model).model_name as model_name,
      (model).temperature as temperature,
      (model).max_tokens as max_tokens
      FROM models_config WHERE user_id = $1`,
      [userId]
    );
    const result = await Postgres.query<ModelConfig>(query);
    console.log(result);
    if (result.length === 0) {
      const create_q = new Postgres.Query(
        "INSERT INTO models_config (user_id,model) VALUES ('default-user',ROW('gemini', 'gemini-2.5-flash', 0.7, 8192)::model_config)"
      );
      await Postgres.query(create_q);
      const new_r = await Postgres.query<ModelConfig>(query);
      if (new_r.length <= 0) {
        throw new Error(`No user found with ID: ${userId}`);
      }
      return new_r[0];
    }
    return result[0];
  }

  public isInitialized(): boolean {
    return this.initialized;
  }

  /* ==================== PUBLIC CRUD OPERATIONS ==================== */

  /**
   * Add a new agent to the system
   * @param agent_config - Raw agent configuration
   * @returns Promise<AgentConfig<Id.Id>> - The newly created agent configuration
   */
  public async addAgent(
    agent_config: AgentConfig<Id.NoId>
  ): Promise<AgentConfig<Id.Id>> {
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

    const q = new Postgres.Query(
      `INSERT INTO agents (
        name,
        "group",
        profile,
        mode,
        mcp_servers,
        plugins,
        prompts,
        graph,
        memory,
        rag
      ) VALUES (
        $1,
        $2,
        $3::agent_profile,
        $4::agent_mode,
        $5::jsonb,
        $6::text[],
        $7::agent_prompts,
        $8::graph_config,
        $9::memory_config,
        $10::rag_config
      ) RETURNING *`,
      [
        finalName, // $1
        group, // $2
        agent_config.profile, // $3
        agent_config.mode, // $4
        agent_config.mcpServers || {}, // $5
        agent_config.plugins, // $6
        agent_config.prompts, // $7
        agent_config.graph, // $8
        agent_config.memory, // $9
        agent_config.rag, // $10
      ]
    );
    const q_res = await Postgres.query<AgentConfig<Id.Id>>(q);
    logger.debug(`Agent added to database: ${JSON.stringify(q_res)}`);

    if (q_res.length > 0) {
      const newAgentDbRecord = q_res[0];
      this.agentConfigs.push(newAgentDbRecord);
      this.createSnakAgentFromConfig(newAgentDbRecord)
        .then((snakAgent) => {
          this.agentInstances.set(newAgentDbRecord.id, snakAgent);
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
   * @returns Promise<void>
   */
  public async deleteAgent(id: string): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    const q = new Postgres.Query(
      `DELETE FROM agents WHERE id = $1 RETURNING *`,
      [id]
    );
    const q_res = await Postgres.query<AgentConfig<Id.Id>>(q);
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
      const model = await this.getModelFromUser('default-user');
      const modelInstance = this.initializeModels(model);
      if (!modelInstance) {
        throw new Error('Failed to initialize model for AgentSelector');
      }
      this.agentSelector = new AgentSelector({
        availableAgents: this.agentInstances,
        model: modelInstance,
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
      await this.init_agents_config();
      this.initialized = true;
    } catch (error) {
      logger.error('Error during agent storage initialization:', error);
      this.initialized = false;
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
      const q_res = await Postgres.query<AgentConfig<Id.Id>>(q);
      this.agentConfigs = [...q_res];
      await this.registerAgentInstance();
      logger.debug(
        `Agents configuration loaded: ${this.agentConfigs.length} agents`
      );
      return q_res;
    } catch (error) {
      logger.error('Error during agents configuration initialization:', error);
      throw error;
    }
  }

  /* ==================== PRIVATE AGENT CREATION METHODS ==================== */

  private async createSnakAgentFromConfig(
    agentConfig: AgentConfig<Id.Id>
  ): Promise<SnakAgent> {
    try {
      const databaseConfig = {
        database: process.env.POSTGRES_DB as string,
        host: process.env.POSTGRES_HOST as string,
        user: process.env.POSTGRES_USER as string,
        password: process.env.POSTGRES_PASSWORD as string,
        port: parseInt(process.env.POSTGRES_PORT as string),
      };

      const starknetConfig: StarknetConfig = {
        provider: this.config.starknet.provider,
        accountPrivateKey: this.config.starknet.privateKey,
        accountPublicKey: this.config.starknet.publicKey,
      };

      const systemPrompt = this.buildSystemPromptFromConfig({
        name: agentConfig.name,
        description: agentConfig.profile.description,
        lore: agentConfig.profile.lore || [],
        objectives: agentConfig.profile.objectives || [],
        knowledge: agentConfig.profile.knowledge || [],
      });

      agentConfig.profile.mergedProfile = systemPrompt;

      const snakAgent = new SnakAgent(
        starknetConfig,
        agentConfig,
        databaseConfig
      );
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
        this.agentInstances.set(agentConfig.id, snakAgent);
        logger.debug(
          `Created SnakAgent: ${agentConfig.name} (${agentConfig.id})`
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

  /**
   * Initializes model instances based on the loaded configuration.
   * @throws {Error} If models configuration is not loaded.
   */
  protected initializeModels(model: ModelConfig): BaseChatModel | null {
    if (!model) {
      logger.error;
    }

    try {
      let modelInstance: BaseChatModel | null = null;
      const commonConfig = {
        modelName: model.modelName,
      };

      console.log(JSON.stringify(model));
      switch (model.provider.toLowerCase()) {
        case 'openai':
          modelInstance = new ChatOpenAI({
            ...commonConfig,
            openAIApiKey: process.env.OPENAI_API_KEY,
          });
          break;
        case 'anthropic':
          modelInstance = new ChatAnthropic({
            ...commonConfig,
            anthropicApiKey: process.env.ANTHROPIC_API_KEY,
          });
          break;
        case 'gemini':
          modelInstance = new ChatGoogleGenerativeAI({
            ...commonConfig,
            apiKey: process.env.GEMINI_API_KEY,
          });
          break;
        // Add case for 'deepseek' if a Langchain integration exists or becomes available
        default:
          throw new Error('No valid model provided');
      }
      return modelInstance;
    } catch (error) {
      logger.error(
        `Failed to initialize model ${model.provider}: ${model.modelName}): ${error}`
      );
      return null;
    }
  }
}
