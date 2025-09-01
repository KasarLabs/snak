import { createAgentTool } from '../../../config-agent/tools/createAgentTool.js';

// Mocks
jest.mock('@snakagent/database', () => ({
  Postgres: {
    Query: jest.fn(),
    query: jest.fn(),
  },
}));

jest.mock('@snakagent/core', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
  },
}));

describe('createAgentTool', () => {
  let mockPostgres: any;
  let mockLogger: any;

  const setupMocks = () => {
    mockPostgres = require('@snakagent/database').Postgres;
    mockLogger = require('@snakagent/core').logger;

    mockPostgres.Query.mockImplementation((query: string, params: any[]) => ({
      query,
      params,
    }));
  };

  const mkRow = (overrides = {}) => ({
    id: 1,
    name: 'test-agent',
    ...overrides,
  });
  const asJson = (result: string) => JSON.parse(result);

  beforeEach(() => {
    jest.clearAllMocks();
    setupMocks();
  });

  describe('tool configuration', () => {
    it('should have correct name and description', () => {
      expect(createAgentTool.name).toBe('create_agent');
      expect(createAgentTool.description).toContain(
        'Create/add/make a new agent configuration'
      );
    });

    it('should validate schema with safeParse', () => {
      const schema = createAgentTool.schema;
      const result = schema.safeParse({
        name: 'test',
        group: 'test',
        description: 'test',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('normalization & INSERT parameters', () => {
    it.each([
      {
        name: 'minimal fields',
        input: { name: 'test', group: 'test', description: 'test' },
        expected: [
          'test',
          'test',
          'test',
          '',
          '',
          '',
          null,
          5,
          null,
          false,
          5,
          20,
          false,
          'Xenova/all-MiniLM-L6-v2',
          'interactive',
          15,
        ],
      },
      {
        name: 'empty arrays',
        input: {
          name: 'empty',
          group: 'test',
          description: 'test',
          lore: [],
          objectives: [],
          knowledge: [],
          plugins: [],
        },
        expected: [
          'empty',
          'test',
          'test',
          [],
          [],
          [],
          null,
          5,
          [],
          false,
          5,
          20,
          false,
          'Xenova/all-MiniLM-L6-v2',
          'interactive',
          15,
        ],
      },
    ])('should handle $name correctly', async ({ input, expected }) => {
      mockPostgres.query.mockResolvedValue([mkRow()]);

      await createAgentTool.func(input);

      expect(mockPostgres.Query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO agents'),
        expect.arrayContaining(expected)
      );
    });

    it('should handle all fields present correctly', async () => {
      const input = {
        name: 'full',
        group: 'trading',
        description: 'desc',
        lore: ['l1'],
        objectives: ['o1'],
        knowledge: ['k1'],
        system_prompt: 'prompt',
        interval: 300,
        plugins: ['p1'],
        memory: { enabled: true, shortTermMemorySize: 50, memorySize: 100 },
        rag: { enabled: true, embeddingModel: 'model' },
        mode: 'autonomous',
        max_iterations: 10,
      };

      mockPostgres.query.mockResolvedValue([mkRow()]);

      await createAgentTool.func(input);

      expect(mockPostgres.Query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO agents'),
        expect.arrayContaining([
          'full',
          'trading',
          'desc',
          ['l1'],
          ['o1'],
          ['k1'],
          'prompt',
          300,
          ['p1'],
          true,
          50,
          100,
          true,
          'model',
          'autonomous',
          10,
        ])
      );
    });

    it('should use normalized values from normalizeNumericValues', async () => {
      mockPostgres.query.mockResolvedValue([mkRow()]);

      await createAgentTool.func({
        name: 'test',
        group: 'test',
        description: 'test',
      });

      expect(mockPostgres.Query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([5, 5, 20, 15])
      );
    });

    it('should handle null/undefined values with defaults', async () => {
      mockPostgres.query.mockResolvedValue([mkRow()]);

      await createAgentTool.func({
        name: 'test',
        group: 'test',
        description: 'test',
        lore: null,
        objectives: undefined,
        knowledge: null,
        system_prompt: null,
        plugins: undefined,
        memory: null,
        rag: null,
      });

      expect(mockPostgres.Query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([
          '',
          '',
          '',
          null,
          null,
          5,
          null,
          false,
          5,
          20,
          false,
          'Xenova/all-MiniLM-L6-v2',
          'interactive',
          15,
        ])
      );
    });
  });

  describe('success cases', () => {
    it('should return success with data when agent created', async () => {
      const mockRow = mkRow({ name: 'success-agent' });
      mockPostgres.query.mockResolvedValue([mockRow]);

      const result = await createAgentTool.func({
        name: 'success-agent',
        group: 'test',
        description: 'test',
      });
      const parsed = asJson(result);

      expect(parsed.success).toBe(true);
      expect(parsed.data).toEqual(mockRow);
      expect(parsed.message).toContain(
        'Agent "success-agent" created successfully'
      );
      expect(parsed.message).toContain('Note:');
    });

    it('should include appliedDefaults in message when present', async () => {
      mockPostgres.query.mockResolvedValue([mkRow()]);

      const result = await createAgentTool.func({
        name: 'test',
        group: 'test',
        description: 'test',
      });
      const parsed = asJson(result);

      expect(parsed.message).toContain('Note:');
      expect(parsed.message).toContain('interval set to default value (5)');
      expect(parsed.message).toContain(
        'max_iterations set to default value (15)'
      );
      expect(parsed.message).toContain(
        'mode set to default value (interactive)'
      );
      expect(parsed.message).toContain(
        'memory initialized with default values'
      );
      expect(parsed.message).toContain('rag initialized with default values');
    });
  });

  describe('failure cases', () => {
    it('should handle no data returned', async () => {
      mockPostgres.query.mockResolvedValue([]);

      const result = await createAgentTool.func({
        name: 'test',
        group: 'test',
        description: 'test',
      });
      const parsed = asJson(result);

      expect(parsed.success).toBe(false);
      expect(parsed.message).toBe('Failed to create agent - no data returned');
    });

    it.each([
      { error: new Error('DB error'), expected: 'DB error' },
      { error: 'String error', expected: 'String error' },
    ])('should handle database errors: $error', async ({ error, expected }) => {
      mockPostgres.query.mockRejectedValue(error);

      const result = await createAgentTool.func({
        name: 'test',
        group: 'test',
        description: 'test',
      });
      const parsed = asJson(result);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error creating agent:')
      );
      expect(parsed.success).toBe(false);
      expect(parsed.message).toBe('Failed to create agent');
      expect(parsed.error).toBe(expected);
    });

    it('should handle Postgres.Query constructor errors', async () => {
      mockPostgres.Query.mockImplementation(() => {
        throw new Error('Query error');
      });

      const result = await createAgentTool.func({
        name: 'test',
        group: 'test',
        description: 'test',
      });
      const parsed = asJson(result);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error creating agent:')
      );
      expect(parsed.success).toBe(false);
      expect(parsed.error).toBe('Query error');
    });
  });

  describe('pass-through validation', () => {
    it('should preserve complex objects/arrays as-is', async () => {
      const complexInput = {
        name: 'complex',
        group: 'test',
        description: 'test',
        lore: ['very long lore entry', 'another one'],
        objectives: ['complex objective with special chars: !@#$%^&*()'],
        knowledge: ['knowledge with "quotes" and \'apostrophes\''],
        plugins: ['plugin1', 'plugin2', 'plugin3'],
        memory: { enabled: true, shortTermMemorySize: 999, memorySize: 1000 },
        rag: {
          enabled: true,
          embeddingModel: 'very-long-model-name-with-special-chars',
        },
      };

      mockPostgres.query.mockResolvedValue([mkRow()]);

      await createAgentTool.func(complexInput);

      expect(mockPostgres.Query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([
          complexInput.lore,
          complexInput.objectives,
          complexInput.knowledge,
          complexInput.plugins,
          true,
          true,
          'very-long-model-name-with-special-chars',
          5,
          'interactive',
          15,
        ])
      );
    });
  });
});
