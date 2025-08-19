import { SystemMessage } from '@langchain/core/messages';
import { AgentMode, ModelProviders } from '@snakagent/core';

// Mock dependencies - consolidated to avoid duplication
jest.mock('@langchain/core/messages', () => ({
  SystemMessage: jest.fn().mockImplementation((content) => ({ content })),
}));

jest.mock('@snakagent/core', () => ({
  AgentMode: {
    INTERACTIVE: 'interactive',
    AUTONOMOUS: 'autonomous',
    HYBRID: 'hybrid',
  },
  ModelProviders: {
    OpenAI: 'openai',
  },
}));

jest.mock('@snakagent/database', () => ({
  Postgres: {
    connect: jest.fn().mockResolvedValue(undefined),
    query: jest.fn(),
    Query: jest.fn().mockImplementation((sql, params) => ({ sql, params })),
  },
}));

// Consolidated mocks
const mockSnakAgentInit = jest.fn().mockResolvedValue(undefined);
const mockModelSelectorInit = jest.fn().mockResolvedValue(undefined);
const mockInteractiveAgentInitialize = jest
  .fn()
  .mockResolvedValue({ app: { type: 'interactive' } });
const mockAutonomousAgentInitialize = jest
  .fn()
  .mockResolvedValue({ app: { type: 'autonomous' } });

jest.mock('../../core/snakAgent', () => ({
  SnakAgent: jest.fn().mockImplementation(() => ({
    init: mockSnakAgentInit,
  })),
}));

jest.mock('../../modes/interactive', () => ({
  InteractiveAgent: jest.fn().mockImplementation(() => ({
    initialize: mockInteractiveAgentInitialize,
  })),
}));

jest.mock('../../modes/autonomous', () => ({
  AutonomousAgent: jest.fn().mockImplementation(() => ({
    initialize: mockAutonomousAgentInitialize,
  })),
}));

jest.mock('../../operators/modelSelector', () => ({
  ModelSelector: jest.fn().mockImplementation(() => ({
    init: mockModelSelectorInit,
  })),
}));

jest.mock('starknet', () => ({
  logger: {
    error: jest.fn(),
  },
  RpcProvider: jest.fn().mockImplementation(() => ({})),
}));

// Import the functions to test
import {
  createAgentById,
  createInteractiveAgent,
  createAutonomousAgent,
  createHybridAgent,
  studio_graph_interactive,
  studio_graph_autonomous,
  studio_graph_hybrid,
  AgentConfigSQL,
} from '../graph.js';

// Test interface that allows string values for memory/rag during parsing tests
type TestAgentConfig = Omit<AgentConfigSQL, 'memory' | 'rag'> & {
  memory: AgentConfigSQL['memory'] | string;
  rag: AgentConfigSQL['rag'] | string;
};

// Mock references
const mockPostgres = jest.requireMock('@snakagent/database').Postgres;
const mockInteractiveAgent = jest.requireMock(
  '../../modes/interactive'
).InteractiveAgent;
const mockAutonomousAgent = jest.requireMock(
  '../../modes/autonomous'
).AutonomousAgent;
const mockModelSelector = jest.requireMock(
  '../../operators/modelSelector'
).ModelSelector;
const mockLogger = jest.requireMock('starknet').logger;

