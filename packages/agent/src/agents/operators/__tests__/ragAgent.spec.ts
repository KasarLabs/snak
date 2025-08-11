// Mock external dependencies BEFORE importing
// Note: @snakagent/core is mocked via Jest moduleNameMapper in jest.config.cjs

jest.mock('@snakagent/database/queries', () => ({
  rag: {
    init: jest.fn().mockResolvedValue(undefined),
    search: jest.fn().mockResolvedValue([
      {
        id: 'vec1',
        document_id: 'doc1',
        chunk_index: 0,
        content: 'This is a test document about blockchain technology',
        original_name: 'test1.txt',
        mime_type: 'text/plain',
        similarity: 0.85,
      },
      {
        id: 'vec2',
        document_id: 'doc2',
        chunk_index: 1,
        content: 'Another document about DeFi protocols',
        original_name: 'test2.txt',
        mime_type: 'text/plain',
        similarity: 0.72,
      },
    ]),
  },
}));

jest.mock('@snakagent/core', () => ({
  logger: {
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
  CustomHuggingFaceEmbeddings: jest.fn().mockImplementation(() => ({
    embedQuery: jest.fn().mockResolvedValue([0.1, 0.2, 0.3, 0.4, 0.5]),
  })),
}));

import { RagAgent } from '../ragAgent.js';
import { HumanMessage } from '@langchain/core/messages';
import { ChatPromptTemplate } from '@langchain/core/prompts';

// Get the mocked modules for testing
const { rag: mockRagOperations } = jest.requireMock(
  '@snakagent/database/queries'
);
const { CustomHuggingFaceEmbeddings: MockEmbeddings } =
  jest.requireMock('@snakagent/core');

describe('RagAgent', () => {
  let ragAgent: RagAgent;
  interface MockEmbeddings {
    embedQuery: jest.Mock<Promise<number[]>, [string]>;
  }
  let mockEmbeddings: MockEmbeddings;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset mock implementations
    mockRagOperations.init.mockResolvedValue(undefined);
    mockRagOperations.search.mockResolvedValue([
      {
        id: 'vec1',
        document_id: 'doc1',
        chunk_index: 0,
        content: 'This is a test document about blockchain technology',
        original_name: 'test1.txt',
        mime_type: 'text/plain',
        similarity: 0.85,
      },
      {
        id: 'vec2',
        document_id: 'doc2',
        chunk_index: 1,
        content: 'Another document about DeFi protocols',
        original_name: 'test2.txt',
        mime_type: 'text/plain',
        similarity: 0.72,
      },
    ]);

    // Create mock embeddings instance
    mockEmbeddings = {
      embedQuery: jest.fn().mockResolvedValue([0.1, 0.2, 0.3, 0.4, 0.5]),
    };
    (MockEmbeddings as jest.Mock).mockImplementation(() => mockEmbeddings);

    // Create rag agent instance
    ragAgent = new RagAgent({
      topK: 4,
      embeddingModel: 'Xenova/all-MiniLM-L6-v2',
    });
  });

  describe('initialization', () => {
    it('should initialize with default configuration values', () => {
      const agent = new RagAgent({});

      expect(agent).toBeDefined();
      expect(agent.id).toBe('rag-agent');
    });

    it('should initialize with custom configuration', () => {
      const customConfig = {
        topK: 10,
        embeddingModel: 'custom-model',
      };

      const agent = new RagAgent(customConfig);
      expect(agent).toBeDefined();
      expect(MockEmbeddings).toHaveBeenCalledWith({
        model: 'custom-model',
        dtype: 'fp32',
      });
    });

    it('should initialize embeddings with default model when not specified', () => {
      const agent = new RagAgent({});

      expect(MockEmbeddings).toHaveBeenCalledWith({
        model: 'Xenova/all-MiniLM-L6-v2',
        dtype: 'fp32',
      });
    });
  });

  describe('init', () => {
    it('should initialize rag operations successfully', async () => {
      await ragAgent.init();

      expect(mockRagOperations.init).toHaveBeenCalledTimes(1);
    });

    it('should set initialized flag to true after successful init', async () => {
      await ragAgent.init();

      // Test that the agent is now initialized by calling a method that requires initialization
      const result = await ragAgent.execute('test query');
      expect(result).toBeDefined();
    });
  });

  describe('retrieveRelevantRag', () => {
    beforeEach(async () => {
      await ragAgent.init();
    });

    it('should retrieve relevant documents for string query', async () => {
      const query = 'blockchain technology';
      const results = await ragAgent.retrieveRelevantRag(
        query,
        4,
        'test-agent'
      );

      expect(mockEmbeddings.embedQuery).toHaveBeenCalledWith(query);
      expect(mockRagOperations.search).toHaveBeenCalledWith(
        [0.1, 0.2, 0.3, 0.4, 0.5],
        'test-agent',
        4
      );
      expect(results).toHaveLength(2);
      expect(results[0].document_id).toBe('doc1');
    });

    it('should retrieve relevant documents for BaseMessage query', async () => {
      const message = new HumanMessage('blockchain technology');
      const results = await ragAgent.retrieveRelevantRag(
        message,
        4,
        'test-agent'
      );

      expect(mockEmbeddings.embedQuery).toHaveBeenCalledWith(
        'blockchain technology'
      );
      expect(results).toHaveLength(2);
    });

    it('should filter results based on similarity threshold', async () => {
      // Mock results with some below threshold
      mockRagOperations.search.mockResolvedValue([
        {
          id: 'vec1',
          document_id: 'doc1',
          chunk_index: 0,
          content: 'High similarity document',
          original_name: 'high.txt',
          mime_type: 'text/plain',
          similarity: 0.85,
        },
        {
          id: 'vec2',
          document_id: 'doc2',
          chunk_index: 1,
          content: 'Low similarity document',
          original_name: 'low.txt',
          mime_type: 'text/plain',
          similarity: 0.3,
        },
      ]);

      const results = await ragAgent.retrieveRelevantRag('test query');

      // Should only return documents above threshold (0.5 by default)
      expect(results).toHaveLength(1);
      expect(results[0].document_id).toBe('doc1');
    });

    it('should throw error when not initialized', async () => {
      const uninitializedAgent = new RagAgent();

      await expect(
        uninitializedAgent.retrieveRelevantRag('test query')
      ).rejects.toThrow('RagAgent: Not initialized');
    });

    it('should use default topK when not specified', async () => {
      const results = await ragAgent.retrieveRelevantRag('test query');

      expect(mockRagOperations.search).toHaveBeenCalledWith(
        [0.1, 0.2, 0.3, 0.4, 0.5],
        '',
        4 // default topK
      );
    });
  });

  describe('formatRagForContext', () => {
    it('should format empty results as empty string', () => {
      const result = ragAgent.formatRagForContext([]);
      expect(result).toBe('');
    });

    it('should format results with proper structure', () => {
      const results = [
        {
          id: 'vec1',
          document_id: 'doc1',
          chunk_index: 0,
          content: 'Test content 1',
          original_name: 'test1.txt',
          mime_type: 'text/plain',
          similarity: 0.85,
        },
        {
          id: 'vec2',
          document_id: 'doc2',
          chunk_index: 1,
          content: 'Test content 2',
          original_name: 'test2.txt',
          mime_type: 'text/plain',
          similarity: 0.72,
        },
      ];

      const formatted = ragAgent.formatRagForContext(results);

      expect(formatted).toContain('### Rag Context');
      expect(formatted).toContain(
        'Rag [id: doc1, chunk: 0, similarity: 0.8500]: Test content 1'
      );
      expect(formatted).toContain(
        'Rag [id: doc2, chunk: 1, similarity: 0.7200]: Test content 2'
      );
      expect(formatted).toContain('Instructions:');
    });
  });

  describe('enrichPromptWithRag', () => {
    beforeEach(async () => {
      await ragAgent.init();
    });

    it('should enrich prompt with rag context', async () => {
      const prompt = ChatPromptTemplate.fromTemplate(
        'Answer this: {question}\n\nContext: {rag}'
      );
      const message = 'What is blockchain?';

      const enrichedPrompt = await ragAgent.enrichPromptWithRag(
        prompt,
        message,
        4,
        'test-agent'
      );

      expect(enrichedPrompt).toBeDefined();
      // The prompt should be enriched with rag context
    });

    it('should return original prompt when no relevant documents found', async () => {
      mockRagOperations.search.mockResolvedValue([]);

      const prompt = ChatPromptTemplate.fromTemplate('Answer this: {question}');
      const message = 'What is blockchain?';

      const enrichedPrompt = await ragAgent.enrichPromptWithRag(
        prompt,
        message,
        4,
        'test-agent'
      );

      expect(enrichedPrompt).toBe(prompt);
    });
  });

  describe('execute', () => {
    beforeEach(async () => {
      await ragAgent.init();
    });

    it('should execute search with string input', async () => {
      const result = await ragAgent.execute('test query');

      expect(result).toContain('### Rag Context');
      expect(result).toContain(
        'This is a test document about blockchain technology'
      );
    });

    it('should execute search with BaseMessage input', async () => {
      const message = new HumanMessage('test query');
      const result = await ragAgent.execute(message);

      expect(result).toContain('### Rag Context');
    });

    it('should execute search with object input', async () => {
      const input = { query: 'test query' };
      const result = await ragAgent.execute(input);

      expect(result).toContain('### Rag Context');
    });

    it('should return raw results when raw config is true', async () => {
      const result = await ragAgent.execute('test query', false, { raw: true });

      expect(Array.isArray(result)).toBe(true);
      expect(result[0]).toHaveProperty('document_id');
      expect(result[0]).toHaveProperty('content');
    });

    it('should use custom topK from config', async () => {
      await ragAgent.execute('test query', false, { topK: 10 });

      expect(mockRagOperations.search).toHaveBeenCalledWith(
        [0.1, 0.2, 0.3, 0.4, 0.5],
        '',
        10
      );
    });

    it('should use agentId from config', async () => {
      await ragAgent.execute('test query', false, { agentId: 'custom-agent' });

      expect(mockRagOperations.search).toHaveBeenCalledWith(
        [0.1, 0.2, 0.3, 0.4, 0.5],
        'custom-agent',
        4
      );
    });

    it('should throw error when not initialized', async () => {
      const uninitializedAgent = new RagAgent();

      await expect(uninitializedAgent.execute('test query')).rejects.toThrow(
        'RagAgent: Not initialized'
      );
    });
  });

  describe('createRagChain', () => {
    beforeEach(async () => {
      await ragAgent.init();
    });

    it('should create a rag chain for given agentId', () => {
      const chain = ragAgent.createRagChain('test-agent');

      expect(chain).toBeDefined();
      expect(typeof chain.invoke).toBe('function');
    });

    it('should create chain with correct configuration', () => {
      const chain = ragAgent.createRagChain('test-agent');

      // Test that the chain can be invoked
      expect(chain).toBeDefined();
    });
  });

  describe('createRagNode', () => {
    beforeEach(async () => {
      await ragAgent.init();
    });

    it('should create a rag node function', () => {
      const node = ragAgent.createRagNode('test-agent');

      expect(typeof node).toBe('function');
    });

    it('should handle errors gracefully in rag node', async () => {
      mockRagOperations.search.mockRejectedValue(new Error('Database error'));

      const node = ragAgent.createRagNode('test-agent');
      const state = {
        messages: [new HumanMessage('test query')],
      };

      const result = await node(state);

      expect(result).toEqual({ rag: '' });
    });

    it('should return rag context from node', async () => {
      const node = ragAgent.createRagNode('test-agent');
      const state = {
        messages: [new HumanMessage('test query')],
      };

      const result = await node(state);

      expect(result).toHaveProperty('rag');
      expect(typeof result.rag).toBe('string');
    });
  });

  describe('environment variable handling', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      jest.resetModules();
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should use default similarity threshold when env var is not set', async () => {
      delete process.env.RAG_SIMILARITY_THRESHOLD;

      // Re-import to trigger the threshold calculation
      jest.resetModules();
      const { RagAgent } = await import('../ragAgent.js');

      const agent = new RagAgent();
      expect(agent).toBeDefined();
    });

    it('should use custom similarity threshold from env var', async () => {
      process.env.RAG_SIMILARITY_THRESHOLD = '0.7';

      // Re-import to trigger the threshold calculation
      jest.resetModules();
      const { RagAgent } = await import('../ragAgent.js');

      const agent = new RagAgent();
      expect(agent).toBeDefined();
    });

    it('should handle invalid similarity threshold gracefully', async () => {
      process.env.RAG_SIMILARITY_THRESHOLD = 'invalid';

      // Re-import to trigger the threshold calculation
      jest.resetModules();
      const { RagAgent } = await import('../ragAgent.js');

      const agent = new RagAgent();
      expect(agent).toBeDefined();
    });
  });

  describe('integration tests', () => {
    beforeEach(async () => {
      await ragAgent.init();
    });

    it('should handle complete rag workflow', async () => {
      const query = 'blockchain technology';

      // Test retrieval
      const results = await ragAgent.retrieveRelevantRag(
        query,
        4,
        'test-agent'
      );
      expect(results).toHaveLength(2);

      // Test formatting
      const formatted = ragAgent.formatRagForContext(results);
      expect(formatted).toContain('### Rag Context');

      // Test execution
      const executed = await ragAgent.execute(query);
      expect(executed).toContain('### Rag Context');

      // Test prompt enrichment
      const prompt = ChatPromptTemplate.fromTemplate('Answer: {rag}');
      const enriched = await ragAgent.enrichPromptWithRag(
        prompt,
        query,
        4,
        'test-agent'
      );
      expect(enriched).toBeDefined();
    });

    it('should handle chain and node creation', async () => {
      const chain = ragAgent.createRagChain('test-agent');
      const node = ragAgent.createRagNode('test-agent');

      const state = {
        messages: [new HumanMessage('test query')],
      };

      const chainResult = await chain.invoke(state);
      const nodeResult = await node(state);

      expect(chainResult).toHaveProperty('rag');
      expect(nodeResult).toHaveProperty('rag');
    });
  });
});
