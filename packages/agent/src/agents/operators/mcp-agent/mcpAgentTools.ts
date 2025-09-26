import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { logger } from '@snakagent/core';
import { MCP_CONTROLLER } from '../../../services/mcp/src/mcp.js';
import { Postgres } from '@snakagent/database';
import { AgentConfig } from '@snakagent/core';
import { OperatorRegistry } from '../operatorRegistry.js';
import { BaseAgent } from '../../core/baseAgent.js';

interface AgentWithTools extends BaseAgent {
  getTools?: () => DynamicStructuredTool[];
  tools?: DynamicStructuredTool[];
}

interface SmitheryServerResponse {
  qualifiedName: string;
  displayName: string;
  description: string;
  homepage: string;
  useCount: string;
  isDeployed: boolean;
  createdAt: string;
}

interface SmitheryListResponse {
  servers: SmitheryServerResponse[];
  pagination: {
    currentPage: number;
    pageSize: number;
    totalPages: number;
    totalCount: number;
  };
}

interface SmitheryServerDetail {
  qualifiedName: string;
  displayName: string;
  iconUrl: string | null;
  deploymentUrl: string;
  connections: Array<{
    type: string;
    url?: string;
    configSchema: any;
  }>;
  security: {
    scanPassed: boolean;
  } | null;
  tools: Array<{
    name: string;
    description: string | null;
    inputSchema: {
      type: 'object';
      properties?: object;
    };
  }> | null;
}

/**
 * Creates a set of tools for managing MCP servers
 * @returns Array of DynamicStructuredTool instances for MCP management
 */
