import { deleteAgentTool } from '../../../config-agent/tools/deleteAgentTool.js';
import { Postgres } from '@snakagent/database';
import { logger } from '@snakagent/core';

jest.mock('@snakagent/database', () => ({
  Postgres: {
    Query: jest.fn(),
    query: jest.fn(),
  },
}));

jest.mock('@snakagent/core', () => ({
  logger: { error: jest.fn(), info: jest.fn() },
}));

describe('deleteAgentTool', () => {
  let mockPostgres: jest.Mocked<typeof Postgres>;
  let mockLogger: jest.Mocked<typeof logger>;

  const asJson = (result: string) => JSON.parse(result);
  const mkAgent = (id: number, name: string) => ({
    id,
    name,
    description: 'Test agent',
  });
  const setupFind = (agent: any) =>
    mockPostgres.query.mockResolvedValueOnce([agent]);
  const setupDelete = () => mockPostgres.query.mockResolvedValueOnce([]);

  beforeEach(() => {
    jest.clearAllMocks();
    mockPostgres = jest.mocked(Postgres);
    mockLogger = jest.mocked(logger);

    // Mock Postgres.Query constructor
    mockPostgres.Query.mockImplementation(
      (query: string, params: unknown[]) => ({ query, params })
    );
  });

  describe('tool configuration', () => {
    it('should have correct name and description', () => {
      expect(deleteAgentTool.name).toBe('delete_agent');
      expect(deleteAgentTool.description).toContain(
        'Delete/remove/destroy an agent configuration permanently'
      );
    });

    it('should validate schema', () => {
      const result = deleteAgentTool.schema.safeParse({ identifier: 'test' });
      expect(result.success).toBe(true);
    });
  });

  describe('confirmation handling', () => {
    it('should proceed when confirm is true', async () => {
      const agent = mkAgent(1, 'test-agent');
      setupFind(agent);
      setupDelete();

      const result = await deleteAgentTool.func({
        identifier: 'test-agent',
        confirm: true,
      });

      expect(asJson(result).success).toBe(true);
    });

    it('should proceed when confirm is undefined', async () => {
      const agent = mkAgent(1, 'test-agent');
      setupFind(agent);
      setupDelete();

      const result = await deleteAgentTool.func({ identifier: 'test-agent' });

      expect(asJson(result).success).toBe(true);
    });

    it('should return early when confirm is false', async () => {
      const result = await deleteAgentTool.func({
        identifier: 'test-agent',
        confirm: false,
      });

      expect(mockPostgres.query).not.toHaveBeenCalled();
      expect(asJson(result)).toEqual({
        success: false,
        message:
          'Deletion requires explicit confirmation. Set confirm to true.',
      });
    });
  });

  describe('search behavior', () => {
    it.each([
      ['id', 'id' as const, 'SELECT * FROM agents WHERE id = $1'],
      ['name', 'name' as const, 'SELECT * FROM agents WHERE name = $1'],
      ['default', undefined, 'SELECT * FROM agents WHERE name = $1'],
    ])(
      'should use correct search query for %s',
      async (_, searchBy, expectedQuery) => {
        const agent = mkAgent(1, 'test-agent');
        setupFind(agent);
        setupDelete();

        await deleteAgentTool.func({ identifier: 'test-agent', searchBy });

        expect(mockPostgres.Query).toHaveBeenNthCalledWith(1, expectedQuery, [
          'test-agent',
        ]);
      }
    );

    it('should handle invalid searchBy by defaulting to name', async () => {
      const agent = mkAgent(1, 'test-agent');
      setupFind(agent);
      setupDelete();

      await deleteAgentTool.func({
        identifier: 'test-agent',
        searchBy: 'invalid_type' as any,
      });

      expect(mockPostgres.Query).toHaveBeenNthCalledWith(
        1,
        'SELECT * FROM agents WHERE name = $1',
        ['test-agent']
      );
    });
  });

  describe('agent not found', () => {
    it.each([
      ['id', '999', 'id' as const],
      ['name', 'non-existent', undefined],
      ['default', 'missing', undefined],
    ])(
      'should handle agent not found by %s',
      async (_, identifier, searchBy) => {
        mockPostgres.query.mockResolvedValueOnce([]);

        const result = await deleteAgentTool.func({ identifier, searchBy });

        expect(mockPostgres.Query).toHaveBeenCalledTimes(1);
        expect(asJson(result)).toEqual({
          success: false,
          message: `Agent not found with ${searchBy || 'name'}: ${identifier}`,
        });
      }
    );
  });

  describe('successful deletion', () => {
    it('should delete agent and return success message', async () => {
      const agent = mkAgent(1, 'test-agent');
      setupFind(agent);
      setupDelete();

      const result = await deleteAgentTool.func({ identifier: 'test-agent' });

      expect(mockPostgres.Query).toHaveBeenCalledTimes(2);
      expect(mockPostgres.Query).toHaveBeenNthCalledWith(
        1,
        'SELECT * FROM agents WHERE name = $1',
        ['test-agent']
      );
      expect(mockPostgres.Query).toHaveBeenNthCalledWith(
        2,
        'DELETE FROM agents WHERE id = $1',
        [1]
      );

      expect(asJson(result)).toEqual({
        success: true,
        message: 'Agent "test-agent" deleted successfully',
      });
    });
  });

  describe('error handling', () => {
    it.each([
      ['during find', 'Error', new Error('DB error')],
      ['during find', 'string', 'DB error'],
      ['during delete', 'Error', new Error('DB error')],
      ['during delete', 'string', 'DB error'],
    ])('should handle %s %s', async (phase, errorType, error) => {
      const agent = mkAgent(1, 'test-agent');

      if (phase === 'during find') {
        mockPostgres.query.mockRejectedValueOnce(error);
      } else {
        setupFind(agent);
        mockPostgres.query.mockRejectedValueOnce(error);
      }

      const result = await deleteAgentTool.func({ identifier: 'test-agent' });

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error deleting agent:')
      );
      expect(asJson(result)).toEqual({
        success: false,
        message: 'Failed to delete agent',
        error: errorType === 'Error' ? 'DB error' : 'DB error',
      });
    });

    it('should handle Postgres.Query constructor errors', async () => {
      mockPostgres.Query.mockImplementation(() => {
        throw new Error('Query error');
      });

      const result = await deleteAgentTool.func({ identifier: 'test-agent' });

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error deleting agent:')
      );
      expect(asJson(result)).toEqual({
        success: false,
        message: 'Failed to delete agent',
        error: 'Query error',
      });
    });
  });

  describe('ID parameter handling', () => {
    it.each([
      ['non-numeric', 'abc'],
      ['zero', '0'],
      ['negative', '-1'],
    ])('should handle %s ID gracefully', async (_, identifier) => {
      mockPostgres.query.mockResolvedValueOnce([]);

      const result = await deleteAgentTool.func({ identifier, searchBy: 'id' });

      expect(mockPostgres.Query).toHaveBeenCalledTimes(1);
      expect(asJson(result).success).toBe(false);
    });

    it('should use numeric string ID for SELECT but row ID for DELETE', async () => {
      const agent = mkAgent(123, 'numeric-id-agent');
      setupFind(agent);
      setupDelete();

      await deleteAgentTool.func({ identifier: '123', searchBy: 'id' });

      expect(mockPostgres.Query).toHaveBeenNthCalledWith(
        1,
        'SELECT * FROM agents WHERE id = $1',
        ['123']
      );
      expect(mockPostgres.Query).toHaveBeenNthCalledWith(
        2,
        'DELETE FROM agents WHERE id = $1',
        [123]
      );
    });
  });
});
