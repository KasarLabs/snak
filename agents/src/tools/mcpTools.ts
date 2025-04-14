import {
  DynamicStructuredTool,
  StructuredTool,
  Tool,
} from '@langchain/core/tools';
import { z } from 'zod';
import { MCPConfigManager, MCP } from '../mcpConfig.js';
import { JsonConfig } from '../jsonConfig.js';
import { MCP_CONTROLLER } from '../mcp/src/mcp.js';
import logger from '../logger.js';

export const createMCPTools = (config: JsonConfig, configPath: string) => {
  const mcpManager = new MCPConfigManager(config, configPath);
  let mcpController: MCP_CONTROLLER | null = null;
  let allTools: (Tool | DynamicStructuredTool<any> | StructuredTool)[] = [];

  // Initialize MCP controller if mcpServers are configured
  if (config.mcpServers && Object.keys(config.mcpServers).length > 0) {
    try {
      mcpController = MCP_CONTROLLER.fromJsonConfig(config);

      // Register for tool updates
      mcpController.onToolsUpdate((updatedTools) => {
        // Update our tools list with new tools
        // First, remove old MCP server tools (keep only management tools)
        allTools = allTools.filter(
          (tool) =>
            tool.name === 'search_mcp' ||
            tool.name === 'add_mcp' ||
            tool.name === 'remove_mcp' ||
            tool.name === 'reload_mcp_config' ||
            tool.name === 'get_mcp_tools' ||
            tool.name === 'reload_mcp_connections' ||
            tool.name === 'list_mcp_servers' ||
            tool.name === 'update_mcp'
        );

        // Then add the new MCP server tools
        allTools.push(...updatedTools);

        logger.info(
          `Tools list updated with ${updatedTools.length} tools from MCP servers`
        );
      });

      // Initialize connections
      const initializeAndGetTools = async () => {
        try {
          await mcpController!.initializeConnections();
          // Tools will be added via the onToolsUpdate handler
        } catch (error) {
          logger.error(`Failed to initialize MCP connections: ${error}`);
        }
      };

      // Execute initialization immediately
      initializeAndGetTools();

      // Register callback for configuration changes
      mcpManager.onConfigChange(async (newConfig) => {
        if (mcpController && newConfig.mcpServers) {
          try {
            await mcpController.updateConfiguration(newConfig.mcpServers);
            // Tools will be updated via the onToolsUpdate handler
          } catch (error) {
            logger.error(`Failed to update MCP controller: ${error}`);
          }
        }
      });

      logger.info('MCP controller initialized and change listener registered');
    } catch (error) {
      logger.error(`Failed to initialize MCP controller: ${error}`);
    }
  }

  // Register cleanup handler for when the process exits
  process.on('exit', () => {
    mcpManager.cleanup();
    if (mcpController) {
      mcpController.close().catch((error) => {
        logger.error(`Error closing MCP connections on exit: ${error}`);
      });
    }
  });

  // Also handle signals for graceful shutdown
  process.on('SIGINT', () => {
    mcpManager.cleanup();
    if (mcpController) {
      mcpController.close().catch((error) => {
        logger.error(`Error closing MCP connections on SIGINT: ${error}`);
      });
    }
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    mcpManager.cleanup();
    if (mcpController) {
      mcpController.close().catch((error) => {
        logger.error(`Error closing MCP connections on SIGTERM: ${error}`);
      });
    }
    process.exit(0);
  });

  // Function to initialize or reinitialize the MCP controller
  const initOrReinitMcpController = async () => {
    try {
      // Get the latest config
      const currentConfig = mcpManager.getConfig();

      // Clean up existing controller if it exists
      if (mcpController) {
        try {
          await mcpController.close();
        } catch (error) {
          logger.error(`Error closing existing MCP controller: ${error}`);
        }
      }

      // Initialize a new controller with the current config
      if (
        currentConfig.mcpServers &&
        Object.keys(currentConfig.mcpServers).length > 0
      ) {
        mcpController = MCP_CONTROLLER.fromJsonConfig(currentConfig);

        // Re-register for tool updates
        mcpController.onToolsUpdate((updatedTools) => {
          // Update our tools list with new tools
          // First, remove old MCP server tools (keep only management tools)
          allTools = allTools.filter(
            (tool) =>
              tool.name === 'search_mcp' ||
              tool.name === 'add_mcp' ||
              tool.name === 'remove_mcp' ||
              tool.name === 'reload_mcp_config' ||
              tool.name === 'get_mcp_tools' ||
              tool.name === 'reload_mcp_connections' ||
              tool.name === 'list_mcp_servers' ||
              tool.name === 'update_mcp'
          );

          // Then add the new MCP server tools
          allTools.push(...updatedTools);

          logger.info(
            `Tools list updated with ${updatedTools.length} tools from MCP servers`
          );
        });

        // Initialize connections
        await mcpController.initializeConnections();
        logger.info('MCP controller successfully reinitialized');
        return true;
      } else {
        logger.warn('No MCP servers configured, controller not initialized');
        return false;
      }
    } catch (error) {
      logger.error(`Failed to reinitialize MCP controller: ${error}`);
      return false;
    }
  };

  const searchMCPTool = new DynamicStructuredTool({
    name: 'search_mcp',
    description: 'Search for Smithery servers that can be used as MCP servers',
    schema: z.object({
      query: z
        .string()
        .describe(
          'The search query for Smithery servers. Be specific and describe the exact functionality needed.'
        ),
    }),
    func: async ({ query }) => {
      try {
        const servers = await mcpManager.searchMCP(query);

        if (servers.length === 0) {
          return 'Aucun serveur Smithery trouvé pour cette requête.';
        }

        const formattedServers = servers
          .map((server, index) => {
            return `${index + 1}. ${server.name} (${server.id})
   Description: ${server.description}
   Nombre d'utilisations: ${server.similarity}
   URL: ${server.url}`;
          })
          .join('\n\n');

        return `Serveurs Smithery trouvés:\n\n${formattedServers}\n\nPour ajouter un serveur, utilisez l'outil add_mcp avec le qualifiedName du serveur.`;
      } catch (error) {
        return `Erreur lors de la recherche de serveurs Smithery: ${error}`;
      }
    },
  });

  const addMCPTool = new DynamicStructuredTool({
    name: 'add_mcp',
    description: 'Add a Smithery server as an MCP server to the configuration',
    schema: z.object({
      qualifiedName: z
        .string()
        .describe(
          'The qualifiedName of the Smithery server to add (e.g., @arjunkmrm/perplexity-search)'
        ),
      env: z
        .record(z.string())
        .describe(
          'Environment variables required by the server. Should match the required config from server details.'
        ),
    }),
    func: async ({ qualifiedName, env }) => {
      try {
        // Get server details from Smithery
        const serverDetails = await mcpManager.getServerDetails(qualifiedName);

        // Check if we have all required environment variables
        const configSchema = serverDetails.connections[0]?.configSchema;
        if (configSchema && configSchema.required) {
          const missingEnvVars = configSchema.required.filter(
            (key) => !env[key]
          );

          if (missingEnvVars.length > 0) {
            const missingVarDescriptions = missingEnvVars
              .map((key) => {
                const prop = configSchema.properties[key];
                return `- ${key}: ${prop?.description || 'Aucune description disponible'}`;
              })
              .join('\n');

            return `Variables d'environnement manquantes requises pour ${serverDetails.displayName}:\n${missingVarDescriptions}\n\nVeuillez fournir ces variables et réessayer.`;
          }
        }

        // Create a server object that matches the MCP interface
        const server: MCP = {
          name: serverDetails.displayName,
          description: 'Smithery server',
          id: qualifiedName,
        };

        // Add the server
        await mcpManager.addMCP(server, env);

        return `Le serveur Smithery "${serverDetails.displayName}" (${qualifiedName}) a été ajouté avec succès à la configuration.`;
      } catch (error) {
        return `Erreur lors de l'ajout du serveur Smithery: ${error}`;
      }
    },
  });

  const removeMCPTool = new DynamicStructuredTool({
    name: 'remove_mcp',
    description: 'Remove a MCP server from the configuration',
    schema: z.object({
      serverName: z.string().describe('The name of the MCP server to remove'),
    }),
    func: async ({ serverName }) => {
      try {
        await mcpManager.removeMCP(serverName);
        return 'Serveur supprimé avec succès et configuration enregistrée';
      } catch (error) {
        return `Erreur lors de la suppression du serveur: ${error}`;
      }
    },
  });

  const reloadMCPConfigTool = new DynamicStructuredTool({
    name: 'reload_mcp_config',
    description: 'Manually reload the MCP configuration from the file',
    schema: z.object({}),
    func: async () => {
      try {
        await mcpManager.reloadConfig();
        return 'Configuration rechargée avec succès';
      } catch (error) {
        return `Erreur lors du rechargement de la configuration: ${error}`;
      }
    },
  });

  const reloadMCPConnectionsTool = new DynamicStructuredTool({
    name: 'reload_mcp_connections',
    description:
      'Force reload MCP connections and tools without restarting the server',
    schema: z.object({}),
    func: async () => {
      try {
        logger.info('Attempting to completely reload MCP connections...');

        // Try the reinitialize approach first
        const success = await initOrReinitMcpController();

        if (success) {
          return 'Connexions MCP rechargées et réinitialisées avec succès. Les outils devraient maintenant être disponibles.';
        }

        // If reinitialization failed but we still have a controller, try the regular reload
        if (mcpController) {
          try {
            await mcpController.reloadConnections();
            return 'Connexions MCP rechargées avec succès. Les outils devraient maintenant être disponibles.';
          } catch (error) {
            return `Erreur lors du rechargement des connexions MCP via reloadConnections(): ${error}. Essayez de redémarrer l'application.`;
          }
        }

        return "Impossible de réinitialiser le contrôleur MCP. Assurez-vous que votre configuration est valide et essayez de redémarrer l'application.";
      } catch (error) {
        return `Erreur lors du rechargement des connexions MCP: ${error}. Essayez de redémarrer l'application.`;
      }
    },
  });

  const getMCPToolsTool = new DynamicStructuredTool({
    name: 'get_mcp_tools',
    description: 'Get the currently available MCP tools',
    schema: z.object({}),
    func: async () => {
      if (!mcpController) {
        return 'Aucun contrôleur MCP initialisé';
      }

      try {
        const tools = mcpController.getTools();
        if (tools.length === 0) {
          return "Aucun outil MCP disponible. Essayez d'utiliser la commande reload_mcp_connections pour recharger les connexions.";
        }
        return `Outils MCP disponibles (${tools.length}): ${tools.map((t) => t.name).join(', ')}`;
      } catch (error) {
        return `Erreur lors de la récupération des outils MCP: ${error}`;
      }
    },
  });

  // Ajout d'un outil pour lister les serveurs MCP installés
  const listMCPServersTool = new DynamicStructuredTool({
    name: 'list_mcp_servers',
    description: 'List all installed MCP servers in the configuration',
    schema: z.object({}),
    func: async () => {
      try {
        const currentConfig = mcpManager.getConfig();

        if (
          !currentConfig.mcpServers ||
          Object.keys(currentConfig.mcpServers).length === 0
        ) {
          return "Aucun serveur MCP n'est actuellement configuré.";
        }

        const serverEntries = Object.entries(currentConfig.mcpServers);
        const formattedServers = serverEntries
          .map(([name, config]) => {
            const serverConfig = config as {
              command: string;
              args: string[];
              env: Record<string, string>;
            };

            // Try to extract the Smithery qualified name from args if available
            let qualifiedName = 'N/A';
            if (serverConfig.args && serverConfig.args.includes('run')) {
              const runIndex = serverConfig.args.indexOf('run');
              if (runIndex >= 0 && runIndex + 1 < serverConfig.args.length) {
                qualifiedName = serverConfig.args[runIndex + 1];
              }
            }

            // Format environment variables if any
            const envVars = Object.keys(serverConfig.env || {}).join(', ');

            return `- ${name}:
  Qualified Name: ${qualifiedName}
  Command: ${serverConfig.command} ${serverConfig.args.join(' ')}
  Environment Variables: ${envVars || 'Aucune'}`;
          })
          .join('\n\n');

        return `Serveurs MCP configurés (${serverEntries.length}):\n\n${formattedServers}`;
      } catch (error) {
        return `Erreur lors de la récupération des serveurs MCP: ${error}`;
      }
    },
  });

  // Ajout d'un outil pour mettre à jour les serveurs MCP existants
  const updateMCPTool = new DynamicStructuredTool({
    name: 'update_mcp',
    description: 'Update an existing MCP server configuration',
    schema: z.object({
      serverName: z.string().describe('The name of the MCP server to update'),
      qualifiedName: z
        .string()
        .optional()
        .describe('New qualifiedName of the Smithery server (optional)'),
      env: z
        .record(z.string())
        .describe('New environment variables for the server'),
    }),
    func: async ({ serverName, qualifiedName, env }) => {
      try {
        const currentConfig = mcpManager.getConfig();

        if (
          !currentConfig.mcpServers ||
          !currentConfig.mcpServers[serverName]
        ) {
          return `Serveur "${serverName}" non trouvé dans la configuration.`;
        }

        // Get the current server configuration
        const currentServerConfig = currentConfig.mcpServers[serverName];

        // If a new qualified name is provided, we need to update the server details
        if (qualifiedName) {
          try {
            const serverDetails =
              await mcpManager.getServerDetails(qualifiedName);

            // Create a server object that matches the MCP interface
            const server: MCP = {
              name: serverDetails.displayName,
              description: 'Smithery server',
              id: qualifiedName,
            };

            // Remove the existing server
            await mcpManager.removeMCP(serverName);

            // Add the server with new details and environment variables
            await mcpManager.addMCP(server, env);

            return `Le serveur "${serverName}" a été mis à jour avec succès vers "${serverDetails.displayName}" (${qualifiedName}).`;
          } catch (error) {
            return `Erreur lors de la mise à jour du serveur avec le nouveau qualified name: ${error}`;
          }
        } else {
          // If only env variables are updated, extract the qualifiedName from current config
          let existingQualifiedName = null;

          if (
            currentServerConfig.args &&
            currentServerConfig.args.includes('run')
          ) {
            const runIndex = currentServerConfig.args.indexOf('run');
            if (
              runIndex >= 0 &&
              runIndex + 1 < currentServerConfig.args.length
            ) {
              existingQualifiedName = currentServerConfig.args[runIndex + 1];
            }
          }

          if (!existingQualifiedName) {
            return `Impossible de déterminer le qualified name existant pour "${serverName}". Veuillez fournir un qualified name explicite.`;
          }

          try {
            const serverDetails = await mcpManager.getServerDetails(
              existingQualifiedName
            );

            // Create a server object that matches the MCP interface
            const server: MCP = {
              name: serverDetails.displayName,
              description: 'Smithery server',
              id: existingQualifiedName,
            };

            // Remove the existing server
            await mcpManager.removeMCP(serverName);

            // Add the server with new environment variables
            await mcpManager.addMCP(server, env);

            return `Les variables d'environnement du serveur "${serverName}" ont été mises à jour avec succès.`;
          } catch (error) {
            return `Erreur lors de la mise à jour des variables d'environnement du serveur: ${error}`;
          }
        }
      } catch (error) {
        return `Erreur lors de la mise à jour du serveur MCP: ${error}`;
      }
    },
  });

  // Add management tools to the list
  allTools.push(
    searchMCPTool,
    addMCPTool,
    removeMCPTool,
    reloadMCPConfigTool,
    reloadMCPConnectionsTool,
    getMCPToolsTool,
    listMCPServersTool,
    updateMCPTool
  );

  return allTools;
};
