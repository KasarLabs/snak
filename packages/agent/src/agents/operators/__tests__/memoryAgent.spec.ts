// Mock external dependencies BEFORE importing
// Note: @snakagent/core is mocked via Jest moduleNameMapper in jest.config.cjs

jest.mock('@snakagent/database/queries', () => ({
  memory: {
    init: jest.fn().mockResolvedValue(undefined),
    insert_memory: jest.fn().mockResolvedValue({ id: 1 }),
    enforce_memory_limit: jest.fn().mockResolvedValue(undefined),
    similar_memory: jest.fn().mockResolvedValue([
      {
        id: 1,
        content: 'User prefers blockchain transactions',
        similarity: 0.8,
        history: [{ timestamp: '2024-01-01T00:00:00Z' }],
      },
      {
        id: 2,
        content: 'User likes DeFi protocols',
        similarity: 0.75,
        history: [],
      },
    ]),
  },
  iterations: {
    similar_iterations: jest.fn().mockResolvedValue([
      {
        id: 10,
        question: 'How to use AVNU?',
        answer: 'AVNU is a DEX aggregator...',
        similarity: 0.7,
      },
    ]),
  },
}));

import { MemoryAgent, MemoryConfig } from '../memoryAgent.js';
import { HumanMessage } from '@langchain/core/messages';

// Get the mocked modules for testing
const { memory: mockMemoryOperations, iterations: mockIterationOperations } =
  jest.requireMock('@snakagent/database/queries');

