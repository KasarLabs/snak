import { DynamicStructuredTool } from '@langchain/core/tools';
import { logger } from '@snakagent/core';
import { SearchMcpServerSchema } from './schemas/index.js';

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

export function searchMcpServerTool(): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'search_mcp_server',
    description:
      'Search for MCP servers on Smithery using a human readable search request',
    schema: SearchMcpServerSchema,
    func: async ({
      query,
      limit = 10,
      deployedOnly = false,
      verifiedOnly = false,
    }) => {
      try {
        const apiKey = process.env.SMITHERY_API_KEY;
        if (!apiKey) {
          throw new Error('SMITHERY_API_KEY environment variable is required');
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
              const detail: SmitheryServerDetail = await detailResponse.json();

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
  });
}
