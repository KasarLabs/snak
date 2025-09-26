import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigurationService } from '../config/configuration.js';
import { DatabaseService } from './services/database.service.js';
import { Postgres } from '@snakagent/database';
import {
  AgentConfig,
  ModelConfig,
  StarknetConfig,
  AgentPromptsInitialized,
  AgentValidationService,
  DEFAULT_AGENT_MODEL,
} from '@snakagent/core';
// Add this import if ModelSelectorConfig is exported from @snakagent/core
import DatabaseStorage from '../common/database/database.storage.js';
import {
  AgentSelector,
  SnakAgent,
  TASK_EXECUTOR_SYSTEM_PROMPT,
  TASK_MANAGER_SYSTEM_PROMPT,
  TASK_MEMEMORY_MANAGER_SYSTEM_PROMPT,
  TASK_VERIFIER_SYSTEM_PROMPT,
} from '@snakagent/agents';
import { SystemMessage } from '@langchain/core/messages';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';

const logger = new Logger('AgentStorage');

// Default agent configuration constants
/**
 * Service responsible for managing agent storage, configuration, and lifecycle
 */
@Injectable()
export class AgentStorage implements OnModuleInit {
  private agentConfigs: AgentConfig.OutputWithId[] = [];
  private agentInstances: Map<string, SnakAgent> = new Map();
  private agentSelector: AgentSelector;
  private agentValidationService: AgentValidationService;
  private initialized: boolean = false;
  private initializationPromise: Promise<void> | null = null;
  constructor(
    private readonly config: ConfigurationService,
    private readonly databaseService: DatabaseService
  ) {
    this.agentValidationService = new AgentValidationService(this);
  }

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
  ): AgentConfig.OutputWithId | undefined {
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
   * Get all agent configurations for a specific user
   * @param userId - User ID to filter configurations
   * @returns AgentConfigSQL[] - Array of agent configurations owned by the user
   */
  public getAllAgentConfigs(userId: string): AgentConfig.OutputWithId[] {
    if (!this.initialized) {
      return [];
    }
    return this.agentConfigs.filter((config) => config.user_id === userId);
  }

  /**
   * Get a SnakAgent instance by ID
   * @param {string} id - The agent ID
   * @param {string} userId - User ID to verify ownership (required)
   * @returns {SnakAgent | undefined} The agent instance or undefined if not found or not owned by user
   */
  public getAgentInstance(id: string, userId: string): SnakAgent | undefined {
    const compositeKey = `${id}|${userId}`;
    return this.agentInstances.get(compositeKey);
  }
  /**
   * Get all agent instances for a specific user
   * @param {string} userId - The user ID
   * @returns {SnakAgent[]} Array of agent instances owned by the user
   */
  public getAgentInstancesByUser(userId: string): SnakAgent[] {
    const userAgents: SnakAgent[] = [];
    for (const [key, instance] of this.agentInstances.entries()) {
      const [_agentId, agentUserId] = key.split('|');
      if (agentUserId === userId) {
        userAgents.push(instance);
      }
    }
    return userAgents;
  }

  /**
   * Get all agent instances
   * @param userId - Optional user ID to filter instances
   * @returns {SnakAgent[]} Array of all agent instances
   */
  public getAllAgentInstances(userId: string): SnakAgent[] {
    return this.getAgentInstancesByUser(userId);
  }

  public getAgentSelector(): AgentSelector {
    if (!this.agentSelector) {
      throw new Error('AgentSelector is not initialized');
    }
    return this.agentSelector;
  }

  public async getModelFromUser(userId: string): Promise<ModelConfig> {
    if (!userId || userId.length === 0) {
      throw new Error('User ID is required to fetch model configuration');
    }
    const query = new Postgres.Query(
      `SELECT
      (model).model_provider as "provider",
      (model).model_name as "model_name",
      (model).temperature as "temperature",
      (model).max_tokens as "max_tokens"
      FROM models_config WHERE user_id = $1`,
      [userId]
    );
    const result = await Postgres.query<ModelConfig>(query);
    if (result.length === 0) {
      const create_q = new Postgres.Query(
        'INSERT INTO models_config (user_id,model) VALUES ($1,ROW($2, $3, $4, $5)::model_config)',
        [
          userId,
          DEFAULT_AGENT_MODEL.provider,
          DEFAULT_AGENT_MODEL.model_name,
          DEFAULT_AGENT_MODEL.temperature,
          DEFAULT_AGENT_MODEL.max_tokens,
        ]
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
   * @param agentConfig - Raw agent configuration
   * @returns Promise<AgentConfig.OutputWithId> - The newly created agent configuration
   */
  public async addAgent(
    agentConfig: AgentConfig.Input,
    userId: string
  ): Promise<AgentConfig.OutputWithId> {
    logger.debug(`Adding agent with config: ${JSON.stringify(agentConfig)}`);

    if (!this.initialized) {
      await this.initialize();
    }

    const baseName = agentConfig.profile.name;

    let finalName = baseName;
    const nameCheckQuery = new Postgres.Query(
      `SELECT (profile).name FROM agents WHERE (profile)."group" = $1 AND ((profile).name = $2 OR (profile).name LIKE $2 || '-%') ORDER BY LENGTH((profile).name) DESC, (profile).name DESC LIMIT 1`,
      [agentConfig.profile.group, baseName]
    );
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
            `Unexpected name format found: ${existingName} for baseName: ${baseName} in group: ${agentConfig.profile.group}. Attempting to suffix with -1.`
          );
          finalName = `${baseName}-1`;
        }
      }
    }

    const prompt_id =
      agentConfig.prompts_id ?? (await this.initializeDefaultPrompts(userId));

    agentConfig.prompts_id = prompt_id;
    agentConfig.profile.name = finalName;

    await this.agentValidationService.validateAgent(agentConfig, true);

    const q = new Postgres.Query(
      'SELECT * FROM insert_agent_from_json($1, $2)',
      [userId, JSON.stringify(agentConfig)]
    );
    const q_res = await Postgres.query<AgentConfig.OutputWithId>(q);
    logger.debug(`Agent added to database: ${JSON.stringify(q_res)}`);

    if (q_res.length > 0) {
      const newAgentDbRecord = q_res[0];
      const compositeKey = `${newAgentDbRecord.id}|${userId}`;
      this.agentConfigs.push(newAgentDbRecord);
      this.createSnakAgentFromConfig(newAgentDbRecord)
        .then((snakAgent) => {
          this.agentInstances.set(compositeKey, snakAgent);
          this.agentSelector.updateAvailableAgents(
            [newAgentDbRecord.id, snakAgent],
            userId
          );
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
  public async deleteAgent(id: string, userId: string): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    const q = new Postgres.Query(
      `DELETE FROM agents WHERE id = $1 AND user_id = $2 RETURNING *`,
      [id, userId]
    );
    const q_res = await Postgres.query<AgentConfig.OutputWithId>(q);
    logger.debug(`Agent deleted from database: ${JSON.stringify(q_res)}`);

    this.agentConfigs = this.agentConfigs.filter(
      (config) => !(config.id === id && config.user_id === userId)
    );
    this.agentInstances.delete(id);
    this.agentSelector.removeAgent(id, userId);
    logger.debug(`Agent ${id} removed from local configuration`);
  }

  /* ==================== PUBLIC UTILITIES ==================== */

  /**
   * Get the total number of agents in the system
   * @returns Promise<number> - The total number of agents
   */
  public async getTotalAgentsCount(): Promise<number> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const q = new Postgres.Query(`SELECT COUNT(*) as count FROM agents`);
      const result = await Postgres.query<{ count: string }>(q);
      return parseInt(result[0].count, 10);
    } catch (error) {
      logger.error('Error getting total agents count:', error);
      throw error;
    }
  }

  /**
   * Get the number of agents for a specific user
   * @param userId - User ID to count agents for
   * @returns Promise<number> - The number of agents owned by the user
   */
  public async getUserAgentsCount(userId: string): Promise<number> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const q = new Postgres.Query(
        `SELECT COUNT(*) as count FROM agents WHERE user_id = $1`,
        [userId]
      );
      const result = await Postgres.query<{ count: string }>(q);
      return parseInt(result[0].count, 10);
    } catch (error) {
      logger.error(`Error getting agents count for user ${userId}:`, error);
      throw error;
    }
  }

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

      // const model = await this.getModelFromUser(userId); // Need to be used when user_id table will be created
      const model: ModelConfig = {
        provider: process.env.DEFAULT_MODEL_PROVIDER as string,
        model_name: process.env.DEFAULT_MODEL_NAME as string,
        temperature: parseFloat(process.env.DEFAULT_TEMPERATURE ?? '0.7'),
        max_tokens: parseInt(process.env.DEFAULT_MAX_TOKENS ?? '4096'),
      };
      const modelInstance = this.initializeModels(model);
      if (!modelInstance || modelInstance.bindTools === undefined) {
        throw new Error('Failed to initialize model for AgentSelector');
      }
      this.agentSelector = new AgentSelector(
        this.agentInstances,
        modelInstance
      );
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
      const q = new Postgres.Query(`
        SELECT
          id,
          user_id,
          row_to_json(profile) as profile,
          mcp_servers as "mcp_servers",
          prompts_id,
          row_to_json(graph) as graph,
          row_to_json(memory) as memory,
          row_to_json(rag) as rag,
          created_at,
          updated_at,
          avatar_image,
          avatar_mime_type
        FROM agents
      `);
      const q_res = await Postgres.query<AgentConfig.OutputWithId>(q);
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
    agentConfig: AgentConfig.OutputWithId
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

      // JUST FOR TESTING PURPOSES
      const model = await this.getModelFromUser(agentConfig.user_id);
      const modelInstance = this.initializeModels(model);
      if (!modelInstance) {
        throw new Error('Failed to initialize model for SnakAgent');
      }
      // Get prompts from database or use fallback
      const promptsFromDb = await this.getPromptsFromDatabase(
        agentConfig.prompts_id
      );
      if (!promptsFromDb) {
        throw new Error(
          `Failed to load prompts for agent ${agentConfig.id}, prompts ID: ${agentConfig.prompts_id}`
        );
      }

      const AgentConfigRuntime: AgentConfig.Runtime = {
        ...agentConfig,
        prompts: promptsFromDb,
        graph: {
          ...agentConfig.graph,
          model: modelInstance,
        },
      };
      const snakAgent = new SnakAgent(
        starknetConfig,
        AgentConfigRuntime,
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
        const compositeKey = `${agentConfig.id}|${agentConfig.user_id}`;
        this.agentInstances.set(compositeKey, snakAgent);
        logger.debug(
          `Created SnakAgent: ${agentConfig.profile.name} (${agentConfig.id})`
        );
      }
    } catch (error) {
      logger.error('Error registering agent instance:', error);
      throw error;
    }
  }

  /**
   * Initializes model instances based on the loaded configuration.
   * @throws {Error} If models configuration is not loaded.
   */
  protected initializeModels(model: ModelConfig): BaseChatModel | null {
    try {
      if (!model) {
        throw new Error('Model configuration is not defined');
      }
      let modelInstance: BaseChatModel | null = null;
      const commonConfig = {
        modelName: model.model_name,
        verbose: false,
        temperature: model.temperature,
      };
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
            model: model.model_name, // Updated to valid Gemini model name
            verbose: false,
            temperature: model.temperature,
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
        `Failed to initialize model ${model.provider}: ${model.model_name}): ${error}`
      );
      return null;
    }
  }

  /* ==================== PRIVATE CONFIGURATION METHODS ==================== */

  /**
   * Get prompts from database by prompt ID
   * @private
   * @param promptId - UUID of the prompt configuration
   * @returns Promise<AgentConfig.Prompts | null> - Parsed prompts or null if not found
   */
  private async getPromptsFromDatabase(
    promptId: string
  ): Promise<AgentPromptsInitialized<string> | null> {
    try {
      const query = new Postgres.Query(
        `SELECT json_build_object(
          'task_executor_prompt', task_executor_prompt,
          'task_manager_prompt', task_manager_prompt,
          'task_verifier_prompt', task_verifier_prompt,
          'task_memory_manager_prompt', task_memory_manager_prompt
        ) as prompts_json
         FROM prompts
         WHERE id = $1`,
        [promptId]
      );

      const result = await Postgres.query<{
        prompts_json: AgentPromptsInitialized<string>;
      }>(query);

      if (result.length === 0) {
        logger.warn(`No prompts found for ID: ${promptId}`);
        return null;
      }

      const promptData = result[0].prompts_json;
      // Validate that we have valid prompt data
      if (!promptData || typeof promptData !== 'object') {
        logger.warn(`Invalid prompt data structure for ID: ${promptId}`);
        return null;
      }

      // Parse to proper format and return as SystemMessage objects
      // The type suggests it should have camelCase properties
      return {
        task_executor_prompt: promptData.task_executor_prompt,

        task_manager_prompt: promptData.task_manager_prompt,
        task_memory_manager_prompt: promptData.task_memory_manager_prompt,

        task_verifier_prompt: promptData.task_verifier_prompt,
      };
    } catch (error) {
      logger.error(`Failed to fetch prompts from database: ${error.message}`);
      return null;
    }
  }

  private async initializeDefaultPrompts(userId: string): Promise<string> {
    try {
      // First, check if prompts already exist for this user
      const existingQuery = new Postgres.Query(
        `SELECT id FROM prompts WHERE user_id = $1 LIMIT 1`,
        [userId]
      );
      const existing = await Postgres.query<{ id: string }>(existingQuery);

      if (existing.length > 0) {
        logger.debug(
          `Default prompts already exist for user ${userId}, returning existing ID`
        );
        return existing[0].id;
      }

      // Insert new default prompts for the user
      const insertQuery = new Postgres.Query(
        `INSERT INTO prompts (
          user_id,
          task_executor_prompt,
          task_manager_prompt,
          task_verifier_prompt,
          task_memory_manager_prompt,
          public
        ) VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [
          userId,
          TASK_EXECUTOR_SYSTEM_PROMPT,
          TASK_MANAGER_SYSTEM_PROMPT,
          TASK_VERIFIER_SYSTEM_PROMPT,
          TASK_MEMEMORY_MANAGER_SYSTEM_PROMPT,
          false,
        ]
      );

      const result = await Postgres.query<{ id: string }>(insertQuery);
      if (result.length > 0) {
        const promptId = result[0].id;
        logger.debug(
          `Default prompts created successfully for user ${userId} with ID: ${promptId}`
        );
        return promptId;
      } else {
        throw new Error('Failed to create default prompts - no ID returned');
      }
    } catch (error) {
      logger.error('Failed to initialize default prompts:', error);
      throw error;
    }
  }

  /**
   * Validate agent configuration
   * @param agentConfig - Agent configuration to validate
   * @param isCreation - Whether this is for creation (true) or update (false)
   */
  async validateAgent(
    agentConfig: AgentConfig.Input | AgentConfig.WithOptionalParam,
    isCreation: boolean = false
  ): Promise<void> {
    return this.agentValidationService.validateAgent(
      agentConfig,
      isCreation,
      this
    );
  }
}
