import { getGuardValue } from './guards.service.js';
import { AgentConfig } from '../common/agent.js';
import logger from '../logger/logger.js';

/**
 * Interface for database operations needed by agent validation
 */
export interface AgentDatabaseInterface {
  /**
   * Get the total number of agents in the system
   * @returns Promise<number> - The total number of agents
   */
  getTotalAgentsCount(): Promise<number>;

  /**
   * Get the number of agents for a specific user
   * @param userId - User ID to count agents for
   * @returns Promise<number> - The number of agents owned by the user
   */
  getUserAgentsCount(userId: string): Promise<number>;
}

/**
 * Service for validating agent configurations
 * Provides validation logic that can be used across different parts of the application
 */
export class AgentValidationService {
  constructor(private readonly databaseInterface?: AgentDatabaseInterface) {}

  /**
   * Unified validation method for both agent creation and update
   * @param agent_config - Agent configuration to validate
   *   - AgentConfig.Input: Complete configuration for creation
   *   - AgentConfig.WithOptionalParam: Configuration with required id/user_id for updates
   *   - Partial<AgentConfig.Input>: Partial configuration for specific field validation (e.g., MCP servers only)
   * @param isCreation - Whether this is for creation (true) or update (false)
   * @param databaseInterface - Optional database interface for count validations
   * @public
   */
  public async validateAgent(
    agent_config: AgentConfig.Input | AgentConfig.InputWithOptionalParam,
    isCreation: boolean = false,
    databaseInterface?: AgentDatabaseInterface
  ): Promise<void> {
    try {
      const dbInterface = databaseInterface || this.databaseInterface;

      // Only validate limits for creation, not for updates
      if (
        isCreation &&
        'user_id' in agent_config &&
        agent_config.user_id &&
        dbInterface
      ) {
        // Validate global agent limits
        const totalAgentsCount = await dbInterface.getTotalAgentsCount();
        if (totalAgentsCount >= getGuardValue('global.max_agents')) {
          throw new Error(
            `Maximum global agent limit reached (${getGuardValue('global.max_agents')}). Cannot create more agents.`
          );
        }

        // Validate user-specific agent limits
        const userAgentsCount = await dbInterface.getUserAgentsCount(
          agent_config.user_id!
        );
        if (userAgentsCount >= getGuardValue('user.max_agents')) {
          throw new Error(
            `Maximum user agent limit reached (${getGuardValue('user.max_agents')}). User cannot create more agents.`
          );
        }
      }

      // Validate each section using dedicated methods
      if (agent_config.profile) {
        this.validateProfile(agent_config.profile);
      }

      if (agent_config.graph) {
        this.validateGraph(agent_config.graph);
      }

      if (agent_config.memory) {
        this.validateMemory(agent_config.memory);
      }

      if (agent_config.rag) {
        this.validateRAG(agent_config.rag);
      }

      if (agent_config.mcp_servers) {
        this.validateMCPServers(agent_config.mcp_servers);
      }

      // Validate identifiers (chatId and prompts_id)
      this.validateIdentifiers(agent_config);

      logger.debug(
        `Agent ${isCreation ? 'creation' : 'update'} validation passed successfully`
      );
    } catch (error) {
      logger.error(
        `Agent ${isCreation ? 'creation' : 'update'} validation failed:`,
        error
      );
      throw error;
    }
  }

