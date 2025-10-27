import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigurationService } from '../config/configuration.js';
import { DatabaseService } from './services/database.service.js';
import { SupervisorService } from './services/supervisor.service.js';
import { redisAgents, agents } from '@snakagent/database/queries';
import { RedisClient } from '@snakagent/database/redis';
import {
  AgentConfig,
  ModelConfig,
  AgentPromptsInitialized,
  DEFAULT_AGENT_MODEL,
  AgentValidationService,
  DatabaseConfigService,
} from '@snakagent/core';
// Add this import if ModelSelectorConfig is exported from @snakagent/core
import DatabaseStorage from '../common/database/database.storage.js';
import {
  AgentConfigResolver,
  SnakAgent,
  TASK_EXECUTOR_SYSTEM_PROMPT,
  TASK_MANAGER_SYSTEM_PROMPT,
  TASK_MEMORY_MANAGER_SYSTEM_PROMPT,
  TASK_VERIFIER_SYSTEM_PROMPT,
  BaseAgent,
  SupervisorAgent,
} from '@snakagent/agents';
import { initializeModels } from './utils/agents.utils.js';

const logger = new Logger('AgentStorage');

// Default agent configuration constants

/**
 * Service responsible for managing agent storage, configuration, and lifecycle
 */
@Injectable()
export class AgentStorage implements OnModuleInit {
  private initialized: boolean = false;
  private initializationPromise: Promise<void> | null = null;
  private agentValidationService: AgentValidationService;

