import { getMcpAgentTools } from '../../mcp-agent/mcpAgentTools.js';

jest.mock('@snakagent/core', () => ({
  logger: { error: jest.fn(), debug: jest.fn(), info: jest.fn(), warn: jest.fn() }
}));

jest.mock('../../../../services/mcp/src/mcp.js', () => ({
  MCP_CONTROLLER: jest.fn()
}));

jest.mock('@snakagent/database', () => ({
  Postgres: { Query: jest.fn(), query: jest.fn() }
}));

jest.mock('../../operatorRegistry.js', () => ({
  OperatorRegistry: { getInstance: jest.fn(() => ({ getAgent: jest.fn() })) }
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
  const ok = (data: any) => ({ ok: true, json: jest.fn().mockResolvedValue(data) });
  const bad = (status: number, statusText = '') => ({ ok: false, status, statusText });
  const setDbRows = (rows: any[]) => mockPostgres.query.mockResolvedValue(rows);
  const setDbError = (error: Error) => mockPostgres.query.mockRejectedValue(error);
  const fetchOnce = (response: any) => mockFetch.mockResolvedValueOnce(response);
  const fetchReject = (error: Error) => mockFetch.mockRejectedValueOnce(error);

  beforeEach(() => {
    jest.clearAllMocks();
    mockLogger = require('@snakagent/core').logger;
    mockMcpController = require('../../../../services/mcp/src/mcp.js').MCP_CONTROLLER;
    mockPostgres = require('@snakagent/database').Postgres;
    mockOperatorRegistry = require('../../operatorRegistry.js').OperatorRegistry;
    tools = getMcpAgentTools();
    process.env.SMITHERY_API_KEY = TEST_SMITHERY_API_KEY;
  });

  afterEach(() => {
    delete process.env.SMITHERY_API_KEY;
  });

  describe('Tool structure and validation', () => {
    it('should return all expected tools with proper structure', () => {
      const expectedTools = ['search_mcp_server', 'install_mcp_server', 'list_mcp_servers', 'refresh_mcp_server', 'delete_mcp_server'];
      
      expect(tools).toHaveLength(5);
      expect(tools.map(t => t.name)).toEqual(expect.arrayContaining(expectedTools));
      
      tools.forEach(tool => {
        expect(tool).toHaveProperty('name');
        expect(tool).toHaveProperty('description');
        expect(tool).toHaveProperty('schema');
        expect(tool.hasOwnProperty('func') || tool.hasOwnProperty('invoke')).toBe(true);
      });
    });
  });

  describe('search_mcp_server', () => {
    let searchTool: any;

    beforeEach(() => {
      searchTool = tools.find(t => t.name === 'search_mcp_server');
    });

    it('should validate schema structure', () => {
      const { schema } = searchTool;
      expect(schema.shape).toHaveProperty('query');
      expect(schema.shape).toHaveProperty('limit');
      expect(schema.shape).toHaveProperty('deployedOnly');
      expect(schema.shape).toHaveProperty('verifiedOnly');
      expect(schema.shape.query._def.typeName).toBe('ZodString');
    });

    it('should handle missing API key', async () => {
      delete process.env.SMITHERY_API_KEY;
      await expect(searchTool.func({ query: 'test' }))
        .rejects.toThrow('SMITHERY_API_KEY environment variable is required');
    });

    it('should handle API key invalid', async () => {
      mockFetch.mockResolvedValue(bad(401));
      await expect(searchTool.func({ query: 'test' }))
        .rejects.toThrow('Invalid Smithery API key');
    });

    it('should handle API server error', async () => {
      mockFetch.mockResolvedValue(bad(500, 'Internal Server Error'));
      await expect(searchTool.func({ query: 'test' }))
        .rejects.toThrow('Smithery API request failed: 500 Internal Server Error');
    });

    it('should handle network error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));
      await expect(searchTool.func({ query: 'test' }))
        .rejects.toThrow('Failed to search MCP servers: Error: Network error');
    });

    it('should handle successful search with filters', async () => {
      const mockResponse = ok({
        servers: [{ qualifiedName: 'test-server', displayName: 'Test Server' }],
        pagination: { totalCount: 1 }
      });
      mockFetch.mockResolvedValue(mockResponse);

      const result = await searchTool.func({ 
        query: 'test', 
        limit: 10, 
        deployedOnly: true, 
        verifiedOnly: true 
      });
      
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('https://registry.smithery.ai/servers'),
        expect.objectContaining({
          headers: { Authorization: `Bearer ${TEST_SMITHERY_API_KEY}`, Accept: 'application/json' }
        })
      );
      expect(result).toContain('test-server');
    });

    it('should handle search with no results', async () => {
      mockFetch.mockResolvedValue(ok({ servers: [], pagination: { totalCount: 0 } }));

      const result = await searchTool.func({ query: 'nonexistent' });
      expect(result).toContain('No MCP servers found');
    });

    it('should handle server detail fetching with errors', async () => {
      const searchResponse = ok({
        servers: [{ qualifiedName: 'test-server', displayName: 'Test Server' }],
        pagination: { totalCount: 1 }
      });

      mockFetch
        .mockResolvedValueOnce(searchResponse)
        .mockResolvedValueOnce(bad(404));

      const result = await searchTool.func({ query: 'test' });
      
      expect(result).toContain('test-server');
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should handle successful server detail fetching', async () => {
      const searchResponse = ok({
        servers: [{ qualifiedName: 'test-server', displayName: 'Test Server' }],
        pagination: { totalCount: 1 }
      });

      const detailResponse = ok({
        connections: [
          { type: 'http', url: 'http://example.com', configSchema: { properties: { apiKey: { type: 'string' } } } },
          { type: 'stdio', configSchema: { properties: {} } }
        ],
        security: { scanPassed: true },
        tools: [{ name: 'tool1', description: 'Test tool' }]
      });

      mockFetch
        .mockResolvedValueOnce(searchResponse)
        .mockResolvedValueOnce(detailResponse);

      const result = await searchTool.func({ query: 'test' });
      
      expect(result).toContain('test-server');
      expect(result).toContain('tool1');
      expect(result).toContain('hasLocalOption');
    });
  });

  describe('install_mcp_server', () => {
    let installTool: any;

    beforeEach(() => {
      installTool = tools.find(t => t.name === 'install_mcp_server');
    });

    it('should validate schema structure', () => {
      const { schema } = installTool;
      expect(schema.shape).toHaveProperty('agentId');
      expect(schema.shape).toHaveProperty('qualifiedName');
      expect(schema.shape).toHaveProperty('serverName');
      expect(schema.shape).toHaveProperty('config');
      expect(schema.shape).toHaveProperty('profile');
      expect(schema.shape.agentId._def.typeName).toBe('ZodString');
    });

    it('should handle agent not found', async () => {
      setDbRows([]);
      await expect(installTool.func({
        agentId: 'nonexistent',
        qualifiedName: 'test-server'
      })).rejects.toThrow('Agent not found: nonexistent');
    });

    it('should handle duplicate server', async () => {
      setDbRows([{ id: 'test-agent', mcpServers: { 'existing-server': { command: 'npx' } } }]);
      await expect(installTool.func({
        agentId: 'test-agent',
        qualifiedName: 'test-server',
        serverName: 'existing-server'
      })).rejects.toThrow('MCP server "existing-server" already exists for agent "test-agent"');
    });

    it('should handle database error', async () => {
      setDbError(new Error('Database error'));
      await expect(installTool.func({
        agentId: 'test-agent',
        qualifiedName: 'test-server'
      })).rejects.toThrow('Failed to install MCP server');
    });

    it.each([
      ['custom server name', 'custom-name', 'custom-name'],
      ['default server name', undefined, 'test-server']
    ])('should handle successful installation with %s', async (_, serverName, expectedName) => {
      setDbRows([{ id: 'test-agent', mcpServers: {} }]);

      const result = await installTool.func({
        agentId: 'test-agent',
        qualifiedName: 'org/test-server',
        serverName,
        config: { apiKey: TEST_SMITHERY_API_KEY },
        profile: 'test-profile'
      });

      expect(mockPostgres.query).toHaveBeenCalledTimes(2);
      expect(result).toContain(expectedName);
    });
  });

  describe('list_mcp_servers', () => {
    let listTool: any;

    beforeEach(() => {
      listTool = tools.find(t => t.name === 'list_mcp_servers');
    });

    it('should validate schema structure', () => {
      const { schema } = listTool;
      expect(schema.shape).toHaveProperty('agentId');
      expect(schema.shape.agentId._def.typeName).toBe('ZodString');
    });

    it('should handle agent not found', async () => {
      setDbRows([]);
      await expect(listTool.func({ agentId: 'test-agent' })).rejects.toThrow('Agent not found: test-agent');
    });

    it('should handle database error', async () => {
      setDbError(new Error('Database error'));
      await expect(listTool.func({ agentId: 'test-agent' })).rejects.toThrow('Failed to list MCP servers');
    });

    it('should handle successful listing with servers', async () => {
      setDbRows([{
        id: 'test-agent',
        name: 'Test Agent',
        mcpServers: { server1: { config: 'value1' }, server2: { config: 'value2' } }
      }]);

      const result = await listTool.func({ agentId: 'test-agent' });
      expect(result).toContain('test-agent');
      expect(result).toContain('server1');
    });

    it('should handle successful listing no servers', async () => {
      setDbRows([{
        id: 'test-agent',
        name: 'Test Agent',
        mcpServers: {}
      }]);

      const result = await listTool.func({ agentId: 'test-agent' });
      expect(result).toContain('test-agent');
      expect(result).toContain('{}');
    });
  });

  describe('refresh_mcp_server', () => {
    let refreshTool: any;

    beforeEach(() => {
      refreshTool = tools.find(t => t.name === 'refresh_mcp_server');
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should validate schema structure', () => {
      const { schema } = refreshTool;
      expect(schema.shape).toHaveProperty('agentId');
      expect(schema.shape).toHaveProperty('timeout');
      expect(schema.shape.agentId._def.typeName).toBe('ZodString');
    });

    it('should handle agent not found', async () => {
      setDbRows([]);
      await expect(refreshTool.func({ agentId: 'test-agent' })).rejects.toThrow('Agent not found: test-agent');
    });

    it('should handle database error', async () => {
      setDbError(new Error('Database error'));
      await expect(refreshTool.func({ agentId: 'test-agent' })).rejects.toThrow('Failed to refresh MCP servers');
    });

    it('should handle no servers configured', async () => {
      setDbRows([{ mcpServers: {} }]);

      const result = await refreshTool.func({ agentId: 'test-agent' });
      
      expect(result).toContain('No MCP servers configured for agent test-agent');
      expect(result).toContain('"mcpToolsCount":0');
    });

    it('should handle successful refresh', async () => {
      setDbRows([{ mcpServers: { server1: { config: 'value1' } } }]);

      const mockMcpInstance = {
        initializeConnections: jest.fn().mockResolvedValue(undefined),
        getTools: jest.fn().mockReturnValue([{ name: 'tool1' }])
      };
      mockMcpController.mockImplementation(() => mockMcpInstance);

      const mockAgent = { getTools: jest.fn().mockReturnValue([]) };
      mockOperatorRegistry.getInstance.mockReturnValue({ getAgent: jest.fn().mockReturnValue(mockAgent) });

      const resultPromise = refreshTool.func({ agentId: 'test-agent', timeout: 30000 });
      jest.runAllTimers();
      const result = await resultPromise;

      expect(result).toContain('Successfully refreshed MCP servers for agent test-agent');
      expect(mockMcpController).toHaveBeenCalled();
    });

    it('should handle connection errors', async () => {
      setDbRows([{ mcpServers: { server1: { config: 'value1' } } }]);

      const mockMcpInstance = {
        initializeConnections: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
        getTools: jest.fn().mockReturnValue([])
      };
      mockMcpController.mockImplementation(() => mockMcpInstance);

      await expect(refreshTool.func({ agentId: 'test-agent' }))
        .rejects.toThrow('Failed to connect to MCP servers');
    });

    it('should handle registry update errors with warning', async () => {
      setDbRows([{ mcpServers: { server1: { config: 'value1' } } }]);

      const mockMcpInstance = {
        initializeConnections: jest.fn().mockResolvedValue(undefined),
        getTools: jest.fn().mockReturnValue([{ name: 'tool1' }])
      };
      mockMcpController.mockImplementation(() => mockMcpInstance);

      mockOperatorRegistry.getInstance.mockImplementation(() => {
        throw new Error('Registry error');
      });

      const resultPromise = refreshTool.func({ agentId: 'test-agent' });
      jest.runAllTimers();
      const result = await resultPromise;

      expect(result).toContain('Successfully refreshed MCP servers for agent test-agent');
      expect(mockLogger.warn).toHaveBeenCalledWith('Failed to update agent registry: Error: Registry error');
    });
  });

  describe('delete_mcp_server', () => {
    let deleteTool: any;

    beforeEach(() => {
      deleteTool = tools.find(t => t.name === 'delete_mcp_server');
    });

    it('should validate schema structure', () => {
      const { schema } = deleteTool;
      expect(schema.shape).toHaveProperty('agentId');
      expect(schema.shape).toHaveProperty('serverName');
      expect(schema.shape.agentId._def.typeName).toBe('ZodString');
    });

    it('should handle agent not found', async () => {
      setDbRows([]);
      await expect(deleteTool.func({
        agentId: 'test-agent',
        serverName: 'test-server'
      })).rejects.toThrow('Agent not found: test-agent');
    });

    it('should handle server not found', async () => {
      setDbRows([{ id: 'test-agent', mcpServers: { 'other-server': { config: 'value' } } }]);
      await expect(deleteTool.func({
        agentId: 'test-agent',
        serverName: 'test-server'
      })).rejects.toThrow('MCP server "test-server" not found in agent "test-agent"');
    });

    it('should handle database error', async () => {
      setDbError(new Error('Database error'));
      await expect(deleteTool.func({
        agentId: 'test-agent',
        serverName: 'test-server'
      })).rejects.toThrow('Failed to delete MCP server');
    });

    it('should handle successful deletion', async () => {
      mockPostgres.query
        .mockResolvedValueOnce([{ id: 'test-agent', mcpServers: { 'test-server': { config: 'value' } } }])
        .mockResolvedValueOnce([{ id: 'test-agent', mcpServers: {} }]);

      const result = await deleteTool.func({
        agentId: 'test-agent',
        serverName: 'test-server'
      });

      expect(mockPostgres.query).toHaveBeenCalledTimes(2);
      const resultObj = JSON.parse(result);
      expect(resultObj.success).toBe(true);
      expect(resultObj.message).toContain('test-server');
    });
  });
});
