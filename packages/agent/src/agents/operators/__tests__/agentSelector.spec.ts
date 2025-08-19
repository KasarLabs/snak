import { AgentSelector } from '../agentSelector.js';
import { agentSelectorPromptContent } from '../../../prompt/prompts.js';

// Mock the prompts with .js suffix for ESM compatibility
jest.mock('../../../prompt/prompts.js', () => ({
  agentSelectorPromptContent: jest.fn(
    (agentInfo, input) =>
      `Mock prompt for agents: ${Array.from(agentInfo.keys()).join(', ')} and input: ${input}`
  ),
}));

// Use the external mock for @snakagent/core
jest.mock('@snakagent/core');

// Mock classes for testing
class MockSnakAgent {
  private mockName: string;
  private mockDescription: string | null | undefined;

  constructor(name: string, description?: string | null) {
    this.mockName = name;
    this.mockDescription = description;
  }

  public getAgentConfig(): any {
    return {
      name: this.mockName,
      description: this.mockDescription,
    };
  }

  public async init(): Promise<void> {
    // Mock implementation
  }

  public async *execute(): AsyncGenerator<any> {
    // Mock implementation
    yield { content: 'Mock agent response' };
  }
}

class MockModelSelector {
  private mockModel = { invoke: jest.fn() };

  public getModels(): any {
    return { fast: this.mockModel };
  }

  public getMockModel() {
    return this.mockModel;
  }
}

// Helper functions
const llmOk = (content: any) => ({
  content,
  _getType: () => 'ai',
  usage_metadata: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
});

const llmErr = (msg = 'LLM error') => new Error(msg);

function makeAgents() {
  return new Map([
    [
      'agent1',
      new MockSnakAgent('agent1', 'Handles blockchain operations') as any,
    ],
    [
      'agent2',
      new MockSnakAgent('agent2', 'Handles configuration management') as any,
    ],
    ['agent3', new MockSnakAgent('agent3', 'Handles MCP operations') as any],
  ]);
}

