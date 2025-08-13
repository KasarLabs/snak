import { createAgentTool } from '../../../config-agent/tools/createAgentTool.js';

// Mock the database
jest.mock('@snakagent/database', () => ({
  Postgres: {
    Query: jest.fn(),
    query: jest.fn(),
  },
}));

// Mock the logger
jest.mock('@snakagent/core', () => ({
  logger: {
    error: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
  },
}));

// Mock normalizeAgentValues
jest.mock('../../../config-agent/tools/normalizeAgentValues.js', () => ({
  normalizeNumericValues: jest.fn(),
}));

describe('createAgentTool', () => {
  let mockPostgres: any;
  let mockLogger: any;
  let mockNormalizeAgentValues: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockPostgres = require('@snakagent/database').Postgres;
    mockLogger = require('@snakagent/core').logger;
    mockNormalizeAgentValues = require('../../../config-agent/tools/normalizeAgentValues.js').normalizeNumericValues;

    // Reset mock implementations
    mockPostgres.Query.mockClear();
    mockPostgres.query.mockClear();
    mockLogger.error.mockClear();
    mockLogger.info.mockClear();
    mockNormalizeAgentValues.mockClear();

    // Configure Postgres.Query to return a mock query object
    mockPostgres.Query.mockImplementation((query: string, params: any[]) => {
      return { query, params };
    });

    // Configure normalizeAgentValues to return a default mock response
    mockNormalizeAgentValues.mockReturnValue({
      normalizedConfig: {
        interval: 5,
        max_iterations: 15,
        memory: {
          shortTermMemorySize: 5,
          memorySize: 20,
        },
      },
      appliedDefaults: [],
    });
  });

  describe('tool configuration', () => {
    it('should have correct name and description', () => {
      expect(createAgentTool.name).toBe('create_agent');
      expect(createAgentTool.description).toContain(
        'Create/add/make a new agent configuration'
      );
    });

    it('should have proper schema validation', () => {
      const schema = createAgentTool.schema;
      expect(schema).toBeDefined();
      expect(schema.shape).toHaveProperty('name');
      expect(schema.shape).toHaveProperty('description');
      expect(schema.shape).toHaveProperty('group');
      expect(schema.shape).toHaveProperty('lore');
      expect(schema.shape).toHaveProperty('objectives');
      expect(schema.shape).toHaveProperty('knowledge');
      expect(schema.shape).toHaveProperty('system_prompt');
      expect(schema.shape).toHaveProperty('interval');
      expect(schema.shape).toHaveProperty('plugins');
      expect(schema.shape).toHaveProperty('memory');
      expect(schema.shape).toHaveProperty('rag');
      expect(schema.shape).toHaveProperty('mode');
      expect(schema.shape).toHaveProperty('max_iterations');
    });

    it('should validate required fields', () => {
      const schema = createAgentTool.schema;

      // Name should be required
      expect(schema.shape.name._def.typeName).toBe('ZodString');

      // Description and group should be required
      expect(schema.shape.description._def.typeName).toBe('ZodString');
      expect(schema.shape.group._def.typeName).toBe('ZodString');
    });
  });

  describe('function execution', () => {
    it('should call normalizeAgentValues with input parameters', async () => {
      const mockCreatedAgent = {
        id: 1,
        name: 'test-agent',
        description: 'Test agent',
        group: 'general',
      };

      mockPostgres.query.mockResolvedValue([mockCreatedAgent]);

      const input = {
        name: 'test-agent',
        group: 'general',
        description: 'Test agent',
      };

      await createAgentTool.func(input);

      expect(mockNormalizeAgentValues).toHaveBeenCalledWith(input);
      expect(mockNormalizeAgentValues).toHaveBeenCalledTimes(1);
    });

    it('should create agent with minimal required fields', async () => {
      const mockCreatedAgent = {
        id: 1,
        name: 'test-agent',
        description: 'Test agent',
        group: 'general',
        lore: '',
        objectives: '',
        knowledge: '',
        system_prompt: null,
        interval: 5,
        plugins: null,
        memory: { enabled: false, shortTermMemorySize: 5, memorySize: 20 },
        rag: { enabled: false, embeddingModel: null },
        mode: 'interactive',
        max_iterations: 15,
      };

      mockPostgres.query.mockResolvedValue([mockCreatedAgent]);

      const result = await createAgentTool.func({
        name: 'test-agent',
        group: 'general',
        description: 'Test agent',
      });

      expect(mockPostgres.Query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO agents'),
        [
          'test-agent',
          'general',
          'Test agent',
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
        ]
      );

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.message).toBe(
        'Agent "test-agent" created successfully'
      );
      expect(parsedResult.data).toEqual(mockCreatedAgent);
    });

    it('should create agent with all fields', async () => {
      const mockCreatedAgent = {
        id: 1,
        name: 'full-agent',
        description: 'A comprehensive test agent',
        group: 'trading',
        lore: ['Lore 1', 'Lore 2'],
        objectives: ['Objective 1', 'Objective 2'],
        knowledge: ['Knowledge 1', 'Knowledge 2'],
        system_prompt: 'You are a trading agent',
        interval: 300,
        plugins: ['plugin1', 'plugin2'],
        memory: { enabled: true, shortTermMemorySize: 50, memorySize: 100 },
        rag: { enabled: true, embeddingModel: 'test-model' },
        mode: 'interactive',
        max_iterations: 10,
      };

      mockPostgres.query.mockResolvedValue([mockCreatedAgent]);

      // Mock normalizeAgentValues to return the expected normalized values
      mockNormalizeAgentValues.mockReturnValue({
        normalizedConfig: {
          interval: 300,
          max_iterations: 10,
          memory: {
            shortTermMemorySize: 50,
            memorySize: 100,
          },
        },
        appliedDefaults: [],
      });

      const result = await createAgentTool.func({
        name: 'full-agent',
        description: 'A comprehensive test agent',
        group: 'trading',
        lore: ['Lore 1', 'Lore 2'],
        objectives: ['Objective 1', 'Objective 2'],
        knowledge: ['Knowledge 1', 'Knowledge 2'],
        system_prompt: 'You are a trading agent',
        interval: 300,
        plugins: ['plugin1', 'plugin2'],
        memory: { enabled: true, shortTermMemorySize: 50, memorySize: 100 },
        rag: { enabled: true, embeddingModel: 'test-model' },
        mode: 'interactive',
        max_iterations: 10,
      });

      expect(mockPostgres.Query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO agents'),
        [
          'full-agent',
          'trading',
          'A comprehensive test agent',
          ['Lore 1', 'Lore 2'],
          ['Objective 1', 'Objective 2'],
          ['Knowledge 1', 'Knowledge 2'],
          'You are a trading agent',
          300,
          ['plugin1', 'plugin2'],
          true,
          50,
          100,
          true,
          'test-model',
          'interactive',
          10,
        ]
      );

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.message).toBe(
        'Agent "full-agent" created successfully'
      );
      expect(parsedResult.data).toEqual(mockCreatedAgent);
    });

    it('should use normalized values from normalizeAgentValues', async () => {
      const mockCreatedAgent = {
        id: 1,
        name: 'normalized-agent',
        description: 'Test agent',
        group: 'general',
      };

      mockPostgres.query.mockResolvedValue([mockCreatedAgent]);

      // Mock normalizeAgentValues to return specific normalized values
      mockNormalizeAgentValues.mockReturnValue({
        normalizedConfig: {
          interval: 10,
          max_iterations: 25,
          memory: {
            shortTermMemorySize: 15,
            memorySize: 50,
          },
        },
        appliedDefaults: ['interval set to default value (10)', 'max_iterations set to default value (25)'],
      });

      const result = await createAgentTool.func({
        name: 'normalized-agent',
        group: 'general',
        description: 'Test agent',
      });

      // Verify that the normalized values are used in the query
      expect(mockPostgres.Query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO agents'),
        [
          'normalized-agent',
          'general',
          'Test agent',
          '',
          '',
          '',
          null,
          10, // normalized interval
          null,
          false,
          15, // normalized shortTermMemorySize
          50, // normalized memorySize
          false,
          null,
          'interactive',
          25, // normalized max_iterations
        ]
      );

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.message).toContain('Note: interval set to default value (10); max_iterations set to default value (25)');
    });

    it('should handle empty arrays for array fields', async () => {
      const mockCreatedAgent = {
        id: 1,
        name: 'empty-arrays-agent',
        lore: [],
        objectives: [],
        knowledge: [],
        plugins: [],
      };

      mockPostgres.query.mockResolvedValue([mockCreatedAgent]);

      const result = await createAgentTool.func({
        name: 'empty-arrays-agent',
        group: 'general',
        description: 'Test agent',
        lore: [],
        objectives: [],
        knowledge: [],
        plugins: [],
      });

      expect(mockPostgres.Query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO agents'),
        [
          'empty-arrays-agent',
          'general',
          'Test agent',
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
        ]
      );

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle database query errors', async () => {
      const dbError = new Error('Database connection failed');
      mockPostgres.query.mockRejectedValue(dbError);

      const result = await createAgentTool.func({
        name: 'test-agent',
        group: 'general',
        description: 'Test agent',
      });

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error creating agent: Error: Database connection failed'
      );

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(false);
      expect(parsedResult.message).toBe('Failed to create agent');
      expect(parsedResult.error).toBe('Database connection failed');
    });

    it('should handle database query errors with non-Error objects', async () => {
      mockPostgres.query.mockRejectedValue('String error');

      const result = await createAgentTool.func({
        name: 'test-agent',
        group: 'general',
        description: 'Test agent',
      });

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error creating agent: String error'
      );

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(false);
      expect(parsedResult.message).toBe('Failed to create agent');
      expect(parsedResult.error).toBe('String error');
    });

    it('should handle Postgres.Query constructor errors', async () => {
      mockPostgres.Query.mockImplementation(() => {
        throw new Error('Invalid query syntax');
      });

      const result = await createAgentTool.func({
        name: 'test-agent',
        group: 'general',
        description: 'Test agent',
      });

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error creating agent: Error: Invalid query syntax'
      );

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(false);
      expect(parsedResult.message).toBe('Failed to create agent');
      expect(parsedResult.error).toBe('Invalid query syntax');
    });

    it('should handle duplicate agent name errors', async () => {
      const duplicateError = new Error(
        'duplicate key value violates unique constraint "agents_name_key"'
      );
      mockPostgres.query.mockRejectedValue(duplicateError);

      const result = await createAgentTool.func({
        name: 'existing-agent',
        group: 'general',
        description: 'Test agent',
      });

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error creating agent: Error: duplicate key value violates unique constraint "agents_name_key"'
      );

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(false);
      expect(parsedResult.message).toBe('Failed to create agent');
      expect(parsedResult.error).toBe(
        'duplicate key value violates unique constraint "agents_name_key"'
      );
    });

    it('should handle creation failure with no data returned', async () => {
      mockPostgres.query.mockResolvedValue([]);

      const result = await createAgentTool.func({
        name: 'failed-agent',
        group: 'general',
        description: 'Test agent',
      });

      expect(mockPostgres.Query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO agents'),
        [
          'failed-agent',
          'general',
          'Test agent',
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
        ]
      );

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(false);
      expect(parsedResult.message).toBe('Failed to create agent - no data returned');
      expect(parsedResult.data).toBeUndefined();
    });
  });

  describe('edge cases', () => {
    it('should handle agent name with special characters', async () => {
      const mockCreatedAgent = {
        id: 1,
        name: 'agent-with-dashes_and_underscores',
      };

      mockPostgres.query.mockResolvedValue([mockCreatedAgent]);

      const result = await createAgentTool.func({
        name: 'agent-with-dashes_and_underscores',
        group: 'general',
        description: 'Test agent',
      });

      expect(mockPostgres.Query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO agents'),
        [
          'agent-with-dashes_and_underscores',
          'general',
          'Test agent',
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
        ]
      );

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
    });

    it('should handle very long agent names', async () => {
      const longName = 'a'.repeat(255); // Maximum reasonable length
      const mockCreatedAgent = {
        id: 1,
        name: longName,
      };

      mockPostgres.query.mockResolvedValue([mockCreatedAgent]);

      const result = await createAgentTool.func({
        name: longName,
        group: 'general',
        description: 'Test agent',
      });

      expect(mockPostgres.Query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO agents'),
        [
          longName,
          'general',
          'Test agent',
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
        ]
      );

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
    });

    it('should handle very long descriptions', async () => {
      const longDescription =
        'This is a very long description that might exceed normal limits. '.repeat(
          10
        );
      const mockCreatedAgent = {
        id: 1,
        name: 'long-desc-agent',
        description: longDescription,
      };

      mockPostgres.query.mockResolvedValue([mockCreatedAgent]);

      const result = await createAgentTool.func({
        name: 'long-desc-agent',
        group: 'general',
        description: longDescription,
      });

      expect(mockPostgres.Query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO agents'),
        [
          'long-desc-agent',
          'general',
          longDescription,
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
        ]
      );

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
    });

    it('should handle large arrays in array fields', async () => {
      const largeArray = Array.from({ length: 100 }, (_, i) => `item-${i}`);
      const mockCreatedAgent = {
        id: 1,
        name: 'large-arrays-agent',
        lore: largeArray,
        objectives: largeArray,
        knowledge: largeArray,
        plugins: largeArray,
      };

      mockPostgres.query.mockResolvedValue([mockCreatedAgent]);

      const result = await createAgentTool.func({
        name: 'large-arrays-agent',
        group: 'general',
        description: 'Test agent',
        lore: largeArray,
        objectives: largeArray,
        knowledge: largeArray,
        plugins: largeArray,
      });

      expect(mockPostgres.Query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO agents'),
        [
          'large-arrays-agent',
          'general',
          'Test agent',
          largeArray,
          largeArray,
          largeArray,
          null,
          5,
          largeArray,
          false,
          5,
          20,
          false,
          null,
          'interactive',
          15,
        ]
      );

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
    });
  });

  describe('parameter validation', () => {
    it('should handle empty string values', async () => {
      const mockCreatedAgent = {
        id: 1,
        name: 'empty-strings-agent',
        description: '',
        group: '',
        system_prompt: '',
        mode: '',
      };

      mockPostgres.query.mockResolvedValue([mockCreatedAgent]);

      const result = await createAgentTool.func({
        name: 'empty-strings-agent',
        description: '',
        group: '',
        system_prompt: '',
        mode: '',
      });

      expect(mockPostgres.Query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO agents'),
        [
          'empty-strings-agent',
          '',
          '',
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
        ]
      );

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
    });

    it('should handle null and undefined values', async () => {
      const mockCreatedAgent = {
        id: 1,
        name: 'null-values-agent',
        description: 'Test agent',
        group: 'general',
      };

      mockPostgres.query.mockResolvedValue([mockCreatedAgent]);

      const result = await createAgentTool.func({
        name: 'null-values-agent',
        group: 'general',
        description: 'Test agent',
        lore: null,
        objectives: undefined,
        knowledge: null,
        system_prompt: null,
        plugins: undefined,
        memory: null,
        rag: null,
        mode: null,
        interval: null,
        max_iterations: null,
      });

      expect(mockPostgres.Query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO agents'),
        [
          'null-values-agent',
          'general',
          'Test agent',
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
        ]
      );

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
    });
  });
});
