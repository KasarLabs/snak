import { createAllowedTools } from '../../tools/tools.js';
import { MCP_CONTROLLER } from '../../services/mcp/src/mcp.js';
import { logger, AgentConfig } from '@snakagent/core';
import { Postgres } from '@snakagent/database/queries';
import { memory, iterations } from '@snakagent/database/queries';
import { DatabaseCredentials } from '@snakagent/database';
import {
  Tool,
  DynamicStructuredTool,
  StructuredTool,
} from '@langchain/core/tools';
import { AnyZodObject } from 'zod';
import { SnakAgentInterface } from '../../types/index.js';

let databaseConnectionPromise: Promise<void> | null = null;
let isConnected = false;

/**
 * Initializes the list of tools for the agent based on signature type and configuration
 * @param snakAgent - The agent interface instance
 * @param agentConfig - Configuration object containing plugins and MCP servers
 * @returns Promise resolving to array of tools
 */
export async function initializeToolsList(
  snakAgent: SnakAgentInterface,
  agentConfig: AgentConfig
): Promise<(StructuredTool | Tool | DynamicStructuredTool<AnyZodObject>)[]> {
  let toolsList: (Tool | DynamicStructuredTool<any> | StructuredTool)[] = [];

  const allowedTools = await createAllowedTools(snakAgent, agentConfig.plugins);
  toolsList = [...allowedTools];
  if (
    agentConfig.mcpServers &&
    Object.keys(agentConfig.mcpServers).length > 0
  ) {
    try {
      const mcp = MCP_CONTROLLER.fromAgentConfig(agentConfig);
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
 * Initializes database connection with singleton pattern to prevent duplicate connections
 * @param db - Database credentials for connection
 */
export const initializeDatabase = async (db: DatabaseCredentials) => {
  try {
    if (isConnected) {
      await memory.init();
      await iterations.init();
      logger.debug(
        'Agent memory table successfully initialized (connection exists)'
      );
      return;
    }

    if (databaseConnectionPromise) {
      await databaseConnectionPromise;
      await memory.init();
      await iterations.init();
      logger.debug(
        'Agent memory table successfully initialized (waited for connection)'
      );
      return;
    }

    databaseConnectionPromise = Postgres.connect(db);
    await databaseConnectionPromise;
    isConnected = true;

    await memory.init();
    await iterations.init();
    logger.debug('Agent memory table successfully created');
  } catch (error) {
    logger.error('Error creating memories table:', error);
    databaseConnectionPromise = null;
    isConnected = false;
    throw error;
  }
};

/**
 * Formats agent response for display, handling various data structures including JSON
 * @param response - Agent response (string, object, or array)
 * @returns Formatted string for display
 */
export const formatAgentResponse = (response: any): string => {
  if (typeof response === 'string') {
    try {
      if (
        (response.startsWith('[') && response.endsWith(']')) ||
        (response.startsWith('{') && response.endsWith('}'))
      ) {
        const parsed = JSON.parse(response);
        return formatAgentResponse(parsed);
      }

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
      return response;
    }
  }

  if (Array.isArray(response)) {
    let result = '';
    for (const item of response) {
      if (typeof item === 'object' && item !== null) {
        if (item.type === 'text' && item.text) {
          result += item.text + '\n';
        } else if (item.content) {
          result += item.content + '\n';
        } else {
          result += JSON.stringify(item) + '\n';
        }
      } else if (item !== null) {
        result += String(item) + '\n';
      }
    }
    return result.trim();
  }

  if (typeof response === 'object' && response !== null) {
    if (response.type === 'text' && response.text) {
      return response.text;
    } else if (response.content && typeof response.content === 'string') {
      return response.content;
    }
    try {
      return JSON.stringify(response);
    } catch (e) {
      return String(response);
    }
  }

  return String(response);
};

/**
 * Processes string content and attempts to parse JSON structures
 * @param content - String content to process
 * @returns Processed content string
 */
export const processStringContent = (content: string): string => {
  const trimmedContent = content.trim();
  if (
    (trimmedContent.startsWith('[') && trimmedContent.endsWith(']')) ||
    (trimmedContent.startsWith('{') && trimmedContent.endsWith('}'))
  ) {
    try {
      const parsed = JSON.parse(trimmedContent);
      return processMessageContent(parsed);
    } catch (e) {
      return content;
    }
  }
  return content;
};

/**
 * Processes array content by extracting text from structured objects
 * @param content - Array content to process
 * @returns Concatenated string result
 */
export const processArrayContent = (content: any[]): string => {
  let result = '';
  for (const item of content) {
    if (typeof item === 'object' && item !== null) {
      if (item.type === 'text' && item.text) {
        result += item.text + '\n';
      } else if (item.content) {
        result += item.content + '\n';
      } else {
        result += JSON.stringify(item) + '\n';
      }
    } else if (item !== null) {
      result += String(item) + '\n';
    }
  }
  return result.trim();
};

/**
 * Processes object content based on its structure and known patterns
 * @param content - Object content to process
 * @returns Extracted string content
 */
export const processObjectContent = (content: Record<string, any>): string => {
  if (content.type === 'text' && content.text) {
    return content.text;
  } else if (content.content && typeof content.content === 'string') {
    return content.content;
  }
  return JSON.stringify(content);
};

/**
 * Main content processor that handles different data types recursively
 * @param content - Content of any type to process
 * @returns Processed string content
 */
export const processMessageContent = (content: any): string => {
  if (typeof content === 'string') {
    return processStringContent(content);
  }

  if (Array.isArray(content)) {
    return processArrayContent(content);
  }

  if (typeof content === 'object' && content !== null) {
    return processObjectContent(content);
  }

  return String(content);
};
