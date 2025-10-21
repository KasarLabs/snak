import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

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

  // Limit to 64 characters (Google AI requirement) minus the "transfer_to_" prefix (13 chars)
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
export function createTransferAgentTool(
  agentName: string
): DynamicStructuredTool {
  const sanitizedName = sanitizeAgentName(agentName);

  return new DynamicStructuredTool({
    name: `transfer_to_${sanitizedName}`,
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
