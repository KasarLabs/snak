import {
  AgentSelector,
  AgentConfigResolver,
  AgentBuilder,
} from '../agentSelector.js';
import { agentSelectorPromptContent } from '@prompts/core/prompts.js';
import { AgentConfig } from '@snakagent/core';

jest.mock('@prompts/core/prompts.js', () => ({
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
      profile: {
        name: this.mockName,
        description: this.mockDescription,
      },
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

// Helper functions
const llmOk = (content: any) => ({
  content,
  _getType: () => 'ai',
  usage_metadata: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
});

const llmErr = (msg = 'LLM error') => new Error(msg);

function makeAgentConfigs(): AgentConfig.OutputWithId[] {
  return [
    {
      id: 'agent1-id',
      user_id: 'user1',
      profile: {
        name: 'agent1',
        description: 'Handles blockchain operations',
        group: 'test',
      },
      prompts_id: 'prompts1',
      graph: {} as any,
      memory: {} as any,
      rag: {} as any,
      mcp_servers: [],
      created_at: new Date(),
      updated_at: new Date(),
    },
    {
      id: 'agent2-id',
      user_id: 'user1',
      profile: {
        name: 'agent2',
        description: 'Handles configuration management',
        group: 'test',
      },
      prompts_id: 'prompts2',
      graph: {} as any,
      memory: {} as any,
      rag: {} as any,
      mcp_servers: [],
      created_at: new Date(),
      updated_at: new Date(),
    },
    {
      id: 'agent3-id',
      user_id: 'user1',
      profile: {
        name: 'agent3',
        description: 'Handles MCP operations',
        group: 'test',
      },
      prompts_id: 'prompts3',
      graph: {} as any,
      memory: {} as any,
      rag: {} as any,
      mcp_servers: [],
      created_at: new Date(),
      updated_at: new Date(),
    },
  ];
}

function makeAgentConfigsForMultipleUsers(): AgentConfig.OutputWithId[] {
  return [
    {
      id: 'agent1-id',
      user_id: 'user1',
      profile: {
        name: 'agent1',
        description: 'Handles blockchain operations',
        group: 'test',
      },
      prompts_id: 'prompts1',
      graph: {} as any,
      memory: {} as any,
      rag: {} as any,
      mcp_servers: [],
      created_at: new Date(),
      updated_at: new Date(),
    },
    {
      id: 'agent2-id',
      user_id: 'user1',
      profile: {
        name: 'agent2',
        description: 'Handles configuration management',
        group: 'test',
      },
      prompts_id: 'prompts2',
      graph: {} as any,
      memory: {} as any,
      rag: {} as any,
      mcp_servers: [],
      created_at: new Date(),
      updated_at: new Date(),
    },
    {
      id: 'agent3-id',
      user_id: 'user2',
      profile: {
        name: 'agent3',
        description: 'Handles blockchain operations for user2',
        group: 'test',
      },
      prompts_id: 'prompts3',
      graph: {} as any,
      memory: {} as any,
      rag: {} as any,
      mcp_servers: [],
      created_at: new Date(),
      updated_at: new Date(),
    },
    {
      id: 'agent4-id',
      user_id: 'user2',
      profile: {
        name: 'agent4',
        description: 'Handles MCP operations for user2',
        group: 'test',
      },
      prompts_id: 'prompts4',
      graph: {} as any,
      memory: {} as any,
      rag: {} as any,
      mcp_servers: [],
      created_at: new Date(),
      updated_at: new Date(),
    },
  ];
}

describe('AgentSelector', () => {
  let agentSelector: AgentSelector;
  let mockAgentConfigs: AgentConfig.OutputWithId[];
  let mockModel: any;
  let mockAgentConfigResolver: jest.MockedFunction<AgentConfigResolver>;
  let mockAgentBuilder: jest.MockedFunction<AgentBuilder>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAgentConfigs = makeAgentConfigs();
    mockModel = { invoke: jest.fn() };

    mockAgentConfigResolver = jest.fn(async (userId: string) => {
      return mockAgentConfigs.filter((cfg) => cfg.user_id === userId);
    });

    mockAgentBuilder = jest.fn(async (config: AgentConfig.OutputWithId) => {
      return new MockSnakAgent(
        config.profile.name,
        config.profile.description
      ) as any;
    });

    agentSelector = new AgentSelector(
      mockAgentConfigResolver,
      mockAgentBuilder,
      mockModel as any
    );
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await agentSelector.init();
      // Should not throw error
      expect(agentSelector).toBeDefined();
    });

    it('should handle initialization without model', async () => {
      const agentSelectorWithoutModel = new AgentSelector(
        mockAgentConfigResolver,
        mockAgentBuilder,
        null as any
      );
      await agentSelectorWithoutModel.init();
      // Should not throw error
    });

    it('should handle agents without description', async () => {
      const configsWithoutDesc: AgentConfig.OutputWithId[] = [
        {
          id: 'agent-no-desc-id',
          user_id: 'user1',
          profile: {
            name: 'agent-no-desc',
            description: undefined as any,
            group: 'test',
          },
          prompts_id: 'prompts1',
          graph: {} as any,
          memory: {} as any,
          rag: {} as any,
          mcp_servers: [],
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      const resolverNoDesc = jest.fn(async () => configsWithoutDesc);
      const builderNoDesc = jest.fn(
        async (config) =>
          new MockSnakAgent(
            config.profile.name,
            config.profile.description
          ) as any
      );

      const agentSelectorNoDesc = new AgentSelector(
        resolverNoDesc,
        builderNoDesc,
        mockModel as any
      );

      await agentSelectorNoDesc.init();
      mockModel.invoke.mockResolvedValueOnce(llmOk('agent-no-desc'));
      await agentSelectorNoDesc.execute('Request', false, { userId: 'user1' });
      expect(agentSelectorPromptContent).toHaveBeenCalled();
    });
  });

  describe('agent resolution', () => {
    beforeEach(async () => {
      await agentSelector.init();
    });

    it('should resolve agent configs for a specific user', async () => {
      const configs = await mockAgentConfigResolver('user1');
      expect(configs).toHaveLength(3);
      expect(configs.every((cfg) => cfg.user_id === 'user1')).toBe(true);
    });

    it('should build agent from config', async () => {
      const config = mockAgentConfigs[0];
      const agent = await mockAgentBuilder(config);
      expect(agent.getAgentConfig().profile.name).toBe('agent1');
      expect(agent.getAgentConfig().profile.description).toBe(
        'Handles blockchain operations'
      );
    });

    it('should handle multiple users with unique agent names', async () => {
      const multiUserConfigs = makeAgentConfigsForMultipleUsers();
      const multiUserResolver = jest.fn(async (userId: string) => {
        return multiUserConfigs.filter((cfg) => cfg.user_id === userId);
      });
      const multiUserBuilder = jest.fn(
        async (config: AgentConfig.OutputWithId) => {
          return new MockSnakAgent(
            config.profile.name,
            config.profile.description
          ) as any;
        }
      );
      const multiUserAgentSelector = new AgentSelector(
        multiUserResolver,
        multiUserBuilder,
        mockModel as any
      );
      await multiUserAgentSelector.init();

      // Test user1 agents
      mockModel.invoke.mockResolvedValueOnce(llmOk('agent1'));
      const resultUser1 = await multiUserAgentSelector.execute(
        'Request',
        false,
        { userId: 'user1' }
      );
      expect(resultUser1.getAgentConfig().profile.name).toBe('agent1');
      expect(resultUser1.getAgentConfig().profile.description).toBe(
        'Handles blockchain operations'
      );

      // Test user2 agents
      mockModel.invoke.mockResolvedValueOnce(llmOk('agent3'));
      const resultUser2 = await multiUserAgentSelector.execute(
        'Request',
        false,
        { userId: 'user2' }
      );
      expect(resultUser2.getAgentConfig().profile.name).toBe('agent3');
      expect(resultUser2.getAgentConfig().profile.description).toBe(
        'Handles blockchain operations for user2'
      );
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
        const result = await agentSelector.execute('Some request', false, {
          userId: 'user1',
        });
        expect(result.getAgentConfig().profile.name).toBe(expectedAgent);
        expect(mockModel.invoke).toHaveBeenCalledTimes(1);
        expect(mockAgentBuilder).toHaveBeenCalledTimes(1);
      }
    );

    it.each([
      { content: '', description: 'empty content' },
      { content: ' \n', description: 'whitespace-only content' },
      { content: { complex: 'object' }, description: 'complex object' },
    ])('should handle $description', async ({ content }) => {
      mockModel.invoke.mockResolvedValueOnce(llmOk(content));
      if (typeof content === 'string' && content.trim() === '') {
        await expect(
          agentSelector.execute('Some request', false, { userId: 'user1' })
        ).rejects.toThrow('No matching agent found');
      } else {
        await expect(
          agentSelector.execute('Some request', false, { userId: 'user1' })
        ).rejects.toThrow(
          'AgentSelector did not return a valid string response'
        );
      }
    });

    it('should throw error when LLM returns non-existent agent', async () => {
      mockModel.invoke.mockResolvedValueOnce(llmOk('non-existent-agent'));
      await expect(
        agentSelector.execute('Some request', false, { userId: 'user1' })
      ).rejects.toThrow('No matching agent found');
    });

    it('should handle LLM invocation errors', async () => {
      mockModel.invoke.mockRejectedValueOnce(llmErr('LLM service unavailable'));
      await expect(
        agentSelector.execute('Some request', false, { userId: 'user1' })
      ).rejects.toThrow(
        'AgentSelector execution failed: LLM service unavailable'
      );
    });

    it('should throw error when config is not provided', async () => {
      await expect(agentSelector.execute('Some request')).rejects.toThrow(
        'AgentSelector: config parameter is required'
      );
    });

    it('should throw error when userId is not provided in config', async () => {
      await expect(
        agentSelector.execute('Some request', false, {})
      ).rejects.toThrow(
        'AgentSelector: userId is required in config parameter'
      );
    });

    it('should filter agents by userId correctly', async () => {
      const multiUserConfigs = makeAgentConfigsForMultipleUsers();
      const multiUserResolver = jest.fn(async (userId: string) => {
        return multiUserConfigs.filter((cfg) => cfg.user_id === userId);
      });
      const multiUserBuilder = jest.fn(
        async (config: AgentConfig.OutputWithId) => {
          return new MockSnakAgent(
            config.profile.name,
            config.profile.description
          ) as any;
        }
      );
      const multiUserAgentSelector = new AgentSelector(
        multiUserResolver,
        multiUserBuilder,
        mockModel as any
      );
      await multiUserAgentSelector.init();

      mockModel.invoke.mockResolvedValueOnce(llmOk('agent2'));
      const result = await multiUserAgentSelector.execute('Request', false, {
        userId: 'user1',
      });
      expect(result.getAgentConfig().profile.name).toBe('agent2');

      mockModel.invoke.mockResolvedValueOnce(llmOk('agent2'));
      await expect(
        multiUserAgentSelector.execute('Request', false, { userId: 'user2' })
      ).rejects.toThrow('No matching agent found');
    });

    it('should only build the selected agent', async () => {
      mockModel.invoke.mockResolvedValueOnce(llmOk('agent2'));
      await agentSelector.execute('Some request', false, { userId: 'user1' });

      // Should resolve configs for user1
      expect(mockAgentConfigResolver).toHaveBeenCalledWith('user1');

      // Should only build agent2, not all agents
      expect(mockAgentBuilder).toHaveBeenCalledTimes(1);
      expect(mockAgentBuilder).toHaveBeenCalledWith(
        expect.objectContaining({
          profile: expect.objectContaining({ name: 'agent2' }),
        })
      );
    });
  });

  describe('edge cases', () => {
    beforeEach(async () => {
      await agentSelector.init();
    });

    it('should reject case-mismatched agent names', async () => {
      mockModel.invoke.mockResolvedValueOnce(llmOk('AGENT1'));
      await expect(
        agentSelector.execute('Some request', false, { userId: 'user1' })
      ).rejects.toThrow('No matching agent found');
    });

    it('should handle special characters in agent names', async () => {
      const specialConfig: AgentConfig.OutputWithId = {
        id: 'agent-special-id',
        user_id: 'user1',
        profile: {
          name: 'agent-special',
          description: 'Handles special operations',
          group: 'test',
        },
        prompts_id: 'prompts-special',
        graph: {} as any,
        memory: {} as any,
        rag: {} as any,
        mcp_servers: [],
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockAgentConfigs.push(specialConfig);

      mockModel.invoke.mockResolvedValueOnce(llmOk('agent-special'));
      const result = await agentSelector.execute(
        'Special operation request',
        false,
        { userId: 'user1' }
      );
      expect(result.getAgentConfig().profile.name).toBe('agent-special');
    });

    it('should handle empty userId in config', async () => {
      await expect(
        agentSelector.execute('Some request', false, { userId: '' })
      ).rejects.toThrow(
        'AgentSelector: userId is required in config parameter'
      );
    });

    it('should handle undefined userId in config', async () => {
      await expect(
        agentSelector.execute('Some request', false, { userId: undefined })
      ).rejects.toThrow(
        'AgentSelector: userId is required in config parameter'
      );
    });

    it('should throw error when no agents found for user', async () => {
      const emptyResolver = jest.fn(async () => []);
      const emptyBuilder = jest.fn();
      const emptySelectorAgent = new AgentSelector(
        emptyResolver,
        emptyBuilder,
        mockModel as any
      );

      await emptySelectorAgent.init();
      await expect(
        emptySelectorAgent.execute('Some request', false, {
          userId: 'user-no-agents',
        })
      ).rejects.toThrow('No agents found for user');
    });
  });
});
