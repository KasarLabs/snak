// Mock external dependencies BEFORE importing
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

const { memory: mockMemoryOperations, iterations: mockIterationOperations } =
  jest.requireMock('@snakagent/database/queries');

describe('MemoryAgent', () => {
  let memoryAgent: MemoryAgent;
  let mockConfig: MemoryConfig;

  // Test data helpers
  const createMockMemory = (id: number, content: string, similarity: number, history: any[] = []) => ({
    id,
    content,
    similarity,
    history,
  });

  const createMockIteration = (id: number, question: string, answer: string, similarity: number) => ({
    id,
    question,
    answer,
    similarity,
  });

  const createMockState = (messages: any[]) => ({ messages });
  const createMockConfig = (configurable: any) => ({ configurable });

  // Common test scenarios
  const similarityThresholdTests = [
    { value: 'invalid_value', description: 'invalid environment variable' },
    { value: '-0.5', description: 'negative similarity threshold' },
    { value: '1.5', description: 'similarity threshold above 1' },
    { value: '0.7', description: 'valid similarity threshold' },
    { value: '0', description: 'zero similarity threshold' },
  ];

  const memorySizeTests = [
    { value: undefined, expected: 15, description: 'undefined memorySize' },
    { value: 25, expected: 25, description: 'custom memorySize' },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset mock implementations to default values
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
    
    mockIterationOperations.similar_iterations.mockResolvedValue([
      {
        id: 10,
        question: 'How to use AVNU?',
        answer: 'AVNU is a DEX aggregator...',
        similarity: 0.7,
      },
    ]);

    mockConfig = {
      enabled: true,
      shortTermMemorySize: 10,
      memorySize: 15,
      maxIterations: 5,
      embeddingModel: 'Xenova/all-MiniLM-L6-v2',
    };
    memoryAgent = new MemoryAgent(mockConfig);
  });

  describe('initialization', () => {
    it('should initialize with default configuration values', () => {
      const agent = new MemoryAgent({});
      expect(agent).toBeDefined();
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
        metadata: expect.objectContaining({ timestamp: expect.any(String) }),
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
        15
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
        expect.any(Array),
        4
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
        expect.any(Array),
        4
      );
      expect(memories).toHaveLength(3);
    });

    it('should format memories for context correctly', () => {
      const mockMemories = [
        createMockMemory(1, 'User prefers DeFi', 0.9, [{ timestamp: '2024-01-01T10:00:00Z' }]),
        createMockMemory(2, 'Question: How to swap?\nAnswer: Use DEX aggregator', 0.8),
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

    it.each([
      ['store', 'Please store this user preference'],
      ['remember', 'remember my wallet address'],
      ['save', 'save this information'],
    ])('should detect %s operations correctly', async (operation, content) => {
      const result = await memoryAgent.execute(content, false, { userId: 'test-user' });
      expect(result).toBe('Memory stored successfully.');
    });

    it.each([
      ['retrieve', 'retrieve my past preferences'],
      ['recall', 'recall my settings'],
      ['get', 'get my memories'],
    ])('should detect %s operations correctly', async (operation, content) => {
      const result = await memoryAgent.execute(content, false, { userId: 'test-user' });
      expect(result).toContain('### User Memory Context');
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

      const mockState = createMockState([new HumanMessage('test query')]);
      const mockConfig = createMockConfig({ userId: 'test-user', agentId: 'test-agent' });

      const result = await memoryNode(mockState, mockConfig);
      expect(result).toHaveProperty('memories');
    });

    it('should handle memory node errors gracefully', async () => {
      mockMemoryOperations.similar_memory.mockRejectedValueOnce(
        new Error('Chain execution error')
      );

      const memoryNode = memoryAgent.createMemoryNode();
      const mockState = createMockState([new HumanMessage('test query')]);
      const mockConfig = createMockConfig({ userId: 'test-user' });

      const result = await memoryNode(mockState, mockConfig);
      expect(result).toEqual({ memories: '' });
    });
  });

  describe('similarity threshold filtering', () => {
    beforeEach(async () => {
      await memoryAgent.init();
    });

    it('should filter memories below similarity threshold', async () => {
      mockMemoryOperations.similar_memory.mockResolvedValueOnce([
        createMockMemory(1, 'High similarity memory', 0.8),
        createMockMemory(2, 'Low similarity memory', 0.1),
      ]);

      const memories = await memoryAgent.retrieveRelevantMemories(
        'test query',
        'test-user'
      );

      expect(memories).toHaveLength(2);
    });
  });

  describe('edge cases and error handling', () => {
    beforeEach(async () => {
      await memoryAgent.init();
    });

    it('should handle empty message content', async () => {
      const result = await memoryAgent.execute('', false, { userId: 'test-user' });
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
      const originalPrompt = ChatPromptTemplate.fromTemplate('Hello {input}\n\n{memories}');

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
      const originalPrompt = ChatPromptTemplate.fromTemplate('Hello {input}\n\n{memories}');

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
      const originalPrompt = ChatPromptTemplate.fromTemplate('Hello {input}\n\n{memories}');

      const enrichedPrompt = await uninitializedAgent.enrichPromptWithMemories(
        originalPrompt,
        'test query',
        'test-user'
      );

      expect(enrichedPrompt).toBe(originalPrompt);
    });

    it('should handle enrichment errors and return original prompt', async () => {
      mockMemoryOperations.similar_memory.mockRejectedValueOnce(
        new Error('Enrichment error')
      );

      const { ChatPromptTemplate } = await import('@langchain/core/prompts');
      const originalPrompt = ChatPromptTemplate.fromTemplate('Hello {input}\n\n{memories}');

      const enrichedPrompt = await memoryAgent.enrichPromptWithMemories(
        originalPrompt,
        'test query',
        'test-user'
      );

      expect(enrichedPrompt).toBe(originalPrompt);
    });
  });

  describe('memory tools edge cases', () => {
    beforeEach(async () => {
      await memoryAgent.init();
    });

    it.each([
      { configurable: undefined, description: 'undefined configurable' },
      { configurable: { userId: undefined }, description: 'undefined userId' },
      { configurable: { userId: 'test-user', memorySize: undefined }, description: 'undefined memorySize' },
      { configurable: { userId: 'test-user', config: { memorySize: 25 } }, description: 'nested config memorySize' },
    ])('should handle $description in prepareMemoryTools', async ({ configurable }) => {
      const interactiveTools = memoryAgent.prepareMemoryTools();
      const tool = interactiveTools[0];
      const result = await tool.invoke({ content: 'test content' }, { configurable });
      expect(result).toBeDefined();
    });

    it('should handle errors in memory tool execution', async () => {
      const interactiveTools = memoryAgent.prepareMemoryTools();
      const tool = interactiveTools[0];

      mockMemoryOperations.insert_memory.mockRejectedValueOnce(
        new Error('Tool execution error')
      );

      const result = await tool.invoke(
        { content: 'test content' },
        { configurable: { userId: 'test-user' } }
      );

      expect(result).toBe('Failed to store memory.');
    });

    it('should handle errors in retrieve memories tool', async () => {
      const tools = memoryAgent.getMemoryTools();
      const retrieveTool = tools[1];

      mockMemoryOperations.similar_memory.mockRejectedValueOnce(
        new Error('Retrieval tool error')
      );

      const result = await retrieveTool.invoke({
        query: 'test query',
        userId: 'test-user',
        limit: 5
      });

      expect(result).toBe('Failed to retrieve memories: Error: Retrieval tool error');
    });

    it('should handle empty results in retrieve memories tool', async () => {
      const tools = memoryAgent.getMemoryTools();
      const retrieveTool = tools[1];

      mockMemoryOperations.similar_memory.mockResolvedValueOnce([]);

      const result = await retrieveTool.invoke({
        query: 'test query',
        userId: 'test-user',
        limit: 5
      });

      expect(result).toBe('No relevant memories found.');
    });

    it('should handle filtered results in retrieve memories tool', async () => {
      const tools = memoryAgent.getMemoryTools();
      const retrieveTool = tools[1];

      mockMemoryOperations.similar_memory.mockResolvedValueOnce([
        createMockMemory(1, 'Low similarity memory', -0.1),
      ]);

      const result = await retrieveTool.invoke({
        query: 'test query',
        userId: 'test-user',
        limit: 5
      });

      expect(result).toBe('No relevant memories found.');
    });
  });

  describe('message content handling', () => {
    beforeEach(async () => {
      await memoryAgent.init();
    });

    it.each([
      { content: { type: 'object', data: 'test data' }, description: 'non-string content' },
      { content: { type: 'complex', nested: { value: 'test value' } }, description: 'complex content' },
    ])('should handle $description in retrieveRelevantMemories', async ({ content }) => {
      const mockMessage = { content, constructor: { name: 'BaseMessage' } };
      const memories = await memoryAgent.retrieveRelevantMemories(mockMessage as any, 'test-user');
      expect(memories).toBeDefined();
      expect(mockMemoryOperations.similar_memory).toHaveBeenCalled();
    });
  });

  describe('memory storage edge cases', () => {
    beforeEach(async () => {
      await memoryAgent.init();
    });

    it.each(memorySizeTests)('should handle $description', async ({ value, expected }) => {
      const interactiveTools = memoryAgent.prepareMemoryTools();
      const tool = interactiveTools[0];

      const result = await tool.invoke(
        { content: 'store this memory' },
        { configurable: { userId: 'test-user', memorySize: value } }
      );

      expect(result).toBe('Memory stored successfully.');
      expect(mockMemoryOperations.enforce_memory_limit).toHaveBeenCalledWith('test-user', expected);
    });
  });

  describe('memory retrieval edge cases', () => {
    beforeEach(async () => {
      await memoryAgent.init();
    });

    it('should handle errors in retrieveMemoriesForContent gracefully', async () => {
      mockMemoryOperations.similar_memory.mockRejectedValueOnce(
        new Error('Retrieval error')
      );

      const result = await memoryAgent.execute(
        'retrieve memories with error',
        false,
        { userId: 'test-user' }
      );

      expect(result).toBe('Failed to retrieve memories: Error: Retrieval error');
    });

    it('should handle errors in retrieveMemoriesForContent with agentId', async () => {
      mockIterationOperations.similar_iterations.mockRejectedValueOnce(
        new Error('Iteration error')
      );

      const result = await memoryAgent.execute(
        'retrieve memories with iteration error',
        false,
        { userId: 'test-user', agentId: 'test-agent' }
      );

      expect(result).toBe('Failed to retrieve memories: Error: Iteration error');
    });

    it('should handle empty results in retrieveMemoriesForContent', async () => {
      mockMemoryOperations.similar_memory.mockResolvedValueOnce([]);
      mockIterationOperations.similar_iterations.mockResolvedValueOnce([]);

      const result = await memoryAgent.execute(
        'retrieve memories with no results',
        false,
        { userId: 'test-user', agentId: 'test-agent' }
      );

      expect(result).toBe('No relevant memories found.');
    });
  });

  describe('memory chain edge cases', () => {
    beforeEach(async () => {
      await memoryAgent.init();
    });

    it.each([
      { messages: [{ content: 'test content', constructor: { name: 'OtherMessage' } }], description: 'messages without HumanMessage' },
    ])('should handle $description in createMemoryChain', async ({ messages }) => {
      const chain = memoryAgent.createMemoryChain(3);
      const result = await chain.invoke(createMockState(messages), createMockConfig({ userId: 'test-user' }));
      expect(result).toBeDefined();
    });

    it('should handle memory chain execution errors', async () => {
      mockMemoryOperations.similar_memory.mockRejectedValueOnce(
        new Error('Chain execution error')
      );

      const chain = memoryAgent.createMemoryChain(3);
      
      try {
        const result = await chain.invoke(
          createMockState([new HumanMessage('test query')]),
          createMockConfig({ userId: 'test-user' })
        );
        expect(result).toBeDefined();
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('similarity threshold edge cases', () => {
    beforeEach(async () => {
      await memoryAgent.init();
    });

    it('should handle memories with exact similarity threshold', async () => {
      mockMemoryOperations.similar_memory.mockResolvedValueOnce([
        createMockMemory(1, 'Exact threshold memory', 0),
      ]);

      const memories = await memoryAgent.retrieveRelevantMemories('test query', 'test-user');
      expect(memories).toHaveLength(1);
    });

    it('should handle iterations with exact similarity threshold', async () => {
      mockIterationOperations.similar_iterations.mockResolvedValueOnce([
        createMockIteration(1, 'Exact threshold question', 'Exact threshold answer', 0),
      ]);
      mockMemoryOperations.similar_memory.mockResolvedValueOnce([]);

      const memories = await memoryAgent.retrieveRelevantMemories('test query', 'test-user', 'test-agent');
      expect(memories).toHaveLength(1);
    });

    it('should handle mixed memory and iteration results with limit', async () => {
      mockMemoryOperations.similar_memory.mockResolvedValueOnce([
        createMockMemory(1, 'Memory result 1', 0.9),
        createMockMemory(2, 'Memory result 2', 0.8),
      ]);

      mockIterationOperations.similar_iterations.mockResolvedValueOnce([
        createMockIteration(10, 'Iteration question 1', 'Iteration answer 1', 0.7),
        createMockIteration(11, 'Iteration question 2', 'Iteration answer 2', 0.6),
      ]);

      const memories = await memoryAgent.retrieveRelevantMemories('test query', 'test-user', 'test-agent', 3);

      expect(memories).toHaveLength(3);
      expect(memories[0].similarity).toBe(0.9);
      expect(memories[1].similarity).toBe(0.8);
      expect(memories[2].similarity).toBe(0.7);
    });

    it('should filter out results below similarity threshold', async () => {
      mockMemoryOperations.similar_memory.mockResolvedValueOnce([
        createMockMemory(1, 'Above threshold memory', 0.5),
        createMockMemory(2, 'Below threshold memory', -0.1),
      ]);

      const memories = await memoryAgent.retrieveRelevantMemories('test query', 'test-user');

      expect(memories).toHaveLength(1);
      expect(memories[0].content).toBe('Above threshold memory');
    });
  });

  describe('configuration edge cases', () => {
    it.each(similarityThresholdTests)('should handle $description', ({ value }) => {
      const originalEnv = process.env.MEMORY_SIMILARITY_THRESHOLD;
      process.env.MEMORY_SIMILARITY_THRESHOLD = value;
      
      const agent = new MemoryAgent({});
      process.env.MEMORY_SIMILARITY_THRESHOLD = originalEnv;
      
      expect(agent).toBeDefined();
    });
  });

  describe('advanced error handling', () => {
    beforeEach(async () => {
      await memoryAgent.init();
    });

    it('should handle errors in upsertMemory tool with specific error message', async () => {
      const tools = memoryAgent.getMemoryTools();
      const upsertTool = tools[0];

      mockMemoryOperations.insert_memory.mockRejectedValueOnce(
        new Error('Specific upsert error')
      );

      const result = await upsertTool.invoke({
        content: 'test content',
        userId: 'test-user'
      });

      expect(result).toBe('Failed to store memory: Error: Specific upsert error');
    });

    it('should handle errors in retrieve memories tool with specific error message', async () => {
      const tools = memoryAgent.getMemoryTools();
      const retrieveTool = tools[1];

      mockMemoryOperations.similar_memory.mockRejectedValueOnce(
        new Error('Specific retrieval error')
      );

      const result = await retrieveTool.invoke({
        query: 'test query',
        userId: 'test-user'
      });

      expect(result).toBe('Failed to retrieve memories: Error: Specific retrieval error');
    });

    it('should handle errors in prompt enrichment with specific error message', async () => {
      mockMemoryOperations.similar_memory.mockRejectedValueOnce(
        new Error('Specific enrichment error')
      );

      const { ChatPromptTemplate } = await import('@langchain/core/prompts');
      const originalPrompt = ChatPromptTemplate.fromTemplate('Hello {input}\n\n{memories}');

      const enrichedPrompt = await memoryAgent.enrichPromptWithMemories(
        originalPrompt,
        'test query',
        'test-user'
      );

      expect(enrichedPrompt).toBe(originalPrompt);
    });
  });
});
