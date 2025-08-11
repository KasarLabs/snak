import { AgentSelector } from '../agentSelector.js';

// Mock the prompts
jest.mock('../../../prompt/prompts', () => ({
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
  private mockDescription: string;

  constructor(name: string, description: string) {
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

describe('AgentSelector', () => {
  let agentSelector: AgentSelector;
  let modelSelector: any;
  let mockAgents: Map<string, any>;
  let mockModel: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock agents
    mockAgents = new Map();
    mockAgents.set(
      'agent1',
      new MockSnakAgent('agent1', 'Handles blockchain operations')
    );
    mockAgents.set(
      'agent2',
      new MockSnakAgent('agent2', 'Handles configuration management')
    );
    mockAgents.set(
      'agent3',
      new MockSnakAgent('agent3', 'Handles MCP operations')
    );

    // Create mock model selector
    modelSelector = new MockModelSelector();
    mockModel = modelSelector.getMockModel();

    // Create agent selector
    agentSelector = new AgentSelector({
      availableAgents: mockAgents,
      modelSelector,
      debug: true,
    });
  });

  describe('initialization', () => {
    it('should initialize with available agents', async () => {
      await agentSelector.init();

      // Verify that agents are properly initialized
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
  });

  describe('agent management', () => {
    beforeEach(async () => {
      await agentSelector.init();
    });

    it('should remove an agent successfully', async () => {
      await agentSelector.removeAgent('agent1');

      // Verify agent is removed
      expect(mockAgents.has('agent1')).toBe(false);
      expect(mockAgents.size).toBe(2);
    });

    it('should handle removing non-existent agent', async () => {
      await agentSelector.removeAgent('non-existent');

      // Should not throw error and agents should remain unchanged
      expect(mockAgents.size).toBe(3);
    });

    it('should update available agents', async () => {
      const newAgent: any = new MockSnakAgent(
        'agent4',
        'Handles new operations'
      );

      await agentSelector.updateAvailableAgents(['agent4', newAgent]);

      // Verify new agent is added
      expect(mockAgents.has('agent4')).toBe(true);
      expect(mockAgents.size).toBe(4);
    });
  });

  describe('agent selection', () => {
    beforeEach(async () => {
      await agentSelector.init();
    });

    it('should select the correct agent based on LLM response', async () => {
      // Mock LLM response to return 'agent1'
      mockModel.invoke.mockResolvedValueOnce({
        content: 'agent1',
        _getType: () => 'ai',
        usage_metadata: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
      });

      const result = await agentSelector.execute(
        'I need to perform blockchain operations'
      );

      expect(result).toBeDefined();
      expect(result.getAgentConfig().name).toBe('agent1');
      expect(mockModel.invoke).toHaveBeenCalledTimes(1);
    });

    it('should select agent2 for configuration requests', async () => {
      // Mock LLM response to return 'agent2'
      mockModel.invoke.mockResolvedValueOnce({
        content: 'agent2',
        _getType: () => 'ai',
        usage_metadata: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
      });

      const result = await agentSelector.execute(
        'I need to change my configuration'
      );

      expect(result).toBeDefined();
      expect(result.getAgentConfig().name).toBe('agent2');
    });

    it('should select agent3 for MCP operations', async () => {
      // Mock LLM response to return 'agent3'
      mockModel.invoke.mockResolvedValueOnce({
        content: 'agent3',
        _getType: () => 'ai',
        usage_metadata: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
      });

      const result = await agentSelector.execute(
        'I need to manage MCP servers'
      );

      expect(result).toBeDefined();
      expect(result.getAgentConfig().name).toBe('agent3');
    });

    it('should throw error when LLM returns non-existent agent', async () => {
      // Mock LLM response to return non-existent agent
      mockModel.invoke.mockResolvedValueOnce({
        content: 'non-existent-agent',
        _getType: () => 'ai',
        usage_metadata: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
      });

      await expect(agentSelector.execute('Some request')).rejects.toThrow(
        'No matching agent found'
      );
    });

    it('should throw error when LLM returns invalid response format', async () => {
      // Mock LLM response with invalid format
      mockModel.invoke.mockResolvedValueOnce({
        content: { complex: 'object' }, // Not a string
        _getType: () => 'ai',
        usage_metadata: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
      });

      await expect(agentSelector.execute('Some request')).rejects.toThrow(
        'AgentSelector did not return a valid string response'
      );
    });

    it('should handle LLM invocation errors', async () => {
      // Mock LLM to throw an error
      mockModel.invoke.mockRejectedValueOnce(
        new Error('LLM service unavailable')
      );

      await expect(agentSelector.execute('Some request')).rejects.toThrow(
        'AgentSelector execution failed: LLM service unavailable'
      );
    });

    it('should handle empty response content', async () => {
      // Mock LLM response with empty content
      mockModel.invoke.mockResolvedValueOnce({
        content: '',
        _getType: () => 'ai',
        usage_metadata: { input_tokens: 1, output_tokens: 0, total_tokens: 1 },
      });

      await expect(agentSelector.execute('Some request')).rejects.toThrow(
        'No matching agent found'
      );
    });

    it('should handle whitespace-only response content', async () => {
      // Mock LLM response with whitespace-only content
      mockModel.invoke.mockResolvedValueOnce({
        content: '   \n\t   ',
        _getType: () => 'ai',
        usage_metadata: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
      });

      await expect(agentSelector.execute('Some request')).rejects.toThrow(
        'No matching agent found'
      );
    });
  });

  describe('edge cases', () => {
    beforeEach(async () => {
      await agentSelector.init();
    });

    it('should handle case-insensitive agent name matching', async () => {
      // Mock LLM response with different case
      mockModel.invoke.mockResolvedValueOnce({
        content: 'AGENT1',
        _getType: () => 'ai',
        usage_metadata: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
      });

      await expect(agentSelector.execute('Some request')).rejects.toThrow(
        'No matching agent found'
      );
    });

    it('should handle special characters in agent names', async () => {
      // Add agent with special characters
      const specialAgent: any = new MockSnakAgent(
        'agent-special',
        'Handles special operations'
      );
      mockAgents.set('agent-special', specialAgent);

      // Mock LLM response
      mockModel.invoke.mockResolvedValueOnce({
        content: 'agent-special',
        _getType: () => 'ai',
        usage_metadata: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
      });

      const result = await agentSelector.execute('Special operation request');

      expect(result.getAgentConfig().name).toBe('agent-special');
    });
  });
});
