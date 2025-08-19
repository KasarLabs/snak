// Mock modules before importing
jest.mock('../../../config-agent/tools/normalizeAgentValues.js', () => ({
  normalizeNumericValues: jest.fn(),
}));

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

import { updateAgentTool } from '../../../config-agent/tools/updateAgentTool.js';

// Helpers
const asJson = (result: string) => JSON.parse(result);

const createAgent = (overrides: any = {}) => ({
  id: 1,
  name: 'test-agent',
  description: 'Old description',
  ...overrides,
});

const createMockNormalizeResult = (config: any, defaults: string[] = []) => ({
  normalizedConfig: JSON.parse(JSON.stringify(config)),
  appliedDefaults: [...defaults],
});

describe('updateAgentTool', () => {
  let mockPostgres: any;
  let mockLogger: any;
  let mockNormalize: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockPostgres = require('@snakagent/database').Postgres;
    mockLogger = require('@snakagent/core').logger;
    mockNormalize =
      require('../../../config-agent/tools/normalizeAgentValues.js').normalizeNumericValues;

    // Reset mock implementations
    mockPostgres.Query.mockImplementation((query: string, params: any[]) => ({
      query,
      params,
    }));
    mockPostgres.query.mockResolvedValue([]);
    mockLogger.error.mockImplementation(() => {});
    mockLogger.info.mockImplementation(() => {});
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('tool configuration', () => {
    it('should have correct name and description', () => {
      expect(updateAgentTool.name).toBe('update_agent');
      expect(updateAgentTool.description).toContain(
        'Update/modify/change/rename specific properties'
      );
    });
  });

  describe('search behavior', () => {
    it.each([
      ['id', '123', 'id', 123, 'SELECT * FROM agents WHERE id = $1'],
      [
        'name',
        'test-agent',
        'name',
        'test-agent',
        'SELECT * FROM agents WHERE name = $1',
      ],
      [
        undefined,
        'test-agent',
        'name',
        'test-agent',
        'SELECT * FROM agents WHERE name = $1',
      ],
      [
        null,
        'test-agent',
        'name',
        'test-agent',
        'SELECT * FROM agents WHERE name = $1',
      ],
      [
        'invalid',
        'test-agent',
        'name',
        'test-agent',
        'SELECT * FROM agents WHERE name = $1',
      ],
    ])(
      'should search by %s when searchBy=%s',
      async (
        searchBy,
        identifier,
        expectedSearchBy,
        expectedValue,
        expectedQuery
      ) => {
        const mockAgent = createAgent({ name: identifier });
        const mockUpdatedAgent = { ...mockAgent, description: 'Updated' };

        mockNormalize.mockReturnValueOnce(
          createMockNormalizeResult({ description: 'Updated' })
        );
        mockPostgres.query
          .mockResolvedValueOnce([mockAgent])
          .mockResolvedValueOnce([mockUpdatedAgent]);

        const result = await updateAgentTool.func({
          identifier,
          searchBy: searchBy as any,
          updates: { description: 'Updated' },
        });

        expect(mockPostgres.query).toHaveBeenNthCalledWith(
          1,
          expect.objectContaining({
            query: expectedQuery,
            params: [expectedValue],
          })
        );
        expect(asJson(result).success).toBe(true);
      }
    );

    it('should handle invalid ID format', async () => {
      const result = await updateAgentTool.func({
        identifier: 'not-a-number',
        searchBy: 'id',
        updates: { description: 'Updated' },
      });

      expect(mockPostgres.query).not.toHaveBeenCalled();
      expect(asJson(result)).toEqual({
        success: false,
        message: 'Invalid ID format: not-a-number',
      });
    });

    it('should handle agent not found', async () => {
      mockPostgres.query.mockResolvedValueOnce([]);

      const result = await updateAgentTool.func({
        identifier: 'non-existent',
        updates: { description: 'Updated' },
      });

      expect(mockPostgres.query).toHaveBeenCalledTimes(1);
      expect(asJson(result)).toEqual({
        success: false,
        message: 'Agent not found with name: non-existent',
      });
    });
  });

  describe('update execution', () => {
    it('should handle multiple fields update', async () => {
      const updates = {
        name: 'new-name',
        description: 'Updated',
        group: 'trading',
      };
      const mockAgent = createAgent();
      const mockUpdatedAgent = { ...mockAgent, ...updates };

      mockNormalize.mockReturnValueOnce(createMockNormalizeResult(updates));
      mockPostgres.query
        .mockResolvedValueOnce([mockAgent])
        .mockResolvedValueOnce([mockUpdatedAgent]);

      const result = await updateAgentTool.func({
        identifier: 'test-agent',
        updates,
      });

      expect(asJson(result).success).toBe(true);
    });

    it('should handle no valid fields to update', async () => {
      const mockAgent = createAgent();
      mockNormalize.mockReturnValueOnce(createMockNormalizeResult({}));
      mockPostgres.query.mockResolvedValueOnce([mockAgent]);

      const result = await updateAgentTool.func({
        identifier: 'test-agent',
        updates: {},
      });

      expect(mockPostgres.query).toHaveBeenCalledTimes(1);
      expect(asJson(result)).toEqual({
        success: false,
        message: 'No valid fields to update',
      });
    });

    it('should handle pass-through of complex objects and arrays', async () => {
      const updates = {
        memory: { enabled: true, size: 100 },
        rag: { enabled: false, topK: 5 },
        plugins: ['plugin1', 'plugin2'],
        lore: ['story1', 'story2'],
      };

      const mockAgent = createAgent();
      const mockUpdatedAgent = { ...mockAgent, ...updates };

      mockNormalize.mockReturnValueOnce(createMockNormalizeResult(updates));
      mockPostgres.query
        .mockResolvedValueOnce([mockAgent])
        .mockResolvedValueOnce([mockUpdatedAgent]);

      const result = await updateAgentTool.func({
        identifier: 'test-agent',
        updates,
      });

      expect(asJson(result).success).toBe(true);
    });
  });

  describe('update results', () => {
    it('should include appliedDefaults in message', async () => {
      const mockAgent = createAgent();
      const mockUpdatedAgent = { ...mockAgent, interval: 5 };

      mockNormalize.mockReturnValueOnce(
        createMockNormalizeResult({ interval: 5 }, [
          'interval set to default value (5)',
        ])
      );
      mockPostgres.query
        .mockResolvedValueOnce([mockAgent])
        .mockResolvedValueOnce([mockUpdatedAgent]);

      const result = await updateAgentTool.func({
        identifier: 'test-agent',
        updates: { interval: 0 },
      });

      const parsed = asJson(result);
      expect(parsed.success).toBe(true);
      expect(parsed.message).toContain('interval set to default value (5)');
    });

    it('should handle update failure when result is empty', async () => {
      const mockAgent = createAgent();

      mockNormalize.mockReturnValueOnce(
        createMockNormalizeResult({ description: 'Updated' })
      );
      mockPostgres.query
        .mockResolvedValueOnce([mockAgent])
        .mockResolvedValueOnce([]); // Empty result means update failed

      const result = await updateAgentTool.func({
        identifier: 'test-agent',
        updates: { description: 'Updated' },
      });

      const parsed = asJson(result);
      expect(parsed.success).toBe(false);
      expect(parsed.message).toBe('Failed to update agent');
      expect(mockPostgres.query).toHaveBeenCalledTimes(2);
      expect(mockPostgres.query.mock.calls[1][0]).toEqual(
        expect.objectContaining({
          query: expect.stringMatching(/\bUPDATE\b/i),
        })
      );
    });
  });

  describe('error handling', () => {
    it.each([
      [
        'Postgres.Query constructor errors',
        () => {
          throw new Error('Invalid query syntax');
        },
        'Invalid query syntax',
      ],
      [
        'non-Error exceptions',
        () => {
          throw 'String error';
        },
        'String error',
      ],
    ])(
      'should handle %s',
      async (_description, errorThrowingFn, expectedMsg) => {
        mockPostgres.Query.mockImplementation(errorThrowingFn);

        const result = await updateAgentTool.func({
          identifier: 'test-agent',
          updates: { description: 'Updated' },
        });

        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('Error updating agent:')
        );
        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining(expectedMsg)
        );
        expect(asJson(result).success).toBe(false);
        expect(mockPostgres.query).not.toHaveBeenCalled();
        expect(mockPostgres.Query).toHaveBeenCalledTimes(1);
      }
    );
  });
});
