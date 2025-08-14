// Mock external dependencies BEFORE importing
jest.mock('@snakagent/core', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
  AgentConfig: jest.fn(),
  CustomHuggingFaceEmbeddings: jest.fn().mockImplementation(() => ({
    embedQuery: jest.fn().mockResolvedValue([0.1, 0.2, 0.3]),
  })),
}));

jest.mock('@snakagent/metrics', () => ({
  metrics: {
    agentConnect: jest.fn(),
  },
  default: {
    agentConnect: jest.fn(),
  },
}));

jest.mock('@snakagent/database/queries', () => ({
  iterations: {
    insert_iteration: jest.fn().mockResolvedValue(undefined),
    count_iterations: jest.fn().mockResolvedValue(5),
    delete_oldest_iteration: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('snak-mcps', () => ({
  MultiServerMCPClient: jest.fn().mockImplementation(() => ({
    initializeConnections: jest.fn().mockResolvedValue(undefined),
    getTools: jest.fn().mockReturnValue([]),
  })),
}));

jest.mock('starknet', () => ({
  RpcProvider: jest.fn().mockImplementation(() => ({
    getChainId: jest.fn().mockResolvedValue('0x534e5f474f45524c49'),
  })),
}));

jest.mock('../../operators/modelSelector', () => ({
  ModelSelector: jest.fn().mockImplementation(() => ({
    init: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('../../operators/memoryAgent', () => ({
  MemoryAgent: jest.fn().mockImplementation(() => ({
    init: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('../../operators/ragAgent', () => ({
  RagAgent: jest.fn().mockImplementation(() => ({
    init: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('../../operators/mcp-agent/mcpAgent', () => ({
  MCPAgent: jest.fn().mockImplementation(() => ({
    init: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('../../operators/config-agent/configAgent', () => ({
  ConfigurationAgent: jest.fn().mockImplementation(() => ({
    init: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('../../modes/interactive', () => ({
  createInteractiveAgent: jest.fn().mockResolvedValue({
    app: {
      streamEvents: jest.fn().mockResolvedValue([]),
    },
  }),
}));

jest.mock('../../modes/autonomous', () => ({
  createAutonomousAgent: jest.fn().mockResolvedValue({
    app: {
      streamEvents: jest.fn().mockResolvedValue([]),
      getState: jest.fn().mockResolvedValue({ tasks: [] }),
    },
    agent_config: {},
  }),
}));

jest.mock('../../../config/agentConfig', () => ({
  AgentMode: {
    INTERACTIVE: 'interactive',
    AUTONOMOUS: 'autonomous',
    HYBRID: 'hybrid',
  },
  AGENT_MODES: {
    interactive: 'interactive',
    autonomous: 'autonomous',
    hybrid: 'hybrid',
  },
}));

import {
  SnakAgent,
  SnakAgentConfig,
  AgentIterationEvent,
} from '../snakAgent.js';
import { RpcProvider } from 'starknet';

// Get the mocked modules for testing
const mockLogger = jest.requireMock('@snakagent/core').logger;
const mockMetrics = jest.requireMock('@snakagent/metrics').metrics;
const mockIterations = jest.requireMock(
  '@snakagent/database/queries'
).iterations;
const mockModelSelector = jest.requireMock(
  '../../operators/modelSelector'
).ModelSelector;
const mockMemoryAgent = jest.requireMock(
  '../../operators/memoryAgent'
).MemoryAgent;
const mockRagAgent = jest.requireMock('../../operators/ragAgent').RagAgent;
const mockCreateInteractiveAgent = jest.requireMock(
  '../../modes/interactive'
).createInteractiveAgent;
const mockCreateAutonomousAgent = jest.requireMock(
  '../../modes/autonomous'
).createAutonomousAgent;

describe('SnakAgent', () => {
  let snakAgent: SnakAgent;
  let mockConfig: SnakAgentConfig;
  let mockProvider: RpcProvider;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset mock implementations
    mockCreateInteractiveAgent.mockResolvedValue({
      app: {
        streamEvents: jest.fn().mockResolvedValue([]),
      },
    });

    mockCreateAutonomousAgent.mockResolvedValue({
      app: {
        streamEvents: jest.fn().mockResolvedValue([]),
        getState: jest.fn().mockResolvedValue({ tasks: [] }),
      },
      agent_config: {},
    });

    mockProvider = {
      getChainId: jest.fn().mockResolvedValue('0x534e5f474f45524c49'),
    } as any;

    mockConfig = {
      provider: mockProvider,
      accountPublicKey: '0x1234567890abcdef',
      accountPrivateKey: '0xabcdef1234567890',
      db_credentials: {
        host: 'localhost',
        port: 5432,
        database: 'test_db',
        user: 'test_user',
        password: 'test_password',
      },
      agentConfig: {
        id: 'test-agent',
        name: 'Test Agent',
        mode: 'interactive' as any,
        group: 'test-group',
        description: 'Test agent description',
        interval: 1000,
        chatId: 'test-chat',
        memory: {
          enabled: true,
          shortTermMemorySize: 15,
          memorySize: 20,
          embeddingModel: 'Xenova/all-MiniLM-L6-v2',
        },
        maxIterations: 10,
        plugins: [],
        prompt: { content: 'Test prompt' } as any,
      },
      modelSelectorConfig: {
        defaultModel: 'gpt-4',
        name: 'gpt-4',
        provider: 'openai',
        apiKey: 'test-key',
      } as any,
    };

    snakAgent = new SnakAgent(mockConfig as any);
  });

  describe('AgentIterationEvent enum', () => {
    it('should have correct event values', () => {
      expect(AgentIterationEvent.ON_CHAT_MODEL_STREAM).toBe(
        'on_chat_model_stream'
      );
      expect(AgentIterationEvent.ON_CHAT_MODEL_START).toBe(
        'on_chat_model_start'
      );
      expect(AgentIterationEvent.ON_CHAT_MODEL_END).toBe('on_chat_model_end');
      expect(AgentIterationEvent.ON_CHAIN_START).toBe('on_chain_start');
      expect(AgentIterationEvent.ON_CHAIN_END).toBe('on_chain_end');
      expect(AgentIterationEvent.ON_CHAIN_STREAM).toBe('on_chain_stream');
    });

    it('should have all required event types', () => {
      const expectedEvents = [
        'on_chat_model_stream',
        'on_chat_model_start',
        'on_chat_model_end',
        'on_chain_start',
        'on_chain_end',
        'on_chain_stream',
      ];

      const actualEvents = Object.values(AgentIterationEvent);
      expect(actualEvents).toEqual(expect.arrayContaining(expectedEvents));
      expect(actualEvents).toHaveLength(expectedEvents.length);
    });

    it('should maintain enum integrity', () => {
      expect(AgentIterationEvent.ON_CHAT_MODEL_STREAM).toBeDefined();
      expect(AgentIterationEvent.ON_CHAT_MODEL_START).toBeDefined();
      expect(AgentIterationEvent.ON_CHAT_MODEL_END).toBeDefined();
      expect(AgentIterationEvent.ON_CHAIN_START).toBeDefined();
      expect(AgentIterationEvent.ON_CHAIN_END).toBeDefined();
      expect(AgentIterationEvent.ON_CHAIN_STREAM).toBeDefined();
    });
  });

  describe('constructor', () => {
    it('should initialize with provided configuration', () => {
      expect(snakAgent.id).toBe('snak');
      expect(snakAgent.type).toBe('snak');
      expect(snakAgent.description).toBe('No description');
    });

    it('should throw error if private key is missing', () => {
      const invalidConfig = { ...mockConfig, accountPrivateKey: '' };
      expect(() => new SnakAgent(invalidConfig)).toThrow(
        'STARKNET_PRIVATE_KEY is required'
      );
    });

    it('should call metrics.agentConnect on initialization', () => {
      expect(mockMetrics.agentConnect).toHaveBeenCalled();
    });

    it('should initialize embeddings with correct model', () => {
      const customConfig = {
        ...mockConfig,
        agentConfig: {
          ...mockConfig.agentConfig,
          memory: {
            ...mockConfig.agentConfig.memory,
            embeddingModel: 'custom-model',
          },
        },
      };

      // Clear previous calls to CustomHuggingFaceEmbeddings
      const { CustomHuggingFaceEmbeddings } =
        jest.requireMock('@snakagent/core');
      CustomHuggingFaceEmbeddings.mockClear();

      new SnakAgent(customConfig);

      // Verify that CustomHuggingFaceEmbeddings was called with the custom model
      expect(CustomHuggingFaceEmbeddings).toHaveBeenCalledWith({
        model: 'custom-model',
        dtype: 'fp32',
      });
    });

    it('should initialize embeddings with default model when no custom model is specified', () => {
      const configWithoutCustomModel = {
        ...mockConfig,
        agentConfig: {
          ...mockConfig.agentConfig,
          memory: {
            ...mockConfig.agentConfig.memory,
            embeddingModel: undefined,
          },
        },
      };

      // Clear previous calls to CustomHuggingFaceEmbeddings
      const { CustomHuggingFaceEmbeddings } =
        jest.requireMock('@snakagent/core');
      CustomHuggingFaceEmbeddings.mockClear();

      new SnakAgent(configWithoutCustomModel);

      // Verify that CustomHuggingFaceEmbeddings was called with the default model
      expect(CustomHuggingFaceEmbeddings).toHaveBeenCalledWith({
        model: 'Xenova/all-MiniLM-L6-v2',
        dtype: 'fp32',
      });
    });
  });

  describe('init method', () => {
    it('should initialize successfully with all components', async () => {
      await expect(snakAgent.init()).resolves.toBeUndefined();

      expect(mockModelSelector).toHaveBeenCalledWith(
        mockConfig.modelSelectorConfig
      );
      expect(mockMemoryAgent).toHaveBeenCalledWith({
        shortTermMemorySize: 15,
        memorySize: 20,
        maxIterations: undefined,
        embeddingModel: 'Xenova/all-MiniLM-L6-v2',
      });
      expect(mockCreateInteractiveAgent).toHaveBeenCalled();
    });

    it('should handle initialization without memory agent', async () => {
      const configWithoutMemory = {
        ...mockConfig,
        agentConfig: {
          ...mockConfig.agentConfig,
          memory: { enabled: false },
        },
      };
      const agent = new SnakAgent(configWithoutMemory as any);

      await expect(agent.init()).resolves.toBeUndefined();

      expect(mockMemoryAgent).not.toHaveBeenCalled();
    });

    it('should handle initialization without RAG agent', async () => {
      const configWithoutRag = {
        ...mockConfig,
        agentConfig: {
          ...mockConfig.agentConfig,
          rag: undefined,
        },
      };
      const agent = new SnakAgent(configWithoutRag as any);

      await expect(agent.init()).resolves.toBeUndefined();

      expect(mockRagAgent).not.toHaveBeenCalled();
    });

    it('should handle initialization errors', async () => {
      expect(typeof snakAgent.init).toBe('function');

      mockCreateInteractiveAgent.mockRejectedValue(
        new Error('Executor creation failed')
      );
      await expect(snakAgent.init()).resolves.toBeUndefined();
      expect(mockCreateInteractiveAgent).toHaveBeenCalled();
      expect(snakAgent.init).toBeDefined();
    });
  });

  describe('getter methods', () => {
    beforeEach(async () => {
      await snakAgent.init();
    });

    it('should return account credentials', () => {
      const credentials = snakAgent.getAccountCredentials();
      expect(credentials).toEqual({
        accountPrivateKey: '0xabcdef1234567890',
        accountPublicKey: '0x1234567890abcdef',
      });
    });

    it('should return database credentials', () => {
      const credentials = snakAgent.getDatabaseCredentials();
      expect(credentials).toEqual(mockConfig.db_credentials);
    });

    it('should return agent mode', () => {
      const agent = snakAgent.getAgent();
      expect(agent).toEqual({
        agentMode: 'interactive',
      });
    });

    it('should return agent configuration', () => {
      const config = snakAgent.getAgentConfig();
      expect(config).toEqual(mockConfig.agentConfig);
    });

    it('should return original agent mode', () => {
      const mode = snakAgent.getAgentMode();
      expect(mode).toBe('interactive');
    });

    it('should return provider', () => {
      const provider = snakAgent.getProvider();
      expect(provider).toBe(mockProvider);
    });

    it('should return memory agent when initialized', () => {
      const memoryAgent = snakAgent.getMemoryAgent();
      expect(memoryAgent).toBeDefined();
    });

    it('should return null for memory agent when not initialized', () => {
      const agent = new SnakAgent(mockConfig as any);
      const memoryAgent = agent.getMemoryAgent();
      expect(memoryAgent).toBeNull();
    });

    it('should return RAG agent when initialized', () => {
      const ragAgent = snakAgent.getRagAgent();
      expect(ragAgent).toBeDefined();
    });

    it('should return null for RAG agent when not initialized', () => {
      const agent = new SnakAgent(mockConfig as any);
      const ragAgent = agent.getRagAgent();
      expect(ragAgent).toBeNull();
    });
  });

  describe('execute method', () => {
    beforeEach(async () => {
      await snakAgent.init();
    });

    it('should execute in interactive mode', async () => {
      expect(typeof snakAgent.execute).toBe('function');

      const mockStreamEvents = jest.fn().mockResolvedValue([
        {
          name: 'Branch<agent>',
          event: AgentIterationEvent.ON_CHAIN_START,
          metadata: { langgraph_step: 1 },
        },
        {
          name: 'Branch<agent>',
          event: AgentIterationEvent.ON_CHAIN_END,
          metadata: { langgraph_step: 1 },
        },
      ]);

      mockCreateInteractiveAgent.mockResolvedValue({
        app: {
          streamEvents: mockStreamEvents,
        },
      });

      const generator = snakAgent.execute('Test input');
      expect(generator).toBeDefined();
      const results = [];
      for await (const result of generator) {
        results.push(result);
        if (results.length >= 2) break; // Limit to avoid infinite loops
      }
      expect(results.length).toBeGreaterThan(0);
    });

    it('should handle execution errors', async () => {
      expect(typeof snakAgent.execute).toBe('function');

      const mockStreamEvents = jest
        .fn()
        .mockRejectedValue(new Error('Stream execution failed'));
      mockCreateInteractiveAgent.mockResolvedValue({
        app: {
          streamEvents: mockStreamEvents,
        },
      });

      await snakAgent.init();
      snakAgent['currentMode'] = 'interactive';
      const generator = snakAgent.execute('Test input');
      expect(generator).toBeDefined();

      // Test that the error is properly propagated when consuming the generator
      let errorCaught = false;
      try {
        for await (const chunk of generator) {
          // This should not execute due to the error
          expect(true).toBe(false); // This should never be reached
        }
      } catch (error) {
        errorCaught = true;
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toBe('Stream execution failed');
      }

      expect(errorCaught).toBe(true);
      expect(mockStreamEvents).toHaveBeenCalled();
    });

    it('should handle uninitialized executor', async () => {
      const agent = new SnakAgent(mockConfig as any);
      const generator = agent.execute('Test input');

      await expect(async () => {
        for await (const result of generator) {
          // This should throw
        }
      }).rejects.toThrow('Agent executor is not initialized');
    });
  });

  describe('executeAsyncGenerator method', () => {
    beforeEach(async () => {
      await snakAgent.init();
    });

    it('should generate stream chunks', async () => {
      expect(typeof snakAgent.executeAsyncGenerator).toBe('function');

      const mockStreamEvents = jest.fn().mockResolvedValue([
        {
          name: 'Branch<agent>',
          event: AgentIterationEvent.ON_CHAIN_START,
          metadata: { langgraph_step: 1 },
        },
        {
          name: 'Branch<agent>',
          event: AgentIterationEvent.ON_CHAIN_END,
          metadata: { langgraph_step: 1 },
        },
      ]);

      mockCreateInteractiveAgent.mockResolvedValue({
        app: {
          streamEvents: mockStreamEvents,
        },
      });

      const generator = snakAgent.executeAsyncGenerator('Test input');
      expect(generator).toBeDefined();

      expect(mockCreateInteractiveAgent).toHaveBeenCalled();

      const results = [];
      for await (const chunk of generator) {
        results.push(chunk);
      }

      expect(results).toHaveLength(1);
      expect(results[0]).toHaveProperty('chunk');
      expect(results[0]).toHaveProperty('final');
      expect(results[0]).toHaveProperty('iteration_number');
      expect(results[0]).toHaveProperty('langgraph_step');
    });

    it('should handle thread configuration', async () => {
      expect(typeof snakAgent.executeAsyncGenerator).toBe('function');

      const mockStreamEvents = jest.fn().mockResolvedValue([
        {
          name: 'Branch<agent>',
          event: AgentIterationEvent.ON_CHAIN_START,
          metadata: { langgraph_step: 1 },
        },
        {
          name: 'Branch<agent>',
          event: AgentIterationEvent.ON_CHAIN_END,
          metadata: { langgraph_step: 1 },
        },
      ]);

      mockCreateInteractiveAgent.mockResolvedValue({
        app: {
          streamEvents: mockStreamEvents,
        },
      });

      const config = {
        threadId: 'test-thread',
        metadata: { threadId: 'metadata-thread' },
      };

      const generator = snakAgent.executeAsyncGenerator('Test input', config);
      expect(generator).toBeDefined();

      expect(mockCreateInteractiveAgent).toHaveBeenCalled();

      const results = [];
      for await (const chunk of generator) {
        results.push(chunk);
      }

      expect(results).toHaveLength(1);
      expect(results[0]).toHaveProperty('chunk');
      expect(results[0]).toHaveProperty('final');
      expect(results[0]).toHaveProperty('iteration_number');
      expect(results[0]).toHaveProperty('langgraph_step');
    });
  });

  describe('stop method', () => {
    it('should abort controller when available', () => {
      const mockAbort = jest.fn();
      snakAgent['controller'] = {
        abort: mockAbort,
      } as any;

      snakAgent.stop();

      expect(mockAbort).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'SnakAgent execution stopped'
      );
    });

    it('should handle missing controller', () => {
      snakAgent['controller'] = undefined as any;

      snakAgent.stop();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'No controller found to stop execution'
      );
    });
  });

  describe('executeAutonomousAsyncGenerator method', () => {
    beforeEach(async () => {
      const autonomousConfig = {
        ...mockConfig,
        agentConfig: {
          ...mockConfig.agentConfig,
          mode: 'autonomous',
        },
      };
      snakAgent = new SnakAgent(autonomousConfig as any);
      await snakAgent.init();
    });

    it('should execute in autonomous mode', async () => {
      expect(typeof snakAgent.executeAutonomousAsyncGenerator).toBe('function');

      const mockStreamEvents = jest.fn().mockResolvedValue([
        {
          name: 'Branch<tools,tools,agent,end>',
          event: AgentIterationEvent.ON_CHAIN_START,
          data: {
            input: {
              messages: [
                {
                  additional_kwargs: { iteration_number: 1 },
                },
              ],
            },
          },
          metadata: { langgraph_step: 1 },
        },
        {
          name: 'Branch<tools,tools,agent,end>',
          event: AgentIterationEvent.ON_CHAIN_END,
          metadata: { langgraph_step: 1 },
        },
      ]);

      mockCreateAutonomousAgent.mockResolvedValue({
        app: {
          streamEvents: mockStreamEvents,
          getState: jest.fn().mockResolvedValue({ tasks: [] }),
        },
        agent_config: {},
      });

      const generator = snakAgent.executeAutonomousAsyncGenerator('Test input');
      expect(generator).toBeDefined();

      expect(mockCreateAutonomousAgent).toHaveBeenCalled();

      for await (const chunk of generator) {
        expect(chunk).toHaveProperty('chunk');
        expect(chunk).toHaveProperty('final');
      }
    });

    it('should handle interrupted execution', async () => {
      expect(typeof snakAgent.executeAutonomousAsyncGenerator).toBe('function');

      const mockStreamEvents = jest.fn().mockResolvedValue([
        {
          name: 'Branch<tools,tools,agent,end>',
          event: AgentIterationEvent.ON_CHAIN_START,
          data: {
            input: {
              messages: [
                {
                  additional_kwargs: { iteration_number: 1 },
                },
              ],
            },
          },
          metadata: { langgraph_step: 1 },
        },
        {
          name: 'Branch<tools,tools,agent,end>',
          event: AgentIterationEvent.ON_CHAIN_END,
          metadata: { langgraph_step: 1 },
        },
      ]);

      mockCreateAutonomousAgent.mockResolvedValue({
        app: {
          streamEvents: mockStreamEvents,
          getState: jest.fn().mockResolvedValue({
            tasks: [{ interrupts: ['user_input'] }],
          }),
        },
        agent_config: {},
      });

      const generator = snakAgent.executeAutonomousAsyncGenerator(
        'Test input',
        true
      );
      expect(generator).toBeDefined();

      expect(mockCreateAutonomousAgent).toHaveBeenCalled();

      const results = [];
      for await (const chunk of generator) {
        results.push(chunk);
      }

      expect(Array.isArray(results)).toBe(true);
    });

    it('should handle abort errors', async () => {
      const abortError = new Error('Abort');
      mockCreateAutonomousAgent.mockResolvedValue({
        app: {
          streamEvents: jest.fn().mockRejectedValue(abortError),
          getState: jest.fn().mockResolvedValue({ tasks: [] }),
        },
        agent_config: {},
      });

      const generator = snakAgent.executeAutonomousAsyncGenerator('Test input');

      expect(mockCreateAutonomousAgent).toHaveBeenCalled();
      expect(generator).toBeDefined();

      const results = [];
      try {
        for await (const result of generator) {
          results.push(result);
        }
      } catch (error) {
        // If error is thrown, it should be the abort error
        expect(error.message).toBe('Abort');
      }
      // Either we get results or an error, but the generator should not crash
      expect(generator).toBeDefined();
    });
  });

  describe('memory operations', () => {
    beforeEach(async () => {
      await snakAgent.init();
    });

    it('should capture question for interactive mode', async () => {
      const captureQuestionSpy = jest.spyOn(
        snakAgent as any,
        'captureQuestion'
      );

      await snakAgent['captureQuestion']('Test question');

      expect(captureQuestionSpy).toHaveBeenCalledWith('Test question');
    });

    it('should save iteration for interactive mode', async () => {
      snakAgent['pendingIteration'] = {
        question: 'Test question',
        embedding: [0.1, 0.2, 0.3],
      };

      await snakAgent['saveIteration']('Test answer');

      expect(mockIterations.insert_iteration).toHaveBeenCalled();
    });

    it('should handle memory limit enforcement', async () => {
      mockIterations.count_iterations.mockResolvedValue(20);

      snakAgent['pendingIteration'] = {
        question: 'Test question',
        embedding: [0.1, 0.2, 0.3],
      };

      await snakAgent['saveIteration']('Test answer');

      expect(mockIterations.delete_oldest_iteration).toHaveBeenCalledWith(
        'test-agent'
      );
    });
  });

  describe('error handling', () => {
    it('should identify token-related errors', () => {
      const tokenErrors = [
        'token limit exceeded',
        'tokens exceed maximum',
        'context length exceeded',
        'prompt is too long',
        'maximum context length',
      ];

      tokenErrors.forEach((errorMsg) => {
        const error = new Error(errorMsg);
        const isTokenError = snakAgent['isTokenRelatedError'](error);
        expect(isTokenError).toBe(true);
      });
    });

    it('should identify non-token-related errors', () => {
      const nonTokenError = new Error('Network connection failed');
      const isTokenError = snakAgent['isTokenRelatedError'](nonTokenError);
      expect(isTokenError).toBe(false);
    });
  });

  describe('integration tests', () => {
    it('should handle complete lifecycle', async () => {
      // Initialize
      await expect(snakAgent.init()).resolves.toBeUndefined();

      const config = snakAgent.getAgentConfig();
      expect(config.id).toBe('test-agent');

      expect(typeof snakAgent.execute).toBe('function');

      const mockStreamEvents = jest.fn().mockResolvedValue([
        {
          name: 'Branch<agent>',
          event: AgentIterationEvent.ON_CHAIN_START,
          metadata: { langgraph_step: 1 },
        },
        {
          name: 'Branch<agent>',
          event: AgentIterationEvent.ON_CHAIN_END,
          metadata: { langgraph_step: 1 },
        },
      ]);

      mockCreateInteractiveAgent.mockResolvedValue({
        app: {
          streamEvents: mockStreamEvents,
        },
      });

      const generator = snakAgent.execute('Test input');
      expect(generator).toBeDefined();

      expect(mockCreateInteractiveAgent).toHaveBeenCalled();

      const results = [];
      for await (const chunk of generator) {
        results.push(chunk);
      }

      expect(results).toHaveLength(1);
      expect(results[0]).toHaveProperty('chunk');
      expect(results[0]).toHaveProperty('final');
      expect(results[0]).toHaveProperty('iteration_number');
      expect(results[0]).toHaveProperty('langgraph_step');

      // Stop execution
      snakAgent.stop();
    });

    it('should handle different agent modes', async () => {
      const modes = ['interactive', 'autonomous', 'hybrid'];

      for (const mode of modes) {
        const modeConfig = {
          ...mockConfig,
          agentConfig: {
            ...mockConfig.agentConfig,
            mode,
          },
        };

        const agent = new SnakAgent(modeConfig as any);
        await expect(agent.init()).resolves.toBeUndefined();

        expect(agent.getAgentMode()).toBe(mode);
      }
    });
  });

  describe('edge cases and error scenarios', () => {
    it('should handle initialization without modelSelector', async () => {
      const configWithoutModelSelector = {
        ...mockConfig,
        modelSelectorConfig: undefined,
      };
      const agent = new SnakAgent(configWithoutModelSelector as any);

      await expect(agent.init()).resolves.toBeUndefined();
    });

    it('should handle memory agent with custom configuration', async () => {
      const customMemoryConfig = {
        ...mockConfig,
        agentConfig: {
          ...mockConfig.agentConfig,
          memory: {
            enabled: true,
            shortTermMemorySize: 50,
            memorySize: 100,
            maxIterations: 25,
            embeddingModel: 'custom-embedding-model',
          },
        },
      };
      const agent = new SnakAgent(customMemoryConfig as any);

      await expect(agent.init()).resolves.toBeUndefined();
      expect(agent.getMemoryAgent()).toBeDefined();

      await agent['captureQuestion']('Custom question');
      expect(agent['pendingIteration']).toBeDefined();

      await expect(
        agent['saveIteration']('Custom answer')
      ).resolves.toBeUndefined();
      expect(mockIterations.insert_iteration).toHaveBeenCalled();
    });

    it('should handle RAG agent with custom configuration', async () => {
      const customRagConfig = {
        ...mockConfig,
        agentConfig: {
          ...mockConfig.agentConfig,
          rag: {
            enabled: true,
            topK: 10,
            embeddingModel: 'custom-rag-embedding',
          },
        },
      };
      const agent = new SnakAgent(customRagConfig as any);

      await expect(agent.init()).resolves.toBeUndefined();
      expect(agent.getRagAgent()).toBeDefined();

      await agent['captureQuestion']('RAG question');
      expect(agent['pendingIteration']).toBeDefined();

      await expect(
        agent['saveIteration']('RAG answer')
      ).resolves.toBeUndefined();
      expect(mockIterations.insert_iteration).toHaveBeenCalled();
    });

    it('should handle hybrid mode execution', async () => {
      const hybridConfig = {
        ...mockConfig,
        agentConfig: {
          ...mockConfig.agentConfig,
          mode: 'hybrid',
        },
      };
      const agent = new SnakAgent(hybridConfig as any);
      await agent.init();

      expect(agent.getAgentMode()).toBe('hybrid');
      expect(typeof agent.execute).toBe('function');
    });

    it('should handle controller getter when not initialized', () => {
      const agent = new SnakAgent(mockConfig as any);
      const controller = agent.getController();
      expect(controller).toBeUndefined();
    });

    it('should handle memory operations with disabled memory', async () => {
      const disabledMemoryConfig = {
        ...mockConfig,
        agentConfig: {
          ...mockConfig.agentConfig,
          memory: { enabled: false },
        },
      };
      const agent = new SnakAgent(disabledMemoryConfig as any);
      await agent.init();

      expect(agent.getMemoryAgent()).toBeNull();

      await agent['captureQuestion']('Test question');
      expect(agent['pendingIteration']).toBeUndefined();

      await expect(
        agent['saveIteration']('Test answer')
      ).resolves.toBeUndefined();
      expect(mockIterations.insert_iteration).not.toHaveBeenCalled();
    });

    it('should handle memory operations with zero limits', async () => {
      const zeroMemoryConfig = {
        ...mockConfig,
        agentConfig: {
          ...mockConfig.agentConfig,
          memory: {
            enabled: true,
            shortTermMemorySize: 0,
            memorySize: 0,
          },
        },
      };
      const agent = new SnakAgent(zeroMemoryConfig as any);
      await agent.init();

      await agent['captureQuestion']('Test question');
      expect(agent['pendingIteration']).toBeUndefined();

      await expect(
        agent['saveIteration']('Test answer')
      ).resolves.toBeUndefined();
      expect(mockIterations.insert_iteration).not.toHaveBeenCalled();
    });

    it('should handle database operation failures gracefully', async () => {
      await snakAgent.init();

      mockIterations.insert_iteration.mockRejectedValue(
        new Error('Database connection failed')
      );

      await snakAgent['captureQuestion']('Test question');
      expect(snakAgent['pendingIteration']).toBeDefined();

      await expect(
        snakAgent['saveIteration']('Test answer')
      ).resolves.toBeUndefined();
    });

    it('should handle embedding generation failures', async () => {
      await snakAgent.init();

      const mockEmbeddings = {
        embedQuery: jest.fn().mockRejectedValue(new Error('Embedding failed')),
      };
      snakAgent['iterationEmbeddings'] = mockEmbeddings as any;

      await expect(
        snakAgent['captureQuestion']('Test question')
      ).resolves.toBeUndefined();
      expect(snakAgent['pendingIteration']).toBeUndefined();
    });

    it('should save iteration when memory is enabled and question is captured', async () => {
      const enabledMemoryConfig = {
        ...mockConfig,
        agentConfig: {
          ...mockConfig.agentConfig,
          memory: {
            enabled: true,
            shortTermMemorySize: 50,
            memorySize: 100,
          },
        },
      };
      const agent = new SnakAgent(enabledMemoryConfig as any);
      await agent.init();

      await agent['captureQuestion']('Test question');

      expect(agent['pendingIteration']).toBeDefined();
      expect(agent['pendingIteration']?.question).toBe('Test question');

      await expect(
        agent['saveIteration']('Test answer')
      ).resolves.toBeUndefined();

      expect(mockIterations.insert_iteration).toHaveBeenCalledWith({
        agent_id: 'test-agent',
        question: 'Test question',
        question_embedding: expect.any(Array),
        answer: 'Test answer',
        answer_embedding: expect.any(Array),
      });
    });

    it('should completely disable memory operations when memory.enabled is false', async () => {
      const disabledMemoryConfig = {
        ...mockConfig,
        agentConfig: {
          ...mockConfig.agentConfig,
          memory: {
            enabled: false,
            shortTermMemorySize: 50, // Even with positive limit
            memorySize: 100,
          },
        },
      };
      const agent = new SnakAgent(disabledMemoryConfig as any);
      await agent.init();

      expect(agent.getMemoryAgent()).toBeNull();

      // Test captureQuestion - should not capture anything
      await agent['captureQuestion']('Test question');
      expect(agent['pendingIteration']).toBeUndefined();

      // Test saveIteration - should not save anything
      await expect(
        agent['saveIteration']('Test answer')
      ).resolves.toBeUndefined();
      expect(mockIterations.insert_iteration).not.toHaveBeenCalled();

      // Verify that no database operations were performed
      expect(mockIterations.count_iterations).not.toHaveBeenCalled();
      expect(mockIterations.delete_oldest_iteration).not.toHaveBeenCalled();
    });
  });
});
