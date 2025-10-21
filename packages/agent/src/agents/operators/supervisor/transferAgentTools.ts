import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

/**
 * Creates a transfer tool for a specific agent
 * @param agentName - The name of the agent to transfer to
 * @returns A DynamicStructuredTool for transferring to the specified agent
 */
export function createTransferAgentTool(
  agentName: string
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: `transfer_to_${agentName}`,
    description: `Transfer the conversation to ${agentName}`,
    schema: z.object({}),
    func: async () => {
      return JSON.stringify({
        success: true,
        message: `Transferring to ${agentName}`,
        transfer_to: agentName,
      });
    },
  });
}
