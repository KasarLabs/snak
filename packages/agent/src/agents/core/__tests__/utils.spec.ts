import {
  initializeToolsList,
  initializeDatabase,
  formatAgentResponse,
  processStringContent,
  processArrayContent,
  processObjectContent,
  processMessageContent,
} from '../utils.js';

jest.mock('../../../tools/tools.js');
jest.mock('../../../services/mcp/src/mcp.js');
jest.mock('@snakagent/core');
jest.mock('@snakagent/database/queries');
jest.mock('@snakagent/database');

const mockCreateAllowedTools = jest.mocked(
  require('../../../tools/tools.js').createAllowedTools
);
const mockMCPController = jest.mocked(
  require('../../../services/mcp/src/mcp.js').MCP_CONTROLLER
);
const mockLogger = jest.mocked(require('@snakagent/core').logger);
const mockPostgres = jest.mocked(
  require('@snakagent/database/queries').Postgres
);
const mockMemory = jest.mocked(require('@snakagent/database/queries').memory);
const mockIterations = jest.mocked(
  require('@snakagent/database/queries').iterations
);

const makeSnakAgent = (): any => ({}) as any;
const makeAgentConfig = (overrides: any = {}): any => ({
  plugins: ['test-plugin'],
  mcpServers: {},
  ...overrides,
});
const makeCredentials = (): any =>
  ({
    host: 'localhost',
    port: 5432,
    database: 'test',
    user: 'test',
    password: 'test',
  }) as any;
const makeStepInfo = (overrides: any = {}): any =>
  ({
    result: '',
    ...overrides,
  }) as any;

