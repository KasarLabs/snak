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

const asJson = (result: string) => JSON.parse(result);

const createAgent = (overrides: any = {}) => ({
  id: 1,
  name: 'test-agent',
  description: 'Old description',
  ...overrides,
});

describe('updateAgentTool', () => {
  let mockPostgres: any;
  let mockLogger: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockPostgres = require('@snakagent/database').Postgres;
    mockLogger = require('@snakagent/core').logger;

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

      mockPostgres.query
        .mockResolvedValueOnce([mockAgent])
        .mockResolvedValueOnce([mockUpdatedAgent]);

      const result = await updateAgentTool.func({
        identifier: 'test-agent',
        updates,
      });

      expect(asJson(result).success).toBe(true);
    });

    describe('memory and rag partial updates', () => {
      it('should merge memory updates with existing memory values', async () => {
        const existingAgent = createAgent({
          memory: {
            enabled: false,
            shortTermMemorySize: 10,
            memorySize: 50,
          },
        });

        const updates = {
          memory: {
            enabled: true,
          },
        };

        mockPostgres.query
          .mockResolvedValueOnce([existingAgent])
          .mockResolvedValueOnce([
            { ...existingAgent, memory: updates.memory },
          ]);

        const result = await updateAgentTool.func({
          identifier: 'test-agent',
          updates,
        });

        expect(asJson(result).success).toBe(true);

        expect(mockPostgres.Query).toHaveBeenNthCalledWith(
          2,
          expect.stringContaining('"memory" = ROW($'),
          expect.any(Array)
        );

        const updateCall = mockPostgres.Query.mock.calls[1];
        const updateParams = updateCall[1];

        expect(updateParams[0]).toBe(true);
        expect(updateParams[1]).toBe(10);
        expect(updateParams[2]).toBe(50);
        expect(updateParams[3]).toBe('test-agent');
      });

      it('should merge rag updates with existing rag values', async () => {
        const existingAgent = createAgent({
          rag: {
            enabled: true,
            embeddingModel: 'custom-model',
          },
        });

        const updates = {
          rag: {
            enabled: false,
          },
        };

        mockPostgres.query
          .mockResolvedValueOnce([existingAgent])
          .mockResolvedValueOnce([{ ...existingAgent, rag: updates.rag }]);

        const result = await updateAgentTool.func({
          identifier: 'test-agent',
          updates,
        });

        expect(asJson(result).success).toBe(true);

        expect(mockPostgres.Query).toHaveBeenNthCalledWith(
          2,
          expect.stringContaining('"rag" = ROW($'),
          expect.any(Array)
        );

        const updateCall = mockPostgres.Query.mock.calls[1];
        const updateParams = updateCall[1];

        expect(updateParams[0]).toBe(false);
        expect(updateParams[1]).toBe('custom-model');
        expect(updateParams[2]).toBe('test-agent');
      });

      it('should handle complete memory object replacement', async () => {
        const existingAgent = createAgent({
          memory: {
            enabled: false,
            shortTermMemorySize: 10,
            memorySize: 50,
          },
        });

        const updates = {
          memory: {
            enabled: true,
            shortTermMemorySize: 15,
            memorySize: 100,
          },
        };

        mockPostgres.query
          .mockResolvedValueOnce([existingAgent])
          .mockResolvedValueOnce([
            { ...existingAgent, memory: updates.memory },
          ]);

        const result = await updateAgentTool.func({
          identifier: 'test-agent',
          updates,
        });

        expect(asJson(result).success).toBe(true);

        const updateCall = mockPostgres.Query.mock.calls[1];
        const updateParams = updateCall[1];

        expect(updateParams[0]).toBe(true);
        expect(updateParams[1]).toBe(15);
        expect(updateParams[2]).toBe(100);
        expect(updateParams[3]).toBe('test-agent');
      });

      it('should handle complete rag object replacement', async () => {
        const existingAgent = createAgent({
          rag: {
            enabled: false,
            embeddingModel: 'old-model',
          },
        });

        const updates = {
          rag: {
            enabled: true,
            embeddingModel: 'new-model',
          },
        };

        mockPostgres.query
          .mockResolvedValueOnce([existingAgent])
          .mockResolvedValueOnce([{ ...existingAgent, rag: updates.rag }]);

        const result = await updateAgentTool.func({
          identifier: 'test-agent',
          updates,
        });

        expect(asJson(result).success).toBe(true);

        const updateCall = mockPostgres.Query.mock.calls[1];
        const updateParams = updateCall[1];

        expect(updateParams[0]).toBe(true);
        expect(updateParams[1]).toBe('new-model');
        expect(updateParams[2]).toBe('test-agent');
      });

      it('should not update memory fields when only other fields are provided', async () => {
        const existingAgent = createAgent({
          memory: {
            enabled: false,
            shortTermMemorySize: 10,
            memorySize: 50,
          },
          rag: {
            enabled: true,
            embeddingModel: 'custom-model',
          },
        });

        const updates = {
          name: 'new-name',
          description: 'Updated description',
        };

        mockPostgres.query
          .mockResolvedValueOnce([existingAgent])
          .mockResolvedValueOnce([{ ...existingAgent, ...updates }]);

        const result = await updateAgentTool.func({
          identifier: 'test-agent',
          updates,
        });

        expect(asJson(result).success).toBe(true);

        expect(mockPostgres.Query).toHaveBeenNthCalledWith(
          2,
          expect.not.stringContaining('"memory" = ROW($'),
          expect.any(Array)
        );
        expect(mockPostgres.Query).toHaveBeenNthCalledWith(
          2,
          expect.not.stringContaining('"rag" = ROW($'),
          expect.any(Array)
        );
        expect(mockPostgres.Query).toHaveBeenNthCalledWith(
          2,
          expect.stringContaining('"name" = $'),
          expect.any(Array)
        );
        expect(mockPostgres.Query).toHaveBeenNthCalledWith(
          2,
          expect.stringContaining('"description" = $'),
          expect.any(Array)
        );

        const updateCall = mockPostgres.Query.mock.calls[1];
        const updateParams = updateCall[1];

        expect(updateParams[0]).toBe('new-name');
        expect(updateParams[1]).toBe('Updated description');
        expect(updateParams[2]).toBe('test-agent');

        expect(updateParams).toHaveLength(3);
      });

      it('should handle null and undefined values correctly', async () => {
        const existingAgent = createAgent({
          memory: {
            enabled: true,
            shortTermMemorySize: 20,
            memorySize: 50,
          },
        });

        const updates = {
          memory: {
            enabled: null,
            shortTermMemorySize: undefined,
            memorySize: 100,
          },
        };

        mockPostgres.query
          .mockResolvedValueOnce([existingAgent])
          .mockResolvedValueOnce([
            {
              ...existingAgent,
              memory: { ...existingAgent.memory, memorySize: 100 },
            },
          ]);

        const result = await updateAgentTool.func({
          identifier: 'test-agent',
          updates,
        });

        expect(asJson(result).success).toBe(true);

        const updateCall = mockPostgres.Query.mock.calls[1];
        const updateParams = updateCall[1];

        expect(updateParams[0]).toBe(true);
        expect(updateParams[1]).toBe(20);
        expect(updateParams[2]).toBe(100);
        expect(updateParams[3]).toBe('test-agent');
      });

      it('should preserve existing nested fields during partial updates', async () => {
        const existingAgent = createAgent({
          memory: {
            enabled: true,
            shortTermMemorySize: 5,
            memorySize: 20,
          },
          rag: {
            enabled: false,
            topK: 4,
            embeddingModel: 'existing-rag-model',
          },
        });

        const updates = {
          memory: {
            memorySize: 100,
          },
          rag: {
            enabled: true,
          },
        };

        mockPostgres.query
          .mockResolvedValueOnce([existingAgent])
          .mockResolvedValueOnce([{ ...existingAgent, ...updates }]);

        const result = await updateAgentTool.func({
          identifier: 'test-agent',
          updates,
        });

        expect(asJson(result).success).toBe(true);

        const updateCall = mockPostgres.Query.mock.calls[1];
        const updateParams = updateCall[1];

        expect(updateParams[0]).toBe(true);
        expect(updateParams[1]).toBe(5);
        expect(updateParams[2]).toBe(100);

        expect(updateParams[3]).toBe(true);
        expect(updateParams[4]).toBe('existing-rag-model');

        expect(updateParams[5]).toBe('test-agent');
      });

      it('should handle primitive field updates with null/undefined filtering', async () => {
        const existingAgent = createAgent({
          name: 'existing-name',
          description: 'existing-description',
          group: 'existing-group',
          interval: 1000,
          max_iterations: 100,
          mode: 'interactive',
          plugins: ['plugin1', 'plugin2'],
          lore: ['existing-lore'],
          objectives: ['existing-objective'],
          knowledge: ['existing-knowledge'],
          system_prompt: 'existing-prompt',
        });

        const updates = {
          name: null,
          description: 'new-description',
          group: undefined,
          interval: 2000,
          max_iterations: null,
          mode: 'autonomous',
          plugins: ['new-plugin'],
          lore: undefined,
          objectives: null,
          knowledge: ['new-knowledge'],
          system_prompt: 'new-prompt',
        };

        mockPostgres.query
          .mockResolvedValueOnce([existingAgent])
          .mockResolvedValueOnce([
            {
              ...existingAgent,
              description: 'new-description',
              interval: 2000,
              mode: 'autonomous',
              plugins: ['new-plugin'],
              knowledge: ['new-knowledge'],
              system_prompt: 'new-prompt',
            },
          ]);

        const result = await updateAgentTool.func({
          identifier: 'test-agent',
          updates,
        });

        expect(asJson(result).success).toBe(true);

        const updateCall = mockPostgres.Query.mock.calls[1];
        const updateParams = updateCall[1];

        expect(updateParams[0]).toBe('new-description');
        expect(updateParams[1]).toBe(2000);
        expect(updateParams[2]).toBe('autonomous');
        expect(updateParams[3]).toEqual(['new-plugin']);
        expect(updateParams[4]).toEqual(['new-knowledge']);
        expect(updateParams[5]).toBe('new-prompt');

        expect(updateParams).toHaveLength(7);
        expect(updateParams[6]).toBe('test-agent');
      });

      it('should test complete merge behavior for all field types', async () => {
        const existingAgent = createAgent({
          name: 'test-agent',
          description: 'old description',
          group: 'old-group',
          interval: 1000,
          max_iterations: 5,
          mode: 'interactive',
          plugins: ['old-plugin'],
          lore: ['old-lore'],
          objectives: ['old-objective'],
          knowledge: ['old-knowledge'],
          system_prompt: 'old-prompt',
          memory: {
            enabled: false,
            shortTermMemorySize: 5,
            memorySize: 10,
          },
          rag: {
            enabled: false,
            topK: 2,
            embeddingModel: 'old-model',
          },
        });

        const updates = {
          description: 'new description',
          interval: 2000,

          group: null,
          max_iterations: undefined,

          memory: {
            enabled: true,
            shortTermMemorySize: 15,
            memorySize: null,
          },
          rag: {
            enabled: true,
            topK: undefined,
            embeddingModel: 'new-model',
          },

          plugins: ['new-plugin1', 'new-plugin2'],
          knowledge: ['new-knowledge1', 'new-knowledge2'],
        };

        mockPostgres.query
          .mockResolvedValueOnce([existingAgent])
          .mockResolvedValueOnce([
            {
              ...existingAgent,
              description: 'new description',
              interval: 2000,
              memory: {
                ...existingAgent.memory,
                enabled: true,
                shortTermMemorySize: 15,
              },
              rag: {
                ...existingAgent.rag,
                enabled: true,
                embeddingModel: 'new-model',
              },
              plugins: ['new-plugin1', 'new-plugin2'],
              knowledge: ['new-knowledge1', 'new-knowledge2'],
            },
          ]);

        const result = await updateAgentTool.func({
          identifier: 'test-agent',
          updates,
        });

        expect(asJson(result).success).toBe(true);

        const updateCall = mockPostgres.Query.mock.calls[1];
        const updateParams = updateCall[1];

        expect(updateParams).toHaveLength(10);

        expect(updateParams[0]).toBe('new description');
        expect(updateParams[1]).toBe(2000);
        expect(updateParams[2]).toBe(true);
        expect(updateParams[3]).toBe(15);
        expect(updateParams[4]).toBe(10);
        expect(updateParams[5]).toBe(true);
        expect(updateParams[6]).toBe('new-model');
        expect(updateParams[7]).toEqual(['new-plugin1', 'new-plugin2']);
        expect(updateParams[8]).toEqual(['new-knowledge1', 'new-knowledge2']);

        expect(updateParams[9]).toBe('test-agent');
      });
    });
  });

  describe('update results', () => {
    it('should include appliedDefaults in message', async () => {
      const mockAgent = createAgent();
      const mockUpdatedAgent = { ...mockAgent, interval: 5 };

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

      mockPostgres.query
        .mockResolvedValueOnce([mockAgent])
        .mockResolvedValueOnce([]);

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
