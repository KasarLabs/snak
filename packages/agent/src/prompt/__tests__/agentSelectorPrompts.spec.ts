// Mock console.error to capture error output
const originalConsoleError = console.error;
const mockConsoleError = jest.fn();

// Import the module under test
import {
  agentSelectionSystemPrompt,
  agentSelectionPrompt,
  noMatchingAgentMessage,
  defaultClarificationMessage,
  errorFallbackMessage,
  noValidAgentMessage,
  type AgentSelectionPromptParams,
  type ClarificationData,
} from '../agentSelectorPrompts.js';

describe('agentSelectorPrompts', () => {
  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Mock console.error
    console.error = mockConsoleError;
  });

  afterEach(() => {
    // Restore console.error
    console.error = originalConsoleError;
  });

  describe('agentSelectionSystemPrompt', () => {
    it('should generate system prompt with valid JSON agent descriptions', () => {
      const agentDescriptions = JSON.stringify([
        {
          id: 'config-agent',
          name: 'Configuration Agent',
          description: 'Manages agent configurations',
          type: 'operator',
        },
        {
          id: 'mcp-agent',
          name: 'MCP Agent',
          description: 'Manages MCP servers',
          type: 'operator',
        },
        {
          id: 'ethereum-agent',
          name: 'Ethereum Agent',
          description: 'Handles Ethereum operations',
          type: 'snak',
        },
      ]);

      const result = agentSelectionSystemPrompt(agentDescriptions);

      expect(result).toContain('You are an agent selector');
      expect(result).toContain('OPERATOR AGENTS:');
      expect(result).toContain('SNAK AGENTS:');
      expect(result).toContain('ID: config-agent');
      expect(result).toContain('ID: mcp-agent');
      expect(result).toContain('ID: ethereum-agent');
      expect(result).toContain('Name: Configuration Agent');
      expect(result).toContain('Name: MCP Agent');
      expect(result).toContain('Name: Ethereum Agent');
      expect(result).toContain('Description: Manages agent configurations');
      expect(result).toContain('Description: Manages MCP servers');
      expect(result).toContain('Description: Handles Ethereum operations');
    });

    it('should add array brackets if missing from agent descriptions', () => {
      const agentDescriptions = JSON.stringify({
        id: 'single-agent',
        name: 'Single Agent',
        description: 'A single agent',
        type: 'operator',
      });

      const result = agentSelectionSystemPrompt(agentDescriptions);

      expect(result).toContain('ID: single-agent');
      expect(result).toContain('Name: Single Agent');
      expect(result).toContain('Description: A single agent');
    });

    it('should handle empty agent descriptions', () => {
      const agentDescriptions = '[]';

      const result = agentSelectionSystemPrompt(agentDescriptions);

      expect(result).toContain('You are an agent selector');
      expect(result).toContain('OPERATOR AGENTS:');
      expect(result).toContain('SNAK AGENTS:');
      expect(result).toContain('[');
      expect(result).toContain(']');
    });

    it('should filter agents by type correctly', () => {
      const agentDescriptions = JSON.stringify([
        {
          id: 'operator-1',
          name: 'Operator 1',
          description: 'First operator',
          type: 'operator',
        },
        {
          id: 'snak-1',
          name: 'Snak 1',
          description: 'First snak',
          type: 'snak',
        },
        {
          id: 'operator-2',
          name: 'Operator 2',
          description: 'Second operator',
          type: 'operator',
        },
      ]);

      const result = agentSelectionSystemPrompt(agentDescriptions);

      expect(result).toContain('OPERATOR AGENTS:');
      expect(result).toContain('ID: operator-1');
      expect(result).toContain('ID: operator-2');
      expect(result).toContain('Name: Operator 1');
      expect(result).toContain('Name: Operator 2');

      expect(result).toContain('SNAK AGENTS:');
      expect(result).toContain('ID: snak-1');
      expect(result).toContain('Name: Snak 1');
    });

    it('should handle invalid JSON and return error message', () => {
      const invalidJson = 'invalid json string';

      const result = agentSelectionSystemPrompt(invalidJson);

      expect(result).toBe('Error: Unable to parse agent descriptions');
      expect(mockConsoleError).toHaveBeenCalledWith(
        'Error parsing agent descriptions:',
        expect.any(Error)
      );
    });

    it('should include all required selection rules in the prompt', () => {
      const agentDescriptions = '[]';

      const result = agentSelectionSystemPrompt(agentDescriptions);

      expect(result).toContain('Important Selection Rules:');
      expect(result).toContain('configuration-agent');
      expect(result).toContain('mcp-agent');
      expect(result).toContain('blockchain RPC agent');
      expect(result).toContain('SNAK agent');
    });

    it('should include instructions for agent selection', () => {
      const agentDescriptions = '[]';

      const result = agentSelectionSystemPrompt(agentDescriptions);

      expect(result).toContain('INSTRUCTIONS:');
      expect(result).toContain(
        '1. First, understand what the user is trying to accomplish:'
      );
      expect(result).toContain(
        '2. Your response must ONLY contain the ID of the selected agent'
      );
      expect(result).toContain(
        '3. If the query doesn\'t match any available agent\'s capabilities, respond with "NO_MATCHING_AGENT"'
      );
    });

    it('should handle agents with missing properties gracefully', () => {
      const agentDescriptions = JSON.stringify([
        {
          id: 'incomplete-agent',
          type: 'operator',
        },
      ]);

      const result = agentSelectionSystemPrompt(agentDescriptions);

      expect(result).toContain('ID: incomplete-agent');
      expect(result).toContain('Name: undefined');
      expect(result).toContain('Description: undefined');
    });

    it('should trim whitespace from agent descriptions', () => {
      const agentDescriptions = `  ${JSON.stringify([
        {
          id: 'test-agent',
          name: 'Test Agent',
          description: 'Test Description',
          type: 'operator',
        },
      ])}  `;

      const result = agentSelectionSystemPrompt(agentDescriptions);

      expect(result).toContain('ID: test-agent');
      expect(result).toContain('Name: Test Agent');
      expect(result).toContain('Description: Test Description');
    });
  });

  describe('agentSelectionPrompt', () => {
    it('should return the query as is', () => {
      const query = 'Help me configure my agent settings';

      const result = agentSelectionPrompt(query);

      expect(result).toBe(query);
    });

    it('should handle empty query', () => {
      const query = '';

      const result = agentSelectionPrompt(query);

      expect(result).toBe('');
    });

    it('should handle complex queries with special characters', () => {
      const query = 'Can you help me with @#$%^&*() operations?';

      const result = agentSelectionPrompt(query);

      expect(result).toBe(query);
    });

    it('should handle multi-line queries', () => {
      const query = `This is a multi-line
query with line breaks
and special formatting`;

      const result = agentSelectionPrompt(query);

      expect(result).toBe(query);
    });
  });

  describe('noMatchingAgentMessage', () => {
    it('should return appropriate message when no agent matches', () => {
      const result = noMatchingAgentMessage();

      expect(result).toBe(
        "I don't have an agent that can handle this specific request. Could you clarify what you're trying to do?"
      );
    });

    it('should return consistent message on multiple calls', () => {
      const result1 = noMatchingAgentMessage();
      const result2 = noMatchingAgentMessage();

      expect(result1).toBe(result2);
    });
  });

  describe('defaultClarificationMessage', () => {
    it('should return appropriate clarification message', () => {
      const result = defaultClarificationMessage();

      expect(result).toBe(
        'I need more information to select the appropriate agent. Could you provide more details about what you need?'
      );
    });

    it('should return consistent message on multiple calls', () => {
      const result1 = defaultClarificationMessage();
      const result2 = defaultClarificationMessage();

      expect(result1).toBe(result2);
    });
  });

  describe('errorFallbackMessage', () => {
    it('should return appropriate error fallback message', () => {
      const result = errorFallbackMessage();

      expect(result).toBe(
        'I encountered an issue understanding your request. Could you rephrase it or provide more details about what you need help with?'
      );
    });

    it('should return consistent message on multiple calls', () => {
      const result1 = errorFallbackMessage();
      const result2 = errorFallbackMessage();

      expect(result1).toBe(result2);
    });
  });

  describe('noValidAgentMessage', () => {
    it('should return appropriate no valid agent message', () => {
      const result = noValidAgentMessage();

      expect(result).toBe(
        "I couldn't identify which agent should handle your request. Could you describe more precisely what you need help with?"
      );
    });

    it('should return consistent message on multiple calls', () => {
      const result1 = noValidAgentMessage();
      const result2 = noValidAgentMessage();

      expect(result1).toBe(result2);
    });
  });

  describe('Type definitions', () => {
    it('should have correct AgentSelectionPromptParams interface', () => {
      const params: AgentSelectionPromptParams = {
        query: 'test query',
        agentDescriptions: 'test descriptions',
      };

      expect(params.query).toBe('test query');
      expect(params.agentDescriptions).toBe('test descriptions');
    });

    it('should have correct ClarificationData interface', () => {
      const clarificationData: ClarificationData = {
        possibleAgents: ['agent1', 'agent2'],
        missingInfo: 'missing information',
        clarificationQuestion: 'What do you need?',
      };

      expect(clarificationData.possibleAgents).toEqual(['agent1', 'agent2']);
      expect(clarificationData.missingInfo).toBe('missing information');
      expect(clarificationData.clarificationQuestion).toBe('What do you need?');
    });
  });

  describe('Integration tests', () => {
    it('should work together with system prompt and selection prompt', () => {
      const agentDescriptions = JSON.stringify([
        {
          id: 'test-agent',
          name: 'Test Agent',
          description: 'Test Description',
          type: 'operator',
        },
      ]);

      const systemPrompt = agentSelectionSystemPrompt(agentDescriptions);
      const selectionPrompt = agentSelectionPrompt('test query');

      expect(systemPrompt).toContain('You are an agent selector');
      expect(selectionPrompt).toBe('test query');
    });

    it('should provide appropriate fallback messages for different scenarios', () => {
      const noMatch = noMatchingAgentMessage();
      const clarification = defaultClarificationMessage();
      const error = errorFallbackMessage();
      const noValid = noValidAgentMessage();

      expect(noMatch).toContain("don't have an agent");
      expect(clarification).toContain('more information');
      expect(error).toContain('encountered an issue');
      expect(noValid).toContain("couldn't identify");
    });
  });
});