describe('utils functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPostgres.connect = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('initializeToolsList', () => {
    const mockSnakAgent = makeSnakAgent();
    const mockAgentConfig = makeAgentConfig();

    it('should initialize tools list with allowed tools', async () => {
      const mockTools = [{ name: 'test-tool' }];
      mockCreateAllowedTools.mockResolvedValue(mockTools);

      const result = await initializeToolsList(mockSnakAgent, mockAgentConfig);

      expect(mockCreateAllowedTools).toHaveBeenCalledWith(
        mockSnakAgent,
        mockAgentConfig.plugins
      );
      expect(result).toEqual(mockTools);
    });

    it('should add MCP tools when mcpServers are configured', async () => {
      const mockAllowedTools = [{ name: 'allowed-tool' }];
      const mockMCPTools = [{ name: 'mcp-tool' }];
      const mockMCP = {
        initializeConnections: jest.fn().mockResolvedValue(undefined),
        getTools: jest.fn().mockReturnValue(mockMCPTools),
      };

      mockCreateAllowedTools.mockResolvedValue(mockAllowedTools);
      mockMCPController.fromAgentConfig.mockReturnValue(mockMCP);

      const agentConfigWithMCP = makeAgentConfig({
        mcpServers: { test: 'config' },
      });

      const result = await initializeToolsList(
        mockSnakAgent,
        agentConfigWithMCP
      );

      expect(mockMCP.initializeConnections).toHaveBeenCalled();
      expect(mockMCP.getTools).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        `Added ${mockMCPTools.length} MCP tools to the agent`
      );
      expect(result).toEqual([...mockAllowedTools, ...mockMCPTools]);
    });

    it('should handle MCP initialization errors gracefully', async () => {
      const mockAllowedTools = [{ name: 'allowed-tool' }];
      mockCreateAllowedTools.mockResolvedValue(mockAllowedTools);
      mockMCPController.fromAgentConfig.mockImplementation(() => {
        throw new Error('MCP error');
      });

      const agentConfigWithMCP = makeAgentConfig({
        mcpServers: { test: 'config' },
      });

      const result = await initializeToolsList(
        mockSnakAgent,
        agentConfigWithMCP
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to initialize MCP tools: Error: MCP error'
      );
      expect(result).toEqual(mockAllowedTools);
    });

    it.each([
      { mcpServers: {}, description: 'empty mcpServers object' },
      { mcpServers: undefined, description: 'undefined mcpServers' },
    ])('should handle $description', async ({ mcpServers }) => {
      const mockAllowedTools = [{ name: 'allowed-tool' }];
      mockCreateAllowedTools.mockResolvedValue(mockAllowedTools);

      const agentConfig = makeAgentConfig({ mcpServers });

      const result = await initializeToolsList(mockSnakAgent, agentConfig);

      expect(result).toEqual(mockAllowedTools);
      expect(mockMCPController.fromAgentConfig).not.toHaveBeenCalled();
    });
  });
  describe('initializeDatabase', () => {
    const mockCredentials = makeCredentials();

    beforeEach(() => {
      jest.resetModules();
      jest.clearAllMocks();
    });

    it('should initialize database connection when not connected', async () => {
      mockPostgres.connect.mockResolvedValue(undefined);
      mockMemory.init.mockResolvedValue(undefined);
      mockIterations.init.mockResolvedValue(undefined);

      await initializeDatabase(mockCredentials);

      expect(mockPostgres.connect).toHaveBeenCalledWith(mockCredentials);
      expect(mockMemory.init).toHaveBeenCalled();
      expect(mockIterations.init).toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Agent memory table successfully created'
      );
    });

    it('should reuse existing connection when already connected', async () => {
      mockPostgres.connect.mockResolvedValue(undefined);
      mockMemory.init.mockResolvedValue(undefined);
      mockIterations.init.mockResolvedValue(undefined);
      await initializeDatabase(mockCredentials);

      // Clear connect call count and invoke again to verify reuse
      mockPostgres.connect.mockClear();
      await initializeDatabase(mockCredentials);

      expect(mockPostgres.connect).not.toHaveBeenCalled();
      expect(mockMemory.init).toHaveBeenCalled();
      expect(mockIterations.init).toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Agent memory table successfully initialized (connection exists)'
      );
    });

    it.each([
      {
        mock: mockMemory.init,
        error: 'Memory init failed',
        description: 'memory initialization',
      },
      {
        mock: mockIterations.init,
        error: 'Iterations init failed',
        description: 'iterations initialization',
      },
    ])('should handle $description errors', async ({ mock, error }) => {
      mockPostgres.connect.mockResolvedValue(undefined);
      if (mock === mockMemory.init) {
        mockMemory.init.mockRejectedValue(new Error(error));
        mockIterations.init.mockResolvedValue(undefined);
      } else {
        mockMemory.init.mockResolvedValue(undefined);
        mockIterations.init.mockRejectedValue(new Error(error));
      }

      await expect(initializeDatabase(mockCredentials)).rejects.toThrow(error);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error creating memories table:',
        expect.any(Error)
      );
    });
  });
  describe('formatAgentResponse', () => {
    it.each([
      {
        response: '• First item\n• Second item\n• Third item',
        expected: '  • First item\n  • Second item\n  • Third item',
        description: 'string response with bullet points',
      },
      {
        response: 'Line 1\nLine 2\nLine 3',
        expected: 'Line 1\nLine 2\nLine 3',
        description: 'string response without bullet points',
      },
    ])('should format $description', ({ response, expected }) => {
      const result = formatAgentResponse(response);
      expect(result).toBe(expected);
    });

    it.each([
      {
        response: '{"type": "text", "text": "JSON content"}',
        expected: 'JSON content',
        description: 'JSON string with text type',
      },
      {
        response: '{"invalid": json}',
        expected: '{"invalid": json}',
        description: 'malformed JSON string',
      },
    ])('should handle $description', ({ response, expected }) => {
      const result = formatAgentResponse(response);
      expect(result).toBe(expected);
    });

    it.each([
      {
        response: [
          { type: 'text', text: 'First item' },
          { type: 'text', text: 'Second item' },
        ],
        expected: 'First item\nSecond item',
        description: 'array with text objects',
      },
      {
        response: [{ content: 'Content 1' }, { content: 'Content 2' }],
        expected: 'Content 1\nContent 2',
        description: 'array with content objects',
      },
      {
        response: [
          { type: 'text', text: 'Text item' },
          { content: 'Content item' },
          'String item',
          { unknown: 'object' },
        ],
        expected: 'Text item\nContent item\nString item\n{"unknown":"object"}',
        description: 'array with mixed content',
      },
    ])('should format array $description', ({ response, expected }) => {
      const result = formatAgentResponse(response);
      expect(result).toBe(expected);
    });

    it.each([
      {
        response: { type: 'text', text: 'Text content' },
        expected: 'Text content',
      },
      { response: { content: 'Object content' }, expected: 'Object content' },
      {
        response: { key: 'value', number: 123 },
        expected: '{"key":"value","number":123}',
      },
    ])('should format object response correctly', ({ response, expected }) => {
      const result = formatAgentResponse(response);
      expect(result).toBe(expected);
    });

    it.each([
      { input: 123, expected: '123' },
      { input: true, expected: 'true' },
      { input: null, expected: 'null' },
      { input: undefined, expected: 'undefined' },
    ])('should handle primitive type $input', ({ input, expected }) => {
      expect(formatAgentResponse(input)).toBe(expected);
    });

    it.each([
      { input: [], expected: '' },
      { input: {}, expected: '{}' },
    ])('should handle empty $input', ({ input, expected }) => {
      expect(formatAgentResponse(input)).toBe(expected);
    });
  });

  describe('processStringContent', () => {
    it.each([
      {
        content: '{"type": "text", "text": "JSON content"}',
        expected: 'JSON content',
        description: 'JSON string with text type',
      },
      {
        content: '{"content": "Content from JSON"}',
        expected: 'Content from JSON',
        description: 'JSON string with content property',
      },
      {
        content: '{"invalid": json}',
        expected: '{"invalid": json}',
        description: 'malformed JSON',
      },
      {
        content: 'plain text',
        expected: 'plain text',
        description: 'non-JSON content',
      },
    ])('should process $description', ({ content, expected }) => {
      const result = processStringContent(content);
      expect(result).toBe(expected);
    });

    it.each([
      { content: '', expected: '' },
      { content: '   \n\t  ', expected: '   \n\t  ' },
    ])('should handle $content', ({ content, expected }) => {
      const result = processStringContent(content);
      expect(result).toBe(expected);
    });

    it('should handle JSON array string', () => {
      const jsonArray = '[{"type": "text", "text": "Array item"}]';
      const result = processStringContent(jsonArray);
      expect(result).toBe('Array item');
    });

    it('should handle deeply nested JSON structures', () => {
      const nestedJson = '{"data": {"type": "text", "text": "Nested content"}}';
      const result = processStringContent(nestedJson);
      expect(result).toBe('{"data":{"type":"text","text":"Nested content"}}');
    });
  });

  describe('processArrayContent', () => {
    it.each([
      {
        content: [
          { type: 'text', text: 'First item' },
          { type: 'text', text: 'Second item' },
        ],
        expected: 'First item\nSecond item',
        description: 'array with text objects',
      },
      {
        content: [{ content: 'Content 1' }, { content: 'Content 2' }],
        expected: 'Content 1\nContent 2',
        description: 'array with content objects',
      },
      {
        content: [
          { type: 'text', text: 'Text item' },
          { content: 'Content item' },
          'String item',
          { unknown: 'object' },
        ],
        expected: 'Text item\nContent item\nString item\n{"unknown":"object"}',
        description: 'array with mixed content',
      },
    ])('should process $description', ({ content, expected }) => {
      const result = processArrayContent(content);
      expect(result).toBe(expected);
    });

    it.each([
      { content: [], expected: '' },
      {
        content: ['First item', null, 'Third item'],
        expected: 'First item\nThird item',
      },
      {
        content: ['First item', undefined, 'Third item'],
        expected: 'First item\nundefined\nThird item',
      },
    ])('should handle array edge cases', ({ content, expected }) => {
      const result = processArrayContent(content);
      expect(result).toBe(expected);
    });

    it('should handle array with primitive types', () => {
      const content = [123, 'string', true, false];
      const result = processArrayContent(content);
      expect(result).toBe('123\nstring\ntrue\nfalse');
    });
  });

  describe('processObjectContent', () => {
    it.each([
      {
        content: { type: 'text', text: 'Text content' },
        expected: 'Text content',
      },
      { content: { content: 'Object content' }, expected: 'Object content' },
      {
        content: { key: 'value', number: 123 },
        expected: '{"key":"value","number":123}',
      },
    ])('should process object content correctly', ({ content, expected }) => {
      const result = processObjectContent(content);
      expect(result).toBe(expected);
    });

    it.each([
      { content: {}, expected: '{}' },
      {
        content: { key: null, other: 'value' },
        expected: '{"key":null,"other":"value"}',
      },
      {
        content: { key: undefined, other: 'value' },
        expected: '{"other":"value"}',
      },
    ])('should handle object edge cases', ({ content, expected }) => {
      const result = processObjectContent(content);
      expect(result).toBe(expected);
    });
  });

  describe('processMessageContent', () => {
    it.each([
      {
        content: '{"type": "text", "text": "String content"}',
        expected: 'String content',
      },
      {
        content: [
          { type: 'text', text: 'Array item 1' },
          { type: 'text', text: 'Array item 2' },
        ],
        expected: 'Array item 1\nArray item 2',
      },
      {
        content: { type: 'text', text: 'Object content' },
        expected: 'Object content',
      },
    ])('should process $content type correctly', ({ content, expected }) => {
      const result = processMessageContent(content);
      expect(result).toBe(expected);
    });

    it.each([
      { input: 123, expected: '123' },
      { input: true, expected: 'true' },
      { input: false, expected: 'false' },
      { input: null, expected: 'null' },
      { input: undefined, expected: 'undefined' },
    ])('should handle primitive type $input', ({ input, expected }) => {
      expect(processMessageContent(input)).toBe(expected);
    });

    it.each([
      { input: '', expected: '' },
      { input: [], expected: '' },
      { input: {}, expected: '{}' },
    ])('should handle empty $input', ({ input, expected }) => {
      expect(processMessageContent(input)).toBe(expected);
    });

    it('should handle complex nested content', () => {
      const content = {
        type: 'complex',
        data: [
          { type: 'text', text: 'Nested text' },
          { content: 'Nested content' },
        ],
        metadata: { key: 'value' },
      };

      const result = processMessageContent(content);
      expect(result).toBe(
        '{"type":"complex","data":[{"type":"text","text":"Nested text"},{"content":"Nested content"}],"metadata":{"key":"value"}}'
      );
    });
  });
});