export function getMcpAgentTools(): DynamicStructuredTool[] {
  return [
    new DynamicStructuredTool({
      name: 'search_mcp_server',
      description:
        'Search for MCP servers on Smithery using a human readable search request',
      schema: z.object({
        query: z
          .string()
          .describe(
            'Human readable search query for MCP servers (e.g., "web search", "file management", "memory")'
          ),
        limit: z
          .number()
          .optional()
          .describe('Maximum number of results to return (default: 10)'),
        deployedOnly: z
          .boolean()
          .optional()
          .describe('Only return deployed servers (default: false)'),
        verifiedOnly: z
          .boolean()
          .optional()
          .describe('Only return verified servers (default: false)'),
      }),
      func: async ({
        query,
        limit = 10,
        deployedOnly = false,
        verifiedOnly = false,
      }) => {
        try {
          const apiKey = process.env.SMITHERY_API_KEY;
          if (!apiKey) {
            throw new Error(
              'SMITHERY_API_KEY environment variable is required'
            );
          }

          let searchQuery = query;
          if (deployedOnly) searchQuery += ' is:deployed';
          if (verifiedOnly) searchQuery += ' is:verified';

          const searchParams = new URLSearchParams({
            q: searchQuery,
            page: '1',
            pageSize: limit.toString(),
          });

          const response = await fetch(
            `https://registry.smithery.ai/servers?${searchParams.toString()}`,
            {
              headers: {
                Authorization: `Bearer ${apiKey}`,
                Accept: 'application/json',
              },
            }
          );

          if (!response.ok) {
            if (response.status === 401) {
              throw new Error(
                'Invalid Smithery API key. Please check your SMITHERY_API_KEY environment variable.'
              );
            }
            throw new Error(
              `Smithery API request failed: ${response.status} ${response.statusText}`
            );
          }

          if (response.bodyUsed) {
            throw new Error(
              'Response body already consumed in main search request'
            );
          }
          const searchResult: SmitheryListResponse = await response.json();

          if (!searchResult.servers || searchResult.servers.length === 0) {
            return JSON.stringify(
              {
                success: true,
                message: 'No MCP servers found matching your query',
                query: query,
                servers: [],
                totalCount: 0,
              },
              null,
              2
            );
          }

          const serverDetails = await Promise.all(
            searchResult.servers.map(async (server) => {
              try {
                const detailResponse = await fetch(
                  `https://registry.smithery.ai/servers/${encodeURIComponent(server.qualifiedName)}`,
                  {
                    headers: {
                      Authorization: `Bearer ${apiKey}`,
                      Accept: 'application/json',
                    },
                  }
                );

                if (!detailResponse.ok) {
                  logger.warn(
                    `Failed to get details for server ${server.qualifiedName}: ${detailResponse.status}`
                  );
                  return {
                    ...server,
                    connections: [],
                    tools: [],
                    configSchema: null,
                  };
                }

                if (detailResponse.bodyUsed) {
                  throw new Error(
                    `Response body already consumed for server ${server.qualifiedName}`
                  );
                }
                const detail: SmitheryServerDetail =
                  await detailResponse.json();

                const httpConnection = detail.connections.find(
                  (conn) => conn.type === 'http'
                );
                const stdioConnection = detail.connections.find(
                  (conn) => conn.type === 'stdio'
                );

                return {
                  qualifiedName: server.qualifiedName,
                  displayName: server.displayName,
                  description: server.description,
                  homepage: server.homepage,
                  useCount: server.useCount,
                  isDeployed: server.isDeployed,
                  isVerified: detail.security?.scanPassed || false,
                  tools: detail.tools || [],
                  toolCount: detail.tools?.length || 0,
                  connections: detail.connections.map((conn) => ({
                    type: conn.type,
                    url: conn.url,
                    hasConfig: !!(
                      conn.configSchema?.properties &&
                      Object.keys(conn.configSchema.properties).length > 0
                    ),
                    requiredFields: conn.configSchema?.required || [],
                    configFields: conn.configSchema?.properties
                      ? Object.keys(conn.configSchema.properties)
                      : [],
                  })),
                  installation: {
                    isRemote: server.isDeployed && httpConnection,
                    requiresApiKey: server.isDeployed,
                    hasLocalOption: !!stdioConnection,
                    configurationRequired: !!(
                      httpConnection?.configSchema?.required?.length ||
                      stdioConnection?.configSchema?.required?.length
                    ),
                  },
                };
              } catch (error) {
                logger.error(
                  `Error getting details for server ${server.qualifiedName}: ${error}`
                );
                return {
                  ...server,
                  connections: [],
                  tools: [],
                  installation: {
                    isRemote: false,
                    requiresApiKey: false,
                    hasLocalOption: false,
                    configurationRequired: false,
                  },
                };
              }
            })
          );

          return JSON.stringify(
            {
              success: true,
              message: `Found ${searchResult.servers.length} matching MCP servers`,
              query: query,
              totalCount: searchResult.pagination.totalCount,
              currentPage: searchResult.pagination.currentPage,
              totalPages: searchResult.pagination.totalPages,
              servers: serverDetails,
              usage: {
                tip: "Use 'install_mcp_server' to install any of these servers for an agent",
                note: 'Remote servers require a Smithery API key, local servers can run without one',
                configHelp:
                  "Check 'installation.configurationRequired' to see if additional configuration is needed",
              },
            },
            null,
            2
          );
        } catch (error) {
          logger.error(`Error searching MCP servers: ${error}`);
          throw new Error(`Failed to search MCP servers: ${error}`);
        }
      },
    }),

    new DynamicStructuredTool({
      name: 'install_mcp_server',
      description:
        'Install an MCP server configuration for an agent using Smithery qualified name',
      schema: z.object({
        agentId: z
          .string()
          .describe('The ID of the agent to install the MCP server for'),
        qualifiedName: z
          .string()
          .describe(
            'The Smithery qualified name of the MCP server (from search results)'
          ),
        serverName: z
          .string()
          .optional()
          .describe('Custom name for the server (defaults to qualified name)'),
        config: z
          .record(z.any())
          .optional()
          .describe('Configuration values required by the server'),
        profile: z
          .string()
          .optional()
          .describe('Smithery profile to use (if available)'),
      }),
      func: async ({
        agentId,
        qualifiedName,
        serverName,
        config = {},
        profile,
      }) => {
        try {
          // PostgresQuery relation : agents
          const findQuery = new Postgres.Query(
            'SELECT * FROM agents WHERE id = $1',
            [agentId]
          );
          const existingAgent =
            await Postgres.query<AgentConfig.OutputWithId>(findQuery);

          if (existingAgent.length === 0) {
            throw new Error(`Agent not found: ${agentId}`);
          }

          const agent = existingAgent[0];
          const currentMcpServers = agent.mcp_servers || {};

          const finalServerName =
            serverName || qualifiedName.split('/').pop() || qualifiedName;

          if (currentMcpServers[finalServerName]) {
            throw new Error(
              `MCP server "${finalServerName}" already exists for agent "${agentId}"`
            );
          }

          interface SmitheryCliConfig {
            command: string;
            args: string[];
          }

          const smitheryConfig: SmitheryCliConfig = {
            command: 'npx',
            args: ['-y', '@smithery/cli@latest', 'run', qualifiedName],
          };

          const smitheryApiKey = process.env.SMITHERY_API_KEY;
          if (smitheryApiKey) {
            smitheryConfig.args.push('--key', smitheryApiKey);
          }

          if (profile) {
            smitheryConfig.args.push('--profile', profile);
          }

          if (config && Object.keys(config).length > 0) {
            const encodedConfig = JSON.stringify(JSON.stringify(config));
            smitheryConfig.args.push('--config', encodedConfig);
          }

          currentMcpServers[finalServerName] = smitheryConfig;

          const updateQuery = new Postgres.Query(
            'UPDATE agents SET "mcp_servers" = $1 WHERE id = $2 RETURNING *',
            [currentMcpServers, agentId]
          );

          const result =
            await Postgres.query<AgentConfig.OutputWithId>(updateQuery);

          return JSON.stringify(
            {
              success: true,
              message: `MCP server "${finalServerName}" (${qualifiedName}) installed for agent "${agentId}"`,
              serverName: finalServerName,
              qualifiedName: qualifiedName,
              configuration: smitheryConfig,
              nextSteps: [
                'Use "refresh_mcp_server" to restart the agent with the new MCP server',
                'The server will be available after the agent restart',
              ],
              data: result[0],
            },
            null,
            2
          );
        } catch (error) {
          logger.error(`Error installing MCP server: ${error}`);
          throw new Error(`Failed to install MCP server: ${error}`);
        }
      },
    }),

    new DynamicStructuredTool({
      name: 'list_mcp_servers',
      description: 'List all MCP servers configured for a specific agent',
      schema: z.object({
        agentId: z
          .string()
          .describe('The ID of the agent to list MCP servers for'),
      }),
      func: async ({ agentId }) => {
        try {
          const query = new Postgres.Query(
            'SELECT id, name, "mcp_servers" FROM agents WHERE id = $1',
            [agentId]
          );
          const result = await Postgres.query<AgentConfig.OutputWithId>(query);

          if (result.length === 0) {
            throw new Error(`Agent not found: ${agentId}`);
          }

          const agent = result[0];
          return JSON.stringify(
            {
              success: true,
              agentId: agent.id,
              agentName: agent.profile.name,
              mcp_servers: agent.mcp_servers || {},
            },
            null,
            2
          );
        } catch (error) {
          logger.error(`Error listing MCP servers: ${error}`);
          throw new Error(`Failed to list MCP servers: ${error}`);
        }
      },
    }),

    new DynamicStructuredTool({
      name: 'refresh_mcp_server',
      description: 'Restart an agent with its MCP servers',
      schema: z.object({
        agentId: z.string().describe('The ID of the agent to refresh'),
        timeout: z
          .number()
          .optional()
          .describe(
            'Timeout in milliseconds for MCP initialization (default: 30000)'
          ),
      }),
      func: async ({ agentId, timeout = 30000 }) => {
        try {
          logger.info(`Starting MCP server refresh for agent ${agentId}`);

          const query = new Postgres.Query(
            'SELECT "mcp_servers" FROM agents WHERE id = $1',
            [agentId]
          );
          const result = await Postgres.query<AgentConfig.OutputWithId>(query);

          if (result.length === 0) {
            throw new Error(`Agent not found: ${agentId}`);
          }

          const mcp_servers = result[0].mcp_servers || {};

          if (!mcp_servers || Object.keys(mcp_servers).length === 0) {
            logger.info(`No MCP servers configured for agent ${agentId}`);
            return JSON.stringify({
              success: true,
              message: `No MCP servers configured for agent ${agentId}`,
              mcpToolsCount: 0,
            });
          }

          logger.info(
            `Found ${Object.keys(mcp_servers).length} MCP servers configured for agent ${agentId}`
          );

          const initializeMcpWithTimeout = async () => {
            return Promise.race([
              (async () => {
                logger.info('Creating new MCP controller...');
                const mcp = new MCP_CONTROLLER(mcp_servers);

                logger.info('Initializing MCP connections...');
                await mcp.initializeConnections();

                logger.info('Getting MCP tools...');
                const mcpTools = mcp.getTools() as DynamicStructuredTool[];

                logger.info(`Retrieved ${mcpTools.length} MCP tools`);
                return mcpTools;
              })(),
              new Promise<never>((_, reject) => {
                setTimeout(() => {
                  reject(
                    new Error(`MCP initialization timed out after ${timeout}ms`)
                  );
                }, timeout);
              }),
            ]);
          };

          const mcpTools = await initializeMcpWithTimeout();

          try {
            const registry = OperatorRegistry.getInstance();
            const mcpAgent = registry.getAgent('mcp-agent') as AgentWithTools;

            if (mcpAgent) {
              logger.info('Updating MCP agent tools...');
              if (mcpAgent.getTools) {
                const currentTools = mcpAgent
                  .getTools()
                  .filter(
                    (tool: DynamicStructuredTool) =>
                      !tool.name.startsWith('mcp_')
                  );
                mcpAgent.tools = [...currentTools, ...mcpTools];
                logger.info(
                  `Updated MCP agent with ${mcpTools.length} new tools`
                );
              }
            } else {
              logger.warn(
                'MCP Agent not found in registry - tools not updated'
              );
            }
          } catch (registryError) {
            logger.warn(`Failed to update agent registry: ${registryError}`);
          }

          return JSON.stringify({
            success: true,
            message: `Successfully refreshed MCP servers for agent ${agentId}`,
            mcpToolsCount: mcpTools.length,
            serversRefreshed: Object.keys(mcp_servers),
            timeoutUsed: timeout,
          });
        } catch (error) {
          logger.error(
            `Error refreshing MCP server for agent ${agentId}: ${error}`
          );

          if (error instanceof Error) {
            if (error.message.includes('timed out')) {
              throw new Error(
                `MCP server refresh timed out after ${timeout}ms. Try increasing the timeout or check if MCP servers are responding.`
              );
            } else if (
              error.message.includes('ECONNREFUSED') ||
              error.message.includes('connection')
            ) {
              throw new Error(
                `Failed to connect to MCP servers. Check if the servers are running and accessible.`
              );
            } else {
              throw new Error(
                `Failed to refresh MCP servers: ${error.message}`
              );
            }
          } else {
            throw new Error(`Failed to refresh MCP servers: ${error}`);
          }
        }
      },
    }),

    new DynamicStructuredTool({
      name: 'delete_mcp_server',
      description: 'Delete an MCP server configuration',
      schema: z.object({
        agentId: z.string().describe('The ID of the agent'),
        serverName: z.string().describe('The name of the MCP server to delete'),
      }),
      func: async ({ agentId, serverName }) => {
        try {
          const findQuery = new Postgres.Query(
            'SELECT * FROM agents WHERE id = $1',
            [agentId]
          );
          const existingAgent =
            await Postgres.query<AgentConfig.OutputWithId>(findQuery);

          if (existingAgent.length === 0) {
            throw new Error(`Agent not found: ${agentId}`);
          }

          const agent = existingAgent[0];
          const currentMcpServers = agent.mcp_servers || {};

          if (!currentMcpServers[serverName]) {
            throw new Error(
              `MCP server "${serverName}" not found in agent "${agentId}"`
            );
          }

          delete currentMcpServers[serverName];

          const updateQuery = new Postgres.Query(
            'UPDATE agents SET "mcp_servers" = $1 WHERE id = $2 RETURNING *',
            [currentMcpServers, agentId]
          );

          const result =
            await Postgres.query<AgentConfig.OutputWithId>(updateQuery);

          return JSON.stringify({
            success: true,
            message: `MCP server "${serverName}" deleted from agent "${agentId}"`,
            data: result[0],
          });
        } catch (error) {
          logger.error(`Error deleting MCP server: ${error}`);
          throw new Error(`Failed to delete MCP server: ${error}`);
        }
      },
    }),
  ];
}
