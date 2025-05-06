import { StarknetAgentInterface } from '../../tools/tools.js';
import { createAllowedTools } from '../../tools/tools.js';
import { createSignatureTools } from '../../tools/signatureTools.js';
import { MCP_CONTROLLER } from '../../services/mcp/src/mcp.js';
import { logger } from '@snakagent/core';
import { AgentConfig } from '../../config/jsonConfig.js';
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
  jsonConfig: AgentConfig
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

/**
 * Format agent response for display by handling various formats including JSON structures
 * @param response The agent response which can be a string, object, or array
 * @returns Formatted string for display
 */
export const formatAgentResponse = (response: any): string => {
  // Handle JSON string (needs parsing)
  if (typeof response === 'string') {
    try {
      // Try to parse as JSON if it looks like a JSON array or object
      if (
        (response.startsWith('[') && response.endsWith(']')) ||
        (response.startsWith('{') && response.endsWith('}'))
      ) {
        const parsed = JSON.parse(response);
        return formatAgentResponse(parsed); // Process the parsed object
      }

      // Regular string formatting
      return response
        .split('\n')
        .map((line) => {
          if (line.includes('•')) {
            return `  ${line.trim()}`;
          }
          return line;
        })
        .join('\n');
    } catch (e) {
      // If JSON parsing fails, treat as regular string
      return response;
    }
  }

  // Handle array of objects (like tool response array)
  if (Array.isArray(response)) {
    let result = '';
    for (const item of response) {
      if (typeof item === 'object' && item !== null) {
        // Handle structured objects from the model
        if (item.type === 'text' && item.text) {
          result += item.text + '\n';
        } else if (item.content) {
          result += item.content + '\n';
        } else {
          // Generic object
          result += JSON.stringify(item) + '\n';
        }
      } else if (item !== null) {
        result += String(item) + '\n';
      }
    }
    return result.trim();
  }

  // Handle single object
  if (typeof response === 'object' && response !== null) {
    if (response.type === 'text' && response.text) {
      return response.text;
    } else if (response.content && typeof response.content === 'string') {
      return response.content;
    }
  }

  // Fallback: convert to string
  return String(response);
};

/**
 * Process structured content before wrapping in AIMessage
 * Helper function for formatAIMessageResult
 */
export const processMessageContent = (content: any): string => {
  // Handle string content
  if (typeof content === 'string') {
    try {
      // Check if it's a JSON string
      if (
        (content.startsWith('[') && content.endsWith(']')) ||
        (content.startsWith('{') && content.endsWith('}'))
      ) {
        // Try to parse it
        const parsed = JSON.parse(content);
        return processMessageContent(parsed); // Recursively process the parsed object
      }
      // Regular string
      return content;
    } catch (e) {
      // Not valid JSON, return as is
      return content;
    }
  }

  // Handle array of objects (common when the model returns structured data)
  if (Array.isArray(content)) {
    let result = '';
    for (const item of content) {
      if (typeof item === 'object' && item !== null) {
        // Handle structured objects with type/text format
        if (item.type === 'text' && item.text) {
          result += item.text + '\n';
        } else if (item.content) {
          result += item.content + '\n';
        } else {
          // Generic object
          result += JSON.stringify(item) + '\n';
        }
      } else if (item !== null) {
        result += String(item) + '\n';
      }
    }
    return result.trim();
  }

  // Handle single object
  if (typeof content === 'object' && content !== null) {
    if (content.type === 'text' && content.text) {
      return content.text;
    } else if (content.content && typeof content.content === 'string') {
      return content.content;
    }
  }

  // Fallback - stringify the content
  return typeof content === 'string' ? content : JSON.stringify(content);
};
