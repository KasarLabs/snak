import { getMcpAgentTools } from '../../mcp-agent/mcpAgentTools.js';

// Mock unique pour @snakagent/core
jest.mock('@snakagent/core', () => ({
  logger: {
    error: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

// Mock unique pour MCP_CONTROLLER
jest.mock('../../../../services/mcp/src/mcp.js', () => ({
  MCP_CONTROLLER: jest.fn(),
}));

// Mock unique pour la base de données
jest.mock('@snakagent/database', () => ({
  Postgres: { Query: jest.fn(), query: jest.fn() },
}));

// Mock unique pour OperatorRegistry
jest.mock('../../operatorRegistry.js', () => ({
  OperatorRegistry: { getInstance: jest.fn(() => ({ getAgent: jest.fn() })) },
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

const TEST_SMITHERY_API_KEY = 'test-key';

describe('mcpAgentTools', () => {
  let mockLogger: any;
  let mockMcpController: any;
  let mockPostgres: any;
  let mockOperatorRegistry: any;
  let tools: any[];

  // Helpers utilitaires
  const makeResponse = {
    ok: (data: any) => ({
      ok: true,
      json: jest.fn().mockResolvedValue(data),
    }),
    error: (status: number, statusText = '') => ({
      ok: false,
      status,
      statusText,
    }),
  };

  const makeDbResult = {
    rows: (rows: any[]) => mockPostgres.query.mockResolvedValue(rows),
    error: (error: Error) => mockPostgres.query.mockRejectedValue(error),
  };

  const makeFetchResult = {
    success: (response: any) => mockFetch.mockResolvedValue(response),
    error: (error: Error) => mockFetch.mockRejectedValue(error),
    sequence: (responses: any[]) => {
      responses.forEach((response) =>
        mockFetch.mockResolvedValueOnce(response)
      );
    },
  };

  // Factory functions pour les fixtures
  const makeAgent = (overrides: any = {}) => ({
    id: 'test-agent',
    name: 'Test Agent',
    mcpServers: {},
    ...overrides,
  });

  const makeServer = (overrides: any = {}) => ({
    qualifiedName: 'org/test-server',
    displayName: 'Test Server',
    description: 'Test description',
    homepage: 'https://example.com',
    useCount: '100',
    isDeployed: true,
    createdAt: '2024-01-01',
    ...overrides,
  });

  const makeServerDetail = (overrides: any = {}) => ({
    qualifiedName: 'org/test-server',
    displayName: 'Test Server',
    iconUrl: null,
    deploymentUrl: 'https://example.com',
    connections: [
      {
        type: 'http',
        url: 'http://example.com',
        configSchema: { properties: { apiKey: { type: 'string' } } },
      },
      { type: 'stdio', configSchema: { properties: {} } },
    ],
    security: { scanPassed: true },
    tools: [{ name: 'tool1', description: 'Test tool' }],
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockLogger = require('@snakagent/core').logger;
    mockMcpController =
      require('../../../../services/mcp/src/mcp.js').MCP_CONTROLLER;
    mockPostgres = require('@snakagent/database').Postgres;
    mockOperatorRegistry =
      require('../../operatorRegistry.js').OperatorRegistry;
    tools = getMcpAgentTools();
    process.env.SMITHERY_API_KEY = TEST_SMITHERY_API_KEY;
  });

  afterEach(() => {
    delete process.env.SMITHERY_API_KEY;
    jest.resetAllMocks();
  });

  describe('Tool structure and validation', () => {
    it('should return all expected tools with proper structure', () => {
      const expectedTools = [
        'search_mcp_server',
        'install_mcp_server',
        'list_mcp_servers',
        'refresh_mcp_server',
        'delete_mcp_server',
      ];

      expect(tools).toHaveLength(5);
      expect(tools.map((t) => t.name)).toEqual(
        expect.arrayContaining(expectedTools)
      );

      tools.forEach((tool) => {
        expect(tool).toHaveProperty('name');
        expect(tool).toHaveProperty('description');
        expect(tool).toHaveProperty('schema');
        expect(
          tool.hasOwnProperty('func') || tool.hasOwnProperty('invoke')
        ).toBe(true);
      });
    });
  });

  describe('search_mcp_server', () => {
    let searchTool: any;

    beforeEach(() => {
      searchTool = tools.find((t) => t.name === 'search_mcp_server');
    });

    it('should validate schema structure', () => {
      const { schema } = searchTool;
      expect(schema.shape).toHaveProperty('query');
      expect(schema.shape).toHaveProperty('limit');
      expect(schema.shape).toHaveProperty('deployedOnly');
      expect(schema.shape).toHaveProperty('verifiedOnly');
    });

    it.each([
      [
        'missing API key',
        undefined,
        'SMITHERY_API_KEY environment variable is required',
      ],
      ['invalid API key', makeResponse.error(401), 'Invalid Smithery API key'],
      [
        'server error',
        makeResponse.error(500, 'Internal Server Error'),
        'Smithery API request failed: 500 Internal Server Error',
      ],
      [
        'network error',
        new Error('Network error'),
        'Failed to search MCP servers: Error: Network error',
      ],
    ])('should handle %s', async (_, response, expectedError) => {
      if (response instanceof Error) {
        makeFetchResult.error(response);
      } else if (response === undefined) {
        delete process.env.SMITHERY_API_KEY;
      } else {
        makeFetchResult.success(response);
      }

      await expect(searchTool.func({ query: 'test' })).rejects.toThrow(
        expectedError
      );
    });

    it('should handle successful search with filters', async () => {
      const mockResponse = makeResponse.ok({
        servers: [makeServer()],
        pagination: {
          totalCount: 1,
          currentPage: 1,
          pageSize: 10,
          totalPages: 1,
        },
      });
      makeFetchResult.success(mockResponse);

      const result = await searchTool.func({
        query: 'test',
        limit: 10,
        deployedOnly: true,
        verifiedOnly: true,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('https://registry.smithery.ai/servers'),
        expect.objectContaining({
          headers: {
            Authorization: `Bearer ${TEST_SMITHERY_API_KEY}`,
            Accept: 'application/json',
          },
        })
      );
      expect(result).toContain('test-server');
    });

    it('should handle search with no results', async () => {
      makeFetchResult.success(
        makeResponse.ok({ servers: [], pagination: { totalCount: 0 } })
      );

      const result = await searchTool.func({ query: 'nonexistent' });
      expect(result).toContain('No MCP servers found');
    });

    it('should handle server detail fetching with errors', async () => {
      const searchResponse = makeResponse.ok({
        servers: [makeServer()],
        pagination: { totalCount: 1 },
      });

      makeFetchResult.sequence([searchResponse, makeResponse.error(404)]);

      const result = await searchTool.func({ query: 'test' });

      expect(result).toContain('test-server');
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should handle successful server detail fetching', async () => {
      const searchResponse = makeResponse.ok({
        servers: [makeServer()],
        pagination: { totalCount: 1 },
      });

      const detailResponse = makeResponse.ok(makeServerDetail());

      makeFetchResult.sequence([searchResponse, detailResponse]);

      const result = await searchTool.func({ query: 'test' });

      expect(result).toContain('test-server');
      expect(result).toContain('tool1');
      expect(result).toContain('hasLocalOption');
    });

    it('should handle server detail fetching with missing optional fields', async () => {
      const searchResponse = makeResponse.ok({
        servers: [makeServer()],
        pagination: { totalCount: 1 },
      });

      const detailResponse = makeResponse.ok({
        connections: [],
        security: null,
        tools: null,
      });

      makeFetchResult.sequence([searchResponse, detailResponse]);

      const result = await searchTool.func({ query: 'test' });
      const resultObj = JSON.parse(result);

      expect(result).toContain('test-server');
      expect(resultObj.servers[0].toolCount).toBe(0);
      expect(resultObj.servers[0].isVerified).toBe(false);
    });
  });

  describe('install_mcp_server', () => {
    let installTool: any;

    beforeEach(() => {
      installTool = tools.find((t) => t.name === 'install_mcp_server');
    });

    it('should validate schema structure', () => {
      const { schema } = installTool;
      expect(schema.shape).toHaveProperty('agentId');
      expect(schema.shape).toHaveProperty('qualifiedName');
      expect(schema.shape).toHaveProperty('serverName');
      expect(schema.shape).toHaveProperty('config');
      expect(schema.shape).toHaveProperty('profile');
    });

    it.each([
      ['agent not found', [], 'Agent not found: test-agent'],
      [
        'duplicate server',
        [makeAgent({ mcpServers: { 'existing-server': { command: 'npx' } } })],
        'MCP server "existing-server" already exists for agent "test-agent"',
      ],
      [
        'database error',
        new Error('Database error'),
        'Failed to install MCP server',
      ],
    ])('should handle %s', async (_, dbResult, expectedError) => {
      if (dbResult instanceof Error) {
        makeDbResult.error(dbResult);
      } else {
        makeDbResult.rows(dbResult);
      }

      await expect(
        installTool.func({
          agentId: 'test-agent',
          qualifiedName: 'test-server',
          serverName:
            Array.isArray(dbResult) && dbResult.length > 0
              ? 'existing-server'
              : undefined,
        })
      ).rejects.toThrow(expectedError);
    });

    it.each([
      ['custom server name', 'custom-name', 'custom-name'],
      ['default server name', undefined, 'test-server'],
    ])(
      'should handle successful installation with %s',
      async (_, serverName, expectedName) => {
        makeDbResult.rows([makeAgent()]);

        const result = await installTool.func({
          agentId: 'test-agent',
          qualifiedName: 'org/test-server',
          serverName,
          config: { apiKey: TEST_SMITHERY_API_KEY },
          profile: 'test-profile',
        });

        expect(mockPostgres.query).toHaveBeenCalledTimes(2);
        expect(result).toContain(expectedName);
      }
    );

    it('should handle installation with profile but no config', async () => {
      makeDbResult.rows([makeAgent()]);

      const result = await installTool.func({
        agentId: 'test-agent',
        qualifiedName: 'org/test-server',
        profile: 'test-profile',
      });

      expect(result).toContain('test-server');
      expect(mockPostgres.query).toHaveBeenCalledTimes(2);
    });

    it('should handle qualified name without slash', async () => {
      makeDbResult.rows([makeAgent()]);

      const result = await installTool.func({
        agentId: 'test-agent',
        qualifiedName: 'test-server',
      });

      expect(result).toContain('test-server');
    });
  });

  describe('list_mcp_servers', () => {
    let listTool: any;

    beforeEach(() => {
      listTool = tools.find((t) => t.name === 'list_mcp_servers');
    });

    it('should validate schema structure', () => {
      const { schema } = listTool;
      expect(schema.shape).toHaveProperty('agentId');
    });

    it.each([
      ['agent not found', [], 'Agent not found: test-agent'],
      [
        'database error',
        new Error('Database error'),
        'Failed to list MCP servers',
      ],
    ])('should handle %s', async (_, dbResult, expectedError) => {
      if (dbResult instanceof Error) {
        makeDbResult.error(dbResult);
      } else {
        makeDbResult.rows(dbResult);
      }

      await expect(listTool.func({ agentId: 'test-agent' })).rejects.toThrow(
        expectedError
      );
    });

    it.each([
      [
        'with servers',
        { server1: { config: 'value1' }, server2: { config: 'value2' } },
      ],
      ['no servers', {}],
      ['null mcpServers', null],
      ['undefined mcpServers', undefined],
    ])('should handle successful listing %s', async (_, mcpServers) => {
      makeDbResult.rows([makeAgent({ mcpServers })]);

      const result = await listTool.func({ agentId: 'test-agent' });
      expect(result).toContain('test-agent');

      if (mcpServers && Object.keys(mcpServers).length > 0) {
        expect(result).toContain('server1');
      } else {
        expect(result).toContain('{}');
      }
    });
  });

  describe('refresh_mcp_server', () => {
    let refreshTool: any;

    beforeEach(() => {
      refreshTool = tools.find((t) => t.name === 'refresh_mcp_server');
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should validate schema structure', () => {
      const { schema } = refreshTool;
      expect(schema.shape).toHaveProperty('agentId');
      expect(schema.shape).toHaveProperty('timeout');
    });

    it.each([
      ['agent not found', [], 'Agent not found: test-agent'],
      [
        'database error',
        new Error('Database error'),
        'Failed to refresh MCP servers',
      ],
    ])('should handle %s', async (_, dbResult, expectedError) => {
      if (dbResult instanceof Error) {
        makeDbResult.error(dbResult);
      } else {
        makeDbResult.rows(dbResult);
      }

      await expect(refreshTool.func({ agentId: 'test-agent' })).rejects.toThrow(
        expectedError
      );
    });

    it('should handle no servers configured', async () => {
      makeDbResult.rows([makeAgent({ mcpServers: {} })]);

      const result = await refreshTool.func({ agentId: 'test-agent' });

      expect(result).toContain(
        'No MCP servers configured for agent test-agent'
      );
      expect(result).toContain('"mcpToolsCount":0');
    });

    it('should handle successful refresh', async () => {
      makeDbResult.rows([
        makeAgent({ mcpServers: { server1: { config: 'value1' } } }),
      ]);

      const mockMcpInstance = {
        initializeConnections: jest.fn().mockResolvedValue(undefined),
        getTools: jest.fn().mockReturnValue([{ name: 'tool1' }]),
      };
      mockMcpController.mockImplementation(() => mockMcpInstance);

      const mockAgent = { getTools: jest.fn().mockReturnValue([]) };
      mockOperatorRegistry.getInstance.mockReturnValue({
        getAgent: jest.fn().mockReturnValue(mockAgent),
      });

      const resultPromise = refreshTool.func({
        agentId: 'test-agent',
        timeout: 30000,
      });
      jest.runAllTimers();
      const result = await resultPromise;

      expect(result).toContain(
        'Successfully refreshed MCP servers for agent test-agent'
      );
      expect(mockMcpController).toHaveBeenCalled();
    });

    it.each([
      ['connection errors', 'ECONNREFUSED', 'Failed to connect to MCP servers'],
      [
        'timeout errors',
        'MCP initialization timed out after 1000ms',
        'MCP server refresh timed out after 1000ms',
      ],
      [
        'generic errors',
        'Some other error',
        'Failed to refresh MCP servers: Some other error',
      ],
    ])('should handle %s', async (_, errorMessage, expectedError) => {
      makeDbResult.rows([
        makeAgent({ mcpServers: { server1: { config: 'value1' } } }),
      ]);

      const mockMcpInstance = {
        initializeConnections: jest
          .fn()
          .mockRejectedValue(new Error(errorMessage)),
        getTools: jest.fn().mockReturnValue([]),
      };
      mockMcpController.mockImplementation(() => mockMcpInstance);

      await expect(
        refreshTool.func({ agentId: 'test-agent', timeout: 1000 })
      ).rejects.toThrow(expectedError);
    });

    it('should handle registry update errors with warning', async () => {
      makeDbResult.rows([
        makeAgent({ mcpServers: { server1: { config: 'value1' } } }),
      ]);

      const mockMcpInstance = {
        initializeConnections: jest.fn().mockResolvedValue(undefined),
        getTools: jest.fn().mockReturnValue([{ name: 'tool1' }]),
      };
      mockMcpController.mockImplementation(() => mockMcpInstance);

      mockOperatorRegistry.getInstance.mockImplementation(() => {
        throw new Error('Registry error');
      });

      const resultPromise = refreshTool.func({ agentId: 'test-agent' });
      jest.runAllTimers();
      const result = await resultPromise;

      expect(result).toContain(
        'Successfully refreshed MCP servers for agent test-agent'
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to update agent registry: Error: Registry error'
      );
    });

    it('should filter out existing mcp_ tools when updating registry', async () => {
      makeDbResult.rows([
        makeAgent({ mcpServers: { server1: { config: 'value1' } } }),
      ]);

      const mockMcpInstance = {
        initializeConnections: jest.fn().mockResolvedValue(undefined),
        getTools: jest.fn().mockReturnValue([{ name: 'new_tool' }]),
      };
      mockMcpController.mockImplementation(() => mockMcpInstance);

      const mockAgent: any = {
        getTools: jest
          .fn()
          .mockReturnValue([{ name: 'mcp_old' }, { name: 'keep_me' }]),
        tools: [],
      };
      mockOperatorRegistry.getInstance.mockReturnValue({
        getAgent: jest.fn().mockReturnValue(mockAgent),
      });

      const resultPromise = refreshTool.func({
        agentId: 'test-agent',
        timeout: 30000,
      });
      jest.runAllTimers();
      await resultPromise;

      expect(mockAgent.tools.map((t: any) => t.name)).toEqual([
        'keep_me',
        'new_tool',
      ]);
    });
  });

  describe('delete_mcp_server', () => {
    let deleteTool: any;

    beforeEach(() => {
      deleteTool = tools.find((t) => t.name === 'delete_mcp_server');
    });

    it('should validate schema structure', () => {
      const { schema } = deleteTool;
      expect(schema.shape).toHaveProperty('agentId');
      expect(schema.shape).toHaveProperty('serverName');
    });

    it.each([
      ['agent not found', [], 'Agent not found: test-agent'],
      [
        'server not found',
        [makeAgent({ mcpServers: { 'other-server': { config: 'value' } } })],
        'MCP server "test-server" not found in agent "test-agent"',
      ],
      [
        'database error',
        new Error('Database error'),
        'Failed to delete MCP server',
      ],
    ])('should handle %s', async (_, dbResult, expectedError) => {
      if (dbResult instanceof Error) {
        makeDbResult.error(dbResult);
      } else {
        makeDbResult.rows(dbResult);
      }

      await expect(
        deleteTool.func({
          agentId: 'test-agent',
          serverName: 'test-server',
        })
      ).rejects.toThrow(expectedError);
    });

    it('should handle successful deletion', async () => {
      mockPostgres.query
        .mockResolvedValueOnce([
          makeAgent({ mcpServers: { 'test-server': { config: 'value' } } }),
        ])
        .mockResolvedValueOnce([makeAgent({ mcpServers: {} })]);

      const result = await deleteTool.func({
        agentId: 'test-agent',
        serverName: 'test-server',
      });

      expect(mockPostgres.query).toHaveBeenCalledTimes(2);
      const resultObj = JSON.parse(result);
      expect(resultObj.success).toBe(true);
      expect(resultObj.message).toContain('test-server');
    });

    it.each([
      ['null mcpServers', null],
      ['undefined mcpServers', undefined],
    ])('should handle deletion with %s', async (_, mcpServers) => {
      mockPostgres.query
        .mockResolvedValueOnce([makeAgent({ mcpServers })])
        .mockResolvedValueOnce([makeAgent({ mcpServers: {} })]);

      await expect(
        deleteTool.func({
          agentId: 'test-agent',
          serverName: 'test-server',
        })
      ).rejects.toThrow(
        'MCP server "test-server" not found in agent "test-agent"'
      );
    });
  });
});
