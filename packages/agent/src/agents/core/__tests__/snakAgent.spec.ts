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
  AgentConfig: {},
  MemoryConfig: {},
}));

// Mock database interactions (not used in current snakAgent.ts but kept for compatibility)
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
    getModels: jest.fn().mockReturnValue({}),
    selectModelForMessages: jest
      .fn()
      .mockResolvedValue({ model_name: 'gpt-4', model: {} }),
  })),
}));

jest.mock('../../operators/memoryAgent', () => ({
  MemoryAgent: jest.fn().mockImplementation(() => ({
    init: jest.fn().mockResolvedValue(undefined),
    prepareMemoryTools: jest.fn().mockReturnValue([]),
  })),
}));

jest.mock('../../operators/ragAgent', () => ({
  RagAgent: jest.fn().mockImplementation(() => ({
    init: jest.fn().mockResolvedValue(undefined),
    searchSimilarDocuments: jest.fn().mockResolvedValue([]),
  })),
}));

jest.mock('../../graphs/graph', () => ({
  createGraph: jest.fn().mockResolvedValue({
    app: { streamEvents: jest.fn(), getState: jest.fn() },
    agent_config: {},
  }),
}));

jest.mock('../../../shared/enums/agent-modes.enum', () => ({
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
  AgentType: {
    SUPERVISOR: 'supervisor',
    OPERATOR: 'operator',
    SNAK: 'snak',
  },
  ExecutionMode: {
    PLANNING: 'PLANNING',
    REACTIVE: 'REACTIVE',
    AUTOMATIC: 'AUTOMATIC',
  },
  GraphNode: {
    PLANNING_ORCHESTRATOR: 'planning_orchestrator',
    AGENT_EXECUTOR: 'agent_executor',
    MEMORY_ORCHESTRATOR: 'memory_orchestrator',
    END_GRAPH: 'end_graph',
  },
  PlannerNode: {
    CREATE_INITIAL_HISTORY: 'create_initial_history',
    CREATE_INITIAL_PLAN: 'create_initial_plan',
    PLAN_REVISION: 'plan_revision',
    EVOLVE_FROM_HISTORY: 'evolve_from_history',
    END_PLANNER_GRAPH: 'end_planner_graph',
    PLANNER_VALIDATOR: 'planner_validator',
    GET_PLANNER_STATUS: 'get_planner_status',
    END: 'end',
  },
  ExecutorNode: {
    REASONING_EXECUTOR: 'reasoning_executor',
    TOOL_EXECUTOR: 'tool_executor',
    EXECUTOR_VALIDATOR: 'executor_validator',
    HUMAN: 'human',
    END_EXECUTOR_GRAPH: 'end_executor_graph',
    END: 'end',
  },
  MemoryNode: {
    STM_MANAGER: 'stm_manager',
    LTM_MANAGER: 'ltm_manager',
    RETRIEVE_MEMORY: 'retrieve_memory',
    END_MEMORY_GRAPH: 'end_memory_graph',
    END: 'end',
  },
}));

jest.mock('../../../shared/enums/event.enums', () => ({
  EventType: {
    ON_CHAT_MODEL_START: 'on_chat_model_start',
    ON_CHAT_MODEL_STREAM: 'on_chat_model_stream',
    ON_CHAT_MODEL_END: 'on_chat_model_end',
    ON_LLM_START: 'on_llm_start',
    ON_LLM_STREAM: 'on_llm_stream',
    ON_LLM_END: 'on_llm_end',
    ON_CHAIN_START: 'on_chain_start',
    ON_CHAIN_STREAM: 'on_chain_stream',
    ON_CHAIN_END: 'on_chain_end',
    ON_TOOL_START: 'on_tool_start',
    ON_TOOL_STREAM: 'on_tool_stream',
    ON_TOOL_END: 'on_tool_end',
    ON_TOOL_ERROR: 'on_tool_error',
    ON_RETRIEVER_START: 'on_retriever_start',
    ON_RETRIEVER_END: 'on_retriever_end',
    ON_RETRIEVER_ERROR: 'on_retriever_error',
    ON_PROMPT_START: 'on_prompt_start',
    ON_PROMPT_END: 'on_prompt_end',
    ON_CUSTOM_EVENT: 'on_custom_event',
    ON_GRAPH_ABORTED: 'on_graph_aborted',
    ON_GRAPH_INTERRUPTED: 'on_graph_interrupted',
  },
}));

jest.mock('../../../shared/enums/utils', () => ({
  isInEnum: jest.fn().mockReturnValue(true),
}));