  constructor(
    private readonly config: ConfigurationService,
    private readonly databaseService: DatabaseService,
    private readonly supervisorService: SupervisorService
  ) {
    this.agentValidationService = new AgentValidationService(this);
  }

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
  ): Promise<AgentConfig.Output | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const config = await redisAgents.getAgentByPair(id, userId);

      if (!config) {
        logger.debug(`Agent ${id} not found for user ${userId}`);
      }

      return config;
    } catch (error) {
      logger.error(`Error fetching agent config from Redis: ${error}`);
      // Fallback to PostgreSQL as source of truth
      try {
        const result = await agents.selectAgents('id = $1 AND user_id = $2', [
          id,
          userId,
        ]);
        return result.length > 0 ? result[0] : null;
      } catch (pgError) {
        logger.error(`Fallback to PostgreSQL also failed: ${pgError}`);
        return null;
      }
    }
  }

  /**
   * Get all agent configurations for a specific user from Redis
   * @param userId - User ID to filter configurations
   * @returns AgentConfigSQL[] - Array of agent configurations owned by the user
   */
  public async getAllAgentConfigs(
    userId: string
  ): Promise<AgentConfig.OutputWithoutUserId[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      return await redisAgents.listAgentsByUser(userId);
    } catch (error) {
      logger.error(`Error fetching agent configs from Redis: ${error}`);
      // Fallback to PostgreSQL as source of truth
      try {
        logger.debug(
          `Fallback to PostgreSQL as source of truth for user ${userId}`
        );
        return await agents.selectAgents('user_id = $1', [userId]);
      } catch (pgError) {
        logger.error(`Fallback to PostgreSQL also failed: ${pgError}`);
        throw new Error(
          `Failed to fetch agents from both Redis and PostgreSQL. Redis: ${error}, PostgreSQL: ${pgError}`
        );
      }
    }
  }

  /**
   * Get a SnakAgent instance by ID
   * Fetches from Redis and creates a new instance each time
   * @param {string} id - The agent ID
   * @param {string} userId - User ID to verify ownership (required)
   * @returns {SnakAgent | undefined} The agent instance or undefined if not found or not owned by user
   */
  public async getAgentInstance(
    id: string,
    userId: string
  ): Promise<BaseAgent | undefined> {
    if (!this.initialized) {
      await this.initialize();
    }
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
      // Fallback to PostgreSQL as source of truth
      try {
        const result = await agents.selectAgents('id = $1 AND user_id = $2', [
          id,
          userId,
        ]);
        if (result.length > 0) {
          const {
            created_at,
            updated_at,
            avatar_image,
            avatar_mime_type,
            ...agentConfig
          } = result[0];
          // Create SnakAgent from config
          const snakAgent = await this.createSnakAgentFromConfig(agentConfig);
          logger.debug(
            `Agent ${id} created from PostgreSQL fallback for user ${userId}`
          );
          return snakAgent;
        }
        return undefined;
      } catch (pgError) {
        logger.error(`Fallback to PostgreSQL also failed: ${pgError}`);
        throw new Error(
          `Failed to get agent instance from PostgreSQL: ${pgError}`
        );
      }
    }
  }

  public async getModelFromUser(userId: string): Promise<ModelConfig> {
    if (!userId || userId.length === 0) {
      throw new Error('User ID is required to fetch model configuration');
    }
    const result = await agents.getModelFromUser(userId);
    if (!result) {
      await agents.createModelConfig(
        userId,
        DEFAULT_AGENT_MODEL.provider,
        DEFAULT_AGENT_MODEL.model_name,
        DEFAULT_AGENT_MODEL.temperature,
        DEFAULT_AGENT_MODEL.max_tokens
      );
      const new_r = await agents.getModelFromUser(userId);
      if (!new_r) {
        throw new Error(`No user found with ID: ${userId}`);
      }
      return new_r;
    }
    return result;
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
    if (!this.initialized) {
      await this.initialize();
    }

    const baseName = agentConfig.profile.name;

    let finalName = baseName;
    const nameCheckResult = await agents.checkAgentNameExists(userId, baseName);
    if (nameCheckResult) {
      const existingName = nameCheckResult.name;
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
    await this.agentValidationService.validateAgent(
      { ...agentConfig, user_id: userId },
      true
    );
    const newAgentDbRecord = await agents.insertAgentFromJson(
      userId,
      agentConfig
    );

    if (newAgentDbRecord) {
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

    const q_res = await agents.deleteAgent(id, userId);

    if (!q_res) {
      throw new Error(`Agent ${id} not found or not owned by user ${userId}`);
    }

    logger.debug(`Agent deleted from database: ${q_res.id}`);

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
   * Get the total number of agents in the system
   * @returns Promise<number> - The total number of agents
   */
  public async getTotalAgentsCount(): Promise<number> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      return await agents.getTotalAgentsCount();
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
      return await agents.getUserAgentsCount(userId);
    } catch (error) {
      logger.error(`Error getting agents count for user ${userId}:`, error);
      throw error;
    }
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
      const modelInstance = initializeModels(model);
      if (!modelInstance || modelInstance.bindTools === undefined) {
        throw new Error('Failed to initialize model for AgentSelector');
      }

      // Create agent config resolver function that fetches agent configs from Redis on-demand
      const agentConfigResolver: AgentConfigResolver = async (
        userId: string
      ): Promise<AgentConfig.Output[]> => {
        try {
          const agentConfigs = await redisAgents.listAgentsByUser(userId);
          logger.debug(
            `agentConfigResolver: Found ${agentConfigs.length} configs for user ${userId}`
          );
          return agentConfigs;
        } catch (error) {
          logger.error(`Error fetching agent configs from Redis: ${error}`);
          // Fallback to PostgreSQL as source of truth
          try {
            logger.debug(
              `agentConfigResolver: Fallback to PostgreSQL as source of truth for user ${userId}`
            );
            const result = await agents.selectAgents('user_id = $1', [userId]);
            logger.debug(
              `agentConfigResolver: Found ${result.length} configs from PostgreSQL for user ${userId}`
            );
            return result;
          } catch (pgError) {
            logger.error(
              `agentConfigResolver: Fallback to PostgreSQL also failed: ${pgError}`
            );
            throw new Error(
              `Failed to fetch agent configs: Redis: ${error}, PostgreSQL: ${pgError}`
            );
          }
        }
      };
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
      const q_res = await agents.getAllAgents();

      // Sync all agents to Redis
      logger.debug(`Syncing ${q_res.length} agents to Redis`);
      for (const agentConfig of q_res) {
        try {
          // Check if already exists in Redis
          const exists = await redisAgents.agentExists(
            agentConfig.id,
            agentConfig.user_id
          );
          if (!exists) {
            await redisAgents.saveAgent(agentConfig);
            logger.debug(`Synced agent ${agentConfig.id} to Redis`);
          }
        } catch (error) {
          logger.error(
            `Failed to sync agent ${agentConfig.id} to Redis:`,
            error
          );
          // Continue with other agents
        }
      }

      logger.debug(`Agents configuration loaded: ${q_res.length} agents`);
      return q_res;
    } catch (error) {
      logger.error('Error during agents configuration initialization:', error);
      throw error;
    }
  }

  private async createAgentConfigRuntimeFromOutputWithId(
    agentConfigOutputWithId: AgentConfig.OutputWithId
  ): Promise<AgentConfig.Runtime | undefined> {
    try {
      const model = await this.getModelFromUser(
        agentConfigOutputWithId.user_id
      );
      const modelInstance = initializeModels(model);
      if (!modelInstance) {
        throw new Error('Failed to initialize model for SnakAgent');
      }
      const promptsFromDb = await this.getPromptsFromDatabase(
        agentConfigOutputWithId.prompts_id
      );
      if (!promptsFromDb) {
        throw new Error(
          `Failed to load prompts for agent ${agentConfigOutputWithId.id}, prompts ID: ${agentConfigOutputWithId.prompts_id}`
        );
      }
      const AgentConfigRuntime: AgentConfig.Runtime = {
        ...agentConfigOutputWithId,
        prompts: promptsFromDb,
        graph: {
          ...agentConfigOutputWithId.graph,
          model: modelInstance,
        },
      };
      return AgentConfigRuntime;
    } catch (error) {
      logger.error('Agent configuration validation failed:', error);
      throw error;
    }
  }

  /* ==================== PRIVATE AGENT CREATION METHODS ==================== */

  private async createSnakAgentFromConfig(
    agentConfig: AgentConfig.OutputWithId
  ): Promise<BaseAgent> {
    try {
      const AgentConfigRuntime =
        await this.createAgentConfigRuntimeFromOutputWithId(agentConfig);
      if (!AgentConfigRuntime) {
        throw new Error(
          `Failed to create runtime config for agent ${agentConfig.id}`
        );
      }
      if (this.supervisorService.isSupervisorConfig(AgentConfigRuntime)) {
        const supervisorAgent = new SupervisorAgent(AgentConfigRuntime);
        await supervisorAgent.init();
        return supervisorAgent;
      }
      const snakAgent = new SnakAgent(AgentConfigRuntime);
      await snakAgent.init();

      return snakAgent;
    } catch (error) {
      logger.error(`Error creating SnakAgent from config:`, error);
      throw error;
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
      const promptData = await agents.getPromptsById(promptId);

      if (!promptData) {
        logger.warn(`No prompts found for ID: ${promptId}`);
        return null;
      }

      // Validate that we have valid prompt data
      if (typeof promptData !== 'object') {
        logger.warn(`Invalid prompt data structure for ID: ${promptId}`);
        return null;
      }

      // Parse to proper format and return as SystemMessage objects
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
      const existing = await agents.getExistingPromptsForUser(userId);

      if (existing) {
        logger.debug(
          `Default prompts already exist for user ${userId}, returning existing ID`
        );
        return existing.id;
      }

      // Insert new default prompts for the user
      const promptId = await agents.createDefaultPrompts(
        userId,
        TASK_EXECUTOR_SYSTEM_PROMPT,
        TASK_MANAGER_SYSTEM_PROMPT,
        TASK_VERIFIER_SYSTEM_PROMPT,
        TASK_MEMORY_MANAGER_SYSTEM_PROMPT,
        false
      );

      logger.debug(
        `Default prompts created successfully for user ${userId} with ID: ${promptId}`
      );
      return promptId;
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
    agentConfig: AgentConfig.Input | AgentConfig.InputWithOptionalParam,
    isCreation: boolean = false
  ): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
    return this.agentValidationService.validateAgent(
      agentConfig,
      isCreation,
      this
    );
  }
}
