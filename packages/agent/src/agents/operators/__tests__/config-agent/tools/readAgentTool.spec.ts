import { readAgentTool } from '../../../config-agent/tools/readAgentTool.js';

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

describe('readAgentTool', () => {
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
      expect(readAgentTool.name).toBe('read_agent');
      expect(readAgentTool.description).toContain('Get/retrieve/show/view/find details');
    });

    it('should have proper schema validation', () => {
      const schema = readAgentTool.schema;
      expect(schema).toBeDefined();
      expect(schema.shape).toHaveProperty('identifier');
      expect(schema.shape).toHaveProperty('searchBy');
    });

    it('should validate schema structure', () => {
      const schema = readAgentTool.schema;
      
      // Identifier should be required
      expect(schema.shape.identifier._def.typeName).toBe('ZodString');
      
      // SearchBy should be optional with nullable
      expect(schema.shape.searchBy._def.typeName).toBe('ZodNullable');
    });

    it('should have correct default searchBy', () => {
      const schema = readAgentTool.schema;
      const parsed = schema.parse({ identifier: 'test-agent' });
      expect(parsed.searchBy).toBeUndefined();
    });
  });

  describe('function execution', () => {
    it('should read agent by name', async () => {
      const mockAgent = {
        id: 1,
        name: 'test-agent',
        description: 'Test agent description',
        group: 'trading',
        lore: ['Lore 1', 'Lore 2'],
        objectives: ['Objective 1', 'Objective 2'],
        knowledge: ['Knowledge 1', 'Knowledge 2'],
        system_prompt: 'You are a trading agent',
        interval: 300,
        plugins: ['plugin1', 'plugin2'],
        memory: { enabled: true, memorySize: 100 },
        rag: { enabled: true, embeddingModel: 'test-model' },
        mode: 'interactive',
        max_iterations: 10,
      };
      
      mockPostgres.query.mockResolvedValue([mockAgent]);

      const result = await readAgentTool.func({
        identifier: 'test-agent',
        searchBy: 'name'
      });

      expect(mockPostgres.Query).toHaveBeenCalledWith(
        'SELECT * FROM agents WHERE name = $1',
        ['test-agent']
      );
      expect(mockPostgres.query).toHaveBeenCalled();
      
      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.message).toBe('Agent configuration retrieved successfully');
      expect(parsedResult.data).toEqual(mockAgent);
    });

    it('should read agent by ID', async () => {
      const mockAgent = {
        id: 1,
        name: 'test-agent',
        description: 'Test agent description',
        group: 'trading',
      };
      
      mockPostgres.query.mockResolvedValue([mockAgent]);

      const result = await readAgentTool.func({
        identifier: '1',
        searchBy: 'id'
      });

      expect(mockPostgres.Query).toHaveBeenCalledWith(
        'SELECT * FROM agents WHERE id = $1',
        ['1']
      );
      
      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.data).toEqual(mockAgent);
    });

    it('should use default identifier type when not specified', async () => {
      const mockAgent = {
        id: 1,
        name: 'test-agent',
        description: 'Test agent description',
      };
      
      mockPostgres.query.mockResolvedValue([mockAgent]);

      const result = await readAgentTool.func({
        identifier: 'test-agent'
      });

      expect(mockPostgres.Query).toHaveBeenCalledWith(
        'SELECT * FROM agents WHERE name = $1',
        ['test-agent']
      );
      
      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
    });

    it('should handle agent with minimal fields', async () => {
      const mockAgent = {
        id: 1,
        name: 'minimal-agent',
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
      
      mockPostgres.query.mockResolvedValue([mockAgent]);

      const result = await readAgentTool.func({
        identifier: 'minimal-agent'
      });

      expect(mockPostgres.Query).toHaveBeenCalledWith(
        'SELECT * FROM agents WHERE name = $1',
        ['minimal-agent']
      );
      
      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.data).toEqual(mockAgent);
    });

    it('should handle agent with complex nested objects', async () => {
      const mockAgent = {
        id: 1,
        name: 'complex-agent',
        memory: {
          enabled: true,
          shortTermMemorySize: 50,
          memorySize: 200,
          customField: { nested: { value: 'test' } },
        },
        rag: {
          enabled: true,
          topK: 5,
          embeddingModel: 'Xenova/all-MiniLM-L6-v2',
          customConfig: { threshold: 0.8, maxResults: 100 },
        },
      };
      
      mockPostgres.query.mockResolvedValue([mockAgent]);

      const result = await readAgentTool.func({
        identifier: 'complex-agent'
      });

      expect(mockPostgres.Query).toHaveBeenCalledWith(
        'SELECT * FROM agents WHERE name = $1',
        ['complex-agent']
      );
      
      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.data).toEqual(mockAgent);
    });

    it('should handle agent with large arrays', async () => {
      const largeArray = Array.from({ length: 100 }, (_, i) => `item-${i}`);
      const mockAgent = {
        id: 1,
        name: 'large-arrays-agent',
        lore: largeArray,
        objectives: largeArray,
        knowledge: largeArray,
        plugins: largeArray,
      };
      
      mockPostgres.query.mockResolvedValue([mockAgent]);

      const result = await readAgentTool.func({
        identifier: 'large-arrays-agent'
      });

      expect(mockPostgres.Query).toHaveBeenCalledWith(
        'SELECT * FROM agents WHERE name = $1',
        ['large-arrays-agent']
      );
      
      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.data).toEqual(mockAgent);
    });
  });

  describe('error handling', () => {
    it('should handle agent not found by name', async () => {
      mockPostgres.query.mockResolvedValue([]);

      const result = await readAgentTool.func({
        identifier: 'non-existent-agent'
      });

      expect(mockPostgres.Query).toHaveBeenCalledWith(
        'SELECT * FROM agents WHERE name = $1',
        ['non-existent-agent']
      );
      
      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(false);
      expect(parsedResult.message).toBe('Agent not found with name: non-existent-agent');
    });

    it('should handle agent not found by ID', async () => {
      mockPostgres.query.mockResolvedValue([]);

      const result = await readAgentTool.func({
        identifier: '999',
        searchBy: 'id'
      });

      expect(mockPostgres.Query).toHaveBeenCalledWith(
        'SELECT * FROM agents WHERE id = $1',
        ['999']
      );
      
      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(false);
      expect(parsedResult.message).toBe('Agent not found with id: 999');
    });

    it('should handle database query errors', async () => {
      const dbError = new Error('Database connection failed');
      mockPostgres.query.mockRejectedValue(dbError);

      const result = await readAgentTool.func({
        identifier: 'test-agent'
      });

      expect(mockLogger.error).toHaveBeenCalledWith('Error reading agent: Error: Database connection failed');
      
      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(false);
      expect(parsedResult.message).toBe('Failed to read agent configuration');
      expect(parsedResult.error).toBe('Database connection failed');
    });

    it('should handle database query errors with non-Error objects', async () => {
      mockPostgres.query.mockRejectedValue('String error');

      const result = await readAgentTool.func({
        identifier: 'test-agent'
      });

      expect(mockLogger.error).toHaveBeenCalledWith('Error reading agent: String error');
      
      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(false);
      expect(parsedResult.message).toBe('Failed to read agent configuration');
      expect(parsedResult.error).toBe('String error');
    });

    it('should handle Postgres.Query constructor errors', async () => {
      mockPostgres.Query.mockImplementation(() => {
        throw new Error('Invalid query syntax');
      });

      const result = await readAgentTool.func({
        identifier: 'test-agent'
      });

      expect(mockLogger.error).toHaveBeenCalledWith('Error reading agent: Error: Invalid query syntax');
      
      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(false);
      expect(parsedResult.message).toBe('Failed to read agent configuration');
      expect(parsedResult.error).toBe('Invalid query syntax');
    });

    it('should handle invalid identifier type', async () => {
      const result = await readAgentTool.func({
        identifier: 'test-agent',
        searchBy: 'invalid_type' as any
      });

      expect(mockPostgres.Query).toHaveBeenCalledWith(
        'SELECT * FROM agents WHERE name = $1',
        ['test-agent']
      );
      
      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(false);
      expect(parsedResult.message).toBe('Failed to read agent configuration');
    });
  });

  describe('edge cases', () => {
    it('should handle agent name with special characters', async () => {
      const mockAgent = {
        id: 1,
        name: 'agent-with-dashes_and_underscores',
        description: 'Special characters agent',
      };
      
      mockPostgres.query.mockResolvedValue([mockAgent]);

      const result = await readAgentTool.func({
        identifier: 'agent-with-dashes_and_underscores'
      });

      expect(mockPostgres.Query).toHaveBeenCalledWith(
        'SELECT * FROM agents WHERE name = $1',
        ['agent-with-dashes_and_underscores']
      );
      
      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.data).toEqual(mockAgent);
    });

    it('should handle very long agent names', async () => {
      const longName = 'a'.repeat(255);
      const mockAgent = {
        id: 1,
        name: longName,
        description: 'Long name agent',
      };
      
      mockPostgres.query.mockResolvedValue([mockAgent]);

      const result = await readAgentTool.func({
        identifier: longName
      });

      expect(mockPostgres.Query).toHaveBeenCalledWith(
        'SELECT * FROM agents WHERE name = $1',
        [longName]
      );
      
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
      
      mockPostgres.query.mockResolvedValue([mockAgent]);

      const result = await readAgentTool.func({
        identifier: largeId,
        searchBy: 'id'
      });

      expect(mockPostgres.Query).toHaveBeenCalledWith(
        'SELECT * FROM agents WHERE id = $1',
        [largeId]
      );
      
      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
    });

    it('should handle empty identifier', async () => {
      mockPostgres.query.mockResolvedValue([]);

      const result = await readAgentTool.func({
        identifier: ''
      });

      expect(mockPostgres.Query).toHaveBeenCalledWith(
        'SELECT * FROM agents WHERE name = $1',
        ['']
      );
      
      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(false);
      expect(parsedResult.message).toBe('Agent not found with name: ');
    });

    it('should handle whitespace-only identifier', async () => {
      mockPostgres.query.mockResolvedValue([]);

      const result = await readAgentTool.func({
        identifier: '   '
      });

      expect(mockPostgres.Query).toHaveBeenCalledWith(
        'SELECT * FROM agents WHERE name = $1',
        ['   ']
      );
      
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
      
      mockPostgres.query.mockResolvedValue([mockAgent]);

      const result = await readAgentTool.func({
        identifier: 'TestAgent'
      });

      expect(mockPostgres.Query).toHaveBeenCalledWith(
        'SELECT * FROM agents WHERE name = $1',
        ['TestAgent']
      );
      
      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
    });

    it('should handle multiple agents with same name (should return first)', async () => {
      const mockAgents = [
        { id: 1, name: 'duplicate-agent', description: 'First agent' },
        { id: 2, name: 'duplicate-agent', description: 'Second agent' },
      ];
      
      mockPostgres.query.mockResolvedValue(mockAgents);

      const result = await readAgentTool.func({
        identifier: 'duplicate-agent'
      });

      expect(mockPostgres.Query).toHaveBeenCalledWith(
        'SELECT * FROM agents WHERE name = $1',
        ['duplicate-agent']
      );
      
      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.data).toEqual(mockAgents[0]); // Should return first agent
    });
  });

  describe('parameter validation', () => {
    it('should handle numeric string ID', async () => {
      const mockAgent = {
        id: 123,
        name: 'numeric-id-agent',
        description: 'Numeric ID agent',
      };
      
      mockPostgres.query.mockResolvedValue([mockAgent]);

      const result = await readAgentTool.func({
        identifier: '123',
        searchBy: 'id'
      });

      expect(mockPostgres.Query).toHaveBeenCalledWith(
        'SELECT * FROM agents WHERE id = $1',
        ['123']
      );
      
      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
    });

    it('should handle non-numeric string ID gracefully', async () => {
      mockPostgres.query.mockResolvedValue([]);

      const result = await readAgentTool.func({
        identifier: 'not-a-number',
        searchBy: 'id'
      });

      expect(mockPostgres.Query).toHaveBeenCalledWith(
        'SELECT * FROM agents WHERE id = $1',
        ['not-a-number']
      );
      
      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(false);
      expect(parsedResult.message).toBe('Agent not found with id: not-a-number');
    });

    it('should handle zero ID', async () => {
      mockPostgres.query.mockResolvedValue([]);

      const result = await readAgentTool.func({
        identifier: '0',
        searchBy: 'id'
      });

      expect(mockPostgres.Query).toHaveBeenCalledWith(
        'SELECT * FROM agents WHERE id = $1',
        ['0']
      );
      
      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(false);
      expect(parsedResult.message).toBe('Agent not found with id: 0');
    });

    it('should handle negative ID', async () => {
      mockPostgres.query.mockResolvedValue([]);

      const result = await readAgentTool.func({
        identifier: '-1',
        searchBy: 'id'
      });

      expect(mockPostgres.Query).toHaveBeenCalledWith(
        'SELECT * FROM agents WHERE id = $1',
        ['-1']
      );
      
      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(false);
      expect(parsedResult.message).toBe('Agent not found with id: -1');
    });
  });
}); 