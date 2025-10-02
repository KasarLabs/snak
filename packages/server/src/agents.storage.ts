import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigurationService } from '../config/configuration.js';
import { DatabaseService } from './services/database.service.js';
import { Postgres, redisAgents } from '@snakagent/database/queries';
import { RedisClient } from '@snakagent/database/redis';
import {
  AgentConfig,
  ModelConfig,
  StarknetConfig,
  AgentPromptsInitialized,
  DEFAULT_AGENT_MODEL,
  DatabaseConfigService,
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
   * Get an agent configuration by ID from Redis
   * @param id - Agent ID
   * @param userId - User ID to verify ownership
   * @returns AgentConfigSQL | undefined - The agent configuration or undefined if not found or not owned by user
   */
  public async getAgentConfig(
    id: string,
    userId: string
  ): Promise<AgentConfig.OutputWithId | null> {
    if (!this.initialized) {
      return null;
    }

    try {
      const config = await redisAgents.getAgentByPair(id, userId);
      
      if (!config) {
        logger.debug(`Agent ${id} not found for user ${userId}`);
      }

      return config;
    } catch (error) {
      logger.error(`Error fetching agent config from Redis: ${error}`);
      return null;
    }
  }

  /**
   * Get all agent configurations for a specific user from Redis
   * @param userId - User ID to filter configurations
   * @returns AgentConfigSQL[] - Array of agent configurations owned by the user
   */
  public async getAllAgentConfigs(userId: string): Promise<AgentConfig.OutputWithId[]> {
    if (!this.initialized) {
      return [];
    }
    
    try {
      return await redisAgents.listAgentsByUser(userId);
    } catch (error) {
      logger.error(`Error fetching agent configs from Redis: ${error}`);
      return [];
    }
  }

  /**
   * Get a SnakAgent instance by ID
   * Fetches from Redis and creates a new instance each time
   * @param {string} id - The agent ID
   * @param {string} userId - User ID to verify ownership (required)
   * @returns {SnakAgent | undefined} The agent instance or undefined if not found or not owned by user
   */
  public async getAgentInstance(id: string, userId: string): Promise<SnakAgent | undefined> {
    try {
      const agentConfig = await redisAgents.getAgentByPair(id, userId);
      
      if (!agentConfig) {
        logger.debug(`Agent ${id} not found in Redis for user ${userId}`);
        return undefined;
      }

      // Create SnakAgent from config
      const snakAgent = await this.createSnakAgentFromConfig(agentConfig);
      
      logger.debug(`Agent ${id} created for user ${userId}`);
      return snakAgent;
    } catch (error) {
      logger.error(`Error getting agent instance from Redis: ${error}`);
      return undefined;
    }
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
    const q = new Postgres.Query(
      'SELECT * FROM insert_agent_from_json($1, $2)',
      [userId, JSON.stringify(agentConfig)]
    );
    const q_res = await Postgres.query<AgentConfig.OutputWithId>(q);
    logger.debug(`Agent added to database: ${JSON.stringify(q_res)}`);

    if (q_res.length > 0) {
      const newAgentDbRecord = q_res[0];
      
      // Save to Redis
      try {
        await redisAgents.saveAgent(newAgentDbRecord);
        logger.debug(`Agent ${newAgentDbRecord.id} saved to Redis`);
      } catch (error) {
        logger.error(`Failed to save agent to Redis: ${error}`);
        // Don't throw here, Redis is a cache, PostgreSQL is the source of truth
      }
      
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

    // Delete from Redis
    try {
      await redisAgents.deleteAgent(id, userId);
      logger.debug(`Agent ${id} deleted from Redis`);
    } catch (error) {
      logger.error(`Failed to delete agent from Redis: ${error}`);
      // Don't throw, PostgreSQL deletion is what matters
    }

    logger.debug(`Agent ${id} removed from configuration`);
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
      
      // Create agent resolver function that fetches agents from Redis on-demand
      const agentResolver = async (userId: string): Promise<SnakAgent[]> => {
        try {
          const agentConfigs = await redisAgents.listAgentsByUser(userId);
          const agents: SnakAgent[] = [];
          
          for (const agentConfig of agentConfigs) {
            try {
              const snakAgent = await this.createSnakAgentFromConfig(agentConfig);
              agents.push(snakAgent);
            } catch (error) {
              logger.error(`Failed to create SnakAgent for ${agentConfig.id}:`, error);
            }
          }
          
          return agents;
        } catch (error) {
          logger.error(`Failed to resolve agents for user ${userId}:`, error);
          return [];
        }
      };
      
      this.agentSelector = new AgentSelector(
        agentResolver,
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
      // Initialize global database configuration service
      DatabaseConfigService.getInstance().initialize();
      
      // Wait for database service to be ready instead of polling
      await this.databaseService.onReady();

      await DatabaseStorage.connect();
      
      // Initialize Redis connection
      try {
        const redisClient = RedisClient.getInstance();
        await redisClient.connect();
        logger.log('Redis connected for agent storage');
      } catch (error) {
        logger.error('Failed to initialize Redis connection:', error);
        throw error;
      }
      
      await this.init_agents_config();
      this.initialized = true;
    } catch (error) {
      logger.error('Error during agent storage initialization:', error);
      this.initialized = false;
      throw error;
    }
  }

  /**
   * Initialize agents configuration from database and sync to Redis
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
      
      // Sync all agents to Redis
      logger.debug(`Syncing ${q_res.length} agents to Redis`);
      for (const agentConfig of q_res) {
        try {
          // Check if already exists in Redis
          const exists = await redisAgents.agentExists(agentConfig.id, agentConfig.user_id);
          if (!exists) {
            await redisAgents.saveAgent(agentConfig);
            logger.debug(`Synced agent ${agentConfig.id} to Redis`);
          }
        } catch (error) {
          logger.error(`Failed to sync agent ${agentConfig.id} to Redis:`, error);
          // Continue with other agents
        }
      }
      
      await this.registerAgentInstance();
      logger.debug(
        `Agents configuration loaded: ${q_res.length} agents`
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
    const totalStart = performance.now();
    try {
      // Chronométrage de la configuration Starknet
      const starknetConfigStart = performance.now();
      const starknetConfig: StarknetConfig = {
        provider: this.config.starknet.provider,
        accountPrivateKey: this.config.starknet.privateKey,
        accountPublicKey: this.config.starknet.publicKey,
      };
      const starknetConfigEnd = performance.now();
      const starknetConfigTime = starknetConfigEnd - starknetConfigStart;

      // Chronométrage de la récupération du modèle
      const modelStart = performance.now();
      const model = await this.getModelFromUser(agentConfig.user_id);
      const modelInstance = this.initializeModels(model);
      if (!modelInstance) {
        throw new Error('Failed to initialize model for SnakAgent');
      }
      const modelEnd = performance.now();
      const modelTime = modelEnd - modelStart;

      // Chronométrage de la récupération des prompts
      const promptsStart = performance.now();
      const promptsFromDb = await this.getPromptsFromDatabase(
        agentConfig.prompts_id
      );
      if (!promptsFromDb) {
        throw new Error(
          `Failed to load prompts for agent ${agentConfig.id}, prompts ID: ${agentConfig.prompts_id}`
        );
      }
      const promptsEnd = performance.now();
      const promptsTime = promptsEnd - promptsStart;

      // Chronométrage de la construction de la configuration runtime
      const configBuildStart = performance.now();
      const AgentConfigRuntime: AgentConfig.Runtime = {
        ...agentConfig,
        prompts: promptsFromDb,
        graph: {
          ...agentConfig.graph,
          model: modelInstance,
        },
      };
      const configBuildEnd = performance.now();
      const configBuildTime = configBuildEnd - configBuildStart;
     
      // Chronométrage de l'instanciation
      const instantiationStart = performance.now();
      const snakAgent = new SnakAgent(
        starknetConfig,
        AgentConfigRuntime
      );
      const instantiationEnd = performance.now();
      const instantiationTime = instantiationEnd - instantiationStart;
      
      // Chronométrage de l'initialisation
      const initStart = performance.now();
      await snakAgent.init();
      const initEnd = performance.now();
      const initTime = initEnd - initStart;
      
      const totalEnd = performance.now();
      const totalTime = totalEnd - totalStart;
      
      // Log détaillé des temps d'exécution
      logger.debug(`[SnakAgent Creation] StarknetConfig: ${starknetConfigTime.toFixed(2)}ms`);
      logger.debug(`[SnakAgent Creation] Model loading: ${modelTime.toFixed(2)}ms`);
      logger.debug(`[SnakAgent Creation] Prompts loading: ${promptsTime.toFixed(2)}ms`);
      logger.debug(`[SnakAgent Creation] Config building: ${configBuildTime.toFixed(2)}ms`);
      logger.debug(`[SnakAgent Creation] Instantiation: ${instantiationTime.toFixed(2)}ms`);
      logger.debug(`[SnakAgent Creation] Initialization: ${initTime.toFixed(2)}ms`);
      logger.debug(`[SnakAgent Creation] Total time: ${totalTime.toFixed(2)}ms`);
      logger.debug(`[SnakAgent Creation] Agent ID: ${agentConfig.id} | Name: ${agentConfig.profile.name}`);

      return snakAgent;
    } catch (error) {
      logger.error(`Error creating SnakAgent from config:`, error);
      throw error;
    }
  }

  private async registerAgentInstance() {
    const registrationStart = performance.now();
    
    try {
      // Count agents in Redis for logging purposes
      const q = new Postgres.Query('SELECT DISTINCT user_id FROM agents');
      const userIds = await Postgres.query<{ user_id: string }>(q);
      
      logger.log(`[Agent Registration] Found ${userIds.length} users with agents`);
      
      let totalAgents = 0;
      for (const { user_id } of userIds) {
        try {
          const agentCount = await redisAgents.getAgentCount(user_id);
          totalAgents += agentCount;
        } catch (error) {
          logger.error(`Error counting agents for user ${user_id}:`, error);
        }
      }
      
      const registrationEnd = performance.now();
      const totalRegistrationTime = registrationEnd - registrationStart;
      
      logger.log(`[Agent Registration] Found ${totalAgents} total agents in Redis`);
      logger.log(`[Agent Registration] Agents will be loaded on-demand from Redis`);
      logger.log(`[Agent Registration] Total time: ${totalRegistrationTime.toFixed(2)}ms`);
      
    } catch (error) {
      logger.error('Error during agent registration:', error);
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
}
