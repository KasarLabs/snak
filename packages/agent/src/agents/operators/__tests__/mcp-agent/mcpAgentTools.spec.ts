import { getMcpAgentTools } from '../../mcp-agent/mcpAgentTools.js';

interface MockLogger {
  error: jest.Mock;
  debug: jest.Mock;
  info: jest.Mock;
  warn: jest.Mock;
}

interface MockMcpController extends jest.Mock {
  addServer?: jest.Mock;
  removeServer?: jest.Mock;
  listServers?: jest.Mock;
  refreshServer?: jest.Mock;
}

interface MockPostgresQuery {
  query: string;
  params: any[];
}

interface MockPostgres {
  Query: jest.Mock<MockPostgresQuery, [string, any[]]>;
  query: jest.Mock;
}

interface MockOperatorRegistry {
  getInstance: jest.Mock<{
    getAgent: jest.Mock;
  }>;
}

// Mock the logger
jest.mock('@snakagent/core', () => ({
  logger: {
    error: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

// Mock the MCP controller
jest.mock('../../../../services/mcp/src/mcp.js', () => ({
  MCP_CONTROLLER: jest.fn(),
}));

// Mock the database
jest.mock('@snakagent/database', () => ({
  Postgres: {
    Query: jest.fn(),
    query: jest.fn(),
  },
}));

// Mock the operator registry
jest.mock('../../operatorRegistry.js', () => ({
  OperatorRegistry: {
    getInstance: jest.fn(() => ({
      getAgent: jest.fn(),
    })),
  },
}));

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('mcpAgentTools', () => {
  let mockLogger: MockLogger;
  let mockMcpController: MockMcpController;
  let mockPostgres: MockPostgres;
  let mockOperatorRegistry: MockOperatorRegistry;

  beforeEach(() => {
    jest.clearAllMocks();

    mockLogger = require('@snakagent/core').logger;
    mockMcpController =
      require('../../../../services/mcp/src/mcp.js').MCP_CONTROLLER;
    mockPostgres = require('@snakagent/database').Postgres;
    mockOperatorRegistry =
      require('../../operatorRegistry.js').OperatorRegistry;

    // Reset mock implementations
    mockLogger.error.mockClear();
    mockLogger.debug.mockClear();
    mockLogger.info.mockClear();
    mockLogger.warn.mockClear();
    // Clear the MCP_CONTROLLER mock
    mockMcpController.mockClear();
    mockPostgres.Query.mockClear();
    mockPostgres.query.mockClear();

    mockPostgres.Query.mockImplementation((query: string, params: any[]) => {
      return { query, params };
    });
  });

  afterEach(() => {
    // Clean up remaining timers
    jest.clearAllTimers();
    jest.useRealTimers();

    global.fetch = mockFetch;
  });

  describe('getMcpAgentTools', () => {
    it('should return an array of tools', () => {
      const tools = getMcpAgentTools();

      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBe(5);
    });

    it('should include all expected tools', () => {
      const tools = getMcpAgentTools();
      const toolNames = tools.map((tool) => tool.name);

      expect(toolNames).toContain('search_mcp_server');
      expect(toolNames).toContain('install_mcp_server');
      expect(toolNames).toContain('list_mcp_servers');
      expect(toolNames).toContain('refresh_mcp_server');
      expect(toolNames).toContain('delete_mcp_server');
    });

    it('should return tools with proper structure', () => {
      const tools = getMcpAgentTools();

      tools.forEach((tool) => {
        expect(tool).toHaveProperty('name');
        expect(tool).toHaveProperty('description');
        expect(tool).toHaveProperty('schema');
        expect(
          tool.hasOwnProperty('func') || tool.hasOwnProperty('invoke')
        ).toBe(true);
      });
    });

    it('should have correct tool descriptions', () => {
      const tools = getMcpAgentTools();

      const searchTool = tools.find((t) => t.name === 'search_mcp_server');
      expect(searchTool?.description).toContain(
        'Search for MCP servers on Smithery'
      );

      const installTool = tools.find((t) => t.name === 'install_mcp_server');
      expect(installTool?.description).toContain('Install an MCP server');

      const listTool = tools.find((t) => t.name === 'list_mcp_servers');
      expect(listTool?.description).toContain(
        'List all MCP servers configured for a specific agent'
      );

      const refreshTool = tools.find((t) => t.name === 'refresh_mcp_server');
      expect(refreshTool?.description).toContain(
        'Restart an agent with its MCP servers'
      );

      const deleteTool = tools.find((t) => t.name === 'delete_mcp_server');
      expect(deleteTool?.description).toContain(
        'Delete an MCP server configuration'
      );
    });
  });

  describe('search_mcp_server tool', () => {
    let searchTool: any;

    beforeEach(() => {
      const tools = getMcpAgentTools();
      searchTool = tools.find((t) => t.name === 'search_mcp_server');
    });

    it('should have correct schema validation', () => {
      const schema = searchTool.schema;
      expect(schema).toBeDefined();
      expect(schema.shape).toHaveProperty('query');
      expect(schema.shape).toHaveProperty('limit');
      expect(schema.shape).toHaveProperty('deployedOnly');
      expect(schema.shape).toHaveProperty('verifiedOnly');
    });

    it('should validate required fields', () => {
      const schema = searchTool.schema;

      expect(schema.shape.query._def.typeName).toBe('ZodString');

      expect(schema.shape.limit._def.typeName).toBe('ZodOptional');
      expect(schema.shape.deployedOnly._def.typeName).toBe('ZodOptional');
      expect(schema.shape.verifiedOnly._def.typeName).toBe('ZodOptional');
    });

    it('should handle missing SMITHERY_API_KEY', async () => {
      // Remove the API key from environment
      const originalApiKey = process.env.SMITHERY_API_KEY;
      delete process.env.SMITHERY_API_KEY;

      try {
        await expect(
          searchTool.func({
            query: 'test search',
            limit: 10,
            deployedOnly: false,
            verifiedOnly: false,
          })
        ).rejects.toThrow('SMITHERY_API_KEY environment variable is required');
      } finally {
        // Restore the API key
        if (originalApiKey) {
          process.env.SMITHERY_API_KEY = originalApiKey;
        }
      }
    });

    it('should handle successful search with results', async () => {
      // Set up environment
      process.env.SMITHERY_API_KEY = 'test-api-key';

      const mockResponse = {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          servers: [
            {
              qualifiedName: 'test-server',
              displayName: 'Test Server',
              description: 'A test server',
              homepage: 'https://example.com',
              useCount: '10',
              isDeployed: true,
              createdAt: '2023-01-01',
            },
          ],
          pagination: {
            currentPage: 1,
            pageSize: 10,
            totalPages: 1,
            totalCount: 1,
          },
        }),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await searchTool.func({
        query: 'test search',
        limit: 10,
        deployedOnly: false,
        verifiedOnly: false,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('https://registry.smithery.ai/servers'),
        expect.objectContaining({
          headers: {
            Authorization: 'Bearer test-api-key',
            Accept: 'application/json',
          },
        })
      );

      expect(result).toContain('test-server');
      expect(result).toContain('Test Server');
    });

    it('should handle search with no results', async () => {
      // Set up environment
      process.env.SMITHERY_API_KEY = 'test-api-key';

      // Mock successful fetch response with no servers
      const mockResponse = {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          servers: [],
          pagination: {
            currentPage: 1,
            pageSize: 10,
            totalPages: 0,
            totalCount: 0,
          },
        }),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await searchTool.func({
        query: 'nonexistent search',
        limit: 10,
        deployedOnly: false,
        verifiedOnly: false,
      });

      expect(result).toContain('No MCP servers found matching your query');
    });

    it('should handle API errors', async () => {
      // Set up environment
      process.env.SMITHERY_API_KEY = 'test-api-key';

      // Mock failed fetch response
      const mockResponse = {
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      };
      mockFetch.mockResolvedValue(mockResponse);

      await expect(
        searchTool.func({
          query: 'test search',
          limit: 10,
          deployedOnly: false,
          verifiedOnly: false,
        })
      ).rejects.toThrow('Invalid Smithery API key');
    });
  });

  describe('install_mcp_server tool', () => {
    let installTool: any;

    beforeEach(() => {
      const tools = getMcpAgentTools();
      installTool = tools.find((t) => t.name === 'install_mcp_server');
    });

    it('should have correct schema validation', () => {
      const schema = installTool.schema;
      expect(schema).toBeDefined();
      expect(schema.shape).toHaveProperty('agentId');
      expect(schema.shape).toHaveProperty('qualifiedName');
      expect(schema.shape).toHaveProperty('config');
    });

    it('should validate required fields', () => {
      const schema = installTool.schema;

      expect(schema.shape.agentId._def.typeName).toBe('ZodString');
      expect(schema.shape.qualifiedName._def.typeName).toBe('ZodString');

      expect(schema.shape.config._def.typeName).toBe('ZodOptional');
    });

    it('should handle successful installation', async () => {
      mockPostgres.query.mockResolvedValue([
        {
          id: 'test-agent',
          name: 'Test Agent',
          mcpServers: {},
        },
      ]);

      const result = await installTool.func({
        agentId: 'test-agent',
        qualifiedName: 'test-server',
        config: { someConfig: 'value' },
      });

      expect(mockPostgres.query).toHaveBeenCalled();
      expect(result).toContain('test-server');
      expect(result).toContain('test-agent');
    });

    it('should handle installation errors', async () => {
      mockPostgres.query.mockRejectedValue(new Error('Database error'));

      await expect(
        installTool.func({
          agentId: 'test-agent',
          qualifiedName: 'test-server',
          config: { someConfig: 'value' },
        })
      ).rejects.toThrow('Failed to install MCP server');
    });
  });

  describe('list_mcp_servers tool', () => {
    let listTool: any;

    beforeEach(() => {
      const tools = getMcpAgentTools();
      listTool = tools.find((t) => t.name === 'list_mcp_servers');
    });

    it('should have correct schema validation', () => {
      const schema = listTool.schema;
      expect(schema).toBeDefined();
      expect(schema.shape).toHaveProperty('agentId');
    });

    it('should validate required fields', () => {
      const schema = listTool.schema;

      expect(schema.shape.agentId._def.typeName).toBe('ZodString');
    });

    it('should handle successful listing', async () => {
      mockPostgres.query.mockResolvedValue([
        {
          id: 'test-agent',
          name: 'Test Agent',
          mcpServers: {
            server1: { config: 'value1' },
            server2: { config: 'value2' },
          },
        },
      ]);

      const result = await listTool.func({ agentId: 'test-agent' });

      expect(mockPostgres.query).toHaveBeenCalled();
      expect(result).toContain('test-agent');
      expect(result).toContain('Test Agent');
      expect(result).toContain('server1');
      expect(result).toContain('server2');
    });

    it('should handle listing errors', async () => {
      mockPostgres.query.mockResolvedValue([]);

      await expect(listTool.func({ agentId: 'test-agent' })).rejects.toThrow(
        'Agent not found'
      );
    });
  });

  describe('refresh_mcp_server tool', () => {
    let refreshTool: any;

    beforeEach(() => {
      const tools = getMcpAgentTools();
      refreshTool = tools.find((t) => t.name === 'refresh_mcp_server');
    });

    it('should have correct schema validation', () => {
      const schema = refreshTool.schema;
      expect(schema).toBeDefined();
      expect(schema.shape).toHaveProperty('agentId');
      expect(schema.shape).toHaveProperty('timeout');
    });

    it('should validate required fields', () => {
      const schema = refreshTool.schema;

      expect(schema.shape.agentId._def.typeName).toBe('ZodString');

      expect(schema.shape.timeout._def.typeName).toBe('ZodOptional');
    });

    it('should handle successful refresh', async () => {
      // Use fake timers to avoid real setTimeout
      jest.useFakeTimers();

      mockPostgres.query.mockResolvedValue([
        {
          mcpServers: {
            server1: { config: 'value1' },
            server2: { config: 'value2' },
          },
        },
      ]);

      const mockMcpInstance = {
        initializeConnections: jest.fn().mockResolvedValue(undefined),
        getTools: jest
          .fn()
          .mockReturnValue([{ name: 'tool1' }, { name: 'tool2' }]),
      };

      mockMcpController.mockImplementation(() => mockMcpInstance);

      const resultPromise = refreshTool.func({
        agentId: 'test-agent',
        timeout: 30000,
      });

      jest.runAllTimers();

      const result = await resultPromise;

      expect(mockPostgres.query).toHaveBeenCalled();
      expect(result).toContain(
        'Successfully refreshed MCP servers for agent test-agent'
      );
      expect(mockMcpController).toHaveBeenCalled();

      // Clean up fake timers
      jest.useRealTimers();
    });

    it('should handle refresh errors', async () => {
      mockPostgres.query.mockResolvedValue([]);

      await expect(
        refreshTool.func({
          agentId: 'test-agent',
          timeout: 30000,
        })
      ).rejects.toThrow('Agent not found');
    });
  });

  describe('delete_mcp_server tool', () => {
    let deleteTool: any;

    beforeEach(() => {
      const tools = getMcpAgentTools();
      deleteTool = tools.find((t) => t.name === 'delete_mcp_server');
    });

    it('should have correct schema validation', () => {
      const schema = deleteTool.schema;
      expect(schema).toBeDefined();
      expect(schema.shape).toHaveProperty('agentId');
      expect(schema.shape).toHaveProperty('serverName');
    });

    it('should validate required fields', () => {
      const schema = deleteTool.schema;

      expect(schema.shape.agentId._def.typeName).toBe('ZodString');
      expect(schema.shape.serverName._def.typeName).toBe('ZodString');
    });

    it('should handle successful deletion', async () => {
      mockPostgres.query
        .mockResolvedValueOnce([
          {
            id: 'test-agent',
            mcpServers: {
              'test-server': { config: 'value' },
            },
          },
        ])
        .mockResolvedValueOnce([
          {
            id: 'test-agent',
            mcpServers: {},
          },
        ]);

      const result = await deleteTool.func({
        agentId: 'test-agent',
        serverName: 'test-server',
      });

      expect(mockPostgres.query).toHaveBeenCalledTimes(2);
      const resultObj = JSON.parse(result);
      expect(resultObj.success).toBe(true);
      expect(resultObj.message).toContain(
        'MCP server "test-server" deleted from agent "test-agent"'
      );
    });

    it('should handle deletion errors', async () => {
      mockPostgres.query.mockResolvedValue([]);

      await expect(
        deleteTool.func({
          agentId: 'test-agent',
          serverName: 'test-server',
        })
      ).rejects.toThrow('Agent not found');
    });
  });
});
