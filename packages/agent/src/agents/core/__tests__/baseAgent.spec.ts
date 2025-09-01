import {
  BaseAgent,
  AgentType,
  IAgent,
  IModelAgent,
  AgentMessage,
} from '../baseAgent.js';
import { BaseMessage } from '@langchain/core/messages';
import { StreamChunk } from '../types.js';

jest.mock('@snakagent/core', () => ({
  logger: {
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}));

const makeMessage = (overrides: Partial<AgentMessage> = {}) => {
  const defaults = {
    from: 'agent1',
    to: 'agent2',
    content: 'Test message',
  };
  return { ...defaults, ...overrides };
};

const makeBaseMessage = (content: string) =>
  ({
    _getType: () => 'human',
    content,
  }) as BaseMessage;

// Concrete implementations for testing
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
    const mockChunks: StreamChunk[] = [
      {
        chunk: { content: `Starting execution for ${this.id}`, input },
        graph_step: 1,
        langgraph_step: 1,
        retry_count: 0,
        final: false,
      },
      {
        chunk: { content: `Processing input: ${input}`, config },
        graph_step: 1,
        langgraph_step: 2,
        retry_count: 0,
        final: false,
      },
      {
        chunk: {
          content: `Completed execution for ${this.id}`,
          result: 'success',
        },
        graph_step: 1,
        langgraph_step: 3,
        retry_count: 0,
        final: true,
      },
    ];

    for (const chunk of mockChunks) {
      yield chunk;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }
}