  /**
   * Validate agent profile configuration
   * @param profile - Agent profile to validate
   * @private
   */
  private validateAgentProfile(profile: any): void {
    // Load guard values once for performance
    const nameMaxLength = getGuardValue('agents.profile.name_max_length');
    const nameMinLength = getGuardValue('agents.profile.name_min_length');
    const descriptionMaxLength = getGuardValue(
      'agents.profile.description_max_length'
    );
    const descriptionMinLength = getGuardValue(
      'agents.profile.description_min_length'
    );
    const groupMaxLength = getGuardValue('agents.profile.group_max_length');
    const groupMinLength = getGuardValue('agents.profile.group_min_length');
    const contextsMaxSize = getGuardValue('agents.profile.contexts_max_size');
    const contextMaxLength = getGuardValue('agents.profile.context_max_length');
    const contextMinLength = getGuardValue('agents.profile.context_min_length');

    // Validate agent name length
    if (profile.name) {
      if (profile.name.length > nameMaxLength) {
        throw new Error(
          `Agent name too long. Maximum length: ${nameMaxLength}`
        );
      }
      if (profile.name.length < nameMinLength) {
        throw new Error(
          `Agent name too short. Minimum length: ${nameMinLength}`
        );
      }
    }

    // Validate agent description length
    if (profile.description) {
      if (profile.description.length > descriptionMaxLength) {
        throw new Error(
          `Agent description too long. Maximum length: ${descriptionMaxLength}`
        );
      }
      if (profile.description.length < descriptionMinLength) {
        throw new Error(
          `Agent description too short. Minimum length: ${descriptionMinLength}`
        );
      }
    }

    // Validate agent group length
    if (profile.group) {
      if (profile.group.length > groupMaxLength) {
        throw new Error(
          `Agent group too long. Maximum length: ${groupMaxLength}`
        );
      }
      if (profile.group.length < groupMinLength) {
        throw new Error(
          `Agent group too short. Minimum length: ${groupMinLength}`
        );
      }
    }

    // Validate contexts array
    if (profile.contexts && Array.isArray(profile.contexts)) {
      if (profile.contexts.length > contextsMaxSize) {
        throw new Error(
          `Too many contexts. Maximum allowed: ${contextsMaxSize}`
        );
      }
      for (const context of profile.contexts) {
        if (context.length > contextMaxLength) {
          throw new Error(
            `Context too long. Maximum length: ${contextMaxLength}`
          );
        }
        if (context.length < contextMinLength) {
          throw new Error(
            `Context too short. Minimum length: ${contextMinLength}`
          );
        }
      }
    }
  }

  /**
   * Validate graph configuration
   * @param graph - Graph configuration to validate
   * @private
   */
  private validateGraphConfig(graph: any): void {
    // Load guard values once for performance
    const maxSteps = getGuardValue('agents.graph.max_steps');
    const minSteps = getGuardValue('agents.graph.min_steps');
    const maxIterations = getGuardValue('agents.graph.max_iterations');
    const maxRetries = getGuardValue('agents.graph.max_retries');
    const maxExecutionTimeout = getGuardValue(
      'agents.graph.max_execution_timeout_ms'
    );
    const maxTokenUsage = getGuardValue('agents.graph.max_token_usage');

    // Validate max_steps
    if (graph.max_steps !== undefined && graph.max_steps !== null) {
      if (Number.isNaN(graph.max_steps)) {
        throw new Error('Max steps must be a valid number');
      }
      if (graph.max_steps > maxSteps) {
        throw new Error(`Max steps too high. Maximum value: ${maxSteps}`);
      }
      if (graph.max_steps < minSteps) {
        throw new Error(`Max steps too low. Minimum value: ${minSteps}`);
      }
    }

    // Validate max_iterations
    if (graph.max_iterations !== undefined && graph.max_iterations !== null) {
      if (Number.isNaN(graph.max_iterations)) {
        throw new Error('Max iterations must be a valid number');
      }
      if (graph.max_iterations > maxIterations) {
        throw new Error(
          `Max iterations too high. Maximum value: ${maxIterations}`
        );
      }
    }

    // Validate max_retries
    if (graph.max_retries !== undefined && graph.max_retries !== null) {
      if (Number.isNaN(graph.max_retries)) {
        throw new Error('Max retries must be a valid number');
      }
      if (graph.max_retries > maxRetries) {
        throw new Error(`Max retries too high. Maximum value: ${maxRetries}`);
      }
    }

    // Validate execution_timeout_ms
    if (
      graph.execution_timeout_ms !== undefined &&
      graph.execution_timeout_ms !== null
    ) {
      if (Number.isNaN(graph.execution_timeout_ms)) {
        throw new Error('Execution timeout must be a valid number');
      }
      if (graph.execution_timeout_ms > maxExecutionTimeout) {
        throw new Error(
          `Execution timeout too high. Maximum value: ${maxExecutionTimeout}`
        );
      }
    }

    // Validate max_token_usage
    if (graph.max_token_usage !== undefined && graph.max_token_usage !== null) {
      if (Number.isNaN(graph.max_token_usage)) {
        throw new Error('Max token usage must be a valid number');
      }
      if (graph.max_token_usage > maxTokenUsage) {
        throw new Error(
          `Max token usage too high. Maximum value: ${maxTokenUsage}`
        );
      }
    }

    // Validate model configuration
    if (graph.model) {
      this.validateModelConfig(graph.model);
    }
  }

