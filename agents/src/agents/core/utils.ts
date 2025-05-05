import { StarknetAgentInterface } from '../../tools/tools.js';
import { createAllowedTools } from '../../tools/tools.js';
import { createSignatureTools } from '../../tools/signatureTools.js';
import { MCP_CONTROLLER } from '../../services/mcp/src/mcp.js';
import { logger } from '@snakagent/core';
import { JsonConfig } from '../../config/jsonConfig.js';
import { Postgres } from '@snakagent/database/queries';
import { memory } from '@snakagent/database/queries';
import { DatabaseCredentials } from '@snakagent/database';
import {
  Tool,
  DynamicStructuredTool,
  StructuredTool,
} from '@langchain/core/tools';

/**
 * Initializes the list of tools for the agent
 */
export async function initializeToolsList(
  starknetAgent: StarknetAgentInterface,
  jsonConfig: JsonConfig
): Promise<(Tool | DynamicStructuredTool<any> | StructuredTool)[]> {
  let toolsList: (Tool | DynamicStructuredTool<any> | StructuredTool)[] = [];
  const isSignature = starknetAgent.getSignature().signature === 'wallet';

  if (isSignature) {
    toolsList = await createSignatureTools(jsonConfig.plugins);
  } else {
    const allowedTools = await createAllowedTools(
      starknetAgent,
      jsonConfig.plugins
    );
    toolsList = [...allowedTools];
  }

  if (jsonConfig.mcpServers && Object.keys(jsonConfig.mcpServers).length > 0) {
    try {
      const mcp = MCP_CONTROLLER.fromJsonConfig(jsonConfig);
      await mcp.initializeConnections();

      const mcpTools = mcp.getTools();
      logger.info(`Added ${mcpTools.length} MCP tools to the agent`);
      toolsList = [...toolsList, ...mcpTools];
    } catch (error) {
      logger.error(`Failed to initialize MCP tools: ${error}`);
    }
  }

  return toolsList;
}

/**
 * Initializes the database connection for the agent
 */
export const initializeDatabase = async (db: DatabaseCredentials) => {
  try {
    await Postgres.connect(db);
    await memory.init();
    logger.debug('Agent memory table successfully created');
  } catch (error) {
    logger.error('Error creating memories table:', error);
    throw error;
  }
};

/**
 * Tronque le contenu de la réponse d'un outil à une longueur maximale spécifiée
 * @param result Le résultat de l'invocation de l'outil
 * @param maxLength Longueur maximale (défaut: 5000 caractères)
 * @returns Le résultat avec contenu tronqué si nécessaire
 */
export function truncateToolResults(
  result: any,
  maxLength: number = 5000
): any {
  // Handle case when result is an array (typical in interactive mode)
  if (Array.isArray(result)) {
    for (const msg of result) {
      // Vérifier si c'est un ToolMessage et si le contenu est une chaîne
      if (
        msg._getType &&
        msg._getType() === 'tool' &&
        typeof msg.content === 'string'
      ) {
        const originalLength = msg.content.length;
        if (originalLength > maxLength) {
          msg.content =
            msg.content.substring(0, maxLength) +
            `... [truncated ${originalLength - maxLength} chars]`;
          logger.debug(
            `Tool result content truncated from ${originalLength} to ${maxLength} characters.`
          );
        }
      }
    }
  }

  // Handle case when result is an object with messages array (hybrid mode structure)
  if (result && typeof result === 'object' && Array.isArray(result.messages)) {
    for (const msg of result.messages) {
      // Check for tool messages in any format
      if (typeof msg.content === 'string') {
        const originalLength = msg.content.length;
        if (originalLength > maxLength) {
          msg.content =
            msg.content.substring(0, maxLength) +
            `... [truncated ${originalLength - maxLength} chars]`;
          logger.debug(
            `Tool result content truncated from ${originalLength} to ${maxLength} characters.`
          );
        }
      }

      // Also check for content in tool_calls_results if it exists
      if (Array.isArray(msg.tool_calls_results)) {
        for (const toolResult of msg.tool_calls_results) {
          if (typeof toolResult.content === 'string') {
            const originalLength = toolResult.content.length;
            if (originalLength > maxLength) {
              toolResult.content =
                toolResult.content.substring(0, maxLength) +
                `... [truncated ${originalLength - maxLength} chars]`;
              logger.debug(
                `Tool result content truncated from ${originalLength} to ${maxLength} characters.`
              );
            }
          }
        }
      }
    }
  }

  return result;
}
