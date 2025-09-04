import { listAgentsTool } from '../../../config-agent/tools/listAgentsTool.js';
import { Postgres } from '@snakagent/database';
import { logger } from '@snakagent/core';

jest.mock('@snakagent/database', () => ({
  Postgres: { Query: jest.fn(), query: jest.fn() },
}));

jest.mock('@snakagent/core', () => ({
  logger: { error: jest.fn() },
}));

describe('listAgentsTool', () => {
  let mockPostgres: jest.Mocked<typeof Postgres>;
  let mockLogger: jest.Mocked<typeof logger>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPostgres = jest.mocked(Postgres);
    mockLogger = jest.mocked(logger);
    mockPostgres.Query.mockImplementation(
      (query: string, params: unknown[]) => ({ query, params })
    );
  });

  it('should have correct configuration', () => {
    expect(listAgentsTool.name).toBe('list_agents');
    expect(listAgentsTool.description).toContain(
      'List/show/get all agent configurations'
    );
  });

  it('should transform limit/offset correctly', () => {
    const schema = listAgentsTool.schema;
    expect(schema.safeParse({ limit: -5, offset: 0 }).success).toBe(true);
    expect(schema.safeParse({ limit: 10, offset: 5 }).success).toBe(true);
  });

  describe('SQL construction and filters', () => {
    const filterCases = [
      {
        filters: {},
        expected: { query: 'SELECT * FROM agents ORDER BY name', params: [] },
      },
      {
        filters: { group: 'trading' },
        expected: {
          query: 'SELECT * FROM agents WHERE "group" = $1 ORDER BY name',
          params: ['trading'],
        },
      },
      {
        filters: { mode: 'interactive' },
        expected: {
          query: 'SELECT * FROM agents WHERE "mode" = $1 ORDER BY name',
          params: ['interactive'],
        },
      },
      {
        filters: { name_contains: 'test' },
        expected: {
          query: 'SELECT * FROM agents WHERE "name" ILIKE $1 ORDER BY name',
          params: ['%test%'],
        },
      },
      {
        filters: { group: 'trading', mode: 'interactive' },
        expected: {
          query:
            'SELECT * FROM agents WHERE "group" = $1 AND "mode" = $2 ORDER BY name',
          params: ['trading', 'interactive'],
        },
      },
      {
        filters: { group: 'trading', name_contains: 'agent' },
        expected: {
          query:
            'SELECT * FROM agents WHERE "group" = $1 AND "name" ILIKE $2 ORDER BY name',
          params: ['trading', '%agent%'],
        },
      },
      {
        filters: { mode: 'interactive', name_contains: 'test' },
        expected: {
          query:
            'SELECT * FROM agents WHERE "mode" = $1 AND "name" ILIKE $2 ORDER BY name',
          params: ['interactive', '%test%'],
        },
      },
      {
        filters: {
          group: 'trading',
          mode: 'interactive',
          name_contains: 'agent',
        },
        expected: {
          query:
            'SELECT * FROM agents WHERE "group" = $1 AND "mode" = $2 AND "name" ILIKE $3 ORDER BY name',
          params: ['trading', 'interactive', '%agent%'],
        },
      },
    ];

    it.each(filterCases)(
      'should build correct SQL for filters: $filters',
      async ({ filters, expected }) => {
        mockPostgres.query.mockResolvedValue([{ id: 1, name: 'test' }]);

        await listAgentsTool.func({ filters });

        expect(mockPostgres.Query).toHaveBeenCalledWith(
          expected.query,
          expected.params
        );
      }
    );

    it('should ignore null/undefined/empty filters', async () => {
      mockPostgres.query.mockResolvedValue([{ id: 1, name: 'test' }]);

      await listAgentsTool.func({ filters: null });
      expect(mockPostgres.Query).toHaveBeenCalledWith(
        'SELECT * FROM agents ORDER BY name',
        []
      );

      await listAgentsTool.func({
        filters: { group: '', mode: undefined, name_contains: null },
      });
      expect(mockPostgres.Query).toHaveBeenCalledWith(
        'SELECT * FROM agents ORDER BY name',
        []
      );
    });
  });

  describe('pagination (LIMIT/OFFSET)', () => {
    const paginationCases = [
      {
        limit: 10,
        offset: undefined,
        expected: {
          query: 'SELECT * FROM agents ORDER BY name LIMIT $1',
          params: [10],
        },
      },
      {
        limit: undefined,
        offset: 5,
        expected: {
          query: 'SELECT * FROM agents ORDER BY name OFFSET $1',
          params: [5],
        },
      },
      {
        limit: 10,
        offset: 5,
        expected: {
          query: 'SELECT * FROM agents ORDER BY name LIMIT $1 OFFSET $2',
          params: [10, 5],
        },
      },
      {
        limit: 0,
        offset: undefined,
        expected: { query: 'SELECT * FROM agents ORDER BY name', params: [] },
      },
      {
        limit: undefined,
        offset: 0,
        expected: { query: 'SELECT * FROM agents ORDER BY name', params: [] },
      },
      {
        limit: null,
        offset: null,
        expected: { query: 'SELECT * FROM agents ORDER BY name', params: [] },
      },
    ];

    it.each(paginationCases)(
      'should handle limit=$limit, offset=$offset',
      async ({ limit, offset, expected }) => {
        mockPostgres.query.mockResolvedValue([{ id: 1, name: 'test' }]);

        // Validate input first to apply transformations (≤0 → null)
        const validatedInput = listAgentsTool.schema.parse({ limit, offset });

        await listAgentsTool.func(validatedInput);

        expect(mockPostgres.Query).toHaveBeenCalledWith(
          expected.query,
          expected.params
        );
      }
    );
  });

  describe('clause ordering', () => {
    it('should maintain correct SQL clause order', async () => {
      mockPostgres.query.mockResolvedValue([{ id: 1, name: 'test' }]);

      await listAgentsTool.func({
        filters: { group: 'trading' },
        limit: 10,
        offset: 5,
      });

      const expectedQuery =
        'SELECT * FROM agents WHERE "group" = $1 ORDER BY name LIMIT $2 OFFSET $3';
      expect(mockPostgres.Query).toHaveBeenCalledWith(expectedQuery, [
        'trading',
        10,
        5,
      ]);
    });
  });

  describe('success results', () => {
    it('should return correct success response', async () => {
      const mockAgents = [
        { id: 1, name: 'agent1' },
        { id: 2, name: 'agent2' },
      ];
      mockPostgres.query.mockResolvedValue(mockAgents);

      const result = await listAgentsTool.func({});
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.data).toEqual(mockAgents);
      expect(parsed.count).toBe(2);
      expect(parsed.message).toBe('Found 2 agent(s)');
    });

    it('should handle empty results', async () => {
      mockPostgres.query.mockResolvedValue([]);

      const result = await listAgentsTool.func({});
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.count).toBe(0);
      expect(parsed.message).toBe('Found 0 agent(s)');
    });
  });

  describe('error handling', () => {
    const errorCases = [
      { error: new Error('DB error'), expectedError: 'DB error' },
      { error: 'String error', expectedError: 'String error' },
    ];

    it.each(errorCases)(
      'should handle $error type errors',
      async ({ error, expectedError }) => {
        mockPostgres.query.mockRejectedValue(error);

        const result = await listAgentsTool.func({});
        const parsed = JSON.parse(result);

        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('Error listing agents:')
        );
        expect(parsed.success).toBe(false);
        expect(parsed.message).toBe('Failed to list agents');
        expect(parsed.error).toBe(expectedError);
      }
    );

    it('should handle Postgres.Query constructor errors', async () => {
      mockPostgres.Query.mockImplementation(() => {
        throw new Error('Query error');
      });

      const result = await listAgentsTool.func({});
      const parsed = JSON.parse(result);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error listing agents:')
      );
      expect(parsed.success).toBe(false);
      expect(parsed.message).toBe('Failed to list agents');
    });
  });
});