  /**
   * Validate model configuration
   * @param model - Model configuration to validate
   * @private
   */
  private validateModelConfig(model: any): void {
    // Load guard values once for performance
    const providerMaxLength = getGuardValue(
      'agents.graph.model.provider_max_length'
    );
    const providerMinLength = getGuardValue(
      'agents.graph.model.provider_min_length'
    );
    const modelNameMaxLength = getGuardValue(
      'agents.graph.model.model_name_max_length'
    );
    const modelNameMinLength = getGuardValue(
      'agents.graph.model.model_name_min_length'
    );
    const maxTemperature = getGuardValue('agents.graph.model.max_temperature');
    const maxTokens = getGuardValue('agents.graph.model.max_tokens');

    // Validate provider
    if (model.provider) {
      if (model.provider.length > providerMaxLength) {
        throw new Error(
          `Model provider too long. Maximum length: ${providerMaxLength}`
        );
      }
      if (model.provider.length < providerMinLength) {
        throw new Error(
          `Model provider too short. Minimum length: ${providerMinLength}`
        );
      }
    }

    // Validate model_name
    if (model.model_name) {
      if (model.model_name.length > modelNameMaxLength) {
        throw new Error(
          `Model name too long. Maximum length: ${modelNameMaxLength}`
        );
      }
      if (model.model_name.length < modelNameMinLength) {
        throw new Error(
          `Model name too short. Minimum length: ${modelNameMinLength}`
        );
      }
    }

    // Validate temperature
    if (model.temperature !== undefined) {
      if (model.temperature > maxTemperature) {
        throw new Error(
          `Temperature too high. Maximum value: ${maxTemperature}`
        );
      }
    }

    // Validate max_tokens
    if (model.max_tokens) {
      if (model.max_tokens > maxTokens) {
        throw new Error(`Max tokens too high. Maximum value: ${maxTokens}`);
      }
    }
  }

  /**
   * Validate memory configuration
   * @param memory - Memory configuration to validate
   * @private
   */
  private validateMemoryConfig(memory: any): void {
    // Load guard values once for performance
    const strategyMaxLength = getGuardValue(
      'agents.memory.strategy_max_length'
    );
    const strategyMinLength = getGuardValue(
      'agents.memory.strategy_min_length'
    );

    // Validate size_limits
    if (memory.size_limits) {
      this.validateMemorySizeLimits(memory.size_limits);
    }

    // Validate thresholds
    if (memory.thresholds) {
      this.validateMemoryThresholds(memory.thresholds);
    }

    // Validate timeouts
    if (memory.timeouts) {
      this.validateMemoryTimeouts(memory.timeouts);
    }

    // Validate strategy
    if (memory.strategy) {
      if (memory.strategy.length > strategyMaxLength) {
        throw new Error(
          `Memory strategy too long. Maximum length: ${strategyMaxLength}`
        );
      }
      if (memory.strategy.length < strategyMinLength) {
        throw new Error(
          `Memory strategy too short. Minimum length: ${strategyMinLength}`
        );
      }
      const validStrategies = ['holistic', 'categorized'];
      if (!validStrategies.includes(memory.strategy)) {
        throw new Error(
          `Invalid memory strategy. Must be one of: ${validStrategies.join(', ')}`
        );
      }
    }
  }

