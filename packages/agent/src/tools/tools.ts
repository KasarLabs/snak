import {
  DynamicStructuredTool,
  StructuredTool,
  Tool,
} from '@langchain/core/tools';
import { logger, AgentConfig, supervisorAgentConfig } from '@snakagent/core';
import { AnyZodObject } from 'zod';
import { MCP_CONTROLLER } from '@services/mcp/src/mcp.service.js';
import { CoreToolRegistry } from '@agents/graphs/tools/core.tools.js';
import { getSupervisorConfigTools } from '@agents/operators/supervisor/supervisorTools.js';

export async function initializeMcpTools(
  agentConfig: AgentConfig.Runtime
): Promise<(StructuredTool | Tool | DynamicStructuredTool<AnyZodObject>)[]> {
  let MCPToolsList: (Tool | DynamicStructuredTool<any> | StructuredTool)[] = [];
  if (
    agentConfig.mcp_servers &&
    Object.keys(agentConfig.mcp_servers).length > 0
  ) {
    try {
      const mcp = MCP_CONTROLLER.fromAgentConfig(agentConfig);
      await mcp.initializeConnections();

      const mcpTools = mcp.getTools();
      logger.info(`Added ${mcpTools.length} MCP tools to the agent`);
      MCPToolsList = [...MCPToolsList, ...mcpTools];
    } catch (error) {
      logger.error(`Failed to initialize MCP tools: ${error}`);
    }
  }
  return MCPToolsList;
}
/**
 * Initializes the list of tools for the agent based on signature type and configuration
 * @param snakAgent - The agent interface instance
 * @param agentConfig - Configuration object containing plugins and MCP servers
 * @returns Promise resolving to array of tools
 */
export async function initializeToolsList(
  agentConfig: AgentConfig.Runtime
): Promise<(StructuredTool | Tool | DynamicStructuredTool<AnyZodObject>)[]> {
  let toolsList: (Tool | DynamicStructuredTool<any> | StructuredTool)[] = [];
  const mcpTools = await initializeMcpTools(agentConfig);
  toolsList = [...toolsList, ...mcpTools];

  const isSupervisorAgent =
    agentConfig.profile?.group === supervisorAgentConfig.profile.group &&
    agentConfig.profile?.name === supervisorAgentConfig.profile.name;

  if (isSupervisorAgent) {
    const supervisorTools = getSupervisorConfigTools(agentConfig);
    for (const tool of supervisorTools) {
      if (!tool?.name) {
        logger.warn('Skipping supervisor tool without a name');
        continue;
      }
      const alreadyPresent = toolsList.some((existingTool) => {
        return existingTool?.name === tool.name;
      });

      if (!alreadyPresent) {
        toolsList.push(tool);
      }
    }
  }
  logger.debug(
    `toolsList: ${toolsList
      .map((tool) => tool?.name)
      .filter(Boolean)
      .join(', ')}`
  );
  // Register memory tools
  // const memoryRegistry = new MemoryToolRegistry(agentConfig);
  // toolsList.push(...memoryRegistry.getTools());

  // Register core tools
  const coreRegistry = new CoreToolRegistry();
  toolsList.push(...coreRegistry.getTools());
  return toolsList;
}
