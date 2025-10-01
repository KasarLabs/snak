import { Tool, DynamicStructuredTool } from '@langchain/core/tools';
import { AgentConfig } from '@snakagent/core';
import {
  createAgentTool,
  listAgentsTool,
  deleteAgentTool,
  readAgentTool,
  updateAgentTool,
  addMcpServerTool,
  removeMcpServerTool,
  updateMcpServerTool,
} from './tools/index.js';

/**
 * Shared configuration tools reserved for supervisor agents.
 * These helpers provide a curated list so we can easily control
 * which LangChain tools are exposed to supervisor operators.
 */
export function getSupervisorConfigTools(
  agentConfig: AgentConfig.Runtime
): (Tool | DynamicStructuredTool)[] {
  return [
    createAgentTool(agentConfig),
    listAgentsTool(agentConfig),
    deleteAgentTool(agentConfig),
    readAgentTool(agentConfig),
    updateAgentTool(agentConfig),
    addMcpServerTool(agentConfig),
    removeMcpServerTool(agentConfig),
    updateMcpServerTool(agentConfig),
  ];
}

/**
 * Category-based view of supervisor configuration tools.
 * Note: This is now a function that requires agentConfig parameter.
 */
export function getSupervisorToolCategories(agentConfig: AgentConfig.Runtime) {
  return {
    create: [createAgentTool(agentConfig)],
    read: [readAgentTool(agentConfig)],
    update: [updateAgentTool(agentConfig)],
    delete: [deleteAgentTool(agentConfig)],
    list: [listAgentsTool(agentConfig)],
    mcp: [
      addMcpServerTool(agentConfig),
      removeMcpServerTool(agentConfig),
      updateMcpServerTool(agentConfig),
    ],
  };
}
