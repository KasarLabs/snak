import { listAgentsTool } from '../../../config-agent/tools/listAgentsTool.js';

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

describe('listAgentsTool', () => {
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
      expect(listAgentsTool.name).toBe('list_agents');
      expect(listAgentsTool.description).toContain('List/show/get all agent configurations');
    });

    it('should have proper schema validation', () => {
      const schema = listAgentsTool.schema;
      expect(schema).toBeDefined();
      expect(schema.shape).toHaveProperty('filters');
      expect(schema.shape).toHaveProperty('limit');
      expect(schema.shape).toHaveProperty('offset');
    });

    it('should validate schema structure', () => {
      const schema = listAgentsTool.schema;
      
      // Test filters object 
      expect(schema.shape.filters._def.typeName).toBe('ZodNullable');
      
      // Test limit and offset
      expect(schema.shape.limit._def.typeName).toBe('ZodEffects');
      expect(schema.shape.offset._def.typeName).toBe('ZodEffects');
    });

    it('should handle optional filters', () => {
      const schema = listAgentsTool.schema;
      
      // Should accept empty object
      const parsed = schema.parse({});
      expect(parsed.filters).toBeUndefined();
      expect(parsed.limit).toBeUndefined();
      expect(parsed.offset).toBeUndefined();
    });

    it('should handle filters with all fields', () => {
      const schema = listAgentsTool.schema;
      
      const parsed = schema.parse({
        filters: {
          group: 'trading',
          mode: 'interactive',
          name_contains: 'test'
        },
        limit: 10,
        offset: 5
      });
      
      expect(parsed.filters?.group).toBe('trading');
      expect(parsed.filters?.mode).toBe('interactive');
      expect(parsed.filters?.name_contains).toBe('test');
      expect(parsed.limit).toBe(10);
      expect(parsed.offset).toBe(5);
    });
  });

  describe('function execution', () => {
    it('should list all agents without filters', async () => {
      const mockAgents = [
        { id: 1, name: 'agent1', group: 'trading' },
        { id: 2, name: 'agent2', group: 'rpc' },
      ];
      
      mockPostgres.query.mockResolvedValue(mockAgents);

      const result = await listAgentsTool.func({});

      expect(mockPostgres.Query).toHaveBeenCalledWith(
        'SELECT * FROM agents ORDER BY name',
        []
      );
      expect(mockPostgres.query).toHaveBeenCalled();
      
      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.message).toBe('Found 2 agent(s)');
      expect(parsedResult.data).toEqual(mockAgents);
      expect(parsedResult.count).toBe(2);
    });

    it('should filter agents by group', async () => {
      const mockAgents = [
        { id: 1, name: 'agent1', group: 'trading' },
      ];
      
      mockPostgres.query.mockResolvedValue(mockAgents);

      const result = await listAgentsTool.func({
        filters: { group: 'trading' }
      });

      expect(mockPostgres.Query).toHaveBeenCalledWith(
        'SELECT * FROM agents WHERE "group" = $1 ORDER BY name',
        ['trading']
      );
      
      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.data).toEqual(mockAgents);
    });

    it('should filter agents by mode', async () => {
      const mockAgents = [
        { id: 1, name: 'agent1', mode: 'interactive' },
      ];
      
      mockPostgres.query.mockResolvedValue(mockAgents);

      const result = await listAgentsTool.func({
        filters: { mode: 'interactive' }
      });

      expect(mockPostgres.Query).toHaveBeenCalledWith(
        'SELECT * FROM agents WHERE "mode" = $1 ORDER BY name',
        ['interactive']
      );
      
      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.data).toEqual(mockAgents);
    });

    it('should filter agents by name contains', async () => {
      const mockAgents = [
        { id: 1, name: 'trading-agent', group: 'trading' },
      ];
      
      mockPostgres.query.mockResolvedValue(mockAgents);

      const result = await listAgentsTool.func({
        filters: { name_contains: 'trading' }
      });

      expect(mockPostgres.Query).toHaveBeenCalledWith(
        'SELECT * FROM agents WHERE "name" ILIKE $1 ORDER BY name',
        ['%trading%']
      );
      
      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.data).toEqual(mockAgents);
    });

    it('should apply multiple filters', async () => {
      const mockAgents = [
        { id: 1, name: 'trading-agent', group: 'trading', mode: 'interactive' },
      ];
      
      mockPostgres.query.mockResolvedValue(mockAgents);

      const result = await listAgentsTool.func({
        filters: { 
          group: 'trading',
          mode: 'interactive',
          name_contains: 'agent'
        }
      });

      expect(mockPostgres.Query).toHaveBeenCalledWith(
        'SELECT * FROM agents WHERE "group" = $1 AND "mode" = $2 AND "name" ILIKE $3 ORDER BY name',
        ['trading', 'interactive', '%agent%']
      );
      
      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.data).toEqual(mockAgents);
    });

    it('should apply limit', async () => {
      const mockAgents = [
        { id: 1, name: 'agent1', group: 'trading' },
      ];
      
      mockPostgres.query.mockResolvedValue(mockAgents);

      const result = await listAgentsTool.func({
        limit: 10
      });

      expect(mockPostgres.Query).toHaveBeenCalledWith(
        'SELECT * FROM agents ORDER BY name LIMIT $1',
        [10]
      );
      
      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
    });

    it('should apply offset', async () => {
      const mockAgents = [
        { id: 2, name: 'agent2', group: 'rpc' },
      ];
      
      mockPostgres.query.mockResolvedValue(mockAgents);

      const result = await listAgentsTool.func({
        offset: 5
      });

      expect(mockPostgres.Query).toHaveBeenCalledWith(
        'SELECT * FROM agents ORDER BY name OFFSET $1',
        [5]
      );
      
      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
    });

    it('should apply limit and offset together', async () => {
      const mockAgents = [
        { id: 3, name: 'agent3', group: 'general' },
      ];
      
      mockPostgres.query.mockResolvedValue(mockAgents);

      const result = await listAgentsTool.func({
        limit: 5,
        offset: 10
      });

      expect(mockPostgres.Query).toHaveBeenCalledWith(
        'SELECT * FROM agents ORDER BY name LIMIT $1 OFFSET $2',
        [5, 10]
      );
      
      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
    });

    it('should apply filters, limit, and offset together', async () => {
      const mockAgents = [
        { id: 1, name: 'trading-agent', group: 'trading' },
      ];
      
      mockPostgres.query.mockResolvedValue(mockAgents);

      const result = await listAgentsTool.func({
        filters: { group: 'trading' },
        limit: 5,
        offset: 10
      });

      expect(mockPostgres.Query).toHaveBeenCalledWith(
        'SELECT * FROM agents WHERE "group" = $1 ORDER BY name LIMIT $2 OFFSET $3',
        ['trading', 5, 10]
      );
      
      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
    });

    it('should handle empty result set', async () => {
      mockPostgres.query.mockResolvedValue([]);

      const result = await listAgentsTool.func({});

      expect(mockPostgres.Query).toHaveBeenCalledWith(
        'SELECT * FROM agents ORDER BY name',
        []
      );
      
      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.message).toBe('Found 0 agent(s)');
      expect(parsedResult.data).toEqual([]);
      expect(parsedResult.count).toBe(0);
    });

    it('should handle null filters', async () => {
      const mockAgents = [
        { id: 1, name: 'agent1', group: 'trading' },
      ];
      
      mockPostgres.query.mockResolvedValue(mockAgents);

      const result = await listAgentsTool.func({
        filters: null
      });

      expect(mockPostgres.Query).toHaveBeenCalledWith(
        'SELECT * FROM agents ORDER BY name',
        []
      );
      
      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
    });

    it('should handle undefined filters', async () => {
      const mockAgents = [
        { id: 1, name: 'agent1', group: 'trading' },
      ];
      
      mockPostgres.query.mockResolvedValue(mockAgents);

      const result = await listAgentsTool.func({
        filters: undefined
      });

      expect(mockPostgres.Query).toHaveBeenCalledWith(
        'SELECT * FROM agents ORDER BY name',
        []
      );
      
      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
    });

    it('should handle null limit and offset', async () => {
      const mockAgents = [
        { id: 1, name: 'agent1', group: 'trading' },
      ];
      
      mockPostgres.query.mockResolvedValue(mockAgents);

      const result = await listAgentsTool.func({
        limit: null,
        offset: null
      });

      expect(mockPostgres.Query).toHaveBeenCalledWith(
        'SELECT * FROM agents ORDER BY name',
        []
      );
      
      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle database query errors', async () => {
      const dbError = new Error('Database connection failed');
      mockPostgres.query.mockRejectedValue(dbError);

      const result = await listAgentsTool.func({});

      expect(mockLogger.error).toHaveBeenCalledWith('Error listing agents: Error: Database connection failed');
      
      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(false);
      expect(parsedResult.message).toBe('Failed to list agents');
      expect(parsedResult.error).toBe('Database connection failed');
    });

    it('should handle database query errors with non-Error objects', async () => {
      mockPostgres.query.mockRejectedValue('String error');

      const result = await listAgentsTool.func({});

      expect(mockLogger.error).toHaveBeenCalledWith('Error listing agents: String error');
      
      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(false);
      expect(parsedResult.message).toBe('Failed to list agents');
      expect(parsedResult.error).toBe('String error');
    });

    it('should handle Postgres.Query constructor errors', async () => {
      mockPostgres.Query.mockImplementation(() => {
        throw new Error('Invalid query syntax');
      });

      const result = await listAgentsTool.func({});

      expect(mockLogger.error).toHaveBeenCalledWith('Error listing agents: Error: Invalid query syntax');
      
      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(false);
      expect(parsedResult.message).toBe('Failed to list agents');
      expect(parsedResult.error).toBe('Invalid query syntax');
    });
  });

  describe('edge cases', () => {
    it('should handle very large result sets', async () => {
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        id: i + 1,
        name: `agent${i + 1}`,
        group: 'general',
      }));
      
      mockPostgres.query.mockResolvedValue(largeDataset);

      const result = await listAgentsTool.func({});

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.message).toBe('Found 1000 agent(s)');
      expect(parsedResult.data).toHaveLength(1000);
      expect(parsedResult.count).toBe(1000);
    });

    it('should handle agents with special characters in names', async () => {
      const mockAgents = [
        { id: 1, name: 'agent-with-dashes', group: 'trading' },
        { id: 2, name: 'agent_with_underscores', group: 'rpc' },
        { id: 3, name: 'agent.with.dots', group: 'general' },
      ];
      
      mockPostgres.query.mockResolvedValue(mockAgents);

      const result = await listAgentsTool.func({
        filters: { name_contains: 'agent' }
      });

      expect(mockPostgres.Query).toHaveBeenCalledWith(
        'SELECT * FROM agents WHERE "name" ILIKE $1 ORDER BY name',
        ['%agent%']
      );
      
      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.data).toEqual(mockAgents);
    });

    it('should handle agents with null or undefined values', async () => {
      const mockAgents = [
        { id: 1, name: 'agent1', group: null, mode: undefined },
        { id: 2, name: 'agent2', group: 'trading', mode: 'interactive' },
      ];
      
      mockPostgres.query.mockResolvedValue(mockAgents);

      const result = await listAgentsTool.func({});

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.data).toEqual(mockAgents);
    });

    it('should handle case-insensitive name search', async () => {
      const mockAgents = [
        { id: 1, name: 'TRADING-AGENT', group: 'trading' },
      ];
      
      mockPostgres.query.mockResolvedValue(mockAgents);

      const result = await listAgentsTool.func({
        filters: { name_contains: 'trading' }
      });

      // ILIKE is case-insensitive, so 'trading' should match 'TRADING-AGENT'
      expect(mockPostgres.Query).toHaveBeenCalledWith(
        'SELECT * FROM agents WHERE "name" ILIKE $1 ORDER BY name',
        ['%trading%']
      );
      
      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
    });
  });

  describe('parameter validation', () => {
    it('should transform negative and zero values to null', () => {
      const schema = listAgentsTool.schema;
      
      // Test negative values
      const negativeResult = schema.parse({ limit: -5, offset: -10 });
      expect(negativeResult.limit).toBeNull();
      expect(negativeResult.offset).toBeNull();
      
      // Test zero values
      const zeroResult = schema.parse({ limit: 0, offset: 0 });
      expect(zeroResult.limit).toBeNull();
      expect(zeroResult.offset).toBeNull();
      
      // Test positive values
      const positiveResult = schema.parse({ limit: 5, offset: 10 });
      expect(positiveResult.limit).toBe(5);
      expect(positiveResult.offset).toBe(10);
    });

    it('should handle empty string filters', async () => {
      const mockAgents = [
        { id: 1, name: 'agent1', group: 'trading' },
      ];
      
      mockPostgres.query.mockResolvedValue(mockAgents);

      const result = await listAgentsTool.func({
        filters: { group: '', mode: '', name_contains: '' }
      });

      // Empty strings should be treated as null and ignored
      expect(mockPostgres.Query).toHaveBeenCalledWith(
        'SELECT * FROM agents ORDER BY name',
        []
      );
      
      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
    });

    it('should ignore empty strings when mixed with valid filters', async () => {
      const mockAgents = [
        { id: 1, name: 'trading-agent', group: 'trading', mode: 'interactive' },
      ];
      
      mockPostgres.query.mockResolvedValue(mockAgents);

      const result = await listAgentsTool.func({
        filters: { 
          group: 'trading',
          mode: '',  // Empty string should be ignored
          name_contains: 'agent'  // Valid filter
        }
      });

      // Only valid filters should be included in the query
      expect(mockPostgres.Query).toHaveBeenCalledWith(
        'SELECT * FROM agents WHERE "group" = $1 AND "name" ILIKE $2 ORDER BY name',
        ['trading', '%agent%']
      );
      
      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
    });

    it('should handle zero limit and offset', async () => {
      const mockAgents = [
        { id: 1, name: 'agent1', group: 'trading' },
      ];
      
      mockPostgres.query.mockResolvedValue(mockAgents);

      const validatedInput = listAgentsTool.schema.parse({
        limit: 0,
        offset: 0
      });

      const result = await listAgentsTool.func(validatedInput);

      expect(mockPostgres.Query).toHaveBeenCalledWith(
        'SELECT * FROM agents ORDER BY name',
        []
      );
      
      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
    });

    it('should handle negative limit and offset', async () => {
      const mockAgents = [
        { id: 1, name: 'agent1', group: 'trading' },
      ];
      
      mockPostgres.query.mockResolvedValue(mockAgents);

      const validatedInput = listAgentsTool.schema.parse({
        limit: -5,
        offset: -10
      });

      const result = await listAgentsTool.func(validatedInput);

      expect(mockPostgres.Query).toHaveBeenCalledWith(
        'SELECT * FROM agents ORDER BY name',
        []
      );
      
      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
    });
  });
}); 