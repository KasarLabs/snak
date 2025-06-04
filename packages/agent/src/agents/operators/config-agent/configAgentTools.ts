import { Tool } from '@langchain/core/tools';
import { DynamicStructuredTool } from '@langchain/core/tools';
import {
  createAgentTool,
  readAgentTool,
  updateAgentTool,
  deleteAgentTool,
  listAgentsTool,
} from './tools/index.js';

/**
 * Get all configuration tools for the Config Agent
 * @returns Array of LangChain tools for agent configuration management
 */
export function getConfigAgentTools(): (Tool | DynamicStructuredTool)[] {
  return [
    createAgentTool,
    readAgentTool,
    updateAgentTool,
    deleteAgentTool,
    listAgentsTool,
  ];
}

/**
 * Get tools by category
 */
export const configToolCategories = {
  create: [createAgentTool],
  read: [readAgentTool, listAgentsTool],
  update: [updateAgentTool],
  delete: [deleteAgentTool],
  list: [listAgentsTool],
};
