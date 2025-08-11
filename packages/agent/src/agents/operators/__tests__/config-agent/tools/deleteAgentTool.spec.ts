import { deleteAgentTool } from '../../../config-agent/tools/deleteAgentTool.js';
import { Postgres } from '@snakagent/database';
import { logger } from '@snakagent/core';

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

describe('deleteAgentTool', () => {
  let mockPostgres: jest.Mocked<typeof Postgres>;
  let mockLogger: jest.Mocked<typeof logger>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockPostgres = jest.mocked(Postgres);
    mockLogger = jest.mocked(logger);
    
    // Reset mock implementations
    mockPostgres.Query.mockClear();
    mockPostgres.query.mockClear();
    mockLogger.error.mockClear();
    mockLogger.info.mockClear();
    
    // Configure Postgres.Query to return a mock query object
    mockPostgres.Query.mockImplementation((query: string, params: unknown[]) => {
      return { query, params };
    });
  });

  describe('tool configuration', () => {
    it('should have correct name and description', () => {
      expect(deleteAgentTool.name).toBe('delete_agent');
      expect(deleteAgentTool.description).toContain('Delete/remove/destroy an agent configuration permanently');
    });

    it('should have proper schema validation', () => {
      const schema = deleteAgentTool.schema;
      expect(schema).toBeDefined();
      expect(schema.shape).toHaveProperty('identifier');
      expect(schema.shape).toHaveProperty('searchBy');
      expect(schema.shape).toHaveProperty('confirm');
    });

    it('should validate schema structure', () => {
      const schema = deleteAgentTool.schema;
      
      // Identifier should be required
      expect(schema.shape.identifier._def.typeName).toBe('ZodString');
      
      // SearchBy should be optional with nullable
      expect(schema.shape.searchBy._def.typeName).toBe('ZodNullable');
      
      // Confirm should be optional with nullable
      expect(schema.shape.confirm._def.typeName).toBe('ZodNullable');
    });

    it('should have correct default values', () => {
      const schema = deleteAgentTool.schema;
      const parsed = schema.parse({ identifier: 'test-agent' });
      expect(parsed.searchBy).toBeUndefined();
      expect(parsed.confirm).toBeUndefined();
    });
  });

  describe('function execution', () => {
    it('should delete agent by name', async () => {
      const mockAgent = {
        id: 1,
        name: 'test-agent',
        description: 'Test agent description',
        group: 'trading',
      };
      
      // Mock the SELECT query to return the agent
      mockPostgres.query.mockResolvedValueOnce([mockAgent]);
      // Mock the DELETE query to return empty array (successful deletion)
      mockPostgres.query.mockResolvedValueOnce([]);

      const result = await deleteAgentTool.func({
        identifier: 'test-agent',
        searchBy: 'name'
      });

      expect(mockPostgres.Query).toHaveBeenCalledTimes(2);
      expect(mockPostgres.Query).toHaveBeenNthCalledWith(1, 'SELECT * FROM agents WHERE name = $1', ['test-agent']);
      expect(mockPostgres.Query).toHaveBeenNthCalledWith(2, 'DELETE FROM agents WHERE id = $1', [1]);
      
      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.message).toBe('Agent "test-agent" deleted successfully');
    });

    it('should delete agent by ID', async () => {
      const mockAgent = {
        id: 1,
        name: 'test-agent',
        description: 'Test agent description',
        group: 'trading',
      };
      
      mockPostgres.query.mockResolvedValueOnce([mockAgent]);
      mockPostgres.query.mockResolvedValueOnce([]);

      const result = await deleteAgentTool.func({
        identifier: '1',
        searchBy: 'id'
      });

      expect(mockPostgres.Query).toHaveBeenCalledTimes(2);
      expect(mockPostgres.Query).toHaveBeenNthCalledWith(1, 'SELECT * FROM agents WHERE id = $1', ['1']);
      expect(mockPostgres.Query).toHaveBeenNthCalledWith(2, 'DELETE FROM agents WHERE id = $1', [1]);
      
      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.message).toBe('Agent "test-agent" deleted successfully');
    });

    it('should use default searchBy when not specified', async () => {
      const mockAgent = {
        id: 1,
        name: 'test-agent',
        description: 'Test agent description',
      };
      
      mockPostgres.query.mockResolvedValueOnce([mockAgent]);
      mockPostgres.query.mockResolvedValueOnce([]);

      const result = await deleteAgentTool.func({
        identifier: 'test-agent'
      });

      expect(mockPostgres.Query).toHaveBeenCalledTimes(2);
      expect(mockPostgres.Query).toHaveBeenNthCalledWith(1, 'SELECT * FROM agents WHERE name = $1', ['test-agent']);
      expect(mockPostgres.Query).toHaveBeenNthCalledWith(2, 'DELETE FROM agents WHERE id = $1', [1]);
      
      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.message).toBe('Agent "test-agent" deleted successfully');
    });

    it('should handle agent with complex configuration', async () => {
      const mockAgent = {
        id: 1,
        name: 'complex-agent',
        description: 'Complex agent description',
        group: 'trading',
        lore: ['Lore 1', 'Lore 2'],
        objectives: ['Objective 1', 'Objective 2'],
        knowledge: ['Knowledge 1', 'Knowledge 2'],
        system_prompt: 'Complex system prompt',
        interval: 300,
        plugins: ['plugin1', 'plugin2'],
        memory: { enabled: true, memorySize: 100 },
        rag: { enabled: true, embeddingModel: 'test-model' },
        mode: 'interactive',
        max_iterations: 10,
      };
      
      mockPostgres.query.mockResolvedValueOnce([mockAgent]);
      mockPostgres.query.mockResolvedValueOnce([]);

      const result = await deleteAgentTool.func({
        identifier: 'complex-agent'
      });

      expect(mockPostgres.Query).toHaveBeenCalledTimes(2);
      expect(mockPostgres.Query).toHaveBeenNthCalledWith(1, 'SELECT * FROM agents WHERE name = $1', ['complex-agent']);
      expect(mockPostgres.Query).toHaveBeenNthCalledWith(2, 'DELETE FROM agents WHERE id = $1', [1]);
      
      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.message).toBe('Agent "complex-agent" deleted successfully');
    });

    it('should handle confirmation parameter', async () => {
      const mockAgent = {
        id: 1,
        name: 'confirm-agent',
        description: 'Test agent',
      };
      
      mockPostgres.query.mockResolvedValueOnce([mockAgent]);
      mockPostgres.query.mockResolvedValueOnce([]);

      const result = await deleteAgentTool.func({
        identifier: 'confirm-agent',
        confirm: true
      });

      expect(mockPostgres.Query).toHaveBeenCalledTimes(2);
      expect(mockPostgres.Query).toHaveBeenNthCalledWith(1, 'SELECT * FROM agents WHERE name = $1', ['confirm-agent']);
      expect(mockPostgres.Query).toHaveBeenNthCalledWith(2, 'DELETE FROM agents WHERE id = $1', [1]);
      
      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
    });

    it('should handle confirmation set to false', async () => {
      const result = await deleteAgentTool.func({
        identifier: 'test-agent',
        confirm: false
      });

      expect(mockPostgres.Query).toHaveBeenCalledTimes(0);
      
      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(false);
      expect(parsedResult.message).toBe('Deletion requires explicit confirmation. Set confirm to true.');
    });
  });

  describe('error handling', () => {
    it('should handle agent not found by name', async () => {
      mockPostgres.query.mockResolvedValueOnce([]);

      const result = await deleteAgentTool.func({
        identifier: 'non-existent-agent'
      });

      expect(mockPostgres.Query).toHaveBeenCalledTimes(1);
      expect(mockPostgres.Query).toHaveBeenNthCalledWith(1, 'SELECT * FROM agents WHERE name = $1', ['non-existent-agent']);
      
      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(false);
      expect(parsedResult.message).toBe('Agent not found with name: non-existent-agent');
    });

    it('should handle agent not found by ID', async () => {
      mockPostgres.query.mockResolvedValueOnce([]);

      const result = await deleteAgentTool.func({
        identifier: '999',
        searchBy: 'id'
      });

      expect(mockPostgres.Query).toHaveBeenCalledTimes(1);
      expect(mockPostgres.Query).toHaveBeenNthCalledWith(1, 'SELECT * FROM agents WHERE id = $1', ['999']);
      
      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(false);
      expect(parsedResult.message).toBe('Agent not found with id: 999');
    });

    it('should handle database query errors', async () => {
      const dbError = new Error('Database connection failed');
      mockPostgres.query.mockRejectedValueOnce(dbError);

      const result = await deleteAgentTool.func({
        identifier: 'test-agent'
      });

      expect(mockLogger.error).toHaveBeenCalledWith('Error deleting agent: Error: Database connection failed');
      
      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(false);
      expect(parsedResult.message).toBe('Failed to delete agent');
      expect(parsedResult.error).toBe('Database connection failed');
    });

    it('should handle database query errors with non-Error objects', async () => {
      mockPostgres.query.mockRejectedValueOnce('String error');

      const result = await deleteAgentTool.func({
        identifier: 'test-agent'
      });

      expect(mockLogger.error).toHaveBeenCalledWith('Error deleting agent: String error');
      
      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(false);
      expect(parsedResult.message).toBe('Failed to delete agent');
      expect(parsedResult.error).toBe('String error');
    });

    it('should handle Postgres.Query constructor errors', async () => {
      mockPostgres.Query.mockImplementation(() => {
        throw new Error('Invalid query syntax');
      });

      const result = await deleteAgentTool.func({
        identifier: 'test-agent'
      });

      expect(mockLogger.error).toHaveBeenCalledWith('Error deleting agent: Error: Invalid query syntax');
      
      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(false);
      expect(parsedResult.message).toBe('Failed to delete agent');
      expect(parsedResult.error).toBe('Invalid query syntax');
    });

    it('should handle invalid searchBy parameter', async () => {
      mockPostgres.query.mockResolvedValueOnce([]);

      const result = await deleteAgentTool.func({
        identifier: 'test-agent',
        searchBy: 'invalid_type' as any
      });

      expect(mockPostgres.Query).toHaveBeenCalledTimes(1);
      expect(mockPostgres.Query).toHaveBeenNthCalledWith(1, 'SELECT * FROM agents WHERE name = $1', ['test-agent']);
      
      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(false);
      expect(parsedResult.message).toBe('Agent not found with invalid_type: test-agent');
    });
  });

  describe('edge cases', () => {
    it('should handle agent name with special characters', async () => {
      const mockAgent = {
        id: 1,
        name: 'agent-with-dashes_and_underscores',
        description: 'Special characters agent',
      };
      
      mockPostgres.query.mockResolvedValueOnce([mockAgent]);
      mockPostgres.query.mockResolvedValueOnce([]);

      const result = await deleteAgentTool.func({
        identifier: 'agent-with-dashes_and_underscores'
      });

      expect(mockPostgres.Query).toHaveBeenCalledTimes(2);
      expect(mockPostgres.Query).toHaveBeenNthCalledWith(1, 'SELECT * FROM agents WHERE name = $1', ['agent-with-dashes_and_underscores']);
      expect(mockPostgres.Query).toHaveBeenNthCalledWith(2, 'DELETE FROM agents WHERE id = $1', [1]);
      
      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.message).toBe('Agent "agent-with-dashes_and_underscores" deleted successfully');
    });

    it('should handle very long agent names', async () => {
      const longName = 'a'.repeat(255);
      const mockAgent = {
        id: 1,
        name: longName,
        description: 'Long name agent',
      };
      
      mockPostgres.query.mockResolvedValueOnce([mockAgent]);
      mockPostgres.query.mockResolvedValueOnce([]);

      const result = await deleteAgentTool.func({
        identifier: longName
      });

      expect(mockPostgres.Query).toHaveBeenCalledTimes(2);
      expect(mockPostgres.Query).toHaveBeenNthCalledWith(1, 'SELECT * FROM agents WHERE name = $1', [longName]);
      expect(mockPostgres.Query).toHaveBeenNthCalledWith(2, 'DELETE FROM agents WHERE id = $1', [1]);
      
      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
    });

    it('should handle very large ID values', async () => {
      const largeId = '999999999';
      const mockAgent = {
        id: 999999999,
        name: 'large-id-agent',
        description: 'Large ID agent',
      };
      
      mockPostgres.query.mockResolvedValueOnce([mockAgent]);
      mockPostgres.query.mockResolvedValueOnce([]);

      const result = await deleteAgentTool.func({
        identifier: largeId,
        searchBy: 'id'
      });

      expect(mockPostgres.Query).toHaveBeenCalledTimes(2);
      expect(mockPostgres.Query).toHaveBeenNthCalledWith(1, 'SELECT * FROM agents WHERE id = $1', [largeId]);
      expect(mockPostgres.Query).toHaveBeenNthCalledWith(2, 'DELETE FROM agents WHERE id = $1', [999999999]);
      
      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
    });

    it('should handle empty identifier', async () => {
      mockPostgres.query.mockResolvedValueOnce([]);

      const result = await deleteAgentTool.func({
        identifier: ''
      });

      expect(mockPostgres.Query).toHaveBeenCalledTimes(1);
      expect(mockPostgres.Query).toHaveBeenNthCalledWith(1, 'SELECT * FROM agents WHERE name = $1', ['']);
      
      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(false);
      expect(parsedResult.message).toBe('Agent not found with name: ');
    });

    it('should handle whitespace-only identifier', async () => {
      mockPostgres.query.mockResolvedValueOnce([]);

      const result = await deleteAgentTool.func({
        identifier: '   '
      });

      expect(mockPostgres.Query).toHaveBeenCalledTimes(1);
      expect(mockPostgres.Query).toHaveBeenNthCalledWith(1, 'SELECT * FROM agents WHERE name = $1', ['   ']);
      
      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(false);
      expect(parsedResult.message).toBe('Agent not found with name:    ');
    });

    it('should handle case-sensitive name matching', async () => {
      const mockAgent = {
        id: 1,
        name: 'TestAgent',
        description: 'Case sensitive agent',
      };
      
      mockPostgres.query.mockResolvedValueOnce([mockAgent]);
      mockPostgres.query.mockResolvedValueOnce([]);

      const result = await deleteAgentTool.func({
        identifier: 'TestAgent'
      });

      expect(mockPostgres.Query).toHaveBeenCalledTimes(2);
      expect(mockPostgres.Query).toHaveBeenNthCalledWith(1, 'SELECT * FROM agents WHERE name = $1', ['TestAgent']);
      expect(mockPostgres.Query).toHaveBeenNthCalledWith(2, 'DELETE FROM agents WHERE id = $1', [1]);
      
      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
    });

    it('should handle multiple agents with same name (should delete first)', async () => {
      const mockAgent = {
        id: 1,
        name: 'duplicate-agent',
        description: 'First agent',
      };
      
      mockPostgres.query.mockResolvedValueOnce([mockAgent]);
      mockPostgres.query.mockResolvedValueOnce([]);

      const result = await deleteAgentTool.func({
        identifier: 'duplicate-agent'
      });

      expect(mockPostgres.Query).toHaveBeenCalledTimes(2);
      expect(mockPostgres.Query).toHaveBeenNthCalledWith(1, 'SELECT * FROM agents WHERE name = $1', ['duplicate-agent']);
      expect(mockPostgres.Query).toHaveBeenNthCalledWith(2, 'DELETE FROM agents WHERE id = $1', [1]);
      
      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.message).toBe('Agent "duplicate-agent" deleted successfully');
    });

    it('should handle agent with null values', async () => {
      const mockAgent = {
        id: 1,
        name: 'null-values-agent',
        description: null,
        group: null,
        lore: null,
        objectives: null,
        knowledge: null,
        system_prompt: null,
        interval: null,
        plugins: null,
        memory: null,
        rag: null,
        mode: null,
        max_iterations: null,
      };
      
      mockPostgres.query.mockResolvedValueOnce([mockAgent]);
      mockPostgres.query.mockResolvedValueOnce([]);

      const result = await deleteAgentTool.func({
        identifier: 'null-values-agent'
      });

      expect(mockPostgres.Query).toHaveBeenCalledTimes(2);
      expect(mockPostgres.Query).toHaveBeenNthCalledWith(1, 'SELECT * FROM agents WHERE name = $1', ['null-values-agent']);
      expect(mockPostgres.Query).toHaveBeenNthCalledWith(2, 'DELETE FROM agents WHERE id = $1', [1]);
      
      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.message).toBe('Agent "null-values-agent" deleted successfully');
    });
  });

  describe('parameter validation', () => {
    it('should handle numeric string ID', async () => {
      const mockAgent = {
        id: 123,
        name: 'numeric-id-agent',
        description: 'Numeric ID agent',
      };
      
      mockPostgres.query.mockResolvedValueOnce([mockAgent]);
      mockPostgres.query.mockResolvedValueOnce([]);

      const result = await deleteAgentTool.func({
        identifier: '123',
        searchBy: 'id'
      });

      expect(mockPostgres.Query).toHaveBeenCalledTimes(2);
      expect(mockPostgres.Query).toHaveBeenNthCalledWith(1, 'SELECT * FROM agents WHERE id = $1', ['123']);
      expect(mockPostgres.Query).toHaveBeenNthCalledWith(2, 'DELETE FROM agents WHERE id = $1', [123]);
      
      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
    });

    it('should handle non-numeric string ID gracefully', async () => {
      mockPostgres.query.mockResolvedValueOnce([]);

      const result = await deleteAgentTool.func({
        identifier: 'not-a-number',
        searchBy: 'id'
      });

      expect(mockPostgres.Query).toHaveBeenCalledTimes(1);
      expect(mockPostgres.Query).toHaveBeenNthCalledWith(1, 'SELECT * FROM agents WHERE id = $1', ['not-a-number']);
      
      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(false);
      expect(parsedResult.message).toBe('Agent not found with id: not-a-number');
    });

    it('should handle zero ID', async () => {
      mockPostgres.query.mockResolvedValueOnce([]);

      const result = await deleteAgentTool.func({
        identifier: '0',
        searchBy: 'id'
      });

      expect(mockPostgres.Query).toHaveBeenCalledTimes(1);
      expect(mockPostgres.Query).toHaveBeenNthCalledWith(1, 'SELECT * FROM agents WHERE id = $1', ['0']);
      
      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(false);
      expect(parsedResult.message).toBe('Agent not found with id: 0');
    });

    it('should handle negative ID', async () => {
      mockPostgres.query.mockResolvedValueOnce([]);

      const result = await deleteAgentTool.func({
        identifier: '-1',
        searchBy: 'id'
      });

      expect(mockPostgres.Query).toHaveBeenCalledTimes(1);
      expect(mockPostgres.Query).toHaveBeenNthCalledWith(1, 'SELECT * FROM agents WHERE id = $1', ['-1']);
      
      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(false);
      expect(parsedResult.message).toBe('Agent not found with id: -1');
    });
  });
}); 