describe('AgentSelector', () => {
  let agentSelector: AgentSelector;
  let modelSelector: any;
  let mockAgents: Map<string, any>;
  let mockModel: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAgents = makeAgents();
    modelSelector = new MockModelSelector();
    mockModel = modelSelector.getMockModel();
    agentSelector = new AgentSelector({
      availableAgents: mockAgents,
      modelSelector,
      debug: true,
    });
  });

  describe('initialization', () => {
    it('should initialize with available agents', async () => {
      await agentSelector.init();
      expect(mockAgents.size).toBe(3);
      expect(mockAgents.has('agent1')).toBe(true);
      expect(mockAgents.has('agent2')).toBe(true);
      expect(mockAgents.has('agent3')).toBe(true);
    });

    it('should handle initialization without model selector', async () => {
      const agentSelectorWithoutModel = new AgentSelector({
        availableAgents: mockAgents,
        modelSelector: null as any,
      });
      await agentSelectorWithoutModel.init();
      // Should not throw error
    });

    it('should handle agents without description', async () => {
      const agentsWithoutDescription = new Map([
        ['agent-no-desc', new MockSnakAgent('agent-no-desc') as any],
        ['agent-empty-desc', new MockSnakAgent('agent-empty-desc', '') as any],
        ['agent-undefined-desc', new MockSnakAgent('agent-undefined-desc', undefined) as any],
      ]);
      
      const agentSelectorNoDesc = new AgentSelector({
        availableAgents: agentsWithoutDescription,
        modelSelector,
        debug: true,
      });
      
      await agentSelectorNoDesc.init();
      // Exercise prompt path and assert default description is used
      mockModel.invoke.mockResolvedValueOnce(llmOk('agent-no-desc'));
      await agentSelectorNoDesc.execute('Request');
      expect(agentSelectorPromptContent).toHaveBeenCalled();
      const [agentInfo] = (agentSelectorPromptContent as jest.Mock).mock.calls.at(-1);
      const agentNames = ['agent-no-desc', 'agent-empty-desc', 'agent-undefined-desc'];
      agentNames.forEach(agentName => {
        const desc = agentInfo.get(agentName)?.description;
        expect(desc).toBeUndefined();
      });
    });
  });

  describe('agent management', () => {
    beforeEach(async () => {
      await agentSelector.init();
    });

    it('should remove an agent successfully', async () => {
      await agentSelector.removeAgent('agent1');
      expect(mockAgents.has('agent1')).toBe(false);
      expect(mockAgents.size).toBe(2);
    });

    it('should handle removing non-existent agent', async () => {
      await agentSelector.removeAgent('non-existent');
      expect(mockAgents.size).toBe(3);
    });

    it('should update available agents', async () => {
      const newAgent = new MockSnakAgent(
        'agent4',
        'Handles new operations'
      ) as any;
      await agentSelector.updateAvailableAgents(['agent4', newAgent]);
      expect(mockAgents.has('agent4')).toBe(true);
      expect(mockAgents.size).toBe(4);
    });

    it('should update available agents without description', async () => {
      const agentWithoutDescription = new MockSnakAgent('agent-no-desc') as any;
      await agentSelector.updateAvailableAgents(['agent-no-desc', agentWithoutDescription]);
      expect(mockAgents.has('agent-no-desc')).toBe(true);
      expect(mockAgents.size).toBe(4);
      mockModel.invoke.mockResolvedValueOnce(llmOk('agent-no-desc'));
      const result = await agentSelector.execute('Some request');
      expect(result.getAgentConfig().name).toBe('agent-no-desc');
    });
  });

  describe('agent selection', () => {
    beforeEach(async () => {
      await agentSelector.init();
    });

    it.each([
      {
        llmContent: 'agent1',
        expectedAgent: 'agent1',
        description: 'blockchain operations',
      },
      {
        llmContent: 'agent2',
        expectedAgent: 'agent2',
        description: 'configuration management',
      },
      {
        llmContent: 'agent3',
        expectedAgent: 'agent3',
        description: 'MCP operations',
      },
    ])(
      'should select $expectedAgent for $description',
      async ({ llmContent, expectedAgent }) => {
        mockModel.invoke.mockResolvedValueOnce(llmOk(llmContent));
        const result = await agentSelector.execute('Some request');
        expect(result.getAgentConfig().name).toBe(expectedAgent);
        expect(mockModel.invoke).toHaveBeenCalledTimes(1);
      }
    );

    it.each([
      { content: '', description: 'empty content' },
      { content: ' \n', description: 'whitespace-only content' },
      { content: { complex: 'object' }, description: 'complex object' },
    ])('should handle $description', async ({ content }) => {
      mockModel.invoke.mockResolvedValueOnce(llmOk(content));
      if (typeof content === 'string' && content.trim() === '') {
        await expect(agentSelector.execute('Some request')).rejects.toThrow(
          'No matching agent found'
        );
      } else {
        await expect(agentSelector.execute('Some request')).rejects.toThrow(
          'AgentSelector did not return a valid string response'
        );
      }
    });

    it('should throw error when LLM returns non-existent agent', async () => {
      mockModel.invoke.mockResolvedValueOnce(llmOk('non-existent-agent'));
      await expect(agentSelector.execute('Some request')).rejects.toThrow(
        'No matching agent found'
      );
    });

    it('should handle LLM invocation errors', async () => {
      mockModel.invoke.mockRejectedValueOnce(llmErr('LLM service unavailable'));
      await expect(agentSelector.execute('Some request')).rejects.toThrow(
        'AgentSelector execution failed: LLM service unavailable'
      );
    });
  });

  describe('edge cases', () => {
    beforeEach(async () => {
      await agentSelector.init();
    });

    it('should handle case-insensitive agent name matching', async () => {
      mockModel.invoke.mockResolvedValueOnce(llmOk('AGENT1'));
      await expect(agentSelector.execute('Some request')).rejects.toThrow(
        'No matching agent found'
      );
    });

    it('should handle special characters in agent names', async () => {
      const specialAgent = new MockSnakAgent(
        'agent-special',
        'Handles special operations'
      ) as any;
      mockAgents.set('agent-special', specialAgent);
      mockModel.invoke.mockResolvedValueOnce(llmOk('agent-special'));
      const result = await agentSelector.execute('Special operation request');
      expect(result.getAgentConfig().name).toBe('agent-special');
    });
  });
});