import { SnakAgent, SnakAgentConfig } from '../snakAgent.js';
import { RpcProvider } from 'starknet';

// Mock references
const mockLogger = jest.requireMock('@snakagent/core').logger;
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
const mockCreateGraph = jest.requireMock('../../graphs/graph').createGraph;

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
        streamEvents: jest.fn().mockImplementation(async function* () {
          yield {
            name: 'Branch<agent>',
            event: 'on_chat_model_start',
            run_id: 'test-run-id',
            metadata: {
              langgraph_step: 1,
              langgraph_node: 'agent_executor',
              executionMode: 'REACTIVE',
              conversation_id: 'test-conversation',
              ls_provider: 'openai',
              ls_model_name: 'gpt-4',
              ls_model_type: 'chat',
              ls_temperature: 0.7,
            },
            data: {
              input: {
                messages: [{ content: 'Test message', additional_kwargs: {} }],
                metadata: {},
              },
            },
          };
          yield {
            name: 'Branch<agent>',
            event: 'on_chat_model_end',
            run_id: 'test-run-id',
            metadata: {
              langgraph_step: 1,
              langgraph_node: 'agent_executor',
              executionMode: 'REACTIVE',
              conversation_id: 'test-conversation',
              ls_provider: 'openai',
              ls_model_name: 'gpt-4',
              ls_model_type: 'chat',
              ls_temperature: 0.7,
            },
            data: {
              output: {
                content: 'Test response',
                tool_calls: [],
                usage_metadata: { total_tokens: 100 },
              },
            },
          };
          yield {
            name: 'final',
            event: 'on_graph_end',
            run_id: 'test-run-id',
            metadata: {
              conversation_id: 'test-conversation',
              final: true,
            },
          };
        }),
        getState: jest.fn().mockResolvedValue({
          values: {
            currentGraphStep: 1,
            retry: 0,
            last_node: 'agent_executor',
            messages: [{ content: 'Test message', additional_kwargs: {} }],
          },
          config: {
            configurable: {
              checkpoint_id: 'test-checkpoint',
              thread_id: 'test-thread',
            },
          },
        }),
      },
      agent_config: {
        id: 'test-agent',
        mode: 'interactive',
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
      expect(mockCreateGraph).toHaveBeenCalled();
    });

    it('should handle initialization errors gracefully', async () => {
      mockCreateGraph.mockRejectedValue(new Error('Executor creation failed'));
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
          '[SnakAgent] ❌ Initialization failed: Error: ModelSelector init failed'
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
        '[SnakAgent] ⚠️ No ModelSelector provided - functionality will be limited',
      ],
      [
        'executor returns null',
        undefined,
        '[SnakAgent] ⚠️ Agent executor creation succeeded but result is null',
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
      // Mock createGraph to return null
      mockCreateGraph.mockResolvedValue(null);

      const agent = new SnakAgent(mockConfig);

      await expect(agent.init()).resolves.toBeUndefined();
      expect(mockLogger.error).toHaveBeenCalledWith(
        '[SnakAgent] ❌ Failed to create Agent React Executor: Error: Failed to create agent executor for mode interactive: result is null'
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        '[SnakAgent] ⚠️ Will attempt to recover during execute() calls'
      );
    });

    it.each([
      [
        'memory disabled',
        { memory: { enabled: false } },
        mockMemoryAgent,
        false,
        '[SnakAgent] 🚫 MemoryAgent initialization skipped (disabled in config)',
      ],
      [
        'RAG undefined',
        { rag: undefined },
        mockRagAgent,
        false,
        '[SnakAgent] 🚫 RagAgent initialization skipped (disabled or not configured)',
      ],
      [
        'RAG disabled',
        { rag: { enabled: false } },
        mockRagAgent,
        false,
        '[SnakAgent] 🚫 RagAgent initialization skipped (disabled or not configured)',
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
          `[SnakAgent] ⚠️ ${expectedWarning}`
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
        '[SnakAgent] ⚠️ Controller is not initialized'
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
      ['autonomous', 'executeAsyncGenerator'],
      ['hybrid', 'executeAsyncGenerator'],
    ])('should execute in %s mode', async (mode, expectedMethod) => {
      (snakAgent as any)['currentMode'] = mode;
      const spy = jest
        .spyOn(snakAgent as any, expectedMethod)
        .mockImplementation(async function* () {
          yield { content: 'test', metadata: { final: true } };
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

      const generator = snakAgent.execute('Test input');
      const result = await generator.next();
      expect(result.value).toBe(
        'The mode: unsupported is not supported in this method.'
      );
      expect(result.done).toBe(true);
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

  describe('executeAsyncGenerator (Interactive mode)', () => {
    beforeEach(async () => {
      await snakAgent.init();
      (snakAgent as any)['agentReactExecutor'] = makeMockExecutor();
    });

    it('should execute basic operation', async () => {
      const generator = snakAgent.executeAsyncGenerator('Test input');

      const results = [];
      for await (const chunk of generator) {
        results.push(chunk);
        if (chunk.metadata?.final) break;
      }

      expect(results.length).toBeGreaterThan(0);
      expect(results[results.length - 1].metadata?.final).toBe(true);
    });

    it('should handle execution with thread_id and checkpoint_id parameters', async () => {
      const generator = snakAgent.executeAsyncGenerator(
        'Test input',
        false,
        'custom-thread-id',
        'custom-checkpoint-id'
      );

      const results = [];
      for await (const chunk of generator) {
        results.push(chunk);
        if (chunk.metadata?.final) break;
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

        const generator = snakAgent.executeAsyncGenerator('Test input');

        const results = [];
        for await (const chunk of generator) {
          results.push(chunk);
          if (chunk.metadata?.final) break;
        }

        expect(results.length).toBeGreaterThan(0);
      }
    );

    it('should handle execution errors', async () => {
      const mockExecutor = makeMockExecutor();
      // Mock streamEvents to throw an error when called
      const mockStreamEvents = jest
        .fn()
        .mockRejectedValue(new Error('Stream error'));
      mockExecutor.app.streamEvents = mockStreamEvents;
      (snakAgent as any)['agentReactExecutor'] = mockExecutor;

      const generator = snakAgent.executeAsyncGenerator('Test input');
      let results = [];
      let isDone = false;

      try {
        while (!isDone) {
          const { value, done } = await generator.next();
          if (done) {
            isDone = true;
            if (value !== undefined) {
              results.push(value);
            }
          } else {
            results.push(value);
          }
        }
      } catch (error) {
        // If the generator throws, catch it
        results.push(error);
      }

      // Verify streamEvents was called
      expect(mockStreamEvents).toHaveBeenCalled();

      // Should have at least one result (the error AIMessage)
      expect(results.length).toBeGreaterThan(0);
      const errorResult = results[results.length - 1];
      expect(errorResult).toBeDefined();
      if (errorResult.content) {
        expect(errorResult.content).toContain('Stream error');
        expect(errorResult.additional_kwargs.final).toBe(true);
      }
    });

    it('should handle uninitialized executor', async () => {
      (snakAgent as any)['agentReactExecutor'] = null;

      const generator = snakAgent.executeAsyncGenerator('Test input');
      const { value: errorResult, done } = await generator.next();

      expect(errorResult).toBeDefined();
      expect(errorResult.content).toContain(
        'Autonomous execution error: Agent executor is not initialized'
      );
      expect(errorResult.additional_kwargs.final).toBe(true);
      expect(errorResult.additional_kwargs.error).toBe(
        'autonomous_execution_error'
      );
      expect(done).toBe(true);
    });
  });

  describe('executeAsyncGenerator (Autonomous/Hybrid modes)', () => {
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

      const generator = agent.executeAsyncGenerator('Test input');

      const results = [];
      for await (const chunk of generator) {
        results.push(chunk);
        if (chunk.metadata?.final) break;
      }

      expect(results.length).toBeGreaterThan(0);
    });

    it('should handle interrupted execution', async () => {
      const mockExecutor = makeMockExecutor();
      (snakAgent as any)['agentReactExecutor'] = mockExecutor;

      const generator = snakAgent.executeAsyncGenerator('Test input', true);

      const results = [];
      for await (const chunk of generator) {
        results.push(chunk);
        if (chunk.metadata?.final) break;
      }

      expect(results.length).toBeGreaterThan(0);
    });

    it('should handle execution with custom thread_id and checkpoint_id', async () => {
      const mockExecutor = makeMockExecutor();
      (snakAgent as any)['agentReactExecutor'] = mockExecutor;

      const generator = snakAgent.executeAsyncGenerator(
        'Test input',
        false,
        'custom-thread-id',
        'custom-checkpoint-id'
      );

      const results = [];
      for await (const chunk of generator) {
        results.push(chunk);
        if (chunk.metadata?.final) break;
      }

      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('memory agent initialization', () => {
    it('should initialize memory agent when enabled', async () => {
      const config = makeConfig({
        agentConfig: {
          ...mockConfig.agentConfig,
          memory: { enabled: true, shortTermMemorySize: 15, memorySize: 20 },
        },
      });
      const agent = new SnakAgent(config);
      await agent.init();

      expect(mockMemoryAgent).toHaveBeenCalledWith({
        shortTermMemorySize: 15,
        memorySize: 20,
        embeddingModel: undefined,
      });
    });

    it('should skip memory agent initialization when disabled', async () => {
      const config = makeConfig({
        agentConfig: {
          ...mockConfig.agentConfig,
          memory: { enabled: false },
        },
      });
      const agent = new SnakAgent(config);

      // Clear previous mock calls
      mockMemoryAgent.mockClear();

      await agent.init();

      expect(mockLogger.info).toHaveBeenCalledWith(
        '[SnakAgent] 🚫 MemoryAgent initialization skipped (disabled in config)'
      );
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

    it('should handle abort errors in executeAsyncGenerator', async () => {
      const mockExecutor = makeMockExecutor();
      const abortError = new Error('Abort');
      const mockStreamEvents = jest.fn().mockRejectedValue(abortError);
      mockExecutor.app.streamEvents = mockStreamEvents;

      (snakAgent as any)['agentReactExecutor'] = mockExecutor;

      let results = [];
      let isDone = false;

      try {
        const generator = snakAgent.executeAsyncGenerator('Test input');
        while (!isDone) {
          const { value, done } = await generator.next();
          if (done) {
            isDone = true;
            if (value !== undefined) {
              results.push(value);
            }
          } else {
            results.push(value);
          }
        }
      } catch (error) {
        // If the generator throws, catch it
        results.push(error);
      }

      expect(mockStreamEvents).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        '[SnakAgent] 🛑 Execution aborted by user'
      );
    });
  });

  describe('stop functionality', () => {
    it('should abort controller when available', () => {
      const mockController = { abort: jest.fn() };
      (snakAgent as any)['controller'] = mockController as any;

      snakAgent.stop();

      expect(mockController.abort).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        '[SnakAgent] ⏹️ Execution stopped'
      );
    });

    it('should handle missing controller', () => {
      (snakAgent as any)['controller'] = null;

      snakAgent.stop();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        '[SnakAgent] ⚠️ No controller found to stop execution'
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

      expect(results.length).toBeGreaterThan(0);
      expect(results[0]).toMatchObject({
        event: expect.any(String),
        run_id: expect.any(String),
        metadata: expect.any(Object),
        timestamp: expect.any(String),
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

    it('should call createGraph for autonomous and hybrid modes', async () => {
      // Test autonomous mode
      const autonomousConfig = makeConfig({
        agentConfig: { ...mockConfig.agentConfig, mode: 'autonomous' as any },
      });
      const autonomousAgent = new SnakAgent(autonomousConfig as any);
      await autonomousAgent.init();
      expect(mockCreateGraph).toHaveBeenCalledWith(
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
      expect(mockCreateGraph).toHaveBeenCalledWith(
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
      expect(mockCreateGraph).toHaveBeenCalledWith(
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
      expect(mockCreateGraph).toHaveBeenCalledWith(
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
      expect(mockCreateGraph).toHaveBeenCalledWith(
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
        .spyOn(snakAgent as any, 'executeAsyncGenerator')
        .mockImplementation(async function* () {
          yield { chunk: 'test1', metadata: { final: false } };
          yield { chunk: 'test2', metadata: { final: true } };
        });

      const generator = snakAgent.execute('Test input');
      const results = [];
      for await (const chunk of generator) {
        results.push(chunk);
      }

      expect(spy).toHaveBeenCalled();
      expect(results).toHaveLength(2);
      expect(results[1].metadata.final).toBe(true);
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
                last_node: stateCallCount === 1 ? 'agent1' : 'agent2',
              },
              config: {
                configurable: {
                  checkpoint_id: 'test-checkpoint',
                  thread_id: 'test-thread',
                },
              },
            });
          }),
        },
        agent_config: {},
      };

      mockCreateGraph.mockResolvedValueOnce(mockExecutor);
      await autonomousAgent.init();

      const generator = autonomousAgent.executeAsyncGenerator('Test');
      const results = [];
      for await (const chunk of generator) {
        results.push(chunk);
        if (chunk.metadata?.final) break;
      }

      expect(results.length).toBeGreaterThan(0);
    });
  });
});
