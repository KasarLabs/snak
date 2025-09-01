import { readAgentTool } from '../../../config-agent/tools/readAgentTool.js';
import { Postgres } from '@snakagent/database';
import { logger } from '@snakagent/core';

jest.mock('@snakagent/database', () => ({
  Postgres: { Query: jest.fn(), query: jest.fn() },
}));

jest.mock('@snakagent/core', () => ({
  logger: { error: jest.fn() },
}));

describe('readAgentTool', () => {
  let mockPostgres: jest.Mocked<typeof Postgres>;
  let mockLogger: jest.Mocked<typeof logger>;

  const asJson = (s: string) => JSON.parse(s);
  const mkRow = (o = {}) => ({ id: 1, name: 'agent', ...o });

  beforeEach(() => {
    jest.clearAllMocks();
    mockPostgres = jest.mocked(Postgres);
    mockLogger = jest.mocked(logger);
    mockPostgres.Query.mockImplementation(
      (query: string, params: unknown[]) => ({ query, params })
    );
  });

  describe('searchBy field resolution', () => {
    it.each([
      {
        searchBy: 'id' as const,
        sql: 'SELECT * FROM agents WHERE id = $1',
        params: ['123'],
      },
      {
        searchBy: 'name' as const,
        sql: 'SELECT * FROM agents WHERE name = $1',
        params: ['agent'],
      },
      {
        searchBy: undefined,
        sql: 'SELECT * FROM agents WHERE name = $1',
        params: ['agent'],
      },
      {
        searchBy: 'invalid' as any,
        sql: 'SELECT * FROM agents WHERE name = $1',
        params: ['agent'],
      },
    ])(
      'should resolve searchBy $searchBy correctly',
      async ({ searchBy, sql, params }) => {
        mockPostgres.query.mockResolvedValue([]);

        await readAgentTool.func({ identifier: params[0], searchBy });

        expect(mockPostgres.Query).toHaveBeenCalledWith(sql, params);
        expect(mockPostgres.query).toHaveBeenCalledTimes(1);
      }
    );
  });

  describe('success cases', () => {
    it('should return first row on success', async () => {
      const mockAgent = mkRow();
      mockPostgres.query.mockResolvedValue([mockAgent]);

      const result = await readAgentTool.func({ identifier: 'agent' });
      const out = asJson(result);

      expect(out).toEqual(
        expect.objectContaining({
          success: true,
          message: 'Agent configuration retrieved successfully',
          data: mockAgent,
        })
      );
    });

    it('should return first row when multiple rows exist', async () => {
      const agents = [mkRow({ id: 1 }), mkRow({ id: 2 })];
      mockPostgres.query.mockResolvedValue(agents);

      const result = await readAgentTool.func({ identifier: 'agent' });
      const out = asJson(result);

      expect(out.data).toEqual(agents[0]);
    });
  });

  describe('not found cases', () => {
    it.each([
      { searchBy: 'name' as const, identifier: 'agent' },
      { searchBy: 'id' as const, identifier: '123' },
    ])(
      'should handle not found for $searchBy',
      async ({ searchBy, identifier }) => {
        mockPostgres.query.mockResolvedValue([]);

        const result = await readAgentTool.func({ identifier, searchBy });
        const out = asJson(result);

        expect(out).toEqual(
          expect.objectContaining({
            success: false,
            message: `Agent not found with ${searchBy}: ${identifier}`,
          })
        );
      }
    );
  });

  describe('error handling', () => {
    it.each([
      { phase: 'find', error: new Error('Database connection failed') },
      { phase: 'find', error: 'String error' },
      { phase: 'query', error: new Error('Invalid query syntax') },
    ])('should handle $phase errors with $error', async ({ phase, error }) => {
      if (phase === 'query') {
        mockPostgres.Query.mockImplementation(() => {
          throw error;
        });
      } else {
        mockPostgres.query.mockRejectedValue(error);
      }

      const result = await readAgentTool.func({ identifier: 'agent' });
      const out = asJson(result);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error reading agent:')
      );
      expect(out).toEqual(
        expect.objectContaining({
          success: false,
          message: 'Failed to read agent configuration',
          error: error instanceof Error ? error.message : String(error),
        })
      );
    });
  });

  describe('edge cases', () => {
    it.each([
      { identifier: '123', searchBy: 'id' as const, expected: 'id' },
      { identifier: 'not-a-number', searchBy: 'id' as const, expected: 'id' },
      { identifier: '0', searchBy: 'id' as const, expected: 'id' },
      { identifier: '-1', searchBy: 'id' as const, expected: 'id' },
    ])(
      'should handle identifier $identifier with searchBy $searchBy',
      async ({ identifier, searchBy, expected }) => {
        mockPostgres.query.mockResolvedValue([]);

        const result = await readAgentTool.func({ identifier, searchBy });
        const out = asJson(result);

        expect(out.message).toContain(expected);
      }
    );
  });
});
