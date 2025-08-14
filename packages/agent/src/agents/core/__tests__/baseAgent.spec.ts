import {
  BaseAgent,
  AgentType,
  IAgent,
  IModelAgent,
  AgentMessage,
} from '../baseAgent.js';
import { BaseMessage } from '@langchain/core/messages';
import { StreamChunk } from '../snakAgent.js';

// Mock the logger from @snakagent/core
jest.mock('@snakagent/core', () => ({
  logger: {
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}));

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

class TestAsyncAgent extends BaseAgent {
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
    return { result: `Async agent ${this.id} executed with input: ${input}` };
  }

  async *executeAsyncGenerator(
    input: BaseMessage[] | any,
    config?: Record<string, any>
  ): AsyncGenerator<StreamChunk> {
    // Mock implementation that yields test chunks
    const mockChunks: StreamChunk[] = [
      {
        chunk: { content: `Starting execution for ${this.id}`, input },
        iteration_number: 1,
        langgraph_step: 1,
        final: false,
      },
      {
        chunk: { content: `Processing input: ${input}`, config },
        iteration_number: 1,
        langgraph_step: 2,
        final: false,
      },
      {
        chunk: {
          content: `Completed execution for ${this.id}`,
          result: 'success',
        },
        iteration_number: 1,
        langgraph_step: 3,
        final: true,
      },
    ];

    for (const chunk of mockChunks) {
      yield chunk;
      // Simulate some processing time
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
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

    it('should be available when implemented', () => {
      const asyncAgent = new TestAsyncAgent('async-agent');

      // The method should be available when implemented
      expect(typeof asyncAgent.executeAsyncGenerator).toBe('function');
    });

    it('should return AsyncGenerator<StreamChunk>', async () => {
      const asyncAgent = new TestAsyncAgent('async-agent');
      const generator = asyncAgent.executeAsyncGenerator('test input');

      expect(generator).toBeDefined();
      expect(typeof generator[Symbol.asyncIterator]).toBe('function');
    });

    it('should accept input and optional config parameters', async () => {
      const asyncAgent = new TestAsyncAgent('async-agent');

      const generator1 = asyncAgent.executeAsyncGenerator('input');
      const generator2 = asyncAgent.executeAsyncGenerator('input', {
        key: 'value',
      });

      expect(generator1).toBeDefined();
      expect(generator2).toBeDefined();
    });

    it('should yield StreamChunk objects with correct structure', async () => {
      const asyncAgent = new TestAsyncAgent('async-agent');
      const generator = asyncAgent.executeAsyncGenerator('Test input');

      const chunks: StreamChunk[] = [];
      for await (const chunk of generator) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(3);
      expect(chunks[0]).toHaveProperty('chunk');
      expect(chunks[0]).toHaveProperty('iteration_number');
      expect(chunks[0]).toHaveProperty('langgraph_step');
      expect(chunks[0]).toHaveProperty('final');
    });

    it('should handle different input types', async () => {
      const asyncAgent = new TestAsyncAgent('async-agent');

      // Test with string input
      const stringGenerator = asyncAgent.executeAsyncGenerator('String input');
      const stringChunks: StreamChunk[] = [];
      for await (const chunk of stringGenerator) {
        stringChunks.push(chunk);
      }
      expect(stringChunks[0].chunk.input).toBe('String input');

      // Test with BaseMessage array input
      const messages: BaseMessage[] = [
        { _getType: () => 'human', content: 'Hello' } as BaseMessage,
      ];
      const messageGenerator = asyncAgent.executeAsyncGenerator(messages);
      const messageChunks: StreamChunk[] = [];
      for await (const chunk of messageGenerator) {
        messageChunks.push(chunk);
      }
      expect(messageChunks[0].chunk.input).toEqual(messages);
    });

    it('should pass configuration through to chunks', async () => {
      const asyncAgent = new TestAsyncAgent('async-agent');
      const config = { timeout: 5000, maxIterations: 10 };

      const generator = asyncAgent.executeAsyncGenerator('Test input', config);
      const chunks: StreamChunk[] = [];
      for await (const chunk of generator) {
        chunks.push(chunk);
      }

      // Check that config is passed through
      expect(chunks[1].chunk.config).toEqual(config);
    });

    it('should maintain proper iteration and step progression', async () => {
      const asyncAgent = new TestAsyncAgent('async-agent');
      const generator = asyncAgent.executeAsyncGenerator('Test input');

      const chunks: StreamChunk[] = [];
      for await (const chunk of generator) {
        chunks.push(chunk);
      }

      // Check iteration progression
      expect(chunks[0].iteration_number).toBe(1);
      expect(chunks[1].iteration_number).toBe(1);
      expect(chunks[2].iteration_number).toBe(1);

      // Check langgraph step progression
      expect(chunks[0].langgraph_step).toBe(1);
      expect(chunks[1].langgraph_step).toBe(2);
      expect(chunks[2].langgraph_step).toBe(3);

      // Check final flag
      expect(chunks[0].final).toBe(false);
      expect(chunks[1].final).toBe(false);
      expect(chunks[2].final).toBe(true);
    });

    it('should work with empty input', async () => {
      const asyncAgent = new TestAsyncAgent('async-agent');
      const generator = asyncAgent.executeAsyncGenerator('');

      const chunks: StreamChunk[] = [];
      for await (const chunk of generator) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(3);
      expect(chunks[0].chunk.input).toBe('');
    });

    it('should work with null/undefined config', async () => {
      const asyncAgent = new TestAsyncAgent('async-agent');

      // Test with undefined config
      const generator1 = asyncAgent.executeAsyncGenerator('Test input');
      const chunks1: StreamChunk[] = [];
      for await (const chunk of generator1) {
        chunks1.push(chunk);
      }
      expect(chunks1).toHaveLength(3);

      // Test with null config
      const generator2 = asyncAgent.executeAsyncGenerator(
        'Test input',
        null as any
      );
      const chunks2: StreamChunk[] = [];
      for await (const chunk of generator2) {
        chunks2.push(chunk);
      }
      expect(chunks2).toHaveLength(3);
    });

    it('should be iterable with for await...of', async () => {
      const asyncAgent = new TestAsyncAgent('async-agent');
      const generator = asyncAgent.executeAsyncGenerator('Test input');

      let chunkCount = 0;
      for await (const chunk of generator) {
        chunkCount++;
        expect(chunk).toHaveProperty('chunk');
        expect(chunk).toHaveProperty('iteration_number');
        expect(chunk).toHaveProperty('langgraph_step');
        expect(chunk).toHaveProperty('final');
      }

      expect(chunkCount).toBe(3);
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

    it('should work with async generator agents', async () => {
      const asyncAgent = new TestAsyncAgent(
        'async-operator',
        AgentType.OPERATOR,
        'Async operator agent'
      );

      const syncResult = await asyncAgent.execute('sync task');
      expect(syncResult.result).toContain('async-operator');

      const generator = asyncAgent.executeAsyncGenerator('async task');
      const chunks: StreamChunk[] = [];
      for await (const chunk of generator) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(3);
      expect(chunks[0].chunk.input).toBe('async task');
      expect(chunks[2].final).toBe(true);
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
