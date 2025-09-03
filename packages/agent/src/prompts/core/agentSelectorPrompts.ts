export interface AgentSelectionPromptParams {
  query: string;
  agentDescriptions: string;
}

export interface ClarificationData {
  possibleAgents: string[];
  missingInfo: string;
  clarificationQuestion: string;
}

export const agentSelectionSystemPrompt = (
  agentDescriptions: string
): string => {
  // Add array brackets if they're missing
  const jsonString = agentDescriptions.trim().startsWith('[')
    ? agentDescriptions
    : `[${agentDescriptions}]`;

  try {
    const agents = JSON.parse(jsonString);

    const formatAgents = (type: string) => {
      return agents
        .filter((agent: any) => agent.type === type)
        .map(
          (agent: any) =>
            `ID: ${agent.id}
Name: ${agent.name}
Description: ${agent.description}
`
        )
        .join('\n\n');
    };

    return `You are an agent selector responsible for analyzing user queries and determining which specialized agent should handle each request.

Key responsibilities:
1. Analyze user intent and requirements
2. Match capabilities with available agents
3. Provide clear agent selection or request clarification when needed
4. Consider agent names, types, and descriptions when making selections

Important Selection Rules:
- For any requests related to managing, modifying, or viewing agent configurations (including names, descriptions, or settings), select the configuration-agent
- For requests related to managing MCP (Model Context Protocol) servers, their configurations, or tools (including adding, removing, updating, or listing MCPs), select the mcp-agent
- For blockchain-specific operations, select the corresponding blockchain RPC agent
- For SNAK-related operations, select the appropriate SNAK agent

AVAILABLE AGENTS BY TYPE:

OPERATOR AGENTS:
[
${formatAgents('operator')}
]

SNAK AGENTS:
[
${formatAgents('snak')}
]
INSTRUCTIONS:
1. First, understand what the user is trying to accomplish:
   - Is it a configuration change? → configuration-agent
   - Is it an MCP server operation? → mcp-agent
   - Is it a blockchain operation? → corresponding blockchain RPC agent
   - Is it a SNAK operation? → corresponding SNAK agent

2. Your response must ONLY contain the ID of the selected agent (the exact string from the "id" field).
   Do not include any explanations, analysis, or other text.

3. If the query doesn't match any available agent's capabilities, respond with "NO_MATCHING_AGENT".

Always prioritize accuracy and specificity in your selections.`;
  } catch (error) {
    console.error('Error parsing agent descriptions:', error);
    return 'Error: Unable to parse agent descriptions';
  }
};

export const agentSelectionPrompt = (query: string): string => {
  return query;
};

export const noMatchingAgentMessage = (): string => {
  return "I don't have an agent that can handle this specific request. Could you clarify what you're trying to do?";
};

export const defaultClarificationMessage = (): string => {
  return 'I need more information to select the appropriate agent. Could you provide more details about what you need?';
};

export const errorFallbackMessage = (): string => {
  return 'I encountered an issue understanding your request. Could you rephrase it or provide more details about what you need help with?';
};

export const noValidAgentMessage = (): string => {
  return "I couldn't identify which agent should handle your request. Could you describe more precisely what you need help with?";
};
