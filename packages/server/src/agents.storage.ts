import { Injectable, Logger, OnModuleInit, Query } from '@nestjs/common';
import { ConfigurationService } from '../config/configuration.js';
import { DatabaseService } from './services/database.service.js';
import { Postgres } from '@snakagent/database';
import {
  AgentConfig,
  ModelConfig,
  Id,
  StarknetConfig,
  AgentPrompts,
  DEFAULT_PROMPT_ID,
  DEFAULT_USER_ID,
  DEFAULT_AGENT_ID,
  AgentPromptsInitialized,
  DEFAULT_AGENT_CONFIG,
  DEFAULT_AGENT_MODEL,
} from '@snakagent/core';
// Add this import if ModelSelectorConfig is exported from @snakagent/core
import DatabaseStorage from '../common/database/database.js';
import {
  AgentSelector,
  SnakAgent,
  TASK_EXECUTOR_PROMPT,
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
  private agentConfigs: AgentConfig.InputWithId[] = [];
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
   * @returns AgentConfig.InputWithId | undefined - The agent configuration or undefined if not found
   */
  public getAgentConfig(id: string): AgentConfig.InputWithId | undefined {
    if (!this.initialized) {
      return undefined;
    }
    return this.agentConfigs.find((config) => config.id === id);
  }

  /**
   * Get all agent configurations
   * @returns AgentConfig.InputWithId[] - Array of all agent configurations
   */
  public getAllAgentConfigs(): AgentConfig.InputWithId[] {
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
    if (result.length === 0) {
      const create_q = new Postgres.Query(
        'INSERT INTO models_config (user_id,model) VALUES ($1,ROW($2, $3, $4, $5)::model_config)',
        [
          'default-user',
          DEFAULT_AGENT_MODEL.provider,
          DEFAULT_AGENT_MODEL.modelName,
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
   * @param agent_config - Raw agent configuration
   * @returns Promise<AgentConfig.InputWithId> - The newly created agent configuration
   */
  public async addAgent(
    agent_config: AgentConfig.Input
  ): Promise<AgentConfig.InputWithId> {
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
        ROW($3, $4, $5::text[], $6::text[], $7::text[], $8)::agent_profile,
        $9::agent_mode,
        $10::jsonb,
        $11::text[],
        ROW($12)::agent_prompts,
        ROW($13, $14, $15, $16, $17, ROW($18, $19, $20, $21)::model_config)::graph_config,
        ROW($22, $23, ROW($24, $25, $26, $27)::memory_size_limits, ROW($28, $29, $30, $31)::memory_thresholds, ROW($32, $33)::memory_timeouts, $34::memory_strategy)::memory_config,
        ROW($35, $36, $37)::rag_config
      ) RETURNING
        id,
        name,
        "group",
        row_to_json(profile) as profile,
        mode,
        mcp_servers,
        plugins,
        row_to_json(prompts) as prompts,
        row_to_json(graph) as graph,
        row_to_json(memory) as memory,
        row_to_json(rag) as rag,
        created_at,
        updated_at,
        avatar_image,
        avatar_mime_type`,
      [
        finalName, // $1
        group, // $2
        agent_config.profile.description, // $3
        agent_config.profile.group, // $4
        agent_config.profile.lore, // $5
        agent_config.profile.objectives, // $6
        agent_config.profile.knowledge, // $7
        agent_config.profile.agentConfigPrompt || null, // $8
        agent_config.mode, // $9
        agent_config.mcpServers || {}, // $10
        agent_config.plugins, // $11
        // agent_prompts
        agent_config.prompts.id, // $12
        // graph_config
        agent_config.graph.maxSteps, // $13
        agent_config.graph.maxIterations, // $14
        agent_config.graph.maxRetries, // $15
        agent_config.graph.executionTimeoutMs, // $16
        agent_config.graph.maxTokenUsage, // $17
        // model_config (nested in graph_config)
        agent_config.graph.model.provider, // $18
        agent_config.graph.model.modelName, // $19
        agent_config.graph.model.temperature, // $20
        agent_config.graph.model.max_tokens || 4096, // $21
        // memory_config
        agent_config.memory.ltmEnabled, // $22
        agent_config.memory.summarizationThreshold, // $23
        // memory_size_limits
        agent_config.memory.sizeLimits.shortTermMemorySize, // $24
        agent_config.memory.sizeLimits.maxInsertEpisodicSize, // $25
        agent_config.memory.sizeLimits.maxInsertSemanticSize, // $26
        agent_config.memory.sizeLimits.maxRetrieveMemorySize, // $27
        // memory_thresholds
        agent_config.memory.thresholds.insertSemanticThreshold, // $28
        agent_config.memory.thresholds.insertEpisodicThreshold, // $29
        agent_config.memory.thresholds.retrieveMemoryThreshold, // $30
        agent_config.memory.thresholds.summarizationThreshold, // $31
        // memory_timeouts
        agent_config.memory.timeouts.retrieveMemoryTimeoutMs, // $32
        agent_config.memory.timeouts.insertMemoryTimeoutMs, // $33
        // memory_strategy
        agent_config.memory.strategy, // $34
        // rag_config
        agent_config.rag.enabled, // $35
        agent_config.rag.topK, // $36
        agent_config.rag.embeddingModel, // $37
      ]
    );
    const q_res = await Postgres.query<AgentConfig.InputWithId>(q);
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
    const q_res = await Postgres.query<AgentConfig.InputWithId>(q);
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

      // Initialize default agent and prompts in database
      await this.initializeDefaultAgent();
      await this.initializeDefaultPrompts();

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
      const q = new Postgres.Query(`
        SELECT
          id,
          name,
          "group",
          row_to_json(profile) as profile,
          mode,
          mcp_servers,
          plugins,
          row_to_json(prompts) as prompts,
          row_to_json(graph) as graph,
          row_to_json(memory) as memory,
          row_to_json(rag) as rag,
          created_at,
          updated_at,
          avatar_image,
          avatar_mime_type
        FROM agents
      `);
      const q_res = await Postgres.query<AgentConfig.InputWithId>(q);
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
    agentConfig: AgentConfig.InputWithId
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

      const agentConfigPrompt = this.buildSystemPromptFromConfig({
        name: agentConfig.name,
        description: agentConfig.profile.description,
        lore: agentConfig.profile.lore || [],
        objectives: agentConfig.profile.objectives || [],
        knowledge: agentConfig.profile.knowledge || [],
      });

      agentConfig.profile.agentConfigPrompt = agentConfigPrompt;

      // JUST FOR TESTING PURPOSES
      const model = await this.getModelFromUser('default-user');
      const modelInstance = this.initializeModels(model);
      if (!modelInstance) {
        throw new Error('Failed to initialize model for SnakAgent');
      }
      // Get prompts from database or use fallback
      const promptsFromDb = await this.getPromptsFromDatabase(
        agentConfig.prompts.id
      );
      const agentPrompts = promptsFromDb || {
        taskExecutorPrompt: new SystemMessage('You are a task execution AI.'),
        taskManagerPrompt: new SystemMessage('You are a task management AI.'),
        taskVerifierPrompt: new SystemMessage(
          'You are a task verification AI.'
        ),
        taskMemoryManagerPrompt: new SystemMessage(
          'You are a task and memory management AI.'
        ),
      };

      const AgentConfigRuntime: AgentConfig.Runtime = {
        ...agentConfig,
        prompts: agentPrompts,
        graph: {
          ...agentConfig.graph,
          model: modelInstance,
        },
      };

      console.log('AgentConfigRuntime:', AgentConfigRuntime);
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

  /**
   * Get prompts from database by prompt ID
   * @private
   * @param promptId - UUID of the prompt configuration
   * @returns Promise<AgentConfig.Prompts | null> - Parsed prompts or null if not found
   */
  private async getPromptsFromDatabase(promptId: string): Promise<any | null> {
    try {
      const query = new Postgres.Query(
        `SELECT row_to_json(row(
          task_executor_prompt,
          task_manager_prompt,
          task_verifier_prompt,
          task_memory_manager_prompt
        )) as prompts_json
         FROM prompts
         WHERE id = $1`,
        [promptId]
      );

      const result = await Postgres.query<{
        prompts_json: AgentPromptsInitialized;
      }>(query);

      if (result.length === 0) {
        logger.warn(`No prompts found for ID: ${promptId}`);
        return null;
      }

      const promptData = result[0].prompts_json;

      // Parse to proper format and return as SystemMessage objects
      return {
        taskExecutorPrompt: new SystemMessage(promptData.taskExecutorPrompt),
        taskManagerPrompt: new SystemMessage(promptData.taskManagerPrompt),
        taskVerifierPrompt: new SystemMessage(promptData.taskVerifierPrompt),
        taskMemoryManagerPrompt: new SystemMessage(
          promptData.taskMemoryManagerPrompt
        ),
      };
    } catch (error) {
      logger.error(`Failed to fetch prompts from database: ${error.message}`);
      return null;
    }
  }

  /**
   * Initialize default agent in the database
   * @private
   */
  private async initializeDefaultAgent(): Promise<void> {
    try {
      logger.log('Initializing default agent...');

      // Check if default agent already exists
      const checkQuery = new Postgres.Query(
        `SELECT id FROM agents WHERE id = $1`,
        [DEFAULT_AGENT_ID]
      );

      const existingAgent = await Postgres.query(checkQuery);

      if (existingAgent.length > 0) {
        logger.log('Default agent already exists, skipping creation');
        return;
      }

      // Create default agent configuration using constants
      const insertQuery = new Postgres.Query(
        `INSERT INTO agents (
          id,
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
          $3,
          ROW($4, $5, $6::text[], $7::text[], $8::text[], $9)::agent_profile,
          $10::agent_mode,
          $11::jsonb,
          $12::text[],
          ROW($13)::agent_prompts,
          ROW($14, $15, $16, $17, $18, ROW($19, $20, $21, $22)::model_config)::graph_config,
          ROW($23, $24, ROW($25, $26, $27, $28)::memory_size_limits, ROW($29, $30, $31, $32)::memory_thresholds, ROW($33, $34)::memory_timeouts, $35::memory_strategy)::memory_config,
          ROW($36, $37, $38)::rag_config
        )`,
        [
          DEFAULT_AGENT_ID,                                    // $1
          DEFAULT_AGENT_CONFIG.name,                           // $2
          DEFAULT_AGENT_CONFIG.group,                          // $3
          // agent_profile
          DEFAULT_AGENT_CONFIG.profile.description,            // $4
          DEFAULT_AGENT_CONFIG.profile.group,                  // $5
          DEFAULT_AGENT_CONFIG.profile.lore,                   // $6
          DEFAULT_AGENT_CONFIG.profile.objectives,             // $7
          DEFAULT_AGENT_CONFIG.profile.knowledge,              // $8
          DEFAULT_AGENT_CONFIG.profile.merged_profile,         // $9
          DEFAULT_AGENT_CONFIG.mode,                           // $10
          DEFAULT_AGENT_CONFIG.mcp_servers,                    // $11
          DEFAULT_AGENT_CONFIG.plugins,                        // $12
          // agent_prompts
          DEFAULT_AGENT_CONFIG.prompts.id,                     // $13
          // graph_config
          DEFAULT_AGENT_CONFIG.graph.max_steps,                // $14
          DEFAULT_AGENT_CONFIG.graph.max_iterations,           // $15
          DEFAULT_AGENT_CONFIG.graph.max_retries,              // $16
          DEFAULT_AGENT_CONFIG.graph.execution_timeout_ms,     // $17
          DEFAULT_AGENT_CONFIG.graph.max_token_usage,          // $18
          // model_config (nested in graph_config)
          DEFAULT_AGENT_CONFIG.graph.model.provider,           // $19
          DEFAULT_AGENT_CONFIG.graph.model.modelName,          // $20
          DEFAULT_AGENT_CONFIG.graph.model.temperature,        // $21
          DEFAULT_AGENT_CONFIG.graph.model.max_tokens,         // $22
          // memory_config
          DEFAULT_AGENT_CONFIG.memory.ltm_enabled,             // $23
          DEFAULT_AGENT_CONFIG.memory.summarization_threshold, // $24
          // memory_size_limits
          DEFAULT_AGENT_CONFIG.memory.size_limits.short_term_memory_size,      // $25
          DEFAULT_AGENT_CONFIG.memory.size_limits.max_insert_episodic_size,    // $26
          DEFAULT_AGENT_CONFIG.memory.size_limits.max_insert_semantic_size,    // $27
          DEFAULT_AGENT_CONFIG.memory.size_limits.max_retrieve_memory_size,    // $28
          // memory_thresholds
          DEFAULT_AGENT_CONFIG.memory.thresholds.insert_semantic_threshold,    // $29
          DEFAULT_AGENT_CONFIG.memory.thresholds.insert_episodic_threshold,    // $30
          DEFAULT_AGENT_CONFIG.memory.thresholds.retrieve_memory_threshold,    // $31
          DEFAULT_AGENT_CONFIG.memory.thresholds.summarization_threshold,      // $32
          // memory_timeouts
          DEFAULT_AGENT_CONFIG.memory.timeouts.retrieve_memory_timeout_ms,     // $33
          DEFAULT_AGENT_CONFIG.memory.timeouts.insert_memory_timeout_ms,       // $34
          // memory_strategy
          DEFAULT_AGENT_CONFIG.memory.strategy,                                // $35
          // rag_config
          DEFAULT_AGENT_CONFIG.rag.enabled,                                    // $36
          DEFAULT_AGENT_CONFIG.rag.top_k,                                      // $37
          DEFAULT_AGENT_CONFIG.rag.embedding_model,                            // $38
        ]
      );

      await Postgres.query(insertQuery);
      logger.log('Default agent created successfully');
    } catch (error) {
      logger.warn(`Failed to initialize default agent: ${error.message}`);
      // Don't throw error - this is not critical for basic functionality
    }
  }

  /**
   * Initialize default prompts in the database
   * @private
   */
  private async initializeDefaultPrompts(): Promise<void> {
    try {
      logger.log('Initializing default prompts...');
      // Call the database function to create default prompts
      const query = new Postgres.Query(
        `
        SELECT * FROM upsert_default_prompt(
          $1::UUID,
          $2::UUID,
          $3::UUID,
          $4::TEXT,
          $5::TEXT,
          $6::TEXT,
          $7::TEXT,
          $8::BOOLEAN,
          $9::INTEGER,
          $10::INTEGER
        )
      `,
        [
          DEFAULT_PROMPT_ID,
          DEFAULT_USER_ID,
          DEFAULT_AGENT_ID,
          TASK_EXECUTOR_PROMPT, // task_executor_pcrompt
          TASK_MANAGER_SYSTEM_PROMPT, // task_manager_prompt
          TASK_VERIFIER_SYSTEM_PROMPT, // task_verifier_prompt
          TASK_MEMEMORY_MANAGER_SYSTEM_PROMPT, // task_memory_manager_prompt
          false, // public
          0, // upvote
          0,
        ]
      );
      const result = await Postgres.query(query);

      const promptResult = result[0];
      logger.log(
        `Default prompts: ${promptResult.action_taken} - ${promptResult.message}`
      );
    } catch (error) {
      logger.warn(`Failed to initialize default prompts: ${error.message}`);
      // Don't throw error - this is not critical for basic functionality
    }
  }
}
