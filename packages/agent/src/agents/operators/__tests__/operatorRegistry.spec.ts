import { OperatorRegistry } from '../operatorRegistry.js';
import { IAgent, AgentType } from '../../core/baseAgent.js';

// Mock the logger from @snakagent/core
jest.mock('@snakagent/core', () => ({
  logger: {
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock agent class for testing
class MockAgent implements IAgent {
  readonly id: string;
  readonly type: AgentType;
  readonly description?: string;

  constructor(
    id: string,
    type: AgentType = AgentType.OPERATOR,
    description?: string
  ) {
    this.id = id;
    this.type = type;
    this.description = description;
  }

  async init(): Promise<void> {
    // Mock implementation
  }

  async execute(
    input: any,
    isInterrupted?: boolean,
    config?: Record<string, any>
  ): Promise<any> {
    return { result: `Mock agent ${this.id} executed with input: ${input}` };
  }
}

describe('OperatorRegistry', () => {
  let registry: OperatorRegistry;

  // Factory functions for consistent test data
  const createAgent = (id: string, description?: string) =>
    new MockAgent(id, AgentType.OPERATOR, description);

  const createAgents = () => ({
    agent1: createAgent('agent1', 'Test agent 1'),
    agent2: createAgent('agent2', 'Test agent 2'),
    agent3: createAgent('agent3', 'Test agent 3'),
  });

  beforeEach(() => {
    // Clear any existing registry state by clearing all agents
    const existingRegistry = OperatorRegistry.getInstance();
    existingRegistry.clear();
    registry = OperatorRegistry.getInstance();
  });

  afterEach(() => {
    registry.clear();
  });

  describe('singleton behavior', () => {
    it('should return the same instance', () => {
      const instance1 = OperatorRegistry.getInstance();
      const instance2 = OperatorRegistry.getInstance();

      expect(instance1).toBe(instance2);
      expect(instance1).toBeInstanceOf(OperatorRegistry);
    });

    it('should maintain state across instances', () => {
      const agent = createAgent('test');
      const instance1 = OperatorRegistry.getInstance();
      instance1.register('test', agent);

      const instance2 = OperatorRegistry.getInstance();
      expect(instance2.getAgent('test')).toBe(agent);
    });
  });

  describe('register', () => {
    it.each([
      ['single agent', 1, ['agent1']],
      ['multiple agents', 3, ['agent1', 'agent2', 'agent3']],
    ])('should register %s successfully', (_, expectedSize, agentIds) => {
      const agents = createAgents();

      agentIds.forEach((id) =>
        registry.register(id, agents[id as keyof typeof agents])
      );

      expect(registry.size()).toBe(expectedSize);
      agentIds.forEach((id) => {
        expect(registry.getAgent(id)).toBe(agents[id as keyof typeof agents]);
      });
    });

    it('should overwrite existing agent with same ID', () => {
      const agent1 = createAgent('same-id');
      const agent2 = createAgent('same-id');

      registry.register('same-id', agent1);
      registry.register('same-id', agent2);

      expect(registry.getAgent('same-id')).toBe(agent2);
      expect(registry.size()).toBe(1);
    });
  });

  describe('unregister', () => {
    it.each([
      ['existing agent', 'agent1', true, 0],
      ['non-existent agent', 'missing', false, 1],
    ])(
      'should handle %s correctly',
      (_, agentId, expectedResult, expectedSize) => {
        registry.register('agent1', createAgent('agent1'));

        const result = registry.unregister(agentId);

        expect(result).toBe(expectedResult);
        expect(registry.size()).toBe(expectedSize);
      }
    );

    it('should handle multiple unregister attempts', () => {
      const agent = createAgent('test');
      registry.register('test', agent);

      expect(registry.unregister('test')).toBe(true);
      expect(registry.unregister('test')).toBe(false);
      expect(registry.size()).toBe(0);
    });
  });

  describe('getAgent', () => {
    it.each([
      ['existing agent', 'agent1', (agent: MockAgent) => agent],
      ['non-existent agent', 'missing', () => undefined],
    ])(
      'should return correct result for %s',
      (_, agentId, expectedTransform) => {
        const agent = createAgent('agent1');
        registry.register('agent1', agent);

        const result = registry.getAgent(agentId);
        const expected = expectedTransform(agent);

        expect(result).toBe(expected);
      }
    );
  });

  describe('getAllAgents', () => {
    it('should return all registered agents as record', () => {
      const agents = createAgents();
      Object.entries(agents).forEach(([id, agent]) =>
        registry.register(id, agent)
      );

      const result = registry.getAllAgents();

      expect(result).toEqual(agents);
    });

    it('should return empty record when no agents registered', () => {
      expect(registry.getAllAgents()).toEqual({});
    });
  });

  describe('size and clear', () => {
    it.each([
      [0, []],
      [1, ['agent1']],
      [3, ['agent1', 'agent2', 'agent3']],
    ])('should return size %d for %j agents', (expectedSize, agentIds) => {
      const agents = createAgents();
      agentIds.forEach((id) =>
        registry.register(id, agents[id as keyof typeof agents])
      );

      expect(registry.size()).toBe(expectedSize);
    });

    it('should clear all agents and reset size', () => {
      const agents = createAgents();
      Object.entries(agents).forEach(([id, agent]) =>
        registry.register(id, agent)
      );

      expect(registry.size()).toBe(3);
      registry.clear();

      expect(registry.size()).toBe(0);
      expect(registry.getAllAgents()).toEqual({});
    });

    it('should handle clear on empty registry', () => {
      registry.clear();
      expect(registry.size()).toBe(0);

      registry.clear();
      expect(registry.size()).toBe(0);
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete agent lifecycle', async () => {
      const agent1 = createAgent('test1');
      const agent2 = createAgent('test2');

      // Register
      registry.register('test1', agent1);
      registry.register('test2', agent2);
      expect(registry.size()).toBe(2);

      // Execute
      const result = await agent1.execute('test input');
      expect(result.result).toBe(
        'Mock agent test1 executed with input: test input'
      );

      // Unregister
      expect(registry.unregister('test1')).toBe(true);
      expect(registry.size()).toBe(1);
      expect(registry.getAgent('test1')).toBeUndefined();
      expect(registry.getAgent('test2')).toBe(agent2);

      // Clear
      registry.clear();
      expect(registry.size()).toBe(0);
    });
  });
});
