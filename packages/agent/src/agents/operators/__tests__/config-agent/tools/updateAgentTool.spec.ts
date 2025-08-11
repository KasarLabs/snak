import { updateAgentTool } from '../../../config-agent/tools/updateAgentTool.js';

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

describe('updateAgentTool', () => {
  let mockPostgres: any;
  let mockLogger: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockPostgres = require('@snakagent/database').Postgres;
    mockLogger = require('@snakagent/core').logger;

    // Reset mock implementations
    mockPostgres.Query.mockClear();
    mockPostgres.query.mockClear();
    mockLogger.error.mockClear();
    mockLogger.info.mockClear();

    // Configure Postgres.Query to return a mock query object
    mockPostgres.Query.mockImplementation((query: string, params: any[]) => {
      return { query, params };
    });
  });

  describe('tool configuration', () => {
    it('should have correct name and description', () => {
      expect(updateAgentTool.name).toBe('update_agent');
      expect(updateAgentTool.description).toContain(
        'Update/modify/change/rename specific properties'
      );
    });

    it('should have proper schema validation', () => {
      const schema = updateAgentTool.schema;
      expect(schema).toBeDefined();
      expect(schema.shape).toHaveProperty('identifier');
      expect(schema.shape).toHaveProperty('searchBy');
      expect(schema.shape).toHaveProperty('updates');
      expect(schema.shape.updates.shape).toHaveProperty('name');
      expect(schema.shape.updates.shape).toHaveProperty('description');
      expect(schema.shape.updates.shape).toHaveProperty('group');
      expect(schema.shape.updates.shape).toHaveProperty('lore');
      expect(schema.shape.updates.shape).toHaveProperty('objectives');
      expect(schema.shape.updates.shape).toHaveProperty('knowledge');
      expect(schema.shape.updates.shape).toHaveProperty('system_prompt');
      expect(schema.shape.updates.shape).toHaveProperty('interval');
      expect(schema.shape.updates.shape).toHaveProperty('plugins');
      expect(schema.shape.updates.shape).toHaveProperty('memory');
      expect(schema.shape.updates.shape).toHaveProperty('rag');
      expect(schema.shape.updates.shape).toHaveProperty('mode');
      expect(schema.shape.updates.shape).toHaveProperty('max_iterations');
    });

    it('should validate required fields', () => {
      const schema = updateAgentTool.schema;

      // Identifier should be required
      expect(schema.shape.identifier._def.typeName).toBe('ZodString');

      // Updates should be required
      expect(schema.shape.updates._def.typeName).toBe('ZodObject');
    });

    it('should have correct default searchBy', () => {
      const schema = updateAgentTool.schema;
      const parsed = schema.parse({
        identifier: 'test-agent',
        updates: {},
      });
      expect(parsed.searchBy).toBeUndefined();
    });
  });

  describe('function execution', () => {
    it('should update agent by name with single field', async () => {
      const mockAgent = {
        id: 1,
        name: 'test-agent',
        description: 'Old description',
        group: 'trading',
      };

      const mockUpdatedAgent = {
        ...mockAgent,
        description: 'Updated description',
      };

      mockPostgres.query
        .mockResolvedValueOnce([mockAgent])
        .mockResolvedValueOnce([mockUpdatedAgent]);

      const result = await updateAgentTool.func({
        identifier: 'test-agent',
        searchBy: 'name',
        updates: {
          description: 'Updated description',
        },
      });

      expect(mockPostgres.Query).toHaveBeenCalledTimes(2);
      expect(mockPostgres.Query).toHaveBeenNthCalledWith(
        1,
        'SELECT * FROM agents WHERE name = $1',
        ['test-agent']
      );
      expect(mockPostgres.Query).toHaveBeenNthCalledWith(
        2,
        'UPDATE agents SET "description" = $1 WHERE name = $2 RETURNING *',
        ['Updated description', 'test-agent']
      );

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.message).toBe(
        'Agent "test-agent" updated successfully'
      );
      expect(parsedResult.data).toEqual(mockUpdatedAgent);
    });

    it('should update agent by ID with multiple fields', async () => {
      const mockAgent = {
        id: 1,
        name: 'old-agent',
        description: 'Old description',
        group: 'old-group',
        mode: 'old-mode',
        max_iterations: 10,
      };

      const mockUpdatedAgent = {
        id: 1,
        name: 'updated-agent',
        description: 'Updated description',
        group: 'rpc',
        mode: 'interactive',
        max_iterations: 15,
      };

      mockPostgres.query
        .mockResolvedValueOnce([mockAgent])
        .mockResolvedValueOnce([mockUpdatedAgent]);

      const result = await updateAgentTool.func({
        identifier: '1',
        searchBy: 'id',
        updates: {
          name: 'updated-agent',
          description: 'Updated description',
          group: 'rpc',
          mode: 'interactive',
          max_iterations: 15,
        },
      });

      expect(mockPostgres.Query).toHaveBeenCalledTimes(2);
      expect(mockPostgres.Query).toHaveBeenNthCalledWith(
        1,
        'SELECT * FROM agents WHERE id = $1',
        [1]
      );
      expect(mockPostgres.Query).toHaveBeenNthCalledWith(
        2,
        'UPDATE agents SET "name" = $1, "description" = $2, "group" = $3, "mode" = $4, "max_iterations" = $5 WHERE id = $6 RETURNING *',
        ['updated-agent', 'Updated description', 'rpc', 'interactive', 15, 1]
      );

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.message).toBe(
        'Agent "old-agent" updated successfully'
      );
    });

    it('should update agent with array fields', async () => {
      const mockAgent = {
        id: 1,
        name: 'array-agent',
        lore: ['Old Lore'],
        objectives: ['Old Objective'],
        knowledge: ['Old Knowledge'],
        plugins: ['old-plugin'],
      };

      const mockUpdatedAgent = {
        id: 1,
        name: 'array-agent',
        lore: ['New Lore 1', 'New Lore 2'],
        objectives: ['New Objective 1', 'New Objective 2'],
        knowledge: ['New Knowledge 1', 'New Knowledge 2'],
        plugins: ['plugin3', 'plugin4'],
      };

      mockPostgres.query
        .mockResolvedValueOnce([mockAgent])
        .mockResolvedValueOnce([mockUpdatedAgent]);

      const result = await updateAgentTool.func({
        identifier: 'array-agent',
        updates: {
          lore: ['New Lore 1', 'New Lore 2'],
          objectives: ['New Objective 1', 'New Objective 2'],
          knowledge: ['New Knowledge 1', 'New Knowledge 2'],
          plugins: ['plugin3', 'plugin4'],
        },
      });

      expect(mockPostgres.Query).toHaveBeenCalledTimes(2);
      expect(mockPostgres.Query).toHaveBeenNthCalledWith(
        1,
        'SELECT * FROM agents WHERE name = $1',
        ['array-agent']
      );
      expect(mockPostgres.Query).toHaveBeenNthCalledWith(
        2,
        'UPDATE agents SET "lore" = $1, "objectives" = $2, "knowledge" = $3, "plugins" = $4 WHERE name = $5 RETURNING *',
        [
          ['New Lore 1', 'New Lore 2'],
          ['New Objective 1', 'New Objective 2'],
          ['New Knowledge 1', 'New Knowledge 2'],
          ['plugin3', 'plugin4'],
          'array-agent',
        ]
      );

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
    });

    it('should update agent with complex memory configuration', async () => {
      const mockAgent = {
        id: 1,
        name: 'memory-agent',
        memory: { enabled: false },
      };

      const mockUpdatedAgent = {
        id: 1,
        name: 'memory-agent',
        memory: {
          enabled: true,
          shortTermMemorySize: 75,
          memorySize: 300,
        },
      };

      mockPostgres.query
        .mockResolvedValueOnce([mockAgent])
        .mockResolvedValueOnce([mockUpdatedAgent]);

      const result = await updateAgentTool.func({
        identifier: 'memory-agent',
        updates: {
          memory: {
            enabled: true,
            shortTermMemorySize: 75,
            memorySize: 300,
          },
        },
      });

      expect(mockPostgres.Query).toHaveBeenCalledTimes(2);
      expect(mockPostgres.Query).toHaveBeenNthCalledWith(
        1,
        'SELECT * FROM agents WHERE name = $1',
        ['memory-agent']
      );
      expect(mockPostgres.Query).toHaveBeenNthCalledWith(
        2,
        'UPDATE agents SET "memory" = $1 WHERE name = $2 RETURNING *',
        [
          { enabled: true, shortTermMemorySize: 75, memorySize: 300 },
          'memory-agent',
        ]
      );

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
    });

    it('should update agent with complex RAG configuration', async () => {
      const mockAgent = {
        id: 1,
        name: 'rag-agent',
        rag: { enabled: false },
      };

      const mockUpdatedAgent = {
        id: 1,
        name: 'rag-agent',
        rag: {
          enabled: true,
          topK: 10,
          embeddingModel: 'Xenova/all-MiniLM-L6-v2',
        },
      };

      mockPostgres.query
        .mockResolvedValueOnce([mockAgent])
        .mockResolvedValueOnce([mockUpdatedAgent]);

      const result = await updateAgentTool.func({
        identifier: 'rag-agent',
        updates: {
          rag: {
            enabled: true,
            topK: 10,
            embeddingModel: 'Xenova/all-MiniLM-L6-v2',
          },
        },
      });

      expect(mockPostgres.Query).toHaveBeenCalledTimes(2);
      expect(mockPostgres.Query).toHaveBeenNthCalledWith(
        1,
        'SELECT * FROM agents WHERE name = $1',
        ['rag-agent']
      );
      expect(mockPostgres.Query).toHaveBeenNthCalledWith(
        2,
        'UPDATE agents SET "rag" = $1 WHERE name = $2 RETURNING *',
        [
          {
            enabled: true,
            topK: 10,
            embeddingModel: 'Xenova/all-MiniLM-L6-v2',
          },
          'rag-agent',
        ]
      );

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
    });

    it('should update agent with all fields', async () => {
      const mockAgent = {
        id: 1,
        name: 'old-agent',
        description: 'Old description',
        group: 'old-group',
        lore: ['Old Lore'],
        objectives: ['Old Objective'],
        knowledge: ['Old Knowledge'],
        system_prompt: 'Old system prompt',
        interval: 300,
        plugins: ['old-plugin'],
        memory: { enabled: false },
        rag: { enabled: false },
        mode: 'old-mode',
        max_iterations: 10,
      };

      const mockUpdatedAgent = {
        id: 1,
        name: 'full-update-agent',
        description: 'Full update description',
        group: 'trading',
        lore: ['Lore 1', 'Lore 2'],
        objectives: ['Objective 1', 'Objective 2'],
        knowledge: ['Knowledge 1', 'Knowledge 2'],
        system_prompt: 'Updated system prompt',
        interval: 600,
        plugins: ['plugin1', 'plugin2'],
        memory: { enabled: true, memorySize: 200 },
        rag: { enabled: true, embeddingModel: 'test-model' },
        mode: 'autonomous',
        max_iterations: 20,
      };

      mockPostgres.query
        .mockResolvedValueOnce([mockAgent])
        .mockResolvedValueOnce([mockUpdatedAgent]);

      const result = await updateAgentTool.func({
        identifier: 'full-update-agent',
        updates: {
          name: 'full-update-agent',
          description: 'Full update description',
          group: 'trading',
          lore: ['Lore 1', 'Lore 2'],
          objectives: ['Objective 1', 'Objective 2'],
          knowledge: ['Knowledge 1', 'Knowledge 2'],
          system_prompt: 'Updated system prompt',
          interval: 600,
          plugins: ['plugin1', 'plugin2'],
          memory: { enabled: true, memorySize: 200 },
          rag: { enabled: true, embeddingModel: 'test-model' },
          mode: 'autonomous',
          max_iterations: 20,
        },
      });

      expect(mockPostgres.Query).toHaveBeenCalledTimes(2);
      expect(mockPostgres.Query).toHaveBeenNthCalledWith(
        1,
        'SELECT * FROM agents WHERE name = $1',
        ['full-update-agent']
      );
      expect(mockPostgres.Query).toHaveBeenNthCalledWith(
        2,
        'UPDATE agents SET "name" = $1, "description" = $2, "group" = $3, "lore" = $4, "objectives" = $5, "knowledge" = $6, "system_prompt" = $7, "interval" = $8, "plugins" = $9, "memory" = $10, "rag" = $11, "mode" = $12, "max_iterations" = $13 WHERE name = $14 RETURNING *',
        [
          'full-update-agent',
          'Full update description',
          'trading',
          ['Lore 1', 'Lore 2'],
          ['Objective 1', 'Objective 2'],
          ['Knowledge 1', 'Knowledge 2'],
          'Updated system prompt',
          600,
          ['plugin1', 'plugin2'],
          { enabled: true, memorySize: 200 },
          { enabled: true, embeddingModel: 'test-model' },
          'autonomous',
          20,
          'full-update-agent',
        ]
      );

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
    });

    it('should handle empty arrays for array fields', async () => {
      const mockAgent = {
        id: 1,
        name: 'empty-arrays-agent',
        lore: ['Old Lore'],
        objectives: ['Old Objective'],
        knowledge: ['Old Knowledge'],
        plugins: ['old-plugin'],
      };

      const mockUpdatedAgent = {
        id: 1,
        name: 'empty-arrays-agent',
        lore: [],
        objectives: [],
        knowledge: [],
        plugins: [],
      };

      mockPostgres.query
        .mockResolvedValueOnce([mockAgent])
        .mockResolvedValueOnce([mockUpdatedAgent]);

      const result = await updateAgentTool.func({
        identifier: 'empty-arrays-agent',
        updates: {
          lore: [],
          objectives: [],
          knowledge: [],
          plugins: [],
        },
      });

      expect(mockPostgres.Query).toHaveBeenCalledTimes(2);
      expect(mockPostgres.Query).toHaveBeenNthCalledWith(
        1,
        'SELECT * FROM agents WHERE name = $1',
        ['empty-arrays-agent']
      );
      expect(mockPostgres.Query).toHaveBeenNthCalledWith(
        2,
        'UPDATE agents SET "lore" = $1, "objectives" = $2, "knowledge" = $3, "plugins" = $4 WHERE name = $5 RETURNING *',
        [[], [], [], [], 'empty-arrays-agent']
      );

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle agent not found by name', async () => {
      mockPostgres.query.mockResolvedValueOnce([]);

      const result = await updateAgentTool.func({
        identifier: 'non-existent-agent',
        updates: {
          description: 'Updated description',
        },
      });

      expect(mockPostgres.Query).toHaveBeenCalledTimes(1);
      expect(mockPostgres.Query).toHaveBeenNthCalledWith(
        1,
        'SELECT * FROM agents WHERE name = $1',
        ['non-existent-agent']
      );

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(false);
      expect(parsedResult.message).toBe(
        'Agent not found with name: non-existent-agent'
      );
    });

    it('should handle agent not found by ID', async () => {
      mockPostgres.query.mockResolvedValueOnce([]);

      const result = await updateAgentTool.func({
        identifier: '999',
        searchBy: 'id',
        updates: {
          description: 'Updated description',
        },
      });

      expect(mockPostgres.Query).toHaveBeenCalledTimes(1);
      expect(mockPostgres.Query).toHaveBeenNthCalledWith(
        1,
        'SELECT * FROM agents WHERE id = $1',
        [999]
      );

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(false);
      expect(parsedResult.message).toBe('Agent not found with id: 999');
    });

    it('should handle database query errors', async () => {
      const dbError = new Error('Database connection failed');
      mockPostgres.query.mockRejectedValueOnce(dbError);

      const result = await updateAgentTool.func({
        identifier: 'test-agent',
        updates: {
          description: 'Updated description',
        },
      });

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error updating agent: Error: Database connection failed'
      );

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(false);
      expect(parsedResult.message).toBe('Failed to update agent configuration');
      expect(parsedResult.error).toBe('Database connection failed');
    });

    it('should handle database query errors with non-Error objects', async () => {
      mockPostgres.query.mockRejectedValueOnce('String error');

      const result = await updateAgentTool.func({
        identifier: 'test-agent',
        updates: {
          description: 'Updated description',
        },
      });

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error updating agent: String error'
      );

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(false);
      expect(parsedResult.message).toBe('Failed to update agent configuration');
      expect(parsedResult.error).toBe('String error');
    });

    it('should handle Postgres.Query constructor errors', async () => {
      mockPostgres.Query.mockImplementation(() => {
        throw new Error('Invalid query syntax');
      });

      const result = await updateAgentTool.func({
        identifier: 'test-agent',
        updates: {
          description: 'Updated description',
        },
      });

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error updating agent: Error: Invalid query syntax'
      );

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(false);
      expect(parsedResult.message).toBe('Failed to update agent configuration');
      expect(parsedResult.error).toBe('Invalid query syntax');
    });

    it('should handle invalid identifier type', async () => {
      mockPostgres.query.mockResolvedValueOnce([]);

      const result = await updateAgentTool.func({
        identifier: 'test-agent',
        searchBy: 'invalid_type' as 'id' | 'name',
        updates: {
          description: 'Updated description',
        },
      });

      expect(mockPostgres.Query).toHaveBeenCalledTimes(1);
      expect(mockPostgres.Query).toHaveBeenNthCalledWith(
        1,
        'SELECT * FROM agents WHERE name = $1',
        ['test-agent']
      );

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(false);
      expect(parsedResult.message).toBe(
        'Agent not found with invalid_type: test-agent'
      );
    });

    it('should handle no fields to update', async () => {
      const mockAgent = {
        id: 1,
        name: 'test-agent',
        description: 'Old description',
      };

      mockPostgres.query.mockResolvedValueOnce([mockAgent]);

      const result = await updateAgentTool.func({
        identifier: 'test-agent',
        updates: {},
      });

      expect(mockPostgres.Query).toHaveBeenCalledTimes(1);
      expect(mockPostgres.Query).toHaveBeenNthCalledWith(
        1,
        'SELECT * FROM agents WHERE name = $1',
        ['test-agent']
      );

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(false);
      expect(parsedResult.message).toBe('No valid fields to update');
    });
  });

  describe('edge cases', () => {
    it('should handle agent name with special characters', async () => {
      const mockAgent = {
        id: 1,
        name: 'agent-with-dashes_and_underscores',
        description: 'Old description',
      };

      const mockUpdatedAgent = {
        ...mockAgent,
        description: 'Updated description',
      };

      mockPostgres.query
        .mockResolvedValueOnce([mockAgent])
        .mockResolvedValueOnce([mockUpdatedAgent]);

      const result = await updateAgentTool.func({
        identifier: 'agent-with-dashes_and_underscores',
        updates: {
          description: 'Updated description',
        },
      });

      expect(mockPostgres.Query).toHaveBeenCalledTimes(2);
      expect(mockPostgres.Query).toHaveBeenNthCalledWith(
        1,
        'SELECT * FROM agents WHERE name = $1',
        ['agent-with-dashes_and_underscores']
      );
      expect(mockPostgres.Query).toHaveBeenNthCalledWith(
        2,
        'UPDATE agents SET "description" = $1 WHERE name = $2 RETURNING *',
        ['Updated description', 'agent-with-dashes_and_underscores']
      );

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
    });

    it('should handle very long agent names', async () => {
      const longName = 'a'.repeat(255);
      const mockAgent = {
        id: 1,
        name: longName,
        description: 'Old description',
      };

      const mockUpdatedAgent = {
        ...mockAgent,
        description: 'Updated description',
      };

      mockPostgres.query
        .mockResolvedValueOnce([mockAgent])
        .mockResolvedValueOnce([mockUpdatedAgent]);

      const result = await updateAgentTool.func({
        identifier: longName,
        updates: {
          description: 'Updated description',
        },
      });

      expect(mockPostgres.Query).toHaveBeenCalledTimes(2);
      expect(mockPostgres.Query).toHaveBeenNthCalledWith(
        1,
        'SELECT * FROM agents WHERE name = $1',
        [longName]
      );
      expect(mockPostgres.Query).toHaveBeenNthCalledWith(
        2,
        'UPDATE agents SET "description" = $1 WHERE name = $2 RETURNING *',
        ['Updated description', longName]
      );

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
    });

    it('should handle very long descriptions', async () => {
      const longDescription =
        'This is a very long description that might exceed normal limits. '.repeat(
          10
        );
      const mockAgent = {
        id: 1,
        name: 'long-desc-agent',
        description: 'Old description',
      };

      const mockUpdatedAgent = {
        ...mockAgent,
        description: longDescription,
      };

      mockPostgres.query
        .mockResolvedValueOnce([mockAgent])
        .mockResolvedValueOnce([mockUpdatedAgent]);

      const result = await updateAgentTool.func({
        identifier: 'long-desc-agent',
        updates: {
          description: longDescription,
        },
      });

      expect(mockPostgres.Query).toHaveBeenCalledTimes(2);
      expect(mockPostgres.Query).toHaveBeenNthCalledWith(
        1,
        'SELECT * FROM agents WHERE name = $1',
        ['long-desc-agent']
      );
      expect(mockPostgres.Query).toHaveBeenNthCalledWith(
        2,
        'UPDATE agents SET "description" = $1 WHERE name = $2 RETURNING *',
        [longDescription, 'long-desc-agent']
      );

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
    });

    it('should handle large arrays in array fields', async () => {
      const largeArray = Array.from({ length: 100 }, (_, i) => `item-${i}`);
      const mockAgent = {
        id: 1,
        name: 'large-arrays-agent',
        lore: ['Old Lore'],
        objectives: ['Old Objective'],
        knowledge: ['Old Knowledge'],
        plugins: ['old-plugin'],
      };

      const mockUpdatedAgent = {
        id: 1,
        name: 'large-arrays-agent',
        lore: largeArray,
        objectives: largeArray,
        knowledge: largeArray,
        plugins: largeArray,
      };

      mockPostgres.query
        .mockResolvedValueOnce([mockAgent])
        .mockResolvedValueOnce([mockUpdatedAgent]);

      const result = await updateAgentTool.func({
        identifier: 'large-arrays-agent',
        updates: {
          lore: largeArray,
          objectives: largeArray,
          knowledge: largeArray,
          plugins: largeArray,
        },
      });

      expect(mockPostgres.Query).toHaveBeenCalledTimes(2);
      expect(mockPostgres.Query).toHaveBeenNthCalledWith(
        1,
        'SELECT * FROM agents WHERE name = $1',
        ['large-arrays-agent']
      );
      expect(mockPostgres.Query).toHaveBeenNthCalledWith(
        2,
        'UPDATE agents SET "lore" = $1, "objectives" = $2, "knowledge" = $3, "plugins" = $4 WHERE name = $5 RETURNING *',
        [largeArray, largeArray, largeArray, largeArray, 'large-arrays-agent']
      );

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
    });

    it('should handle complex nested objects in memory and rag', async () => {
      const complexMemory = {
        enabled: true,
        shortTermMemorySize: 50,
        memorySize: 200,
        customField: { nested: { value: 'test' } },
      };

      const complexRag = {
        enabled: true,
        topK: 5,
        embeddingModel: 'Xenova/all-MiniLM-L6-v2',
        customConfig: { threshold: 0.8, maxResults: 100 },
      };

      const mockAgent = {
        id: 1,
        name: 'complex-objects-agent',
        memory: { enabled: false },
        rag: { enabled: false },
      };

      const mockUpdatedAgent = {
        id: 1,
        name: 'complex-objects-agent',
        memory: complexMemory,
        rag: complexRag,
      };

      mockPostgres.query
        .mockResolvedValueOnce([mockAgent])
        .mockResolvedValueOnce([mockUpdatedAgent]);

      const result = await updateAgentTool.func({
        identifier: 'complex-objects-agent',
        updates: {
          memory: complexMemory,
          rag: complexRag,
        },
      });

      expect(mockPostgres.Query).toHaveBeenCalledTimes(2);
      expect(mockPostgres.Query).toHaveBeenNthCalledWith(
        1,
        'SELECT * FROM agents WHERE name = $1',
        ['complex-objects-agent']
      );
      expect(mockPostgres.Query).toHaveBeenNthCalledWith(
        2,
        'UPDATE agents SET "memory" = $1, "rag" = $2 WHERE name = $3 RETURNING *',
        [complexMemory, complexRag, 'complex-objects-agent']
      );

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
    });

    it('should handle empty string values', async () => {
      const mockAgent = {
        id: 1,
        name: 'empty-strings-agent',
        description: 'Old description',
        group: 'old-group',
        system_prompt: 'Old prompt',
        mode: 'old-mode',
      };

      const mockUpdatedAgent = {
        id: 1,
        name: 'empty-strings-agent',
        description: '',
        group: '',
        system_prompt: '',
        mode: '',
      };

      mockPostgres.query
        .mockResolvedValueOnce([mockAgent])
        .mockResolvedValueOnce([mockUpdatedAgent]);

      const result = await updateAgentTool.func({
        identifier: 'empty-strings-agent',
        updates: {
          description: '',
          group: '',
          system_prompt: '',
          mode: '',
        },
      });

      expect(mockPostgres.Query).toHaveBeenCalledTimes(2);
      expect(mockPostgres.Query).toHaveBeenNthCalledWith(
        1,
        'SELECT * FROM agents WHERE name = $1',
        ['empty-strings-agent']
      );
      expect(mockPostgres.Query).toHaveBeenNthCalledWith(
        2,
        'UPDATE agents SET "description" = $1, "group" = $2, "system_prompt" = $3, "mode" = $4 WHERE name = $5 RETURNING *',
        ['', '', '', '', 'empty-strings-agent']
      );

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
    });

    it('should normalize zero and negative numeric values to defaults', async () => {
      const mockAgent = {
        id: 1,
        name: 'numeric-agent',
        interval: 1000,
        max_iterations: 10,
      };

      const mockUpdatedAgent = {
        ...mockAgent,
        interval: 5, // Default value
        max_iterations: 15, // Default value
      };

      mockPostgres.query
        .mockResolvedValueOnce([mockAgent])
        .mockResolvedValueOnce([mockUpdatedAgent]);

      const result = await updateAgentTool.func({
        identifier: 'numeric-agent',
        updates: {
          interval: 0,
          max_iterations: -1,
        },
      });

      expect(mockPostgres.Query).toHaveBeenCalledTimes(2);
      expect(mockPostgres.Query).toHaveBeenNthCalledWith(
        1,
        'SELECT * FROM agents WHERE name = $1',
        ['numeric-agent']
      );
      expect(mockPostgres.Query).toHaveBeenNthCalledWith(
        2,
        'UPDATE agents SET "interval" = $1, "max_iterations" = $2 WHERE name = $3 RETURNING *',
        [5, 15, 'numeric-agent']
      );

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.message).toContain(
        'interval set to default value (5)'
      );
      expect(parsedResult.message).toContain(
        'max_iterations set to default value (15)'
      );
    });

    it('should handle very large numeric values', async () => {
      const mockAgent = {
        id: 1,
        name: 'large-numeric-agent',
        interval: 1000,
        max_iterations: 10,
      };

      const mockUpdatedAgent = {
        id: 1,
        name: 'large-numeric-agent',
        interval: 999999,
        max_iterations: 999999,
      };

      mockPostgres.query
        .mockResolvedValueOnce([mockAgent])
        .mockResolvedValueOnce([mockUpdatedAgent]);

      const result = await updateAgentTool.func({
        identifier: 'large-numeric-agent',
        updates: {
          interval: 999999,
          max_iterations: 999999,
        },
      });

      expect(mockPostgres.Query).toHaveBeenCalledTimes(2);
      expect(mockPostgres.Query).toHaveBeenNthCalledWith(
        1,
        'SELECT * FROM agents WHERE name = $1',
        ['large-numeric-agent']
      );
      expect(mockPostgres.Query).toHaveBeenNthCalledWith(
        2,
        'UPDATE agents SET "interval" = $1, "max_iterations" = $2 WHERE name = $3 RETURNING *',
        [999999, 999999, 'large-numeric-agent']
      );

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
    });
  });

  describe('parameter validation', () => {
    it('should handle numeric string ID', async () => {
      const mockAgent = {
        id: 123,
        name: 'numeric-id-agent',
        description: 'Old description',
      };

      const mockUpdatedAgent = {
        ...mockAgent,
        description: 'Updated description',
      };

      mockPostgres.query
        .mockResolvedValueOnce([mockAgent])
        .mockResolvedValueOnce([mockUpdatedAgent]);

      const result = await updateAgentTool.func({
        identifier: '123',
        searchBy: 'id',
        updates: {
          description: 'Updated description',
        },
      });

      expect(mockPostgres.Query).toHaveBeenCalledTimes(2);
      expect(mockPostgres.Query).toHaveBeenNthCalledWith(
        1,
        'SELECT * FROM agents WHERE id = $1',
        [123]
      );
      expect(mockPostgres.Query).toHaveBeenNthCalledWith(
        2,
        'UPDATE agents SET "description" = $1 WHERE id = $2 RETURNING *',
        ['Updated description', 123]
      );

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
    });

    it('should handle non-numeric string ID gracefully', async () => {
      const result = await updateAgentTool.func({
        identifier: 'not-a-number',
        searchBy: 'id',
        updates: {
          description: 'Updated description',
        },
      });

      expect(mockPostgres.Query).toHaveBeenCalledTimes(0);

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(false);
      expect(parsedResult.message).toBe('Invalid ID format: not-a-number');
    });

    it('should handle zero ID', async () => {
      mockPostgres.query.mockResolvedValueOnce([]);

      const result = await updateAgentTool.func({
        identifier: '0',
        searchBy: 'id',
        updates: {
          description: 'Updated description',
        },
      });

      expect(mockPostgres.Query).toHaveBeenCalledTimes(1);
      expect(mockPostgres.Query).toHaveBeenNthCalledWith(
        1,
        'SELECT * FROM agents WHERE id = $1',
        [0]
      );

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(false);
      expect(parsedResult.message).toBe('Agent not found with id: 0');
    });

    it('should handle negative ID', async () => {
      mockPostgres.query.mockResolvedValueOnce([]);

      const result = await updateAgentTool.func({
        identifier: '-1',
        searchBy: 'id',
        updates: {
          description: 'Updated description',
        },
      });

      expect(mockPostgres.Query).toHaveBeenCalledTimes(1);
      expect(mockPostgres.Query).toHaveBeenNthCalledWith(
        1,
        'SELECT * FROM agents WHERE id = $1',
        [-1]
      );

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(false);
      expect(parsedResult.message).toBe('Agent not found with id: -1');
    });
  });

  describe('numeric value normalization', () => {
    it('should normalize negative max_iterations values to default', async () => {
      const mockAgent = {
        id: 1,
        name: 'test-agent',
        max_iterations: 10,
      };

      const mockUpdatedAgent = {
        ...mockAgent,
        max_iterations: 15, // Default value
      };

      mockPostgres.query
        .mockResolvedValueOnce([mockAgent])
        .mockResolvedValueOnce([mockUpdatedAgent]);

      const result = await updateAgentTool.func({
        identifier: 'test-agent',
        updates: {
          max_iterations: -5,
        },
      });

      expect(mockPostgres.Query).toHaveBeenCalledTimes(2);
      expect(mockPostgres.Query).toHaveBeenNthCalledWith(
        1,
        'SELECT * FROM agents WHERE name = $1',
        ['test-agent']
      );
      expect(mockPostgres.Query).toHaveBeenNthCalledWith(
        2,
        'UPDATE agents SET "max_iterations" = $1 WHERE name = $2 RETURNING *',
        [15, 'test-agent']
      );

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.message).toContain(
        'max_iterations set to default value (15)'
      );
    });

    it('should normalize zero max_iterations values to default', async () => {
      const mockAgent = {
        id: 1,
        name: 'test-agent',
        max_iterations: 10,
      };

      const mockUpdatedAgent = {
        ...mockAgent,
        max_iterations: 15, // Default value
      };

      mockPostgres.query
        .mockResolvedValueOnce([mockAgent])
        .mockResolvedValueOnce([mockUpdatedAgent]);

      const result = await updateAgentTool.func({
        identifier: 'test-agent',
        updates: {
          max_iterations: 0,
        },
      });

      expect(mockPostgres.Query).toHaveBeenCalledTimes(2);
      expect(mockPostgres.Query).toHaveBeenNthCalledWith(
        1,
        'SELECT * FROM agents WHERE name = $1',
        ['test-agent']
      );
      expect(mockPostgres.Query).toHaveBeenNthCalledWith(
        2,
        'UPDATE agents SET "max_iterations" = $1 WHERE name = $2 RETURNING *',
        [15, 'test-agent']
      );

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.message).toContain(
        'max_iterations set to default value (15)'
      );
    });

    it('should accept positive max_iterations values', async () => {
      const mockAgent = {
        id: 1,
        name: 'test-agent',
        max_iterations: 10,
      };

      const mockUpdatedAgent = {
        ...mockAgent,
        max_iterations: 25,
      };

      mockPostgres.query
        .mockResolvedValueOnce([mockAgent])
        .mockResolvedValueOnce([mockUpdatedAgent]);

      const result = await updateAgentTool.func({
        identifier: 'test-agent',
        updates: {
          max_iterations: 25,
        },
      });

      expect(mockPostgres.Query).toHaveBeenCalledTimes(2);
      expect(mockPostgres.Query).toHaveBeenNthCalledWith(
        1,
        'SELECT * FROM agents WHERE name = $1',
        ['test-agent']
      );
      expect(mockPostgres.Query).toHaveBeenNthCalledWith(
        2,
        'UPDATE agents SET "max_iterations" = $1 WHERE name = $2 RETURNING *',
        [25, 'test-agent']
      );

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
    });

    it('should normalize negative interval values to default', async () => {
      const mockAgent = {
        id: 1,
        name: 'test-agent',
        interval: 1000,
      };

      const mockUpdatedAgent = {
        ...mockAgent,
        interval: 5, // Default value
      };

      mockPostgres.query
        .mockResolvedValueOnce([mockAgent])
        .mockResolvedValueOnce([mockUpdatedAgent]);

      const result = await updateAgentTool.func({
        identifier: 'test-agent',
        updates: {
          interval: -500,
        },
      });

      expect(mockPostgres.Query).toHaveBeenCalledTimes(2);
      expect(mockPostgres.Query).toHaveBeenNthCalledWith(
        1,
        'SELECT * FROM agents WHERE name = $1',
        ['test-agent']
      );
      expect(mockPostgres.Query).toHaveBeenNthCalledWith(
        2,
        'UPDATE agents SET "interval" = $1 WHERE name = $2 RETURNING *',
        [5, 'test-agent']
      );

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.message).toContain(
        'interval set to default value (5)'
      );
    });

    it('should normalize zero interval values to default', async () => {
      const mockAgent = {
        id: 1,
        name: 'test-agent',
        interval: 1000,
      };

      const mockUpdatedAgent = {
        ...mockAgent,
        interval: 5, // Default value
      };

      mockPostgres.query
        .mockResolvedValueOnce([mockAgent])
        .mockResolvedValueOnce([mockUpdatedAgent]);

      const result = await updateAgentTool.func({
        identifier: 'test-agent',
        updates: {
          interval: 0,
        },
      });

      expect(mockPostgres.Query).toHaveBeenCalledTimes(2);
      expect(mockPostgres.Query).toHaveBeenNthCalledWith(
        1,
        'SELECT * FROM agents WHERE name = $1',
        ['test-agent']
      );
      expect(mockPostgres.Query).toHaveBeenNthCalledWith(
        2,
        'UPDATE agents SET "interval" = $1 WHERE name = $2 RETURNING *',
        [5, 'test-agent']
      );

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.message).toContain(
        'interval set to default value (5)'
      );
    });

    it('should accept positive interval values', async () => {
      const mockAgent = {
        id: 1,
        name: 'test-agent',
        interval: 1000,
      };

      const mockUpdatedAgent = {
        ...mockAgent,
        interval: 2000,
      };

      mockPostgres.query
        .mockResolvedValueOnce([mockAgent])
        .mockResolvedValueOnce([mockUpdatedAgent]);

      const result = await updateAgentTool.func({
        identifier: 'test-agent',
        updates: {
          interval: 2000,
        },
      });

      expect(mockPostgres.Query).toHaveBeenCalledTimes(2);
      expect(mockPostgres.Query).toHaveBeenNthCalledWith(
        1,
        'SELECT * FROM agents WHERE name = $1',
        ['test-agent']
      );
      expect(mockPostgres.Query).toHaveBeenNthCalledWith(
        2,
        'UPDATE agents SET "interval" = $1 WHERE name = $2 RETURNING *',
        [2000, 'test-agent']
      );

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
    });

    it('should normalize negative memory configuration values to defaults', async () => {
      const mockAgent = {
        id: 1,
        name: 'test-agent',
        memory: { enabled: true, memorySize: 100 },
      };

      const mockUpdatedAgent = {
        ...mockAgent,
        memory: {
          enabled: true,
          shortTermMemorySize: 5, // Default value
          memorySize: 20, // Default value
        },
      };

      mockPostgres.query
        .mockResolvedValueOnce([mockAgent])
        .mockResolvedValueOnce([mockUpdatedAgent]);

      const result = await updateAgentTool.func({
        identifier: 'test-agent',
        updates: {
          memory: {
            enabled: true,
            shortTermMemorySize: -50,
            memorySize: -200,
          },
        },
      });

      expect(mockPostgres.Query).toHaveBeenCalledTimes(2);
      expect(mockPostgres.Query).toHaveBeenNthCalledWith(
        1,
        'SELECT * FROM agents WHERE name = $1',
        ['test-agent']
      );
      expect(mockPostgres.Query).toHaveBeenNthCalledWith(
        2,
        'UPDATE agents SET "memory" = $1 WHERE name = $2 RETURNING *',
        [
          { enabled: true, shortTermMemorySize: 5, memorySize: 20 },
          'test-agent',
        ]
      );

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.message).toContain(
        'memory.shortTermMemorySize set to default value (5)'
      );
      expect(parsedResult.message).toContain(
        'memory.memorySize set to default value (20)'
      );
    });

    it('should normalize zero memory configuration values to defaults', async () => {
      const mockAgent = {
        id: 1,
        name: 'test-agent',
        memory: { enabled: true, memorySize: 100 },
      };

      const mockUpdatedAgent = {
        ...mockAgent,
        memory: {
          enabled: true,
          shortTermMemorySize: 5, // Default value
          memorySize: 20, // Default value
        },
      };

      mockPostgres.query
        .mockResolvedValueOnce([mockAgent])
        .mockResolvedValueOnce([mockUpdatedAgent]);

      const result = await updateAgentTool.func({
        identifier: 'test-agent',
        updates: {
          memory: {
            enabled: true,
            shortTermMemorySize: 0,
            memorySize: 0,
          },
        },
      });

      expect(mockPostgres.Query).toHaveBeenCalledTimes(2);
      expect(mockPostgres.Query).toHaveBeenNthCalledWith(
        1,
        'SELECT * FROM agents WHERE name = $1',
        ['test-agent']
      );
      expect(mockPostgres.Query).toHaveBeenNthCalledWith(
        2,
        'UPDATE agents SET "memory" = $1 WHERE name = $2 RETURNING *',
        [
          { enabled: true, shortTermMemorySize: 5, memorySize: 20 },
          'test-agent',
        ]
      );

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.message).toContain(
        'memory.shortTermMemorySize set to default value (5)'
      );
      expect(parsedResult.message).toContain(
        'memory.memorySize set to default value (20)'
      );
    });

    it('should accept valid memory configuration values', async () => {
      const mockAgent = {
        id: 1,
        name: 'test-agent',
        memory: { enabled: true, memorySize: 100 },
      };

      const mockUpdatedAgent = {
        ...mockAgent,
        memory: {
          enabled: true,
          shortTermMemorySize: 50,
          memorySize: 200,
        },
      };

      mockPostgres.query
        .mockResolvedValueOnce([mockAgent])
        .mockResolvedValueOnce([mockUpdatedAgent]);

      const result = await updateAgentTool.func({
        identifier: 'test-agent',
        updates: {
          memory: {
            enabled: true,
            shortTermMemorySize: 50,
            memorySize: 200,
          },
        },
      });

      expect(mockPostgres.Query).toHaveBeenCalledTimes(2);
      expect(mockPostgres.Query).toHaveBeenNthCalledWith(
        1,
        'SELECT * FROM agents WHERE name = $1',
        ['test-agent']
      );
      expect(mockPostgres.Query).toHaveBeenNthCalledWith(
        2,
        'UPDATE agents SET "memory" = $1 WHERE name = $2 RETURNING *',
        [
          { enabled: true, shortTermMemorySize: 50, memorySize: 200 },
          'test-agent',
        ]
      );

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
    });

    it('should normalize negative RAG configuration values to default', async () => {
      const mockAgent = {
        id: 1,
        name: 'test-agent',
        rag: { enabled: true, topK: 10 },
      };

      const mockUpdatedAgent = {
        ...mockAgent,
        rag: {
          enabled: true,
          topK: 10, // Default value
        },
      };

      mockPostgres.query
        .mockResolvedValueOnce([mockAgent])
        .mockResolvedValueOnce([mockUpdatedAgent]);

      const result = await updateAgentTool.func({
        identifier: 'test-agent',
        updates: {
          rag: {
            enabled: true,
            topK: -5,
          },
        },
      });

      expect(mockPostgres.Query).toHaveBeenCalledTimes(2);
      expect(mockPostgres.Query).toHaveBeenNthCalledWith(
        1,
        'SELECT * FROM agents WHERE name = $1',
        ['test-agent']
      );
      expect(mockPostgres.Query).toHaveBeenNthCalledWith(
        2,
        'UPDATE agents SET "rag" = $1 WHERE name = $2 RETURNING *',
        [{ enabled: true, topK: 10 }, 'test-agent']
      );

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.message).toContain(
        'rag.topK set to default value (10)'
      );
    });

    it('should normalize zero RAG configuration values to default', async () => {
      const mockAgent = {
        id: 1,
        name: 'test-agent',
        rag: { enabled: true, topK: 10 },
      };

      const mockUpdatedAgent = {
        ...mockAgent,
        rag: {
          enabled: true,
          topK: 10, // Default value
        },
      };

      mockPostgres.query
        .mockResolvedValueOnce([mockAgent])
        .mockResolvedValueOnce([mockUpdatedAgent]);

      const result = await updateAgentTool.func({
        identifier: 'test-agent',
        updates: {
          rag: {
            enabled: true,
            topK: 0,
          },
        },
      });

      expect(mockPostgres.Query).toHaveBeenCalledTimes(2);
      expect(mockPostgres.Query).toHaveBeenNthCalledWith(
        1,
        'SELECT * FROM agents WHERE name = $1',
        ['test-agent']
      );
      expect(mockPostgres.Query).toHaveBeenNthCalledWith(
        2,
        'UPDATE agents SET "rag" = $1 WHERE name = $2 RETURNING *',
        [{ enabled: true, topK: 10 }, 'test-agent']
      );

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.message).toContain(
        'rag.topK set to default value (10)'
      );
    });

    it('should accept valid RAG configuration values', async () => {
      const mockAgent = {
        id: 1,
        name: 'test-agent',
        rag: { enabled: true, topK: 10 },
      };

      const mockUpdatedAgent = {
        ...mockAgent,
        rag: {
          enabled: true,
          topK: 15,
          embeddingModel: 'test-model',
        },
      };

      mockPostgres.query
        .mockResolvedValueOnce([mockAgent])
        .mockResolvedValueOnce([mockUpdatedAgent]);

      const result = await updateAgentTool.func({
        identifier: 'test-agent',
        updates: {
          rag: {
            enabled: true,
            topK: 15,
            embeddingModel: 'test-model',
          },
        },
      });

      expect(mockPostgres.Query).toHaveBeenCalledTimes(2);
      expect(mockPostgres.Query).toHaveBeenNthCalledWith(
        1,
        'SELECT * FROM agents WHERE name = $1',
        ['test-agent']
      );
      expect(mockPostgres.Query).toHaveBeenNthCalledWith(
        2,
        'UPDATE agents SET "rag" = $1 WHERE name = $2 RETURNING *',
        [
          { enabled: true, topK: 15, embeddingModel: 'test-model' },
          'test-agent',
        ]
      );

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
    });

    it('should normalize multiple invalid numeric values in single update', async () => {
      const mockAgent = {
        id: 1,
        name: 'test-agent',
        interval: 1000,
        max_iterations: 10,
        memory: { enabled: true, memorySize: 100 },
      };

      const mockUpdatedAgent = {
        ...mockAgent,
        interval: 5, // Default value
        max_iterations: 15, // Default value
        memory: {
          enabled: true,
          shortTermMemorySize: 5, // Default value
          memorySize: 20, // Default value
        },
      };

      mockPostgres.query
        .mockResolvedValueOnce([mockAgent])
        .mockResolvedValueOnce([mockUpdatedAgent]);

      const result = await updateAgentTool.func({
        identifier: 'test-agent',
        updates: {
          interval: -500,
          max_iterations: 0,
          memory: {
            enabled: true,
            shortTermMemorySize: -25,
            memorySize: 0,
          },
        },
      });

      expect(mockPostgres.Query).toHaveBeenCalledTimes(2);
      expect(mockPostgres.Query).toHaveBeenNthCalledWith(
        1,
        'SELECT * FROM agents WHERE name = $1',
        ['test-agent']
      );
      expect(mockPostgres.Query).toHaveBeenNthCalledWith(
        2,
        'UPDATE agents SET "interval" = $1, "max_iterations" = $2, "memory" = $3 WHERE name = $4 RETURNING *',
        [
          5, // Default interval
          15, // Default max_iterations
          { enabled: true, shortTermMemorySize: 5, memorySize: 20 }, // Default memory values
          'test-agent',
        ]
      );

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.message).toContain(
        'interval set to default value (5)'
      );
      expect(parsedResult.message).toContain(
        'max_iterations set to default value (15)'
      );
      expect(parsedResult.message).toContain(
        'memory.shortTermMemorySize set to default value (5)'
      );
      expect(parsedResult.message).toContain(
        'memory.memorySize set to default value (20)'
      );
    });
  });
});