describe('Graph Module', () => {
  // Factory function for test data
  const makeAgentConfig = (
    overrides: Partial<TestAgentConfig> = {}
  ): TestAgentConfig => ({
    id: 'test-agent-id',
    name: 'TestAgent',
    group: 'test-group',
    description: 'A test agent',
    lore: ['Test lore'],
    objectives: ['Test objective'],
    knowledge: ['Test knowledge'],
    system_prompt: 'Test system prompt',
    interval: 1000,
    plugins: ['plugin1', 'plugin2'],
    memory: {
      enabled: true,
      short_term_memory_size: 10,
      memory_size: 20,
    },
    rag: {
      enabled: true,
      embedding_model: 'test-embedding',
    },
    mode: 'autonomous' as AgentMode,
    max_iterations: 5,
    ...overrides,
  });

  const setupEnvironment = () => {
    process.env.POSTGRES_DB = 'test_db';
    process.env.POSTGRES_HOST = 'localhost';
    process.env.POSTGRES_USER = 'test_user';
    process.env.POSTGRES_PASSWORD = 'test_password';
    process.env.POSTGRES_PORT = '5432';
    process.env.STARKNET_RPC_URL = 'https://test.starknet.io';
    process.env.STARKNET_PRIVATE_KEY = 'test_private_key';
    process.env.STARKNET_PUBLIC_ADDRESS = 'test_public_address';
  };

  const cleanupEnvironment = () => {
    delete process.env.POSTGRES_DB;
    delete process.env.POSTGRES_HOST;
    delete process.env.POSTGRES_USER;
    delete process.env.POSTGRES_PASSWORD;
    delete process.env.POSTGRES_PORT;
    delete process.env.STARKNET_RPC_URL;
    delete process.env.STARKNET_PRIVATE_KEY;
    delete process.env.STARKNET_PUBLIC_ADDRESS;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockPostgres.connect.mockResolvedValue(undefined);
    mockPostgres.query.mockResolvedValue([makeAgentConfig()]);
    setupEnvironment();
  });

  afterEach(() => {
    cleanupEnvironment();
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('createAgentById', () => {
    it('should create agent successfully with default config', async () => {
      const result = await createAgentById('test-agent-id');

      expect(result.agent).toBeDefined();
      expect(result.modelSelector).toBeDefined();
      expect(result.config).toEqual(makeAgentConfig());
      expect(mockPostgres.query).toHaveBeenCalledWith(
        expect.objectContaining({
          sql: 'SELECT * from agents WHERE id = $1',
          params: ['test-agent-id'],
        })
      );
    });

    it('should throw error when agent not found', async () => {
      mockPostgres.query.mockResolvedValue([]);

      await expect(createAgentById('non-existent-id')).rejects.toThrow(
        'No agent found for id: non-existent-id'
      );
    });

    describe('memory and RAG config parsing', () => {
      it.each([
        {
          name: 'enabled memory and RAG',
          memory: '(t,10,20)',
          rag: '(t,"test-embedding")',
          expectedMemory: {
            enabled: true,
            short_term_memory_size: 10,
            memory_size: 20,
          },
          expectedRag: { enabled: true, embedding_model: 'test-embedding' },
        },
        {
          name: 'disabled memory and RAG',
          memory: '(f,5,15)',
          rag: '(f,"")',
          expectedMemory: {
            enabled: false,
            short_term_memory_size: 5,
            memory_size: 15,
          },
          expectedRag: { enabled: false, embedding_model: null },
        },
        {
          name: 'partial memory config with default size',
          memory: '(t,10)',
          rag: '(t,"null")',
          expectedMemory: {
            enabled: true,
            short_term_memory_size: 10,
            memory_size: 20,
          },
          expectedRag: { enabled: true, embedding_model: null },
        },
      ])(
        'should parse $name correctly',
        async ({ memory, rag, expectedMemory, expectedRag }) => {
          const config = makeAgentConfig({ memory, rag });
          mockPostgres.query.mockResolvedValue([config]);

          const result = await createAgentById('test-agent-id');

          expect(result.config.memory).toEqual(expectedMemory);
          expect(result.config.rag).toEqual(expectedRag);
        }
      );
    });

    it('should build system prompt correctly', async () => {
      await createAgentById('test-agent-id');

      expect(SystemMessage).toHaveBeenCalledWith(
        expect.stringContaining('Your name : [TestAgent]')
      );
    });

    it('should create model selector with correct configuration', async () => {
      await createAgentById('test-agent-id');

      expect(mockModelSelector).toHaveBeenCalledWith(
        expect.objectContaining({
          debugMode: false,
          useModelSelector: true,
          modelsConfig: expect.objectContaining({
            fast: expect.objectContaining({
              provider: 'openai',
              model_name: 'gpt-4o-mini',
            }),
            smart: expect.objectContaining({
              provider: 'openai',
              model_name: 'gpt-4o-mini',
            }),
            cheap: expect.objectContaining({
              provider: 'openai',
              model_name: 'gpt-4o-mini',
            }),
          }),
        })
      );
    });
  });

  describe('Agent creation functions', () => {
    it.each([
      {
        name: 'interactive',
        fn: createInteractiveAgent,
        mockClass: mockInteractiveAgent,
        expectedType: 'interactive',
      },
      {
        name: 'autonomous',
        fn: createAutonomousAgent,
        mockClass: mockAutonomousAgent,
        expectedType: 'autonomous',
      },
      {
        name: 'hybrid',
        fn: createHybridAgent,
        mockClass: mockAutonomousAgent,
        expectedType: 'autonomous',
      },
    ])(
      'should create $name agent successfully',
      async ({ fn, mockClass, expectedType }) => {
        const result = await fn('test-agent-id');

        expect(result).toEqual({ type: expectedType });
        expect(mockClass).toHaveBeenCalled();
      }
    );
  });

  describe('Studio Graph Functions', () => {
    it.each([
      { fn: studio_graph_interactive, expectedType: 'interactive' },
      { fn: studio_graph_autonomous, expectedType: 'autonomous' },
      { fn: studio_graph_hybrid, expectedType: 'autonomous' },
    ])('should call $fn.name with correct ID', async ({ fn, expectedType }) => {
      const result = await fn();

      expect(result).toEqual({ type: expectedType });
    });
  });

  describe('Error Handling', () => {
    it.each([
      {
        name: 'database connection',
        mockFn: () =>
          mockPostgres.connect.mockRejectedValue(
            new Error('Connection failed')
          ),
        expectedError: 'Connection failed',
      },
      {
        name: 'model selector initialization',
        mockFn: () =>
          mockModelSelectorInit.mockRejectedValueOnce(new Error('Init failed')),
        expectedError: 'Init failed',
      },
      {
        name: 'agent initialization',
        mockFn: () =>
          mockSnakAgentInit.mockRejectedValueOnce(
            new Error('Agent init failed')
          ),
        expectedError: 'Agent init failed',
      },
    ])('should handle $name errors', async ({ mockFn, expectedError }) => {
      mockFn();

      await expect(createAgentById('test-agent-id')).rejects.toThrow(
        expectedError
      );
    });

    it('should throw error when required environment variables are missing', async () => {
      delete process.env.POSTGRES_DB;

      await expect(createAgentById('test-agent-id')).rejects.toThrow(
        'Required environment variable POSTGRES_DB is not set'
      );
    });

    it('should handle missing STARKNET environment variables gracefully', async () => {
      delete process.env.STARKNET_RPC_URL;

      const result = await createAgentById('test-agent-id');
      expect(result).toBeDefined();
    });
  });

  describe('Parsing edge cases and error handling', () => {
    it('should handle malformed memory config gracefully', async () => {
      const malformedConfig = makeAgentConfig({
        memory: '(t,invalid_number,20)', // This will result in NaN for short_term_memory_size
      });
      mockPostgres.query.mockResolvedValue([malformedConfig]);

      const result = await createAgentById('test-agent-id');

      // The parsing should handle this gracefully, resulting in NaN values
      expect(result.config.memory.short_term_memory_size).toBeNaN();
      expect(result.config.memory.memory_size).toBe(20);
      expect(result.config.memory.enabled).toBe(true);
    });

    it('should handle malformed RAG config gracefully', async () => {
      const malformedConfig = makeAgentConfig({
        rag: '(invalid_boolean,"embed")', // This will result in enabled: false due to falsy check
      });
      mockPostgres.query.mockResolvedValue([malformedConfig]);

      const result = await createAgentById('test-agent-id');

      // The parsing should handle this gracefully
      expect(result.config.rag.enabled).toBe(false);
      expect(result.config.rag.embedding_model).toBe('embed');
    });

    it('should handle empty string memory config', async () => {
      const emptyConfig = makeAgentConfig({
        memory: '()', // Empty tuple
      });
      mockPostgres.query.mockResolvedValue([emptyConfig]);

      const result = await createAgentById('test-agent-id');

      // Should handle empty config gracefully
      expect(result.config.memory.enabled).toBe(false);
      expect(result.config.memory.short_term_memory_size).toBeNaN();
      expect(result.config.memory.memory_size).toBe(20); // Default value
    });

    it('should handle empty string RAG config', async () => {
      const emptyConfig = makeAgentConfig({
        rag: '()', // Empty tuple
      });
      mockPostgres.query.mockResolvedValue([emptyConfig]);

      const result = await createAgentById('test-agent-id');

      // Should handle empty config gracefully
      expect(result.config.rag.enabled).toBe(false);
      expect(result.config.rag.embedding_model).toBe(null);
    });
  });
});
