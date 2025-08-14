// Mock external dependencies BEFORE importing
jest.mock('@snakagent/database/queries', () => ({
  rag: {
    init: jest.fn().mockResolvedValue(undefined),
    search: jest.fn().mockResolvedValue([]),
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

// Factory functions for fixtures
const createSearchResult = (overrides = {}) => ({
  id: 'vec1',
  document_id: 'doc1',
  chunk_index: 0,
  content: 'Test document content',
  original_name: 'test.txt',
  mime_type: 'text/plain',
  similarity: 0.85,
  ...overrides,
});

const createDefaultResults = () => [
  createSearchResult({
    id: 'vec1',
    document_id: 'doc1',
    content: 'This is a test document about blockchain technology',
    similarity: 0.85,
  }),
  createSearchResult({
    id: 'vec2',
    document_id: 'doc2',
    chunk_index: 1,
    content: 'Another document about DeFi protocols',
    original_name: 'test2.txt',
    similarity: 0.72,
  }),
];

describe('RagAgent', () => {
  let ragAgent: RagAgent;
  let mockEmbeddings: { embedQuery: jest.Mock };

  const setupMocks = (searchResults = createDefaultResults()) => {
    mockRagOperations.init.mockResolvedValue(undefined);
    mockRagOperations.search.mockResolvedValue(searchResults);
    mockEmbeddings = {
      embedQuery: jest.fn().mockResolvedValue([0.1, 0.2, 0.3, 0.4, 0.5]),
    };
    (MockEmbeddings as jest.Mock).mockImplementation(() => mockEmbeddings);
  };

  beforeEach(() => {
    jest.clearAllMocks();
    setupMocks();
    ragAgent = new RagAgent({
      topK: 4,
      embeddingModel: 'Xenova/all-MiniLM-L6-v2',
    });
  });

  describe('initialization', () => {
    it.each([
      ['default config', {}, 'rag-agent', 'Xenova/all-MiniLM-L6-v2'],
      [
        'custom config',
        { topK: 10, embeddingModel: 'custom-model' },
        'rag-agent',
        'custom-model',
      ],
    ])('should initialize with %s', (_, config, expectedId, expectedModel) => {
      const agent = new RagAgent(config);

      expect(agent).toBeDefined();
      expect(agent.id).toBe(expectedId);
      expect(MockEmbeddings).toHaveBeenCalledWith({
        model: expectedModel,
        dtype: 'fp32',
      });
    });
  });

  describe('init', () => {
    it('should initialize successfully and enable execution', async () => {
      await ragAgent.init();

      expect(mockRagOperations.init).toHaveBeenCalledTimes(1);

      // Verify initialization enables execution
      const result = await ragAgent.execute('test query');
      expect(result).toBeDefined();
    });
  });

  describe('retrieveRelevantRag', () => {
    beforeEach(async () => {
      await ragAgent.init();
    });

    describe('successful retrieval', () => {
      it.each([
        ['string query', 'blockchain technology'],
        ['BaseMessage query', new HumanMessage('blockchain technology')],
      ])('should retrieve documents for %s', async (_, query) => {
        const results = await ragAgent.retrieveRelevantRag(
          query,
          4,
          'test-agent'
        );

        expect(mockEmbeddings.embedQuery).toHaveBeenCalledWith(
          'blockchain technology'
        );
        expect(mockRagOperations.search).toHaveBeenCalledWith(
          [0.1, 0.2, 0.3, 0.4, 0.5],
          'test-agent',
          4
        );
        expect(results).toHaveLength(2);
        expect(results[0].document_id).toBe('doc1');
      });

      it('should use default parameters when not specified', async () => {
        const results = await ragAgent.retrieveRelevantRag('test query');

        expect(mockRagOperations.search).toHaveBeenCalledWith(
          [0.1, 0.2, 0.3, 0.4, 0.5],
          '',
          4
        );
      });
    });

    describe('similarity filtering', () => {
      it('should filter results below similarity threshold', async () => {
        setupMocks([
          createSearchResult({ document_id: 'doc1', similarity: 0.85 }),
          createSearchResult({ document_id: 'doc2', similarity: 0.3 }),
        ]);

        const results = await ragAgent.retrieveRelevantRag('test query');

        expect(results).toHaveLength(1);
        expect(results[0].document_id).toBe('doc1');
      });
    });

    describe('error cases', () => {
      it('should throw error when not initialized', async () => {
        const uninitializedAgent = new RagAgent();

        await expect(
          uninitializedAgent.retrieveRelevantRag('test query')
        ).rejects.toThrow('RagAgent: Not initialized');
      });
    });
  });

  describe('formatRagForContext', () => {
    it.each([
      ['empty results', [], ''],
      [
        'single result',
        [createSearchResult()],
        expect.stringContaining('### Rag Context'),
      ],
      [
        'multiple results',
        createDefaultResults(),
        expect.stringContaining(
          'Rag [id: doc1, chunk: 0, similarity: 0.8500]: This is a test document about blockchain technology'
        ),
      ],
    ])('should format %s correctly', (_, results, expected) => {
      const formatted = ragAgent.formatRagForContext(results);

      if (typeof expected === 'string') {
        expect(formatted).toBe(expected);
      } else {
        expect(formatted).toEqual(expected);
      }
    });

    it('should include proper structure and instructions', () => {
      const formatted = ragAgent.formatRagForContext(createDefaultResults());

      expect(formatted).toContain('### Rag Context');
      expect(formatted).toContain('Instructions:');
      expect(formatted).toContain(
        'Rag [id: doc2, chunk: 1, similarity: 0.7200]: Another document about DeFi protocols'
      );
    });
  });

  describe('enrichPromptWithRag', () => {
    beforeEach(async () => {
      await ragAgent.init();
    });

    it('should enrich prompt when relevant documents found', async () => {
      const prompt = ChatPromptTemplate.fromTemplate(
        'Answer this: {question}\n\nContext: {rag}'
      );

      const enrichedPrompt = await ragAgent.enrichPromptWithRag(
        prompt,
        'What is blockchain?',
        4,
        'test-agent'
      );

      expect(enrichedPrompt).toBeDefined();
      expect(enrichedPrompt).not.toBe(prompt);
    });

    it('should return original prompt when no documents found', async () => {
      setupMocks([]);
      const prompt = ChatPromptTemplate.fromTemplate('Answer this: {question}');

      const enrichedPrompt = await ragAgent.enrichPromptWithRag(
        prompt,
        'What is blockchain?',
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

    describe('successful execution', () => {
      it.each([
        ['string input', 'test query'],
        ['BaseMessage input', new HumanMessage('test query')],
        ['object input', { query: 'test query' }],
      ])('should execute with %s', async (_, input) => {
        const result = await ragAgent.execute(input);

        expect(result).toContain('### Rag Context');
        expect(result).toContain(
          'This is a test document about blockchain technology'
        );
      });
    });

    describe('configuration options', () => {
      it('should return raw results when raw config is true', async () => {
        const result = await ragAgent.execute('test query', false, {
          raw: true,
        });

        expect(Array.isArray(result)).toBe(true);
        expect(result[0]).toHaveProperty('document_id');
        expect(result[0]).toHaveProperty('content');
      });

      it.each([
        ['custom topK', { topK: 10 }, [0.1, 0.2, 0.3, 0.4, 0.5], '', 10],
        [
          'custom agentId',
          { agentId: 'custom-agent' },
          [0.1, 0.2, 0.3, 0.4, 0.5],
          'custom-agent',
          4,
        ],
      ])(
        'should use %s from config',
        async (_, config, expectedEmbedding, expectedAgentId, expectedTopK) => {
          await ragAgent.execute('test query', false, config);

          expect(mockRagOperations.search).toHaveBeenCalledWith(
            expectedEmbedding,
            expectedAgentId,
            expectedTopK
          );
        }
      );
    });

    describe('error cases', () => {
      it('should throw error when not initialized', async () => {
        const uninitializedAgent = new RagAgent();

        await expect(uninitializedAgent.execute('test query')).rejects.toThrow(
          'RagAgent: Not initialized'
        );
      });
    });
  });

  describe('createRagChain', () => {
    beforeEach(async () => {
      await ragAgent.init();
    });

    it('should create executable chain', () => {
      const chain = ragAgent.createRagChain('test-agent');

      expect(chain).toBeDefined();
      expect(typeof chain.invoke).toBe('function');
    });
  });

  describe('createRagNode', () => {
    beforeEach(async () => {
      await ragAgent.init();
    });

    it('should create executable node function', () => {
      const node = ragAgent.createRagNode('test-agent');

      expect(typeof node).toBe('function');
    });

    it('should handle errors gracefully', async () => {
      mockRagOperations.search.mockRejectedValue(new Error('Database error'));
      const node = ragAgent.createRagNode('test-agent');
      const state = { messages: [new HumanMessage('test query')] };

      const result = await node(state);

      expect(result).toEqual({ rag: '' });
    });

    it('should return rag context from node', async () => {
      const node = ragAgent.createRagNode('test-agent');
      const state = { messages: [new HumanMessage('test query')] };

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

    it.each([
      ['not set', undefined],
      ['valid threshold', '0.7'],
      ['invalid threshold', 'invalid'],
    ])(
      'should handle similarity threshold when env var is %s',
      async (_, thresholdValue) => {
        if (thresholdValue === undefined) {
          delete process.env.RAG_SIMILARITY_THRESHOLD;
        } else {
          process.env.RAG_SIMILARITY_THRESHOLD = thresholdValue;
        }

        jest.resetModules();
        const { RagAgent } = await import('../ragAgent.js');
        const agent = new RagAgent();

        expect(agent).toBeDefined();
      }
    );
  });

  describe('integration workflow', () => {
    beforeEach(async () => {
      await ragAgent.init();
    });

    it('should handle complete workflow from retrieval to chain execution', async () => {
      const query = 'blockchain technology';

      // Test complete workflow
      const results = await ragAgent.retrieveRelevantRag(
        query,
        4,
        'test-agent'
      );
      const formatted = ragAgent.formatRagForContext(results);
      const executed = await ragAgent.execute(query);
      const chain = ragAgent.createRagChain('test-agent');
      const node = ragAgent.createRagNode('test-agent');

      const state = { messages: [new HumanMessage(query)] };
      const chainResult = await chain.invoke(state);
      const nodeResult = await node(state);

      expect(results).toHaveLength(2);
      expect(formatted).toContain('### Rag Context');
      expect(executed).toContain('### Rag Context');
      expect(chainResult).toHaveProperty('rag');
      expect(nodeResult).toHaveProperty('rag');
    });
  });
});
