// Consolidated mocks - one per package
jest.mock('@snakagent/core', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
  CustomHuggingFaceEmbeddings: jest.fn().mockImplementation(() => ({
    embedQuery: jest.fn().mockResolvedValue([0.1, 0.2, 0.3]),
  })),
}));

jest.mock('@snakagent/metrics', () => ({
  metrics: { agentConnect: jest.fn() },
}));

jest.mock('@snakagent/database/queries', () => ({
  iterations: {
    insert_iteration: jest.fn().mockResolvedValue(undefined),
    count_iterations: jest.fn().mockResolvedValue(5),
    delete_oldest_iteration: jest.fn().mockResolvedValue(undefined),
  },
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

jest.mock('../../modes/interactive', () => ({
  createInteractiveAgent: jest.fn().mockResolvedValue({
    app: { streamEvents: jest.fn(), getState: jest.fn() },
    agent_config: {},
  }),
}));

jest.mock('../../modes/autonomous', () => ({
  createAutonomousAgent: jest.fn().mockResolvedValue({
    app: { streamEvents: jest.fn(), getState: jest.fn() },
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

jest.mock('../utils', () => ({
  FormatChunkIteration: jest.fn().mockImplementation((chunk) => ({
    chunk: {
      content: chunk.data?.chunk?.content || 'test content',
      tools: undefined,
    },
  })),
}));

import { SnakAgent, SnakAgentConfig } from '../snakAgent.js';
import { RpcProvider } from 'starknet';

// Mock references
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

  // Factory functions
  const makeProvider = (): RpcProvider =>
    ({
      getChainId: jest.fn().mockResolvedValue('0x534e5f474f45524c49'),
    }) as any;

  const makeConfig = (
    overrides: Partial<SnakAgentConfig> = {}
  ): SnakAgentConfig => ({
    provider: makeProvider(),
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
    ...overrides,
  });

  const makeMockExecutor = () =>
    ({
      app: {
        streamEvents: jest.fn().mockResolvedValue([
          {
            name: 'Branch<agent>',
            event: 'on_chat_model_start',
            metadata: { langgraph_step: 1 },
            data: {
              input: {
                messages: [{ content: 'Test message', additional_kwargs: {} }],
                metadata: {},
              },
            },
          },
          {
            name: 'Branch<agent>',
            event: 'on_chat_model_end',
            metadata: { langgraph_step: 1 },
            data: {
              input: {
                messages: [{ content: 'Test message', additional_kwargs: {} }],
                metadata: {},
              },
            },
          },
        ]),
        getState: jest.fn().mockResolvedValue({
          values: { currentGraphStep: 1, retry: 0, last_agent: 'agent' },
          last_agent: 'agent',
          tasks: [],
        }),
      },
    }) as any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockConfig = makeConfig();
    snakAgent = new SnakAgent(mockConfig as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with provided configuration', () => {
      expect(snakAgent.id).toBe('snak');
      expect(snakAgent.type).toBe('snak');
      expect(mockMetrics.agentConnect).toHaveBeenCalled();
    });

    it('should throw error if private key is missing', () => {
      const invalidConfig = { ...mockConfig, accountPrivateKey: '' };
      expect(() => new SnakAgent(invalidConfig)).toThrow(
        'STARKNET_PRIVATE_KEY is required'
      );
    });

    it.each([
      ['custom-model', 'custom-model'],
      [undefined, 'Xenova/all-MiniLM-L6-v2'],
    ])(
      'should initialize embeddings with model: %s',
      (customModel, expectedModel) => {
        const { CustomHuggingFaceEmbeddings } =
          jest.requireMock('@snakagent/core');
        CustomHuggingFaceEmbeddings.mockClear();

        const config = makeConfig({
          agentConfig: {
            ...mockConfig.agentConfig,
            memory: {
              ...mockConfig.agentConfig.memory,
              embeddingModel: customModel,
            },
          },
        });

        new SnakAgent(config);
        expect(CustomHuggingFaceEmbeddings).toHaveBeenCalledWith({
          model: expectedModel,
          dtype: 'fp32',
        });
      }
    );
  });

  describe('initialization', () => {
    it('should initialize successfully with all components', async () => {
      await expect(snakAgent.init()).resolves.toBeUndefined();

      expect(mockModelSelector).toHaveBeenCalledWith(
        mockConfig.modelSelectorConfig
      );
      expect(mockMemoryAgent).toHaveBeenCalledWith({
        shortTermMemorySize: 15,
        memorySize: 20,
        embeddingModel: 'Xenova/all-MiniLM-L6-v2',
      });
      expect(mockCreateInteractiveAgent).toHaveBeenCalled();
    });

    it('should handle initialization errors gracefully', async () => {
      mockCreateInteractiveAgent.mockRejectedValue(
        new Error('Executor creation failed')
      );
      await expect(snakAgent.init()).resolves.toBeUndefined();
    });

    it('should handle initialization errors and throw when not caught', async () => {
      // Mock ModelSelector.init to throw an error
      const mockModelSelectorInstance = {
        init: jest
          .fn()
          .mockRejectedValue(new Error('ModelSelector init failed')),
      };
      const originalMock = mockModelSelector.getMockImplementation();
      mockModelSelector.mockImplementation(() => mockModelSelectorInstance);

      try {
        const agent = new SnakAgent(mockConfig);

        await expect(agent.init()).rejects.toThrow('ModelSelector init failed');
        expect(mockLogger.error).toHaveBeenCalledWith(
          '[SnakAgent] Initialization failed: Error: ModelSelector init failed'
        );
      } finally {
        // Restore original mock
        mockModelSelector.mockImplementation(originalMock);
      }
    });

    it.each([
      [
        'no ModelSelector',
        null,
        '[SnakAgent] No ModelSelector provided - functionality will be limited',
      ],
      [
        'executor returns null',
        undefined,
        '[SnakAgent] Agent executor creation succeeded but result is null',
      ],
    ])(
      'should log warning when %s',
      async (scenario, executorValue, expectedMessage) => {
        const agent = new SnakAgent(mockConfig);
        const createAgentSpy = jest.spyOn(
          agent as any,
          'createAgentReactExecutor'
        );

        createAgentSpy.mockImplementation(async () => {
          (agent as any)['agentReactExecutor'] = executorValue;
        });

        await expect(agent.init()).resolves.toBeUndefined();
        expect(mockLogger.warn).toHaveBeenCalledWith(expectedMessage);
      }
    );

    it('should handle executor returning null and catch error gracefully', async () => {
      // Mock createInteractiveAgent to return null
      mockCreateInteractiveAgent.mockResolvedValue(null);

      const agent = new SnakAgent(mockConfig);

      await expect(agent.init()).resolves.toBeUndefined();
      expect(mockLogger.error).toHaveBeenCalledWith(
        '[SnakAgent] Failed to create agent executor: Error: Failed to create agent executor for mode interactive: result is null'
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        '[SnakAgent] Will attempt to recover during execute() calls'
      );
    });

    it.each([
      [
        'memory disabled',
        { memory: { enabled: false } },
        mockMemoryAgent,
        false,
        '[SnakAgent] MemoryAgent initialization skipped (disabled in config)',
      ],
      [
        'RAG undefined',
        { rag: undefined },
        mockRagAgent,
        false,
        '[SnakAgent] RagAgent initialization skipped (disabled or not configured)',
      ],
      [
        'RAG disabled',
        { rag: { enabled: false } },
        mockRagAgent,
        false,
        '[SnakAgent] RagAgent initialization skipped (disabled or not configured)',
      ],
      [
        'RAG enabled',
        { rag: { enabled: true, topK: 5 } },
        mockRagAgent,
        true,
        undefined,
      ],
    ])(
      'should handle %s',
      async (
        scenario,
        configOverride,
        mock,
        shouldCall,
        expectedLogMessage
      ) => {
        const config = makeConfig({
          agentConfig: { ...mockConfig.agentConfig, ...configOverride },
        });
        const agent = new SnakAgent(config as any);

        await expect(agent.init()).resolves.toBeUndefined();

        if (shouldCall) {
          expect(mock).toHaveBeenCalled();
        } else {
          expect(mock).not.toHaveBeenCalled();
          if (expectedLogMessage) {
            expect(mockLogger.info).toHaveBeenCalledWith(expectedLogMessage);
          }
        }
      }
    );
  });

  describe('getter methods', () => {
    it('should return account credentials', () => {
      const result = snakAgent.getAccountCredentials();
      expect(result).toEqual({
        accountPrivateKey: '0xabcdef1234567890',
        accountPublicKey: '0x1234567890abcdef',
      });
    });

    it('should return database credentials', () => {
      const result = snakAgent.getDatabaseCredentials();
      expect(result).toEqual(mockConfig.db_credentials);
    });

    it('should return agent mode info', () => {
      const result = snakAgent.getAgent();
      expect(result).toEqual({ agentMode: 'interactive' });
    });

    it('should return agent configuration', () => {
      const result = snakAgent.getAgentConfig();
      expect(result).toEqual(mockConfig.agentConfig);
    });

    it('should return original agent mode', () => {
      const result = snakAgent.getAgentMode();
      expect(result).toBe('interactive');
    });

    it('should return provider', () => {
      const result = snakAgent.getProvider();
      expect(result).toBe(mockConfig.provider);
    });

    it.each([
      ['getMemoryAgent', 'memoryAgent', 'MemoryAgent is not initialized'],
      ['getRagAgent', 'ragAgent', 'RagAgent is not initialized'],
    ])(
      'should return null for %s when not initialized',
      (methodName, property, expectedWarning) => {
        const result = (snakAgent as any)[methodName]();
        expect(result).toBeNull();
        expect(mockLogger.warn).toHaveBeenCalledWith(
          `[SnakAgent] ${expectedWarning}`
        );
      }
    );

    it.each([
      ['getMemoryAgent', 'memoryAgent'],
      ['getRagAgent', 'ragAgent'],
    ])('should return %s when initialized', async (methodName, property) => {
      await snakAgent.init();
      const mockAgent = {} as any;
      (snakAgent as any)[property] = mockAgent;

      const result = (snakAgent as any)[methodName]();
      expect(result).toBe(mockAgent);
    });

    it('should return controller when initialized', () => {
      const mockController = new AbortController();
      (snakAgent as any)['controller'] = mockController;

      const result = snakAgent.getController();
      expect(result).toBe(mockController);
    });

    it('should return undefined for controller when not initialized', () => {
      expect(snakAgent.getController()).toBeUndefined();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        '[SnakAgent] Controller is not initialized'
      );
    });
  });

  describe('execution modes', () => {
    beforeEach(async () => {
      await snakAgent.init();
      (snakAgent as any)['agentReactExecutor'] = makeMockExecutor();
    });

    it.each([
      ['interactive', 'executeAsyncGenerator'],
      ['autonomous', 'executeAutonomousAsyncGenerator'],
      ['hybrid', 'executeAutonomousAsyncGenerator'],
    ])('should execute in %s mode', async (mode, expectedMethod) => {
      (snakAgent as any)['currentMode'] = mode;
      const spy = jest
        .spyOn(snakAgent as any, expectedMethod)
        .mockImplementation(async function* () {
          yield { chunk: 'test', final: true };
        });

      const generator = snakAgent.execute('Test input');
      const results = [];
      for await (const chunk of generator) {
        results.push(chunk);
      }

      expect(spy).toHaveBeenCalled();
      expect(results).toHaveLength(1);
    });

    it('should throw error for unsupported mode', async () => {
      (snakAgent as any)['currentMode'] = 'unsupported';

      await expect(async () => {
        const generator = snakAgent.execute('Test input');
        for await (const chunk of generator) {
          // consume generator
        }
      }).rejects.toThrow(
        'The mode: unsupported is not supported in this method.'
      );
    });

    it('should handle uninitialized executor', async () => {
      (snakAgent as any)['agentReactExecutor'] = null;

      await expect(async () => {
        const generator = snakAgent.execute('Test input');
        for await (const chunk of generator) {
          // consume generator
        }
      }).rejects.toThrow('Agent executor is not initialized');
    });
  });

  describe('executeAsyncGenerator', () => {
    beforeEach(async () => {
      await snakAgent.init();
      (snakAgent as any)['agentReactExecutor'] = makeMockExecutor();
    });

    it('should execute basic operation', async () => {
      const generator = snakAgent.executeAsyncGenerator('Test input');

      const results = [];
      for await (const chunk of generator) {
        results.push(chunk);
      }

      expect(results).toHaveLength(3); // 2 events + 1 final
      expect(results[results.length - 1].final).toBe(true);
    });

    it.each([
      ['threadId', { threadId: 'custom-thread' }],
      ['recursionLimit', { recursionLimit: 100 }],
      ['originalUserQuery', { originalUserQuery: 'original query' }],
      ['metadata threadId', { metadata: { threadId: 'metadata-thread' } }],
    ])('should handle configuration with %s', async (configType, config) => {
      const generator = snakAgent.executeAsyncGenerator('Test input', config);

      const results = [];
      for await (const chunk of generator) {
        results.push(chunk);
      }

      expect(results.length).toBeGreaterThan(0);
    });

    it.each([
      ['custom chatId', { chatId: 'custom-chat-id' }],
      ['custom agentId', { id: 'custom-agent-id' }],
      ['custom memorySize', { memory: { memorySize: 50 } }],
    ])(
      'should handle agent config overrides: %s',
      async (configType, agentOverrides) => {
        (snakAgent as any)['agentConfig'] = {
          ...mockConfig.agentConfig,
          ...agentOverrides,
        };

        const config = { threadId: 'custom-thread' };
        const generator = snakAgent.executeAsyncGenerator('Test input', config);

        const results = [];
        for await (const chunk of generator) {
          results.push(chunk);
        }

        expect(results.length).toBeGreaterThan(0);
      }
    );

    it('should handle execution errors', async () => {
      const mockExecutor = makeMockExecutor();
      mockExecutor.app.streamEvents.mockRejectedValue(
        new Error('Stream error')
      );
      (snakAgent as any)['agentReactExecutor'] = mockExecutor;

      await expect(async () => {
        const generator = snakAgent.executeAsyncGenerator('Test input');
        for await (const chunk of generator) {
          // consume generator
        }
      }).rejects.toThrow('Stream error');
    });

    it('should handle uninitialized executor', async () => {
      (snakAgent as any)['agentReactExecutor'] = null;

      await expect(async () => {
        const generator = snakAgent.executeAsyncGenerator('Test input');
        for await (const chunk of generator) {
          // consume generator
        }
      }).rejects.toThrow('Agent executor is not initialized');
    });
  });

  describe('executeAutonomousAsyncGenerator', () => {
    beforeEach(async () => {
      const autonomousConfig = makeConfig({
        agentConfig: { ...mockConfig.agentConfig, mode: 'autonomous' as any },
      });
      snakAgent = new SnakAgent(autonomousConfig);
      await snakAgent.init();
    });

    it.each([
      ['autonomous', 'autonomous'],
      ['hybrid', 'hybrid'],
    ])('should handle %s mode execution', async (mode, expectedMode) => {
      const config = makeConfig({
        agentConfig: { ...mockConfig.agentConfig, mode: mode as any },
      });
      const agent = new SnakAgent(config);
      await agent.init();

      const mockExecutor = makeMockExecutor();
      (agent as any)['agentReactExecutor'] = mockExecutor;

      const generator = agent.executeAutonomousAsyncGenerator('Test input');

      const results = [];
      for await (const chunk of generator) {
        results.push(chunk);
        if (chunk.final) break;
      }

      expect(results.length).toBeGreaterThan(0);
    });

    it('should handle interrupted execution', async () => {
      const mockExecutor = makeMockExecutor();
      (snakAgent as any)['agentReactExecutor'] = mockExecutor;

      const generator = snakAgent.executeAutonomousAsyncGenerator(
        'Test input',
        true
      );

      const results = [];
      for await (const chunk of generator) {
        results.push(chunk);
        if (chunk.final) break;
      }

      expect(results.length).toBeGreaterThan(0);
    });

    it('should handle execution with custom runnable config', async () => {
      const mockExecutor = makeMockExecutor();
      (snakAgent as any)['agentReactExecutor'] = mockExecutor;

      const runnableConfig = { configurable: { custom: 'config' } };
      const generator = snakAgent.executeAutonomousAsyncGenerator(
        'Test input',
        false,
        runnableConfig
      );

      const results = [];
      for await (const chunk of generator) {
        results.push(chunk);
        if (chunk.final) break;
      }

      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('memory operations', () => {
    beforeEach(async () => {
      await snakAgent.init();
      (snakAgent as any)['currentMode'] = 'interactive';
    });

    it('should handle memory operations when enabled', async () => {
      await (snakAgent as any)['captureQuestion']('Test question');
      await (snakAgent as any)['saveIteration']('Test answer');

      expect(mockIterations.insert_iteration).toHaveBeenCalled();
    });

    it.each([
      ['memory disabled', { memory: { enabled: false } }],
      ['zero memory limit', { memory: { shortTermMemorySize: 0 } }],
      ['negative memory limit', { memory: { shortTermMemorySize: -1 } }],
      ['non-interactive mode', {}, 'autonomous'],
    ])(
      'should skip operations when %s',
      async (scenario, configOverride, mode = 'interactive') => {
        const config = makeConfig({
          agentConfig: {
            ...mockConfig.agentConfig,
            ...configOverride,
          },
        });
        const agent = new SnakAgent(config);
        await agent.init();
        (agent as any)['currentMode'] = mode;

        await (agent as any)['captureQuestion']('Test question');
        await (agent as any)['saveIteration']('Test answer');

        expect(mockIterations.insert_iteration).not.toHaveBeenCalled();
      }
    );

    it.each([
      [
        'undefined memory limit',
        { memory: { shortTermMemorySize: undefined } },
      ],
      ['null memory limit', { memory: { shortTermMemorySize: null as any } }],
      [
        'string memory limit',
        { memory: { shortTermMemorySize: 'invalid' as any } },
      ],
    ])('should use default limit when %s', async (scenario, configOverride) => {
      const config = makeConfig({
        agentConfig: {
          ...mockConfig.agentConfig,
          ...configOverride,
        },
      });
      const agent = new SnakAgent(config);
      await agent.init();
      (agent as any)['currentMode'] = 'interactive';

      await (agent as any)['captureQuestion']('Test question');
      await (agent as any)['saveIteration']('Test answer');

      // These should still work because they use default value (15)
      expect(mockIterations.insert_iteration).toHaveBeenCalled();
    });

    it('should enforce memory limit', async () => {
      mockIterations.count_iterations.mockResolvedValue(16);

      await (snakAgent as any)['captureQuestion']('Test question');
      await (snakAgent as any)['saveIteration']('Test answer');

      expect(mockIterations.delete_oldest_iteration).toHaveBeenCalledWith(
        'test-agent'
      );
    });

    it('should not delete when count equals limit', async () => {
      mockIterations.count_iterations.mockResolvedValue(15);

      await (snakAgent as any)['captureQuestion']('Test question');
      await (snakAgent as any)['saveIteration']('Test answer');

      expect(mockIterations.delete_oldest_iteration).not.toHaveBeenCalled();
    });

    it('should handle captureQuestion errors gracefully', async () => {
      const { CustomHuggingFaceEmbeddings } =
        jest.requireMock('@snakagent/core');
      const error = new Error('Embedding error');
      CustomHuggingFaceEmbeddings.mockImplementation(() => ({
        embedQuery: jest.fn().mockRejectedValue(error),
      }));
      const agent = new SnakAgent(mockConfig);
      await agent.init();
      (agent as any)['currentMode'] = 'interactive';

      await (agent as any)['captureQuestion']('Test question');
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to capture question iteration')
      );
    });

    it('should handle saveIteration database error', async () => {
      (snakAgent as any)['pendingIteration'] = {
        question: 'Test question',
        embedding: [0.1, 0.2, 0.3],
      };

      const dbError = new Error('Database connection failed');
      mockIterations.insert_iteration.mockRejectedValueOnce(dbError);
      mockLogger.error.mockClear();

      await (snakAgent as any)['saveIteration']('Test answer');

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to save iteration pair')
      );
    });

    it('should handle no pendingIteration in saveIteration', async () => {
      await (snakAgent as any)['saveIteration']('Test answer');
      expect(mockIterations.insert_iteration).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it.each([
      ['token limit exceeded', true],
      ['tokens exceed maximum', true],
      ['context length exceeded', true],
      ['prompt is too long', true],
      ['maximum context length', true],
      ['Network connection failed', false],
    ])('should identify token-related error: %s', (errorMsg, isTokenError) => {
      const error = new Error(errorMsg);
      const result = (snakAgent as any)['isTokenRelatedError'](error);
      expect(result).toBe(isTokenError);
    });

    it('should cover token error string conversion path', () => {
      const tokenError = 'token limit exceeded';
      const result = (snakAgent as any)['isTokenRelatedError'](tokenError);
      expect(result).toBe(true);
    });
  });

  describe('stop functionality', () => {
    it('should abort controller when available', () => {
      const mockController = { abort: jest.fn() };
      (snakAgent as any)['controller'] = mockController as any;

      snakAgent.stop();

      expect(mockController.abort).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        '[SnakAgent] Execution stopped'
      );
    });

    it('should handle missing controller', () => {
      (snakAgent as any)['controller'] = null;

      snakAgent.stop();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        '[SnakAgent] No controller found to stop execution'
      );
    });
  });

  describe('integration tests', () => {
    it('should handle complete lifecycle', async () => {
      await expect(snakAgent.init()).resolves.toBeUndefined();

      const config = snakAgent.getAgentConfig();
      expect(config.id).toBe('test-agent');

      (snakAgent as any)['agentReactExecutor'] = makeMockExecutor();
      (snakAgent as any)['currentMode'] = 'interactive';

      const generator = snakAgent.execute('Test input');
      const results = [];
      for await (const chunk of generator) {
        results.push(chunk);
      }

      expect(results).toHaveLength(3);
      expect(results[0]).toMatchObject({
        chunk: expect.anything(),
        final: expect.any(Boolean),
        graph_step: expect.any(Number),
        langgraph_step: expect.any(Number),
      });

      snakAgent.stop();
    });

    it.each(['interactive', 'autonomous', 'hybrid'])(
      'should handle %s mode initialization',
      async (mode) => {
        const modeConfig = makeConfig({
          agentConfig: { ...mockConfig.agentConfig, mode: mode as any },
        });

        const agent = new SnakAgent(modeConfig as any);
        await expect(agent.init()).resolves.toBeUndefined();
        expect(agent.getAgentMode()).toBe(mode);
      }
    );

    it('should call createAutonomousAgent for autonomous and hybrid modes', async () => {
      // Test autonomous mode
      const autonomousConfig = makeConfig({
        agentConfig: { ...mockConfig.agentConfig, mode: 'autonomous' as any },
      });
      const autonomousAgent = new SnakAgent(autonomousConfig as any);
      await autonomousAgent.init();
      expect(mockCreateAutonomousAgent).toHaveBeenCalledWith(
        autonomousAgent,
        expect.anything()
      );

      // Reset mocks
      jest.clearAllMocks();

      // Test hybrid mode
      const hybridConfig = makeConfig({
        agentConfig: { ...mockConfig.agentConfig, mode: 'hybrid' as any },
      });
      const hybridAgent = new SnakAgent(hybridConfig as any);
      await hybridAgent.init();
      expect(mockCreateAutonomousAgent).toHaveBeenCalledWith(
        hybridAgent,
        expect.anything()
      );
    });

    it('should cover all switch cases in createAgentReactExecutor', async () => {
      // Test interactive mode
      const interactiveConfig = makeConfig({
        agentConfig: { ...mockConfig.agentConfig, mode: 'interactive' as any },
      });
      const interactiveAgent = new SnakAgent(interactiveConfig as any);
      await interactiveAgent.init();
      expect(mockCreateInteractiveAgent).toHaveBeenCalledWith(
        interactiveAgent,
        expect.anything()
      );

      // Reset mocks
      jest.clearAllMocks();

      // Test autonomous mode
      const autonomousConfig = makeConfig({
        agentConfig: { ...mockConfig.agentConfig, mode: 'autonomous' as any },
      });
      const autonomousAgent = new SnakAgent(autonomousConfig as any);
      await autonomousAgent.init();
      expect(mockCreateAutonomousAgent).toHaveBeenCalledWith(
        autonomousAgent,
        expect.anything()
      );

      // Reset mocks
      jest.clearAllMocks();

      // Test hybrid mode
      const hybridConfig = makeConfig({
        agentConfig: { ...mockConfig.agentConfig, mode: 'hybrid' as any },
      });
      const hybridAgent = new SnakAgent(hybridConfig as any);
      await hybridAgent.init();
      expect(mockCreateAutonomousAgent).toHaveBeenCalledWith(
        hybridAgent,
        expect.anything()
      );
    });
  });

  describe('pass-through data integrity', () => {
    it('should return configuration objects unchanged', () => {
      const credentials = snakAgent.getAccountCredentials();
      const dbCredentials = snakAgent.getDatabaseCredentials();
      const agentConfig = snakAgent.getAgentConfig();

      expect(credentials).toEqual({
        accountPrivateKey: mockConfig.accountPrivateKey,
        accountPublicKey: mockConfig.accountPublicKey,
      });
      expect(dbCredentials).toBe(mockConfig.db_credentials);
      expect(agentConfig).toBe(mockConfig.agentConfig);
    });

    it('should preserve agent properties during execution', async () => {
      await snakAgent.init();

      expect(snakAgent.id).toBe('snak');
      expect(snakAgent.type).toBe('snak');
      expect(snakAgent.getProvider()).toBe(mockConfig.provider);
    });
  });

  describe('additional coverage tests', () => {
    it('should cover final chunk return in execute() for autonomous mode', async () => {
      await snakAgent.init();
      (snakAgent as any)['agentReactExecutor'] = makeMockExecutor();
      (snakAgent as any)['currentMode'] = 'autonomous';

      const spy = jest
        .spyOn(snakAgent as any, 'executeAutonomousAsyncGenerator')
        .mockImplementation(async function* () {
          yield { chunk: 'test1', final: false };
          yield { chunk: 'test2', final: true };
        });

      const generator = snakAgent.execute('Test input');
      const results = [];
      for await (const chunk of generator) {
        results.push(chunk);
      }

      expect(spy).toHaveBeenCalled();
      expect(results).toHaveLength(2);
      expect(results[1].final).toBe(true);
      spy.mockRestore();
    });

    it('should cover agent change detection causing isNewNode = true', async () => {
      const autonomousAgent = new SnakAgent(
        makeConfig({
          agentConfig: { ...mockConfig.agentConfig, mode: 'autonomous' as any },
        })
      );
      await autonomousAgent.init();

      let stateCallCount = 0;
      const mockExecutor = {
        app: {
          streamEvents: jest.fn().mockResolvedValue([
            {
              name: 'test',
              event: 'on_chat_model_start',
              metadata: { langgraph_step: 1 },
              data: { input: { messages: [] }, metadata: {} },
            },
          ]),
          getState: jest.fn().mockImplementation(() => {
            stateCallCount++;
            return Promise.resolve({
              values: {
                currentGraphStep: 1,
                retry: 0,
                last_agent: stateCallCount === 1 ? 'agent1' : 'agent2',
              },
              last_agent: stateCallCount === 1 ? 'agent1' : ('agent2' as any),
              tasks: [],
            });
          }),
        },
        agent_config: {},
      };

      mockCreateAutonomousAgent.mockResolvedValueOnce(mockExecutor);
      await autonomousAgent.init();

      const generator = autonomousAgent.executeAutonomousAsyncGenerator('Test');
      const results = [];
      for await (const chunk of generator) {
        results.push(chunk);
        if (chunk.final) break;
      }

      expect(results.length).toBeGreaterThan(0);
    });
  });
});