  /**
   * Validate memory size limits
   * @param sizeLimits - Memory size limits to validate
   * @private
   */
  private validateMemorySizeLimits(sizeLimits: any): void {
    // Load guard values once for performance
    const maxShortTermMemorySize = getGuardValue(
      'agents.memory.size_limits.max_short_term_memory_size'
    );
    const maxInsertEpisodicSize = getGuardValue(
      'agents.memory.size_limits.max_insert_episodic_size'
    );
    const maxInsertSemanticSize = getGuardValue(
      'agents.memory.size_limits.max_insert_semantic_size'
    );
    const maxRetrieveMemorySize = getGuardValue(
      'agents.memory.size_limits.max_retrieve_memory_size'
    );
    const maxLimitBeforeSummarization = getGuardValue(
      'agents.memory.size_limits.max_limit_before_summarization'
    );

    const limits = [
      { key: 'short_term_memory_size', max: maxShortTermMemorySize },
      { key: 'insert_episodic_size', max: maxInsertEpisodicSize },
      { key: 'insert_semantic_size', max: maxInsertSemanticSize },
      { key: 'retrieve_memory_size', max: maxRetrieveMemorySize },
      { key: 'limit_before_summarization', max: maxLimitBeforeSummarization },
    ];

    for (const limit of limits) {
      if (sizeLimits[limit.key] !== undefined) {
        if (sizeLimits[limit.key] > limit.max) {
          throw new Error(
            `Memory ${limit.key} too high. Maximum value: ${limit.max}`
          );
        }
      }
    }
  }

  /**
   * Validate memory thresholds
   * @param thresholds - Memory thresholds to validate
   * @private
   */
  private validateMemoryThresholds(thresholds: any): void {
    // Load guard values once for performance
    const maxInsertSemanticThreshold = getGuardValue(
      'agents.memory.thresholds.max_insert_semantic_threshold'
    );
    const maxInsertEpisodicThreshold = getGuardValue(
      'agents.memory.thresholds.max_insert_episodic_threshold'
    );
    const maxRetrieveMemoryThreshold = getGuardValue(
      'agents.memory.thresholds.max_retrieve_memory_threshold'
    );
    const maxHitlThreshold = getGuardValue(
      'agents.memory.thresholds.max_hitl_threshold'
    );

    const thresholdKeys = [
      { key: 'insert_semantic_threshold', max: maxInsertSemanticThreshold },
      { key: 'insert_episodic_threshold', max: maxInsertEpisodicThreshold },
      { key: 'retrieve_memory_threshold', max: maxRetrieveMemoryThreshold },
      { key: 'hitl_threshold', max: maxHitlThreshold },
    ];

    for (const threshold of thresholdKeys) {
      if (thresholds[threshold.key] !== undefined) {
        if (thresholds[threshold.key] > threshold.max) {
          throw new Error(
            `Memory ${threshold.key} too high. Maximum value: ${threshold.max}`
          );
        }
      }
    }
  }

  /**
   * Validate memory timeouts
   * @param timeouts - Memory timeouts to validate
   * @private
   */
  private validateMemoryTimeouts(timeouts: any): void {
    // Load guard values once for performance
    const maxRetrieveMemoryTimeout = getGuardValue(
      'agents.memory.timeouts.max_retrieve_memory_timeout_ms'
    );
    const maxInsertMemoryTimeout = getGuardValue(
      'agents.memory.timeouts.max_insert_memory_timeout_ms'
    );

    const timeoutKeys = [
      { key: 'retrieve_memory_timeout_ms', max: maxRetrieveMemoryTimeout },
      { key: 'insert_memory_timeout_ms', max: maxInsertMemoryTimeout },
    ];

    for (const timeout of timeoutKeys) {
      if (timeouts[timeout.key] !== undefined) {
        if (timeouts[timeout.key] > timeout.max) {
          throw new Error(
            `Memory ${timeout.key} too high. Maximum value: ${timeout.max}`
          );
        }
      }
    }
  }

