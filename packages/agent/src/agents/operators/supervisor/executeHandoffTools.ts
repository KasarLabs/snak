import { AIMessage, ToolMessage } from '@langchain/core/messages';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { Command, END, ParentCommand } from '@langchain/langgraph';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { RedisClient } from '@snakagent/database/redis';
import { getAgentIdByName } from '../../../../../database/dist/queries/redis/queries.js';
/**
 * Sanitizes agent name to create a valid function name for Google Generative AI
 * Must start with a letter or underscore and contain only alphanumeric, underscores, dots, colons, or dashes
 * @param name - The agent name to sanitize
 * @returns A sanitized name safe for function declarations
 */
function sanitizeAgentName(name: string): string {
  // Replace spaces and invalid characters with underscores
  let sanitized = name.replace(/[^a-zA-Z0-9_.\-:]/g, '_');

  // Ensure it starts with a letter or underscore
  if (!/^[a-zA-Z_]/.test(sanitized)) {
    sanitized = `agent_${sanitized}`;
  }

  // Limit to 64 characters (Google AI re~quirement) minus the "execute_handoff_to_" prefix (13 chars)
  const maxLength = 64 - 13;
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  return sanitized;
}

/**
 * Creates a transfer tool for a specific agent
 * @param agentName - The name of the agent to transfer to
 * @returns A DynamicStructuredTool for transferring to the specified agent
 */
export function createExecuteHandoffTools(
  agentName: string,
  agentId: string
): DynamicStructuredTool {
  const sanitizedName = sanitizeAgentName(agentName);

  return new DynamicStructuredTool({
    name: `execute_handoff_to_${sanitizedName}`,
    description: `Executing handoff to ${agentName}`,
    schema: z
      .object({
        query: z.string().describe('Query to send to the agent upon handoff'),
      })
      .strict(),
    func: async (query: string) => {
      const tool_id = uuidv4();
      const aiMessage = new AIMessage(`Executing handoff to ${agentName}`);
      aiMessage.tool_calls = [
        {
          id: tool_id,
          name: `execute_handoff_to_${sanitizedName}`,
          args: {},
        },
      ];
      // Log the tool message for auditing/debugging
      const tMessage = new ToolMessage({
        content: `Executing handoff to ${agentName}`,
        tool_call_id: tool_id,
        name: `execute_handoff_to_${sanitizedName}`,
      });

      // Return Command to end the graph using END constant
      // This will terminate the supervisor graph when transfer is requested
      return new Command({
        update: {
          messages: [aiMessage, tMessage],
          transfer_to: [
            { agent_name: agentName, agent_id: agentId, query: query },
          ],
        },
        goto: END,
        graph: Command.PARENT,
      });
    },
  });
}
