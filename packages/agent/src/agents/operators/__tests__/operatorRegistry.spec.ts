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
  let mockAgent1: MockAgent;
  let mockAgent2: MockAgent;
  let mockAgent3: MockAgent;

  beforeEach(() => {
    // Clear the singleton instance before each test
    OperatorRegistry.resetForTesting();

    // Get a fresh instance
    registry = OperatorRegistry.getInstance();

    // Create mock agents
    mockAgent1 = new MockAgent('agent1', AgentType.OPERATOR, 'Test agent 1');
    mockAgent2 = new MockAgent('agent2', AgentType.OPERATOR, 'Test agent 2');
    mockAgent3 = new MockAgent('agent3', AgentType.OPERATOR, 'Test agent 3');
  });

  afterEach(() => {
    // Clear the registry after each test
    registry.clear();
  });

  describe('getInstance', () => {
    it('should return the same instance (singleton pattern)', () => {
      const instance1 = OperatorRegistry.getInstance();
      const instance2 = OperatorRegistry.getInstance();

      expect(instance1).toBe(instance2);
      expect(instance1).toBeInstanceOf(OperatorRegistry);
    });
  });

  describe('register', () => {
    it('should register a new agent successfully', () => {
      registry.register('agent1', mockAgent1);

      expect(registry.getAgent('agent1')).toBe(mockAgent1);
      expect(registry.size()).toBe(1);
    });

    it('should overwrite existing agent when registering with same ID', () => {
      registry.register('agent1', mockAgent1);
      registry.register('agent1', mockAgent2);

      expect(registry.getAgent('agent1')).toBe(mockAgent2);
      expect(registry.size()).toBe(1);
    });

    it('should register multiple agents', () => {
      registry.register('agent1', mockAgent1);
      registry.register('agent2', mockAgent2);
      registry.register('agent3', mockAgent3);

      expect(registry.getAgent('agent1')).toBe(mockAgent1);
      expect(registry.getAgent('agent2')).toBe(mockAgent2);
      expect(registry.getAgent('agent3')).toBe(mockAgent3);
      expect(registry.size()).toBe(3);
    });
  });

  describe('unregister', () => {
    beforeEach(() => {
      registry.register('agent1', mockAgent1);
      registry.register('agent2', mockAgent2);
    });

    it('should unregister an existing agent successfully', () => {
      const result = registry.unregister('agent1');

      expect(result).toBe(true);
      expect(registry.getAgent('agent1')).toBeUndefined();
      expect(registry.getAgent('agent2')).toBe(mockAgent2);
      expect(registry.size()).toBe(1);
    });

    it('should return false when trying to unregister non-existent agent', () => {
      const result = registry.unregister('non-existent');

      expect(result).toBe(false);
      expect(registry.size()).toBe(2);
    });

    it('should handle unregistering the same agent multiple times', () => {
      registry.unregister('agent1');
      const result = registry.unregister('agent1');

      expect(result).toBe(false);
      expect(registry.size()).toBe(1);
    });
  });

  describe('getAgent', () => {
    beforeEach(() => {
      registry.register('agent1', mockAgent1);
    });

    it('should return the correct agent for existing ID', () => {
      const agent = registry.getAgent('agent1');

      expect(agent).toBe(mockAgent1);
      expect(agent?.id).toBe('agent1');
    });

    it('should return undefined for non-existent agent ID', () => {
      const agent = registry.getAgent('non-existent');

      expect(agent).toBeUndefined();
    });
  });

  describe('getAllAgents', () => {
    beforeEach(() => {
      registry.register('agent1', mockAgent1);
      registry.register('agent2', mockAgent2);
      registry.register('agent3', mockAgent3);
    });

    it('should return all registered agents as a record', () => {
      const allAgents = registry.getAllAgents();

      expect(allAgents).toEqual({
        agent1: mockAgent1,
        agent2: mockAgent2,
        agent3: mockAgent3,
      });
    });

    it('should return empty record when no agents are registered', () => {
      registry.clear();
      const allAgents = registry.getAllAgents();

      expect(allAgents).toEqual({});
    });
  });

  describe('size', () => {
    it('should return 0 for empty registry', () => {
      expect(registry.size()).toBe(0);
    });

    it('should return correct count after registering agents', () => {
      registry.register('agent1', mockAgent1);
      expect(registry.size()).toBe(1);

      registry.register('agent2', mockAgent2);
      expect(registry.size()).toBe(2);

      registry.register('agent3', mockAgent3);
      expect(registry.size()).toBe(3);
    });

    it('should return correct count after unregistering agents', () => {
      registry.register('agent1', mockAgent1);
      registry.register('agent2', mockAgent2);
      registry.register('agent3', mockAgent3);

      expect(registry.size()).toBe(3);

      registry.unregister('agent2');
      expect(registry.size()).toBe(2);

      registry.unregister('agent1');
      expect(registry.size()).toBe(1);
    });
  });

  describe('clear', () => {
    beforeEach(() => {
      registry.register('agent1', mockAgent1);
      registry.register('agent2', mockAgent2);
      registry.register('agent3', mockAgent3);
    });

    it('should remove all agents from registry', () => {
      expect(registry.size()).toBe(3);

      registry.clear();

      expect(registry.size()).toBe(0);
      expect(registry.getAgent('agent1')).toBeUndefined();
      expect(registry.getAgent('agent2')).toBeUndefined();
      expect(registry.getAgent('agent3')).toBeUndefined();
    });

    it('should work on already empty registry', () => {
      registry.clear();

      expect(registry.size()).toBe(0);

      registry.clear();

      expect(registry.size()).toBe(0);
    });
  });

  describe('integration tests', () => {
    it('should handle complete lifecycle of agents', async () => {
      // Register agents
      registry.register('agent1', mockAgent1);
      registry.register('agent2', mockAgent2);

      expect(registry.size()).toBe(2);
      expect(registry.getAgent('agent1')).toBe(mockAgent1);
      expect(registry.getAgent('agent2')).toBe(mockAgent2);

      // Test agent execution
      const result1 = await mockAgent1.execute('test input');
      expect(result1).toEqual({
        result: 'Mock agent agent1 executed with input: test input',
      });

      // Unregister one agent
      const unregisterResult = registry.unregister('agent1');
      expect(unregisterResult).toBe(true);
      expect(registry.size()).toBe(1);
      expect(registry.getAgent('agent1')).toBeUndefined();
      expect(registry.getAgent('agent2')).toBe(mockAgent2);

      // Register a new agent
      registry.register('agent3', mockAgent3);
      expect(registry.size()).toBe(2);

      // Clear all
      registry.clear();
      expect(registry.size()).toBe(0);
    });

    it('should maintain singleton behavior across operations', () => {
      const instance1 = OperatorRegistry.getInstance();
      instance1.register('agent1', mockAgent1);

      const instance2 = OperatorRegistry.getInstance();
      expect(instance2.getAgent('agent1')).toBe(mockAgent1);
      expect(instance2.size()).toBe(1);

      instance2.register('agent2', mockAgent2);
      expect(instance1.size()).toBe(2);
      expect(instance1.getAgent('agent2')).toBe(mockAgent2);
    });
  });
});
