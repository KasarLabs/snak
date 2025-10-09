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
  messageAskUserTool,
} from './tools/index.js';
import { messageAskUserSchema } from '@schemas/graph.schemas.js';

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
    messageAskUserTool(),
  ];
}

export function getAgentConfigurationHelperTools(
  agentConfig: AgentConfig.Runtime
) {
  return [
    createAgentTool(agentConfig),
    listAgentsTool(agentConfig),
    deleteAgentTool(agentConfig),
    readAgentTool(agentConfig),
    updateAgentTool(agentConfig),
  ];
}

export function getMcpServerHelperTools(agentConfig: AgentConfig.Runtime) {
  return [
    addMcpServerTool(agentConfig),
    removeMcpServerTool(agentConfig),
    updateMcpServerTool(agentConfig),
  ];
}

export function getCommunicationHelperTools() {
  return [messageAskUserTool()];
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
    communication: [messageAskUserTool()],
  };
}