describe('BaseAgent', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('AgentType enum', () => {
    it.each([
      ['SUPERVISOR', 'supervisor'],
      ['OPERATOR', 'operator'],
      ['SNAK', 'snak'],
    ])('should have correct value for %s', (key, expectedValue) => {
      expect(AgentType[key as keyof typeof AgentType]).toBe(expectedValue);
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
      it.each([
        [
          'with all parameters',
          'test-agent',
          AgentType.OPERATOR,
          'Test agent',
          'Test agent',
        ],
        [
          'with default description',
          'test-agent',
          AgentType.OPERATOR,
          undefined,
          'No description',
        ],
        [
          'with different agent types',
          'supervisor-agent',
          AgentType.SUPERVISOR,
          'Supervisor',
          'Supervisor',
        ],
        ['with snak type', 'snak-agent', AgentType.SNAK, 'Snak', 'Snak'],
      ])(
        'should initialize %s correctly',
        (_, id, type, description, expectedDesc) => {
          const testAgent = new TestAgent(id, type, description);
          expect(testAgent.id).toBe(id);
          expect(testAgent.type).toBe(type);
          expect(testAgent.description).toBe(expectedDesc);
        }
      );
    });

    describe('init method', () => {
      it('should be callable', async () => {
        await expect(agent.init()).resolves.toBeUndefined();
      });
    });

    describe('execute method', () => {
      it.each([
        ['with input only', 'test input', undefined, undefined],
        ['with input and isInterrupted', 'test input', true, undefined],
        [
          'with input, isInterrupted and config',
          'test input',
          false,
          { timeout: 5000 },
        ],
      ])('should execute %s', async (_, input, isInterrupted, config) => {
        const result = await agent.execute(input, isInterrupted, config);
        expect(result.result).toContain(
          `Test agent test-agent executed with input: ${input}`
        );
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

    it.each([
      [
        'without forced model type',
        [makeBaseMessage('Hello'), makeBaseMessage('Hi there!')],
        undefined,
        2,
      ],
      ['with forced model type', [makeBaseMessage('Hello')], 'gpt-4', 1],
    ])(
      'should invoke model %s',
      async (_, messages, forceModelType, expectedCount) => {
        const result = await modelAgent.invokeModel(messages, forceModelType);
        expect(result.modelResult).toBe(
          `Model invoked with ${expectedCount} messages`
        );
        expect(result.forceModelType).toBe(forceModelType);
      }
    );
  });

  describe('AgentMessage interface', () => {
    it.each([
      [
        'with all fields',
        makeMessage({
          metadata: { timestamp: Date.now() },
          modelType: 'gpt-4',
        }),
      ],
      ['with minimal fields', makeMessage()],
    ])('should work %s', (_, message) => {
      expect(message.from).toBe('agent1');
      expect(message.to).toBe('agent2');
      expect(message.content).toBe('Test message');
    });

    it('should handle optional fields correctly', () => {
      const minimalMessage = makeMessage();
      const fullMessage = makeMessage({
        metadata: { key: 'value' },
        modelType: 'gpt-4',
      });

      expect(minimalMessage.metadata).toBeUndefined();
      expect(minimalMessage.modelType).toBeUndefined();
      expect(fullMessage.metadata).toEqual({ key: 'value' });
      expect(fullMessage.modelType).toBe('gpt-4');
    });
  });

  describe('executeAsyncGenerator method', () => {
    it('should be optional on BaseAgent', () => {
      const agent = new TestAgent('test-agent');
      expect(typeof agent.executeAsyncGenerator).toBe('undefined');
    });

    it('should be available when implemented', () => {
      const asyncAgent = new TestAsyncAgent('async-agent');
      expect(typeof asyncAgent.executeAsyncGenerator).toBe('function');
    });

    it('should return AsyncGenerator<StreamChunk>', async () => {
      const asyncAgent = new TestAsyncAgent('async-agent');
      const generator = asyncAgent.executeAsyncGenerator('test input');
      expect(generator).toBeDefined();
      expect(typeof generator[Symbol.asyncIterator]).toBe('function');
    });

    it.each([
      ['string input', 'String input'],
      ['BaseMessage array', [makeBaseMessage('Hello')]],
    ])('should handle %s correctly', async (_, input) => {
      const asyncAgent = new TestAsyncAgent('async-agent');
      const generator = asyncAgent.executeAsyncGenerator(input);
      const chunks: StreamChunk[] = [];
      for await (const chunk of generator) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(3);
      expect(chunks[0].chunk.input).toEqual(input);
    });

    it('should pass configuration through to chunks', async () => {
      const asyncAgent = new TestAsyncAgent('async-agent');
      const config = { timeout: 5000, maxIterations: 10 };
      const generator = asyncAgent.executeAsyncGenerator('Test input', config);
      const chunks: StreamChunk[] = [];

      for await (const chunk of generator) {
        chunks.push(chunk);
      }

      expect(chunks[1].chunk.config).toEqual(config);
    });

    it('should maintain proper step progression', async () => {
      const asyncAgent = new TestAsyncAgent('async-agent');
      const generator = asyncAgent.executeAsyncGenerator('Test input');
      const chunks: StreamChunk[] = [];

      for await (const chunk of generator) {
        chunks.push(chunk);
      }

      expect(chunks[0].graph_step).toBe(1);
      expect(chunks[1].langgraph_step).toBe(2);
      expect(chunks[2].langgraph_step).toBe(3);
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

    it('should work without config parameter', async () => {
      const asyncAgent = new TestAsyncAgent('async-agent');
      const generator = asyncAgent.executeAsyncGenerator('Test input');
      const chunks: StreamChunk[] = [];

      for await (const chunk of generator) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(3);
    });

    it('should be iterable with for await...of', async () => {
      const asyncAgent = new TestAsyncAgent('async-agent');
      const generator = asyncAgent.executeAsyncGenerator('Test input');

      let chunkCount = 0;
      for await (const chunk of generator) {
        chunkCount++;
        expect(chunk).toHaveProperty('chunk');
        expect(chunk).toHaveProperty('graph_step');
        expect(chunk).toHaveProperty('langgraph_step');
        expect(chunk).toHaveProperty('final');
      }

      expect(chunkCount).toBe(3);
    });
  });

  describe('Integration tests', () => {
    it('should work with different agent types in a system', async () => {
      const agents = [
        new TestAgent('supervisor', AgentType.SUPERVISOR, 'Supervisor agent'),
        new TestAgent('operator', AgentType.OPERATOR, 'Operator agent'),
        new TestAgent('snak', AgentType.SNAK, 'Snak agent'),
      ];

      const results = await Promise.all(
        agents.map((agent) => agent.execute(`${agent.type} task`))
      );

      results.forEach((result, index) => {
        expect(result.result).toContain(agents[index].type);
      });
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

      await agent.init();
      const result = await agent.execute('lifecycle test');
      expect(result.result).toContain('lifecycle-agent');
      await agent.dispose();
    });
  });
});
