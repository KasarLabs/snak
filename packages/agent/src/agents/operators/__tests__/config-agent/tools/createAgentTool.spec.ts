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

jest.mock('../../../config-agent/tools/normalizeAgentValues.js', () => ({
  normalizeNumericValues: jest.fn(),
}));

describe('createAgentTool', () => {
  let mockPostgres: any;
  let mockLogger: any;
  let mockNormalize: any;

  const setupMocks = () => {
    mockPostgres = require('@snakagent/database').Postgres;
    mockLogger = require('@snakagent/core').logger;
    mockNormalize =
      require('../../../config-agent/tools/normalizeAgentValues.js').normalizeNumericValues;

    mockPostgres.Query.mockImplementation((query: string, params: any[]) => ({
      query,
      params,
    }));
    mockNormalize.mockReturnValue({
      normalizedConfig: {
        interval: 5,
        max_iterations: 15,
        memory: { shortTermMemorySize: 5, memorySize: 20 },
      },
      appliedDefaults: [],
    });
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
          null,
          'interactive',
          15,
        ],
      },
      {
        name: 'all fields present',
        input: {
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
        },
        expected: [
          'full',
          'trading',
          'desc',
          ['l1'],
          ['o1'],
          ['k1'],
          'prompt',
          5,
          ['p1'],
          true,
          5,
          20,
          true,
          'model',
          'autonomous',
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
          null,
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

    it('should use normalized values from normalizeNumericValues', async () => {
      mockNormalize.mockReturnValue({
        normalizedConfig: {
          interval: 10,
          max_iterations: 25,
          memory: { shortTermMemorySize: 15, memorySize: 50 },
        },
        appliedDefaults: ['interval set to 10', 'max_iterations set to 25'],
      });
      mockPostgres.query.mockResolvedValue([mkRow()]);

      await createAgentTool.func({
        name: 'test',
        group: 'test',
        description: 'test',
      });

      expect(mockNormalize).toHaveBeenCalledWith({
        name: 'test',
        group: 'test',
        description: 'test',
      });
      expect(mockPostgres.Query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([10, 15, 50, 25])
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
          false,
          5,
          20,
          false,
          null,
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
      expect(parsed.message).toBe('Agent "success-agent" created successfully');
    });

    it('should include appliedDefaults in message when present', async () => {
      mockNormalize.mockReturnValue({
        normalizedConfig: {
          interval: 5,
          max_iterations: 15,
          memory: { shortTermMemorySize: 5, memorySize: 20 },
        },
        appliedDefaults: ['interval set to 5', 'max_iterations set to 15'],
      });
      mockPostgres.query.mockResolvedValue([mkRow()]);

      const result = await createAgentTool.func({
        name: 'test',
        group: 'test',
        description: 'test',
      });
      const parsed = asJson(result);

      expect(parsed.message).toContain(
        'Note: interval set to 5; max_iterations set to 15'
      );
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
          complexInput.memory.enabled,
          complexInput.rag.enabled,
          complexInput.rag.embeddingModel,
        ])
      );
    });
  });
});
