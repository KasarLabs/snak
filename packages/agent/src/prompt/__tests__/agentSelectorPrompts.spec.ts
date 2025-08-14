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
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  // Test data factories
  const makeAgent = (overrides = {}) => ({
    id: 'test-agent',
    name: 'Test Agent',
    description: 'Test Description',
    type: 'operator',
    ...overrides,
  });

  const makeAgentDescriptions = (agents: any[]) => JSON.stringify(agents);

  describe('agentSelectionSystemPrompt', () => {
    describe('normal operation', () => {
      it('should generate system prompt with multiple agent types', () => {
        const agentDescriptions = makeAgentDescriptions([
          makeAgent({ id: 'config-agent', name: 'Configuration Agent', type: 'operator' }),
          makeAgent({ id: 'ethereum-agent', name: 'Ethereum Agent', type: 'snak' }),
        ]);

        const result = agentSelectionSystemPrompt(agentDescriptions);

        expect(result).toContain('You are an agent selector');
        expect(result).toContain('OPERATOR AGENTS:');
        expect(result).toContain('SNAK AGENTS:');
        expect(result).toContain('ID: config-agent');
        expect(result).toContain('ID: ethereum-agent');
      });

      it('should include all required prompt sections', () => {
        const result = agentSelectionSystemPrompt('[]');

        expect(result).toContain('Important Selection Rules:');
        expect(result).toContain('configuration-agent');
        expect(result).toContain('INSTRUCTIONS:');
        expect(result).toContain('NO_MATCHING_AGENT');
      });

      it('should add array brackets to single object input', () => {
        const singleAgent = JSON.stringify(makeAgent({ id: 'single-agent' }));

        const result = agentSelectionSystemPrompt(singleAgent);

        expect(result).toContain('ID: single-agent');
      });
    });

    describe('edge cases', () => {
      it.each([
        ['empty array', '[]'],
        ['whitespace padded array', '  []  '],
        ['single agent with whitespace', `  ${makeAgentDescriptions([makeAgent()])}  `],
      ])('should handle %s', (_, input) => {
        const result = agentSelectionSystemPrompt(input);
        expect(result).toContain('You are an agent selector');
      });

      it('should handle agents with missing properties', () => {
        const agentDescriptions = makeAgentDescriptions([{ id: 'incomplete', type: 'operator' }]);

        const result = agentSelectionSystemPrompt(agentDescriptions);

        expect(result).toContain('Name: undefined');
        expect(result).toContain('Description: undefined');
      });
    });

    describe('error handling', () => {
      it('should handle invalid JSON and log error', () => {
        const result = agentSelectionSystemPrompt('invalid json');

        expect(result).toBe('Error: Unable to parse agent descriptions');
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Error parsing agent descriptions:',
          expect.any(Error)
        );
      });
    });
  });

  describe('agentSelectionPrompt', () => {
    it.each([
      ['regular query', 'Help me configure my agent'],
      ['empty string', ''],
      ['special characters', 'Query with @#$%^&*()'],
      ['multiline text', 'Line 1\nLine 2\nLine 3'],
    ])('should return %s as-is', (_, query) => {
      expect(agentSelectionPrompt(query)).toBe(query);
    });
  });

  describe('message functions', () => {
    const messageTests = [
      {
        name: 'noMatchingAgentMessage',
        fn: noMatchingAgentMessage,
        expected: "I don't have an agent that can handle this specific request. Could you clarify what you're trying to do?",
      },
      {
        name: 'defaultClarificationMessage',
        fn: defaultClarificationMessage,
        expected: 'I need more information to select the appropriate agent. Could you provide more details about what you need?',
      },
      {
        name: 'errorFallbackMessage',
        fn: errorFallbackMessage,
        expected: 'I encountered an issue understanding your request. Could you rephrase it or provide more details about what you need help with?',
      },
      {
        name: 'noValidAgentMessage',
        fn: noValidAgentMessage,
        expected: "I couldn't identify which agent should handle your request. Could you describe more precisely what you need help with?",
      },
    ];

    test.each(messageTests)('$name returns correct message', ({ fn, expected }) => {
      expect(fn()).toBe(expected);
    });

    test.each(messageTests)('$name returns consistent results', ({ fn }) => {
      const result1 = fn();
      const result2 = fn();
      expect(result1).toBe(result2);
    });
  });

  describe('type interfaces pass-through', () => {
    it('should handle AgentSelectionPromptParams correctly', () => {
      const params: AgentSelectionPromptParams = {
        query: 'test query',
        agentDescriptions: 'test descriptions',
      };

      expect(params.query).toBe('test query');
      expect(params.agentDescriptions).toBe('test descriptions');
    });

    it('should handle ClarificationData correctly', () => {
      const data: ClarificationData = {
        possibleAgents: ['agent1', 'agent2'],
        missingInfo: 'missing info',
        clarificationQuestion: 'What do you need?',
      };

      expect(data.possibleAgents).toEqual(['agent1', 'agent2']);
      expect(data.missingInfo).toBe('missing info');
      expect(data.clarificationQuestion).toBe('What do you need?');
    });
  });
});