  /**
   * Validate RAG configuration
   * @param rag - RAG configuration to validate
   * @private
   */
  private validateRAGConfig(rag: any): void {
    // Load guard values once for performance
    const maxTopK = getGuardValue('agents.rag.max_top_k');

    // Validate top_k
    if (rag.top_k !== undefined) {
      if (rag.top_k > maxTopK) {
        throw new Error(`RAG top_k too high. Maximum value: ${maxTopK}`);
      }
    }
  }

  // ============================================================================
  // PUBLIC VALIDATION METHODS - Individual section validation
  // ============================================================================

  /**
   * Validate only the agent profile section
   * @param profile - Agent profile to validate
   * @public
   */
  public validateProfile(profile: any): void {
    this.validateAgentProfile(profile);
  }

  /**
   * Validate only the graph configuration section
   * @param graph - Graph configuration to validate
   * @public
   */
  public validateGraph(graph: any): void {
    this.validateGraphConfig(graph);
  }

  /**
   * Validate only the memory configuration section
   * @param memory - Memory configuration to validate
   * @public
   */
  public validateMemory(memory: any): void {
    this.validateMemoryConfig(memory);
  }

  /**
   * Validate only the RAG configuration section
   * @param rag - RAG configuration to validate
   * @public
   */
  public validateRAG(rag: any): void {
    this.validateRAGConfig(rag);
  }

  /**
   * Validate only the MCP servers configuration section
   * @param mcpServers - MCP servers configuration to validate
   * @public
   */
  public validateMCPServers(mcpServers: Record<string, any>): void {
    this.validateMCPServersConfig(mcpServers);
  }

  /**
   * Validate only the chatId and prompts_id fields
   * @param agent_config - Agent configuration containing chatId and prompts_id
   * @public
   */
  public validateIdentifiers(agent_config: any): void {
    const promptsIdMaxLength = getGuardValue('agents.prompts_id_max_length');

    if (
      'chatId' in agent_config &&
      agent_config.chatId &&
      typeof agent_config.chatId === 'string'
    ) {
      if (agent_config.chatId.length > promptsIdMaxLength) {
        throw new Error(
          `Agent chatId too long. Maximum length: ${promptsIdMaxLength}`
        );
      }
    }

    if (
      'prompts_id' in agent_config &&
      agent_config.prompts_id &&
      typeof agent_config.prompts_id === 'string'
    ) {
      if (agent_config.prompts_id.length > promptsIdMaxLength) {
        throw new Error(
          `Agent prompts_id too long. Maximum length: ${promptsIdMaxLength}`
        );
      }
    }
  }

