import { getGuardValue } from './guards.service.js';
import { RawAgentConfig } from '../common/agent.js';
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
   * @param agent_config - Agent configuration to validate (can be partial for updates)
   * @param isCreation - Whether this is for creation (true) or update (false)
   * @param databaseInterface - Optional database interface for count validations
   * @public
   */
  public async validateAgent(
    agent_config: RawAgentConfig | Partial<RawAgentConfig>,
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
          agent_config.user_id
        );
        if (userAgentsCount >= getGuardValue('user.max_agents')) {
          throw new Error(
            `Maximum user agent limit reached (${getGuardValue('user.max_agents')}). User cannot create more agents.`
          );
        }
      }

      // Validate agent name length
      if (agent_config.name) {
        if (agent_config.name.length > getGuardValue('agents.name_max_length')) {
          throw new Error(
            `Agent name too long. Maximum length: ${getGuardValue('agents.name_max_length')}`
          );
        }
        if (agent_config.name.length < getGuardValue('agents.name_min_length')) {
          throw new Error(
            `Agent name too short. Minimum length: ${getGuardValue('agents.name_min_length')}`
          );
        }
      }

      // Validate agent description length
      if (agent_config.description) {
        if (
          agent_config.description.length >
          getGuardValue('agents.description_max_length')
        ) {
          throw new Error(
            `Agent description too long. Maximum length: ${getGuardValue('agents.description_max_length')}`
          );
        }
        if (
          agent_config.description.length <
          getGuardValue('agents.description_min_length')
        ) {
          throw new Error(
            `Agent description too short. Minimum length: ${getGuardValue('agents.description_min_length')}`
          );
        }
      }

      // Validate agent group length
      if (agent_config.group) {
        if (agent_config.group.length > getGuardValue('agents.group_max_length')) {
          throw new Error(
            `Agent group too long. Maximum length: ${getGuardValue('agents.group_max_length')}`
          );
        }
        if (agent_config.group.length < getGuardValue('agents.group_min_length')) {
          throw new Error(
            `Agent group too short. Minimum length: ${getGuardValue('agents.group_min_length')}`
          );
        }
      }

      // Validate interval
      if (agent_config.interval) {
        if (agent_config.interval > getGuardValue('agents.interval_max')) {
          throw new Error(
            `Agent interval too high. Maximum value: ${getGuardValue('agents.interval_max')}`
          );
        }
        if (agent_config.interval < getGuardValue('agents.interval_min')) {
          throw new Error(
            `Agent interval too low. Minimum value: ${getGuardValue('agents.interval_min')}`
          );
        }
      }

      // Validate max iterations
      if (agent_config.max_iterations) {
        if (agent_config.max_iterations > getGuardValue('agents.max_max_iterations')) {
          throw new Error(
            `Agent max iterations too high. Maximum value: ${getGuardValue('agents.max_max_iterations')}`
          );
        }
        if (agent_config.max_iterations < getGuardValue('agents.min_max_iterations')) {
          throw new Error(
            `Agent max iterations too low. Minimum value: ${getGuardValue('agents.min_max_iterations')}`
          );
        }
      }

      // Validate memory configuration
      if (agent_config.memory) {
        if (agent_config.memory.memorySize) {
          if (agent_config.memory.memorySize > getGuardValue('agents.memory.memory_size_max')) {
            throw new Error(
              `Agent memory size too high. Maximum value: ${getGuardValue('agents.memory.memory_size_max')}`
            );
          }
          if (agent_config.memory.memorySize < getGuardValue('agents.memory.memory_size_min')) {
            throw new Error(
              `Agent memory size too low. Minimum value: ${getGuardValue('agents.memory.memory_size_min')}`
            );
          }
        }
        if (agent_config.memory.shortTermMemorySize) {
          if (agent_config.memory.shortTermMemorySize > getGuardValue('agents.memory.short_term_memory_size_max')) {
            throw new Error(
              `Agent short-term memory size too high. Maximum value: ${getGuardValue('agents.memory.short_term_memory_size_max')}`
            );
          }
          if (agent_config.memory.shortTermMemorySize < getGuardValue('agents.memory.short_term_memory_size_min')) {
            throw new Error(
              `Agent short-term memory size too low. Minimum value: ${getGuardValue('agents.memory.short_term_memory_size_min')}`
            );
          }
        }
      }

      // Validate chatId length (if present in the config)
      if ('chatId' in agent_config && agent_config.chatId && typeof agent_config.chatId === 'string') {
        if (agent_config.chatId.length > getGuardValue('agents.chat_id_max_length')) {
          throw new Error(
            `Agent chatId too long. Maximum length: ${getGuardValue('agents.chat_id_max_length')}`
          );
        }
        if (agent_config.chatId.length < getGuardValue('agents.chat_id_min_length')) {
          throw new Error(
            `Agent chatId too short. Minimum length: ${getGuardValue('agents.chat_id_min_length')}`
          );
        }
      }

      // Validate plugins configuration
      if (agent_config.plugins) {
        if (agent_config.plugins.length > getGuardValue('agents.plugins.max_size')) {
          throw new Error(
            `Too many plugins. Maximum allowed: ${getGuardValue('agents.plugins.max_size')}`
          );
        }
        if (agent_config.plugins.length < getGuardValue('agents.plugins.min_size')) {
          throw new Error(
            `Too few plugins. Minimum required: ${getGuardValue('agents.plugins.min_size')}`
          );
        }
        for (const plugin of agent_config.plugins) {
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

      // Validate MCP servers configuration
      if (agent_config.mcpServers) {
        const mcpServers = Object.keys(agent_config.mcpServers);
        if (mcpServers.length > getGuardValue('agents.mcp_servers.max_servers')) {
          throw new Error(
            `Too many MCP servers. Maximum allowed: ${getGuardValue('agents.mcp_servers.max_servers')}`
          );
        }
        if (mcpServers.length < getGuardValue('agents.mcp_servers.min_servers')) {
          throw new Error(
            `Too few MCP servers. Minimum required: ${getGuardValue('agents.mcp_servers.min_servers')}`
          );
        }
        
        for (const serverName of mcpServers) {
          if (serverName.length > getGuardValue('agents.mcp_servers.max_server_name_length')) {
            throw new Error(
              `MCP server name too long. Maximum length: ${getGuardValue('agents.mcp_servers.max_server_name_length')}`
            );
          }
          if (serverName.length < getGuardValue('agents.mcp_servers.min_server_name_length')) {
            throw new Error(
              `MCP server name too short. Minimum length: ${getGuardValue('agents.mcp_servers.min_server_name_length')}`
            );
          }
          
          const server = agent_config.mcpServers[serverName];
          
          // Validate command length
          if (server.command) {
            if (server.command.length > getGuardValue('agents.mcp_servers.command_max_length')) {
              throw new Error(
                `MCP server command too long. Maximum length: ${getGuardValue('agents.mcp_servers.command_max_length')}`
              );
            }
            if (server.command.length < getGuardValue('agents.mcp_servers.min_command_length')) {
              throw new Error(
                `MCP server command too short. Minimum length: ${getGuardValue('agents.mcp_servers.min_command_length')}`
              );
            }
          }
          
          // Validate args configuration
          if (server.args) {
            if (server.args.length > getGuardValue('agents.mcp_servers.args.max_size')) {
              throw new Error(
                `Too many MCP server args. Maximum allowed: ${getGuardValue('agents.mcp_servers.args.max_size')}`
              );
            }
            if (server.args.length < getGuardValue('agents.mcp_servers.args.min_size')) {
              throw new Error(
                `Too few MCP server args. Minimum required: ${getGuardValue('agents.mcp_servers.args.min_size')}`
              );
            }
            for (const arg of server.args) {
              if (arg.length > getGuardValue('agents.mcp_servers.args.max_length')) {
                throw new Error(
                  `MCP server arg too long. Maximum length: ${getGuardValue('agents.mcp_servers.args.max_length')}`
                );
              }
              if (arg.length < getGuardValue('agents.mcp_servers.args.min_length')) {
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
                if (value.length > getGuardValue('agents.mcp_servers.env.max_length')) {
                  throw new Error(
                    `MCP server env value too long. Maximum length: ${getGuardValue('agents.mcp_servers.env.max_length')}`
                  );
                }
                if (value.length < getGuardValue('agents.mcp_servers.env.min_length')) {
                  throw new Error(
                    `MCP server env value too short. Minimum length: ${getGuardValue('agents.mcp_servers.env.min_length')}`
                  );
                }
              }
            }
          }
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
}

/**
 * Global function for agent validation without instantiating a service
 * @param agent_config - Agent configuration to validate
 * @param isCreation - Whether this is for creation (true) or update (false)
 * @param databaseInterface - Optional database interface for count validations
 */
export async function validateAgent(
  agent_config: RawAgentConfig | Partial<RawAgentConfig>,
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
