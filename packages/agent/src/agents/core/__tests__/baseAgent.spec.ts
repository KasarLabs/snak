import {
  BaseAgent,
  AgentType,
  IAgent,
  IModelAgent,
  AgentMessage,
} from '../baseAgent.js';
import { BaseMessage } from '@langchain/core/messages';

// Mock the logger from @snakagent/core
jest.mock('@snakagent/core', () => ({
  logger: {
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}));

// Mock StreamChunk interface
interface StreamChunk {
  event: string;
  data: any;
}

// Concrete implementation of BaseAgent for testing
class TestAgent extends BaseAgent {
  constructor(
    id: string,
    type: AgentType = AgentType.OPERATOR,
    description?: string
  ) {
    super(id, type, description);
  }

  async init(): Promise<void> {
    // Mock implementation
  }

  async execute(
    input: any,
    isInterrupted?: boolean,
    config?: Record<string, any>
  ): Promise<any> {
    return { result: `Test agent ${this.id} executed with input: ${input}` };
  }
}

// Concrete implementation of IModelAgent for testing
class TestModelAgent extends BaseAgent implements IModelAgent {
  constructor(
    id: string,
    type: AgentType = AgentType.OPERATOR,
    description?: string
  ) {
    super(id, type, description);
  }

  async init(): Promise<void> {
    // Mock implementation
  }

  async execute(
    input: any,
    isInterrupted?: boolean,
    config?: Record<string, any>
  ): Promise<any> {
    return { result: `Model agent ${this.id} executed with input: ${input}` };
  }

  async invokeModel(
    messages: BaseMessage[],
    forceModelType?: string
  ): Promise<any> {
    return {
      modelResult: `Model invoked with ${messages.length} messages`,
      forceModelType,
    };
  }
}

describe('baseAgent', () => {
  describe('AgentType enum', () => {
    it('should have correct values', () => {
      expect(AgentType.SUPERVISOR).toBe('supervisor');
      expect(AgentType.OPERATOR).toBe('operator');
      expect(AgentType.SNAK).toBe('snak');
    });
  });

  describe('IAgent interface', () => {
    it('should be implemented correctly by TestAgent', () => {
      const agent: IAgent = new TestAgent(
        'test-agent',
        AgentType.OPERATOR,
        'Test agent'
      );

      expect(agent.id).toBe('test-agent');
      expect(agent.type).toBe(AgentType.OPERATOR);
      expect(agent.description).toBe('Test agent');
      expect(typeof agent.init).toBe('function');
      expect(typeof agent.execute).toBe('function');
    });
  });

  describe('BaseAgent class', () => {
    let agent: TestAgent;

    beforeEach(() => {
      agent = new TestAgent('test-agent', AgentType.OPERATOR, 'Test agent');
    });

    describe('constructor', () => {
      it('should initialize with provided values', () => {
        expect(agent.id).toBe('test-agent');
        expect(agent.type).toBe(AgentType.OPERATOR);
        expect(agent.description).toBe('Test agent');
      });

      it('should use default description when not provided', () => {
        const agentWithoutDesc = new TestAgent(
          'test-agent',
          AgentType.OPERATOR
        );
        expect(agentWithoutDesc.description).toBe('No description');
      });

      it('should work with different agent types', () => {
        const supervisorAgent = new TestAgent(
          'supervisor-agent',
          AgentType.SUPERVISOR
        );
        const snakAgent = new TestAgent('snak-agent', AgentType.SNAK);

        expect(supervisorAgent.type).toBe(AgentType.SUPERVISOR);
        expect(snakAgent.type).toBe(AgentType.SNAK);
      });
    });

    describe('init method', () => {
      it('should be callable', async () => {
        await expect(agent.init()).resolves.toBeUndefined();
      });
    });

    describe('execute method', () => {
      it('should execute with input', async () => {
        const result = await agent.execute('test input');

        expect(result).toEqual({
          result: 'Test agent test-agent executed with input: test input',
        });
      });

      it('should execute with input and isInterrupted flag', async () => {
        const result = await agent.execute('test input', true);

        expect(result).toEqual({
          result: 'Test agent test-agent executed with input: test input',
        });
      });

      it('should execute with input, isInterrupted flag, and config', async () => {
        const config = { timeout: 5000 };
        const result = await agent.execute('test input', false, config);

        expect(result).toEqual({
          result: 'Test agent test-agent executed with input: test input',
        });
      });
    });

    describe('dispose method', () => {
      it('should have default implementation that resolves', async () => {
        await expect(agent.dispose()).resolves.toBeUndefined();
      });
    });
  });

  describe('IModelAgent interface', () => {
    let modelAgent: TestModelAgent;

    beforeEach(() => {
      modelAgent = new TestModelAgent(
        'model-agent',
        AgentType.OPERATOR,
        'Model agent'
      );
    });

    it('should implement IAgent interface', () => {
      const agent: IAgent = modelAgent;

      expect(agent.id).toBe('model-agent');
      expect(agent.type).toBe(AgentType.OPERATOR);
      expect(agent.description).toBe('Model agent');
      expect(typeof agent.init).toBe('function');
      expect(typeof agent.execute).toBe('function');
    });

    it('should implement invokeModel method', async () => {
      const messages: BaseMessage[] = [
        { _getType: () => 'human', content: 'Hello' } as BaseMessage,
        { _getType: () => 'ai', content: 'Hi there!' } as BaseMessage,
      ];

      const result = await modelAgent.invokeModel(messages);

      expect(result).toEqual({
        modelResult: 'Model invoked with 2 messages',
        forceModelType: undefined,
      });
    });

    it('should invoke model with forced model type', async () => {
      const messages: BaseMessage[] = [
        { _getType: () => 'human', content: 'Hello' } as BaseMessage,
      ];

      const result = await modelAgent.invokeModel(messages, 'gpt-4');

      expect(result).toEqual({
        modelResult: 'Model invoked with 1 messages',
        forceModelType: 'gpt-4',
      });
    });
  });

  describe('AgentMessage interface', () => {
    it('should have correct structure', () => {
      const message: AgentMessage = {
        from: 'agent1',
        to: 'agent2',
        content: 'Hello from agent1',
        metadata: { timestamp: Date.now() },
        modelType: 'gpt-4',
      };

      expect(message.from).toBe('agent1');
      expect(message.to).toBe('agent2');
      expect(message.content).toBe('Hello from agent1');
      expect(message.metadata).toBeDefined();
      expect(message.modelType).toBe('gpt-4');
    });

    it('should work with minimal required fields', () => {
      const message: AgentMessage = {
        from: 'agent1',
        to: 'agent2',
        content: 'Simple message',
      };

      expect(message.from).toBe('agent1');
      expect(message.to).toBe('agent2');
      expect(message.content).toBe('Simple message');
      expect(message.metadata).toBeUndefined();
      expect(message.modelType).toBeUndefined();
    });
  });

  describe('executeAsyncGenerator method', () => {
    it('should be optional on BaseAgent', () => {
      const agent = new TestAgent('test-agent');

      // The method is optional, so it might be undefined
      expect(typeof agent.executeAsyncGenerator).toBe('undefined');
    });
  });

  describe('Integration tests', () => {
    it('should work with different agent types in a system', async () => {
      const supervisor = new TestAgent(
        'supervisor',
        AgentType.SUPERVISOR,
        'Supervisor agent'
      );
      const operator = new TestAgent(
        'operator',
        AgentType.OPERATOR,
        'Operator agent'
      );
      const snak = new TestAgent('snak', AgentType.SNAK, 'Snak agent');

      const supervisorResult = await supervisor.execute('supervisor task');
      const operatorResult = await operator.execute('operator task');
      const snakResult = await snak.execute('snak task');

      expect(supervisorResult.result).toContain('supervisor');
      expect(operatorResult.result).toContain('operator');
      expect(snakResult.result).toContain('snak');
    });

    it('should handle agent lifecycle', async () => {
      const agent = new TestAgent(
        'lifecycle-agent',
        AgentType.OPERATOR,
        'Lifecycle test'
      );

      // Initialize
      await agent.init();

      // Execute
      const result = await agent.execute('lifecycle test');
      expect(result.result).toContain('lifecycle-agent');

      // Dispose
      await agent.dispose();
    });
  });
});