  /**
   * Validate MCP servers configuration
   * @param mcpServers - MCP servers configuration to validate
   * @private
   */
  private validateMCPServersConfig(mcpServers: Record<string, any>): void {
    // Load guard values once for performance
    const maxServers = getGuardValue('agents.mcp_servers.max_servers');
    const maxServerNameLength = getGuardValue(
      'agents.mcp_servers.max_server_name_length'
    );
    const minServerNameLength = getGuardValue(
      'agents.mcp_servers.min_server_name_length'
    );
    const commandMaxLength = getGuardValue(
      'agents.mcp_servers.command_max_length'
    );
    const argsMaxSize = getGuardValue('agents.mcp_servers.args.max_size');
    const argsMaxLength = getGuardValue('agents.mcp_servers.args.max_length');
    const envMaxSize = getGuardValue('agents.mcp_servers.env.max_size');
    const envMaxLength = getGuardValue('agents.mcp_servers.env.max_length');

    const serverNames = Object.keys(mcpServers);
    if (serverNames.length > maxServers) {
      throw new Error(`Too many MCP servers. Maximum allowed: ${maxServers}`);
    }

    for (const serverName of serverNames) {
      if (serverName.length > maxServerNameLength) {
        throw new Error(
          `MCP server name too long. Maximum length: ${maxServerNameLength}`
        );
      }
      if (serverName.length < minServerNameLength) {
        throw new Error(
          `MCP server name too short. Minimum length: ${minServerNameLength}`
        );
      }

      const server = mcpServers[serverName];

      // Validate command length
      if (server.command) {
        if (server.command.length > commandMaxLength) {
          throw new Error(
            `MCP server command too long. Maximum length: ${commandMaxLength}`
          );
        }
      }

      // Validate args configuration
      if (server.args) {
        if (server.args.length > argsMaxSize) {
          throw new Error(
            `Too many MCP server args. Maximum allowed: ${argsMaxSize}`
          );
        }
        for (const arg of server.args) {
          if (arg.length > argsMaxLength) {
            throw new Error(
              `MCP server arg too long. Maximum length: ${argsMaxLength}`
            );
          }
        }
      }

      // Validate env configuration
      if (server.env) {
        const envKeys = Object.keys(server.env);
        if (envKeys.length > envMaxSize) {
          throw new Error(
            `Too many MCP server env variables. Maximum allowed: ${envMaxSize}`
          );
        }
        for (const [key, value] of Object.entries(server.env)) {
          if (key.length > envMaxLength) {
            throw new Error(
              `MCP server env key too long. Maximum length: ${envMaxLength}`
            );
          }
          if (value && typeof value === 'string') {
            if (value.length > envMaxLength) {
              throw new Error(
                `MCP server env value too long. Maximum length: ${envMaxLength}`
              );
            }
          }
        }
      }
    }
  }
}

/**
 * Global function for agent validation without instantiating a service
 * @param agent_config - Agent configuration to validate
 *   - AgentConfig.Input: Complete configuration for creation
 *   - AgentConfig.WithOptionalParam: Configuration with required id/user_id for updates
 *   - Partial<AgentConfig.Input>: Partial configuration for specific field validation (e.g., MCP servers only)
 * @param isCreation - Whether this is for creation (true) or update (false)
 * @param databaseInterface - Optional database interface for count validations
 */
export async function validateAgent(
  agent_config: AgentConfig.Input | AgentConfig.InputWithOptionalParam,
  isCreation: boolean = false,
  databaseInterface?: AgentDatabaseInterface
): Promise<void> {
  const validationService = new AgentValidationService(databaseInterface);
  return validationService.validateAgent(
    agent_config,
    isCreation,
    databaseInterface
  );
}

// ============================================================================
// GLOBAL VALIDATION FUNCTIONS - Individual section validation
// ============================================================================

/**
 * Validate only the agent profile section
 * @param profile - Agent profile to validate
 */
export function validateProfile(profile: any): void {
  const validationService = new AgentValidationService();
  validationService.validateProfile(profile);
}

/**
 * Validate only the graph configuration section
 * @param graph - Graph configuration to validate
 */
export function validateGraph(graph: any): void {
  const validationService = new AgentValidationService();
  validationService.validateGraph(graph);
}

/**
 * Validate only the memory configuration section
 * @param memory - Memory configuration to validate
 */
export function validateMemory(memory: any): void {
  const validationService = new AgentValidationService();
  validationService.validateMemory(memory);
}

/**
 * Validate only the RAG configuration section
 * @param rag - RAG configuration to validate
 */
export function validateRAG(rag: any): void {
  const validationService = new AgentValidationService();
  validationService.validateRAG(rag);
}

/**
 * Validate only the MCP servers configuration section
 * @param mcpServers - MCP servers configuration to validate
 */
export function validateMCPServers(mcpServers: Record<string, any>): void {
  const validationService = new AgentValidationService();
  validationService.validateMCPServers(mcpServers);
}

/**
 * Validate only the chatId and prompts_id fields
 * @param agent_config - Agent configuration containing chatId and prompts_id
 */
export function validateIdentifiers(agent_config: any): void {
  const validationService = new AgentValidationService();
  validationService.validateIdentifiers(agent_config);
}
