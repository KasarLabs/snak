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
    agent_config: AgentConfig.Input | AgentConfig.WithOptionalParam,
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

      // Validate agent profile section
      if (agent_config.profile) {
        this.validateAgentProfile(agent_config.profile);
      }

      // Validate graph configuration
      if (agent_config.graph) {
        this.validateGraphConfig(agent_config.graph);
      }

      // Validate memory configuration
      if (agent_config.memory) {
        this.validateMemoryConfig(agent_config.memory);
      }

      // Validate RAG configuration
      if (agent_config.rag) {
        this.validateRAGConfig(agent_config.rag);
      }

      // Validate plugins configuration
      if (agent_config.plugins) {
        this.validatePluginsConfig(agent_config.plugins);
      }

      // Validate MCP servers configuration
      if (agent_config.mcp_servers) {
        this.validateMCPServersConfig(agent_config.mcp_servers);
      }

      // Validate chatId length (if present in the config)
      if (
        'chatId' in agent_config &&
        agent_config.chatId &&
        typeof agent_config.chatId === 'string'
      ) {
        if (
          agent_config.chatId.length >
          getGuardValue('agents.chat_id_max_length')
        ) {
          throw new Error(
            `Agent chatId too long. Maximum length: ${getGuardValue('agents.chat_id_max_length')}`
          );
        }
        if (
          agent_config.chatId.length <
          getGuardValue('agents.chat_id_min_length')
        ) {
          throw new Error(
            `Agent chatId too short. Minimum length: ${getGuardValue('agents.chat_id_min_length')}`
          );
        }
      }

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
    // Validate agent name length
    if (profile.name) {
      if (profile.name.length > getGuardValue('agents.name_max_length')) {
        throw new Error(
          `Agent name too long. Maximum length: ${getGuardValue('agents.name_max_length')}`
        );
      }
      if (profile.name.length < getGuardValue('agents.name_min_length')) {
        throw new Error(
          `Agent name too short. Minimum length: ${getGuardValue('agents.name_min_length')}`
        );
      }
    }

    // Validate agent description length
    if (profile.description) {
      if (
        profile.description.length >
        getGuardValue('agents.description_max_length')
      ) {
        throw new Error(
          `Agent description too long. Maximum length: ${getGuardValue('agents.description_max_length')}`
        );
      }
      if (
        profile.description.length <
        getGuardValue('agents.description_min_length')
      ) {
        throw new Error(
          `Agent description too short. Minimum length: ${getGuardValue('agents.description_min_length')}`
        );
      }
    }

    // Validate agent group length
    if (profile.group) {
      if (profile.group.length > getGuardValue('agents.group_max_length')) {
        throw new Error(
          `Agent group too long. Maximum length: ${getGuardValue('agents.group_max_length')}`
        );
      }
      if (profile.group.length < getGuardValue('agents.group_min_length')) {
        throw new Error(
          `Agent group too short. Minimum length: ${getGuardValue('agents.group_min_length')}`
        );
      }
    }

    // Validate contexts array
    if (profile.contexts && Array.isArray(profile.contexts)) {
      if (profile.contexts.length > getGuardValue('agents.contexts.max_size')) {
        throw new Error(
          `Too many contexts. Maximum allowed: ${getGuardValue('agents.contexts.max_size')}`
        );
      }
      if (profile.contexts.length < getGuardValue('agents.contexts.min_size')) {
        throw new Error(
          `Too few contexts. Minimum required: ${getGuardValue('agents.contexts.min_size')}`
        );
      }
      for (const context of profile.contexts) {
        if (context.length > getGuardValue('agents.contexts.max_length')) {
          throw new Error(
            `Context too long. Maximum length: ${getGuardValue('agents.contexts.max_length')}`
          );
        }
        if (context.length < getGuardValue('agents.contexts.min_length')) {
          throw new Error(
            `Context too short. Minimum length: ${getGuardValue('agents.contexts.min_length')}`
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
    // Validate max_steps
    if (graph.max_steps) {
      if (graph.max_steps > getGuardValue('agents.graph.max_steps_max')) {
        throw new Error(
          `Max steps too high. Maximum value: ${getGuardValue('agents.graph.max_steps_max')}`
        );
      }
      if (graph.max_steps < getGuardValue('agents.graph.max_steps_min')) {
        throw new Error(
          `Max steps too low. Minimum value: ${getGuardValue('agents.graph.max_steps_min')}`
        );
      }
    }

    // Validate max_iterations
    if (graph.max_iterations) {
      if (
        graph.max_iterations > getGuardValue('agents.graph.max_iterations_max')
      ) {
        throw new Error(
          `Max iterations too high. Maximum value: ${getGuardValue('agents.graph.max_iterations_max')}`
        );
      }
      if (
        graph.max_iterations < getGuardValue('agents.graph.max_iterations_min')
      ) {
        throw new Error(
          `Max iterations too low. Minimum value: ${getGuardValue('agents.graph.max_iterations_min')}`
        );
      }
    }

    // Validate max_retries
    if (graph.max_retries) {
      if (graph.max_retries > getGuardValue('agents.graph.max_retries_max')) {
        throw new Error(
          `Max retries too high. Maximum value: ${getGuardValue('agents.graph.max_retries_max')}`
        );
      }
      if (graph.max_retries < getGuardValue('agents.graph.max_retries_min')) {
        throw new Error(
          `Max retries too low. Minimum value: ${getGuardValue('agents.graph.max_retries_min')}`
        );
      }
    }

    // Validate execution_timeout_ms
    if (graph.execution_timeout_ms) {
      if (
        graph.execution_timeout_ms >
        getGuardValue('agents.graph.execution_timeout_max')
      ) {
        throw new Error(
          `Execution timeout too high. Maximum value: ${getGuardValue('agents.graph.execution_timeout_max')}`
        );
      }
      if (
        graph.execution_timeout_ms <
        getGuardValue('agents.graph.execution_timeout_min')
      ) {
        throw new Error(
          `Execution timeout too low. Minimum value: ${getGuardValue('agents.graph.execution_timeout_min')}`
        );
      }
    }

    // Validate max_token_usage
    if (graph.max_token_usage) {
      if (
        graph.max_token_usage >
        getGuardValue('agents.graph.max_token_usage_max')
      ) {
        throw new Error(
          `Max token usage too high. Maximum value: ${getGuardValue('agents.graph.max_token_usage_max')}`
        );
      }
      if (
        graph.max_token_usage <
        getGuardValue('agents.graph.max_token_usage_min')
      ) {
        throw new Error(
          `Max token usage too low. Minimum value: ${getGuardValue('agents.graph.max_token_usage_min')}`
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
    // Validate provider
    if (model.provider) {
      if (
        model.provider.length >
        getGuardValue('agents.model.provider_max_length')
      ) {
        throw new Error(
          `Model provider too long. Maximum length: ${getGuardValue('agents.model.provider_max_length')}`
        );
      }
      if (
        model.provider.length <
        getGuardValue('agents.model.provider_min_length')
      ) {
        throw new Error(
          `Model provider too short. Minimum length: ${getGuardValue('agents.model.provider_min_length')}`
        );
      }
    }

    // Validate model_name
    if (model.model_name) {
      if (
        model.model_name.length >
        getGuardValue('agents.model.model_name_max_length')
      ) {
        throw new Error(
          `Model name too long. Maximum length: ${getGuardValue('agents.model.model_name_max_length')}`
        );
      }
      if (
        model.model_name.length <
        getGuardValue('agents.model.model_name_min_length')
      ) {
        throw new Error(
          `Model name too short. Minimum length: ${getGuardValue('agents.model.model_name_min_length')}`
        );
      }
    }

    // Validate temperature
    if (model.temperature !== undefined) {
      if (model.temperature > getGuardValue('agents.model.temperature_max')) {
        throw new Error(
          `Temperature too high. Maximum value: ${getGuardValue('agents.model.temperature_max')}`
        );
      }
      if (model.temperature < getGuardValue('agents.model.temperature_min')) {
        throw new Error(
          `Temperature too low. Minimum value: ${getGuardValue('agents.model.temperature_min')}`
        );
      }
    }

    // Validate max_tokens
    if (model.max_tokens) {
      if (model.max_tokens > getGuardValue('agents.model.max_tokens_max')) {
        throw new Error(
          `Max tokens too high. Maximum value: ${getGuardValue('agents.model.max_tokens_max')}`
        );
      }
      if (model.max_tokens < getGuardValue('agents.model.max_tokens_min')) {
        throw new Error(
          `Max tokens too low. Minimum value: ${getGuardValue('agents.model.max_tokens_min')}`
        );
      }
    }
  }

  /**
   * Validate memory configuration
   * @param memory - Memory configuration to validate
   * @private
   */
  private validateMemoryConfig(memory: any): void {
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
    const limits = [
      'short_term_memory_size',
      'max_insert_episodic_size',
      'max_insert_semantic_size',
      'max_retrieve_memory_size',
      'limit_before_summarization',
    ];

    for (const limit of limits) {
      if (sizeLimits[limit] !== undefined) {
        if (
          sizeLimits[limit] >
          getGuardValue(`agents.memory.size_limits.${limit}_max`)
        ) {
          throw new Error(
            `Memory ${limit} too high. Maximum value: ${getGuardValue(`agents.memory.size_limits.${limit}_max`)}`
          );
        }
        if (
          sizeLimits[limit] <
          getGuardValue(`agents.memory.size_limits.${limit}_min`)
        ) {
          throw new Error(
            `Memory ${limit} too low. Minimum value: ${getGuardValue(`agents.memory.size_limits.${limit}_min`)}`
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
    const thresholdKeys = [
      'insert_semantic_threshold',
      'insert_episodic_threshold',
      'retrieve_memory_threshold',
      'hitl_threshold',
    ];

    for (const key of thresholdKeys) {
      if (thresholds[key] !== undefined) {
        if (
          thresholds[key] > getGuardValue(`agents.memory.thresholds.${key}_max`)
        ) {
          throw new Error(
            `Memory ${key} too high. Maximum value: ${getGuardValue(`agents.memory.thresholds.${key}_max`)}`
          );
        }
        if (
          thresholds[key] < getGuardValue(`agents.memory.thresholds.${key}_min`)
        ) {
          throw new Error(
            `Memory ${key} too low. Minimum value: ${getGuardValue(`agents.memory.thresholds.${key}_min`)}`
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
    const timeoutKeys = [
      'retrieve_memory_timeout_ms',
      'insert_memory_timeout_ms',
    ];

    for (const key of timeoutKeys) {
      if (timeouts[key] !== undefined) {
        if (
          timeouts[key] > getGuardValue(`agents.memory.timeouts.${key}_max`)
        ) {
          throw new Error(
            `Memory ${key} too high. Maximum value: ${getGuardValue(`agents.memory.timeouts.${key}_max`)}`
          );
        }
        if (
          timeouts[key] < getGuardValue(`agents.memory.timeouts.${key}_min`)
        ) {
          throw new Error(
            `Memory ${key} too low. Minimum value: ${getGuardValue(`agents.memory.timeouts.${key}_min`)}`
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
    // Validate top_k
    if (rag.top_k !== undefined) {
      if (rag.top_k > getGuardValue('agents.rag.top_k_max')) {
        throw new Error(
          `RAG top_k too high. Maximum value: ${getGuardValue('agents.rag.top_k_max')}`
        );
      }
      if (rag.top_k < getGuardValue('agents.rag.top_k_min')) {
        throw new Error(
          `RAG top_k too low. Minimum value: ${getGuardValue('agents.rag.top_k_min')}`
        );
      }
    }

    // Validate embedding_model
    if (rag.embedding_model) {
      if (
        rag.embedding_model.length >
        getGuardValue('agents.rag.embedding_model_max_length')
      ) {
        throw new Error(
          `RAG embedding model too long. Maximum length: ${getGuardValue('agents.rag.embedding_model_max_length')}`
        );
      }
      if (
        rag.embedding_model.length <
        getGuardValue('agents.rag.embedding_model_min_length')
      ) {
        throw new Error(
          `RAG embedding model too short. Minimum length: ${getGuardValue('agents.rag.embedding_model_min_length')}`
        );
      }
    }
  }

  /**
   * Validate plugins configuration
   * @param plugins - Plugins configuration to validate
   * @private
   */
  private validatePluginsConfig(plugins: string[]): void {
    if (plugins.length > getGuardValue('agents.plugins.max_size')) {
      throw new Error(
        `Too many plugins. Maximum allowed: ${getGuardValue('agents.plugins.max_size')}`
      );
    }
    if (plugins.length < getGuardValue('agents.plugins.min_size')) {
      throw new Error(
        `Too few plugins. Minimum required: ${getGuardValue('agents.plugins.min_size')}`
      );
    }
    for (const plugin of plugins) {
      if (plugin.length > getGuardValue('agents.plugins.max_length')) {
        throw new Error(
          `Plugin name too long. Maximum length: ${getGuardValue('agents.plugins.max_length')}`
        );
      }
      if (plugin.length < getGuardValue('agents.plugins.min_length')) {
        throw new Error(
          `Plugin name too short. Minimum length: ${getGuardValue('agents.plugins.min_length')}`
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
    const serverNames = Object.keys(mcpServers);
    if (serverNames.length > getGuardValue('agents.mcp_servers.max_servers')) {
      throw new Error(
        `Too many MCP servers. Maximum allowed: ${getGuardValue('agents.mcp_servers.max_servers')}`
      );
    }
    if (serverNames.length < getGuardValue('agents.mcp_servers.min_servers')) {
      throw new Error(
        `Too few MCP servers. Minimum required: ${getGuardValue('agents.mcp_servers.min_servers')}`
      );
    }

    for (const serverName of serverNames) {
      if (
        serverName.length >
        getGuardValue('agents.mcp_servers.max_server_name_length')
      ) {
        throw new Error(
          `MCP server name too long. Maximum length: ${getGuardValue('agents.mcp_servers.max_server_name_length')}`
        );
      }
      if (
        serverName.length <
        getGuardValue('agents.mcp_servers.min_server_name_length')
      ) {
        throw new Error(
          `MCP server name too short. Minimum length: ${getGuardValue('agents.mcp_servers.min_server_name_length')}`
        );
      }

      const server = mcpServers[serverName];

      // Validate command length
      if (server.command) {
        if (
          server.command.length >
          getGuardValue('agents.mcp_servers.command_max_length')
        ) {
          throw new Error(
            `MCP server command too long. Maximum length: ${getGuardValue('agents.mcp_servers.command_max_length')}`
          );
        }
        if (
          server.command.length <
          getGuardValue('agents.mcp_servers.min_command_length')
        ) {
          throw new Error(
            `MCP server command too short. Minimum length: ${getGuardValue('agents.mcp_servers.min_command_length')}`
          );
        }
      }

      // Validate args configuration
      if (server.args) {
        if (
          server.args.length > getGuardValue('agents.mcp_servers.args.max_size')
        ) {
          throw new Error(
            `Too many MCP server args. Maximum allowed: ${getGuardValue('agents.mcp_servers.args.max_size')}`
          );
        }
        if (
          server.args.length < getGuardValue('agents.mcp_servers.args.min_size')
        ) {
          throw new Error(
            `Too few MCP server args. Minimum required: ${getGuardValue('agents.mcp_servers.args.min_size')}`
          );
        }
        for (const arg of server.args) {
          if (
            arg.length > getGuardValue('agents.mcp_servers.args.max_length')
          ) {
            throw new Error(
              `MCP server arg too long. Maximum length: ${getGuardValue('agents.mcp_servers.args.max_length')}`
            );
          }
          if (
            arg.length < getGuardValue('agents.mcp_servers.args.min_length')
          ) {
            throw new Error(
              `MCP server arg too short. Minimum length: ${getGuardValue('agents.mcp_servers.args.min_length')}`
            );
          }
        }
      }

      // Validate env configuration
      if (server.env) {
        const envKeys = Object.keys(server.env);
        if (envKeys.length > getGuardValue('agents.mcp_servers.env.max_size')) {
          throw new Error(
            `Too many MCP server env variables. Maximum allowed: ${getGuardValue('agents.mcp_servers.env.max_size')}`
          );
        }
        if (envKeys.length < getGuardValue('agents.mcp_servers.env.min_size')) {
          throw new Error(
            `Too few MCP server env variables. Minimum required: ${getGuardValue('agents.mcp_servers.env.min_size')}`
          );
        }
        for (const [key, value] of Object.entries(server.env)) {
          if (key.length > getGuardValue('agents.mcp_servers.env.max_length')) {
            throw new Error(
              `MCP server env key too long. Maximum length: ${getGuardValue('agents.mcp_servers.env.max_length')}`
            );
          }
          if (key.length < getGuardValue('agents.mcp_servers.env.min_length')) {
            throw new Error(
              `MCP server env key too short. Minimum length: ${getGuardValue('agents.mcp_servers.env.min_length')}`
            );
          }
          if (value && typeof value === 'string') {
            if (
              value.length > getGuardValue('agents.mcp_servers.env.max_length')
            ) {
              throw new Error(
                `MCP server env value too long. Maximum length: ${getGuardValue('agents.mcp_servers.env.max_length')}`
              );
            }
            if (
              value.length < getGuardValue('agents.mcp_servers.env.min_length')
            ) {
              throw new Error(
                `MCP server env value too short. Minimum length: ${getGuardValue('agents.mcp_servers.env.min_length')}`
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
  agent_config: AgentConfig.Input | AgentConfig.WithOptionalParam,
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