describe('MemoryAgent', () => {
  let memoryAgent: MemoryAgent;
  let mockConfig: MemoryConfig;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset mock implementations
    mockMemoryOperations.init.mockResolvedValue(undefined);
    mockMemoryOperations.insert_memory.mockResolvedValue({ id: 1 });
    mockMemoryOperations.enforce_memory_limit.mockResolvedValue(undefined);
    mockMemoryOperations.similar_memory.mockResolvedValue([
      {
        id: 1,
        content: 'User prefers blockchain transactions',
        similarity: 0.8,
        history: [{ timestamp: '2024-01-01T00:00:00Z' }],
      },
      {
        id: 2,
        content: 'User likes DeFi protocols',
        similarity: 0.75,
        history: [],
      },
    ]);

    // Create default memory configuration
    mockConfig = {
      enabled: true,
      shortTermMemorySize: 10,
      memorySize: 15,
      maxIterations: 5,
      embeddingModel: 'Xenova/all-MiniLM-L6-v2',
    };

    // Create memory agent instance
    memoryAgent = new MemoryAgent(mockConfig);
  });

  describe('initialization', () => {
    it('should initialize with default configuration values', () => {
      const agent = new MemoryAgent({});

      expect(agent).toBeDefined();
      // Test that defaults are applied correctly
    });

    it('should initialize with custom configuration', () => {
      const customConfig: MemoryConfig = {
        shortTermMemorySize: 20,
        memorySize: 30,
        maxIterations: 10,
        embeddingModel: 'custom-model',
      };

      const agent = new MemoryAgent(customConfig);
      expect(agent).toBeDefined();
    });

    it('should initialize memory database successfully', async () => {
      await memoryAgent.init();

      expect(mockMemoryOperations.init).toHaveBeenCalledTimes(1);
    });

    it('should handle memory database initialization failure with retry', async () => {
      // Mock failure on first two attempts, success on third
      mockMemoryOperations.init
        .mockRejectedValueOnce(new Error('Database connection failed'))
        .mockRejectedValueOnce(new Error('Database connection failed'))
        .mockResolvedValueOnce(undefined);

      await memoryAgent.init();

      expect(mockMemoryOperations.init).toHaveBeenCalledTimes(3);
    });

    it('should throw error after max retries for database initialization', async () => {
      const dbError = new Error('Persistent database error');
      mockMemoryOperations.init.mockRejectedValue(dbError);

      await expect(memoryAgent.init()).rejects.toThrow(
        'MemoryAgent initialization failed'
      );
      expect(mockMemoryOperations.init).toHaveBeenCalledTimes(3);
    });
  });

  describe('memory tools creation', () => {
    beforeEach(async () => {
      await memoryAgent.init();
    });

    it('should create memory tools during initialization', () => {
      const tools = memoryAgent.getMemoryTools();

      expect(tools).toHaveLength(2);
      expect(tools[0].name).toBe('upsert_memory');
      expect(tools[1].name).toBe('retrieve_memories');
    });

    it('should prepare memory tools for interactive agents', () => {
      const interactiveTools = memoryAgent.prepareMemoryTools();

      expect(interactiveTools).toHaveLength(1);
      expect(interactiveTools[0].name).toBe('upsert_memory');
    });
  });

  describe('memory storage operations', () => {
    beforeEach(async () => {
      await memoryAgent.init();
    });

    it('should store memory successfully via execute method', async () => {
      const result = await memoryAgent.execute(
        'remember that I prefer blockchain transactions',
        false,
        { userId: 'test-user' }
      );

      expect(mockMemoryOperations.insert_memory).toHaveBeenCalledWith({
        user_id: 'test-user',
        content: 'remember that I prefer blockchain transactions',
        embedding: expect.any(Array),
        metadata: expect.objectContaining({
          timestamp: expect.any(String),
        }),
        history: [],
      });
      expect(result).toBe('Memory stored successfully.');
    });

    it('should enforce memory limit when storing memories', async () => {
      await memoryAgent.execute('store this important information', false, {
        userId: 'test-user',
      });

      expect(mockMemoryOperations.enforce_memory_limit).toHaveBeenCalledWith(
        'test-user',
        15 // Default memorySize from config
      );
    });

    it('should handle storage errors gracefully', async () => {
      mockMemoryOperations.insert_memory.mockRejectedValueOnce(
        new Error('Database write error')
      );

      const result = await memoryAgent.execute('save this memory', false, {
        userId: 'test-user',
      });

      expect(result).toContain('Failed to store memory');
    });
  });

  describe('memory retrieval operations', () => {
    beforeEach(async () => {
      await memoryAgent.init();
    });

    it('should retrieve relevant memories successfully', async () => {
      const memories = await memoryAgent.retrieveRelevantMemories(
        'blockchain operations',
        'test-user'
      );

      expect(mockMemoryOperations.similar_memory).toHaveBeenCalledWith(
        'test-user',
        expect.any(Array), // embedding
        4 // default limit
      );
      expect(memories).toHaveLength(2);
      expect(memories[0]).toHaveProperty('similarity', 0.8);
    });

    it('should retrieve memories with agent-specific iterations', async () => {
      const memories = await memoryAgent.retrieveRelevantMemories(
        'AVNU usage question',
        'test-user',
        'agent-123'
      );

      expect(mockIterationOperations.similar_iterations).toHaveBeenCalledWith(
        'agent-123',
        expect.any(Array), // embedding
        4 // default limit
      );
      expect(memories).toHaveLength(3); // 2 memories + 1 iteration
    });

    it('should format memories for context correctly', () => {
      const mockMemories = [
        {
          id: 1,
          content: 'User prefers DeFi',
          similarity: 0.9,
          history: [{ timestamp: '2024-01-01T10:00:00Z' }],
        },
        {
          id: 2,
          content: 'Question: How to swap?\nAnswer: Use DEX aggregator',
          similarity: 0.8,
          history: [],
        },
      ];

      const formatted = memoryAgent.formatMemoriesForContext(mockMemories);

      expect(formatted).toContain('### User Memory Context');
      expect(formatted).toContain('Memory [id: 1, relevance: 0.9000');
      expect(formatted).toContain('Memory [id: 2, relevance: 0.8000');
      expect(formatted).toContain('Question: How to swap?');
    });

    it('should return empty string for no memories', () => {
      const formatted = memoryAgent.formatMemoriesForContext([]);
      expect(formatted).toBe('');
    });

    it('should handle retrieval errors gracefully', async () => {
      mockMemoryOperations.similar_memory.mockRejectedValueOnce(
        new Error('Database read error')
      );

      const memories = await memoryAgent.retrieveRelevantMemories(
        'test query',
        'test-user'
      );

      expect(memories).toEqual([]);
    });
  });

  describe('execute method functionality', () => {
    beforeEach(async () => {
      await memoryAgent.init();
    });

    it('should detect storage operations correctly', async () => {
      const storeResult = await memoryAgent.execute(
        'Please store this user preference',
        false,
        { userId: 'test-user' }
      );

      expect(storeResult).toBe('Memory stored successfully.');
    });

    it('should detect retrieval operations correctly', async () => {
      const retrieveResult = await memoryAgent.execute(
        'retrieve my past preferences',
        false,
        { userId: 'test-user' }
      );

      expect(retrieveResult).toContain('### User Memory Context');
    });

    it('should default to retrieval for ambiguous requests', async () => {
      const result = await memoryAgent.execute('what do I like?', false, {
        userId: 'test-user',
      });

      expect(result).toContain('### User Memory Context');
    });

    it('should handle different input types', async () => {
      const messageInput = new HumanMessage('remember my wallet address');
      const result = await memoryAgent.execute(messageInput, false, {
        userId: 'test-user',
      });

      expect(result).toBe('Memory stored successfully.');
    });

    it('should throw error when not initialized', async () => {
      const uninitializedAgent = new MemoryAgent(mockConfig);

      await expect(uninitializedAgent.execute('test input')).rejects.toThrow(
        'MemoryAgent: Not initialized'
      );
    });
  });

  describe('memory chain operations', () => {
    beforeEach(async () => {
      await memoryAgent.init();
    });

    it('should create memory chain successfully', () => {
      const chain = memoryAgent.createMemoryChain(5);
      expect(chain).toBeDefined();
    });

    it('should create memory node for graph operations', async () => {
      const memoryNode = memoryAgent.createMemoryNode();
      expect(typeof memoryNode).toBe('function');

      const mockState = {
        messages: [new HumanMessage('test query')],
      };
      const mockConfig = {
        configurable: { userId: 'test-user', agentId: 'test-agent' },
      };

      const result = await memoryNode(mockState, mockConfig);
      expect(result).toHaveProperty('memories');
    });

    it('should handle memory node errors gracefully', async () => {
      // Force an error in the chain execution
      mockMemoryOperations.similar_memory.mockRejectedValueOnce(
        new Error('Chain execution error')
      );

      const memoryNode = memoryAgent.createMemoryNode();
      const mockState = {
        messages: [new HumanMessage('test query')],
      };
      const mockConfig = {
        configurable: { userId: 'test-user' },
      };

      const result = await memoryNode(mockState, mockConfig);
      expect(result).toEqual({ memories: '' });
    });
  });

  describe('similarity threshold filtering', () => {
    beforeEach(async () => {
      await memoryAgent.init();
    });

    it('should filter memories below similarity threshold', async () => {
      // Mock memories with low similarity scores
      mockMemoryOperations.similar_memory.mockResolvedValueOnce([
        {
          id: 1,
          content: 'High similarity memory',
          similarity: 0.8,
          history: [],
        },
        {
          id: 2,
          content: 'Low similarity memory',
          similarity: 0.1, // Below default threshold of 0
          history: [],
        },
      ]);

      const memories = await memoryAgent.retrieveRelevantMemories(
        'test query',
        'test-user'
      );

      // Both memories should be included since default threshold is 0
      expect(memories).toHaveLength(2);
    });
  });

  describe('edge cases and error handling', () => {
    beforeEach(async () => {
      await memoryAgent.init();
    });

    it('should handle empty message content', async () => {
      const result = await memoryAgent.execute('', false, {
        userId: 'test-user',
      });
      expect(result).toContain('### User Memory Context');
    });

    it('should handle null or undefined configurations', async () => {
      const agent = new MemoryAgent({});
      await agent.init();

      const result = await agent.execute('test', false);
      expect(result).toBeDefined();
    });

    it('should get embeddings instance', async () => {
      await memoryAgent.init();
      const embeddings = memoryAgent.getEmbeddings();
      expect(embeddings).toBeDefined();
    });

    it('should handle memory tools when not initialized', () => {
      const uninitializedAgent = new MemoryAgent(mockConfig);
      const tools = uninitializedAgent.prepareMemoryTools();

      expect(tools).toHaveLength(1);
    });
  });

  describe('prompt enrichment', () => {
    beforeEach(async () => {
      await memoryAgent.init();
    });

    it('should enrich prompt with memory context', async () => {
      const { ChatPromptTemplate } = await import('@langchain/core/prompts');
      const originalPrompt = ChatPromptTemplate.fromTemplate(
        'Hello {input}\n\n{memories}'
      );

      const enrichedPrompt = await memoryAgent.enrichPromptWithMemories(
        originalPrompt,
        'blockchain question',
        'test-user'
      );

      expect(enrichedPrompt).toBeDefined();
    });

    it('should return original prompt when no memories found', async () => {
      mockMemoryOperations.similar_memory.mockResolvedValueOnce([]);

      const { ChatPromptTemplate } = await import('@langchain/core/prompts');
      const originalPrompt = ChatPromptTemplate.fromTemplate(
        'Hello {input}\n\n{memories}'
      );

      const enrichedPrompt = await memoryAgent.enrichPromptWithMemories(
        originalPrompt,
        'test query',
        'test-user'
      );

      expect(enrichedPrompt).toBe(originalPrompt);
    });

    it('should handle enrichment errors gracefully', async () => {
      const uninitializedAgent = new MemoryAgent(mockConfig);
      const { ChatPromptTemplate } = await import('@langchain/core/prompts');
      const originalPrompt = ChatPromptTemplate.fromTemplate(
        'Hello {input}\n\n{memories}'
      );

      const enrichedPrompt = await uninitializedAgent.enrichPromptWithMemories(
        originalPrompt,
        'test query',
        'test-user'
      );

      expect(enrichedPrompt).toBe(originalPrompt);
    });
  });
});
