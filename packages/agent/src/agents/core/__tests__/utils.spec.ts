import {
  initializeToolsList,
  FormatChunkIteration,
  extractTokenChunkFromIteration,
  extractToolsFromIteration,
  initializeDatabase,
  truncateToolResults,
  formatAgentResponse,
  processStringContent,
  processArrayContent,
  processObjectContent,
  processMessageContent,
} from '../utils.js';
import { AgentIterationEvent } from '../types.js';

jest.mock('../../../tools/tools.js');
jest.mock('../../../services/mcp/src/mcp.js');
jest.mock('@snakagent/core');
jest.mock('@snakagent/database/queries');
jest.mock('@snakagent/database');

const mockCreateAllowedTools = jest.mocked(require('../../../tools/tools.js').createAllowedTools);
const mockMCPController = jest.mocked(require('../../../services/mcp/src/mcp.js').MCP_CONTROLLER);
const mockLogger = jest.mocked(require('@snakagent/core').logger);
const mockPostgres = jest.mocked(require('@snakagent/database/queries').Postgres);
const mockMemory = jest.mocked(require('@snakagent/database/queries').memory);
const mockIterations = jest.mocked(require('@snakagent/database/queries').iterations);

const makeSnakAgent = (): any => ({} as any);
const makeAgentConfig = (overrides: any = {}): any => ({
  plugins: ['test-plugin'],
  mcpServers: {},
  ...overrides,
});
const makeCredentials = (): any => ({
  host: 'localhost',
  port: 5432,
  database: 'test',
  user: 'test',
  password: 'test',
} as any);
const makeStepInfo = (overrides: any = {}): any => ({
  result: '',
  ...overrides,
} as any);

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

      expect(mockCreateAllowedTools).toHaveBeenCalledWith(mockSnakAgent, mockAgentConfig.plugins);
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

      const agentConfigWithMCP = makeAgentConfig({ mcpServers: { test: 'config' } });

      const result = await initializeToolsList(mockSnakAgent, agentConfigWithMCP);

      expect(mockMCP.initializeConnections).toHaveBeenCalled();
      expect(mockMCP.getTools).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(`Added ${mockMCPTools.length} MCP tools to the agent`);
      expect(result).toEqual([...mockAllowedTools, ...mockMCPTools]);
    });

    it('should handle MCP initialization errors gracefully', async () => {
      const mockAllowedTools = [{ name: 'allowed-tool' }];
      mockCreateAllowedTools.mockResolvedValue(mockAllowedTools);
      mockMCPController.fromAgentConfig.mockImplementation(() => {
        throw new Error('MCP error');
      });

      const agentConfigWithMCP = makeAgentConfig({ mcpServers: { test: 'config' } });

      const result = await initializeToolsList(mockSnakAgent, agentConfigWithMCP);

      expect(mockLogger.error).toHaveBeenCalledWith('Failed to initialize MCP tools: Error: MCP error');
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

  describe('FormatChunkIteration', () => {
    it.each([
      {
        event: AgentIterationEvent.ON_CHAT_MODEL_STREAM,
        data: { chunk: { content: 'test content' } },
        expectedProperty: 'chunk',
        expectedContent: 'test content',
      },
      {
        event: AgentIterationEvent.ON_CHAT_MODEL_END,
        name: 'test-iteration',
        data: {
          input: { messages: ['test message'] },
          output: { kwargs: { content: 'test output' } },
        },
        expectedProperty: 'iteration',
        expectedName: 'test-iteration',
        expectedContent: 'test output',
      },
      {
        event: AgentIterationEvent.ON_CHAT_MODEL_END,
        name: 'test-iteration',
        data: {
          input: { messages: ['test message'] },
          output: { kwargs: {} },
        },
        expectedProperty: 'iteration',
        expectedName: 'test-iteration',
        expectedContent: '',
      },
      {
        event: AgentIterationEvent.ON_CHAT_MODEL_START,
        name: 'test-iteration',
        data: {
          input: { messages: ['test message'], metadata: { key: 'value' } },
        },
        expectedProperty: 'iteration',
        expectedName: 'test-iteration',
        expectedMessages: ['test message'],
        expectedMetadata: { key: 'value' },
      },
    ])('should format $event event correctly', (testCase) => {
      const mockChunk = {
        event: testCase.event,
        name: testCase.name,
        data: testCase.data,
      };

      const result = FormatChunkIteration(mockChunk);

      expect(result).toHaveProperty(testCase.expectedProperty);
      
      if (testCase.expectedProperty === 'chunk') {
        expect((result as any).chunk.content).toBe(testCase.expectedContent);
      } else if (testCase.expectedProperty === 'iteration') {
        const iteration = (result as any).iteration;
        expect(iteration.name).toBe(testCase.expectedName);
        if (testCase.expectedContent !== undefined) {
          expect(iteration.result.output.content).toBe(testCase.expectedContent);
        }
        if (testCase.expectedMessages) {
          expect(iteration.messages).toEqual(testCase.expectedMessages);
        }
        if (testCase.expectedMetadata) {
          expect(iteration.metadata).toEqual(testCase.expectedMetadata);
        }
      }
    });

    it('should return undefined for unknown event type', () => {
      const mockChunk = { event: 'UNKNOWN_EVENT', data: {} };

      const result = FormatChunkIteration(mockChunk);
      expect(result).toBeUndefined();
    });
  });

  describe('extractTokenChunkFromIteration', () => {
    it('should extract token chunk from iteration', () => {
      const mockIteration = {
        data: {
          chunk: {
            kwargs: {
              token_chunk: { input: 100, output: 200, total: 300 },
            },
          },
        },
      };

      const result = extractTokenChunkFromIteration(mockIteration);

      expect(result).toEqual({ input: 100, output: 200, total: 300 });
    });

    it.each([
      { data: {}, description: 'missing token data' },
      { data: { chunk: null }, description: 'missing chunk data' },
      { data: { chunk: { kwargs: undefined } }, description: 'missing kwargs' },
      { data: { chunk: { kwargs: {} } }, description: 'missing token_chunk' },
    ])('should handle $description', ({ data }) => {
      const mockIteration = { data };

      const result = extractTokenChunkFromIteration(mockIteration);

      expect(result).toBeUndefined();
    });

    it('should handle missing input/output/total in token_chunk', () => {
      const mockIteration = {
        data: {
          chunk: {
            kwargs: {
              token_chunk: { input: undefined, output: undefined, total: undefined },
            },
          },
        },
      };

      const result = extractTokenChunkFromIteration(mockIteration);

      expect(result).toEqual({ input: 0, output: 0, total: 0 });
    });

    it('should handle null iteration', () => {
      const result = extractTokenChunkFromIteration(null);
      expect(result).toBeUndefined();
    });
  });

  describe('extractToolsFromIteration', () => {
    it('should extract tools from iteration', () => {
      const mockIteration = {
        data: {
          chunk: {
            tool_call_chunks: [
              {
                id: 'tool-1',
                name: 'test-tool',
                args: '{"arg": "value"}',
                index: 0,
                type: 'function',
              },
            ],
          },
        },
      };

      const result = extractToolsFromIteration(mockIteration);

      expect(result).toBeDefined();
      if (result) {
        expect(result.name).toBe('test-tool');
        expect(result.id).toBe('tool-1');
        expect(result.args).toBe('{"arg": "value"}');
        expect(result.index).toBe(0);
        expect(result.type).toBe('function');
      }
    });

    it.each([
      { data: { chunk: {} }, description: 'missing tool calls' },
      { data: { chunk: { tool_call_chunks: [] } }, description: 'empty tool_call_chunks array' },
      { data: { chunk: { tool_call_chunks: 'not-an-array' } }, description: 'tool_call_chunks that is not an array' },
      { data: { chunk: { tool_call_chunks: [{ id: 'tool-1', args: '{"arg": "value"}', index: 0, type: 'function' }] } }, description: 'tool without name' },
    ])('should handle $description', ({ data }) => {
      const mockIteration = { data };

      const result = extractToolsFromIteration(mockIteration);

      expect(result).toBeUndefined();
    });

    it.each([null, undefined])('should handle %s iteration', (iteration) => {
      const result = extractToolsFromIteration(iteration);
      expect(result).toBeUndefined();
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
      expect(mockLogger.debug).toHaveBeenCalledWith('Agent memory table successfully created');
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
      expect(
        mockLogger.debug
      ).toHaveBeenCalledWith(
        'Agent memory table successfully initialized (connection exists)'
      );
    });

    it.each([
      { mock: mockMemory.init, error: 'Memory init failed', description: 'memory initialization' },
      { mock: mockIterations.init, error: 'Iterations init failed', description: 'iterations initialization' },
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
      expect(mockLogger.error).toHaveBeenCalledWith('Error creating memories table:', expect.any(Error));
    });
  });

  describe('truncateToolResults', () => {
    it.each([
      {
        content: 'a'.repeat(6000),
        maxLength: 5000,
        shouldTruncate: true,
        description: 'long content',
      },
      {
        content: 'short result',
        maxLength: 5000,
        shouldTruncate: false,
        description: 'short content',
      },
    ])('should $description correctly', ({ content, maxLength, shouldTruncate }) => {
      const mockResult = { messages: [{ content }] };
      const mockStepInfo = makeStepInfo();

      const result = truncateToolResults(mockResult, maxLength, mockStepInfo);

      if (shouldTruncate) {
        expect(result.messages[0].content).toContain('... [truncated');
        expect(result.messages[0].content.length).toBeLessThan(6000);
        expect(mockStepInfo.result).toContain('... [truncated');
      } else {
        expect(result.messages[0].content).toBe(content);
        expect(mockStepInfo.result).toBe(content);
      }
    });

    it('should handle multiple messages', () => {
      const mockResult = {
        messages: [
          { content: 'a'.repeat(6000) },
          { content: 'short message' },
          { content: 'b'.repeat(6000) },
        ],
      };
      const maxLength = 5000;
      const mockStepInfo = makeStepInfo();

      const result = truncateToolResults(mockResult, maxLength, mockStepInfo);

      expect(result.messages[0].content).toContain('... [truncated');
      expect(result.messages[1].content).toBe('short message');
      expect(result.messages[2].content).toContain('... [truncated');
    });

    it.each([
      { existingResult: 'existing result', expectedResult: 'existing resultnew content' },
      { existingResult: undefined, expectedResult: 'new content' },
    ])('should handle step info with $existingResult existing result', ({ existingResult, expectedResult }) => {
      const mockResult = { messages: [{ content: 'new content' }] };
      const maxLength = 5000;
      const mockStepInfo = makeStepInfo({ result: existingResult });

      truncateToolResults(mockResult, maxLength, mockStepInfo);

      expect(mockStepInfo.result).toBe(expectedResult);
    });

    it('should handle content that is not a string', () => {
      const mockResult = { messages: [{ content: 12345 }] };
      const maxLength = 5000;
      const mockStepInfo = makeStepInfo();

      truncateToolResults(mockResult, maxLength, mockStepInfo);

      const content = String(mockStepInfo.result);
      expect(content.replace(/\s/g, '')).toContain('12345');
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
        response: [
          { content: 'Content 1' },
          { content: 'Content 2' },
        ],
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
      { response: { type: 'text', text: 'Text content' }, expected: 'Text content' },
      { response: { content: 'Object content' }, expected: 'Object content' },
      { response: { key: 'value', number: 123 }, expected: '{"key":"value","number":123}' },
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
        content: [
          { content: 'Content 1' },
          { content: 'Content 2' },
        ],
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
      { content: ['First item', null, 'Third item'], expected: 'First item\nThird item' },
      { content: ['First item', undefined, 'Third item'], expected: 'First item\nundefined\nThird item' },
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
      { content: { type: 'text', text: 'Text content' }, expected: 'Text content' },
      { content: { content: 'Object content' }, expected: 'Object content' },
      { content: { key: 'value', number: 123 }, expected: '{"key":"value","number":123}' },
    ])('should process object content correctly', ({ content, expected }) => {
      const result = processObjectContent(content);
      expect(result).toBe(expected);
    });

    it.each([
      { content: {}, expected: '{}' },
      { content: { key: null, other: 'value' }, expected: '{"key":null,"other":"value"}' },
      { content: { key: undefined, other: 'value' }, expected: '{"other":"value"}' },
    ])('should handle object edge cases', ({ content, expected }) => {
      const result = processObjectContent(content);
      expect(result).toBe(expected);
    });
  });

  describe('processMessageContent', () => {
    it.each([
      { content: '{"type": "text", "text": "String content"}', expected: 'String content' },
      { content: [{ type: 'text', text: 'Array item 1' }, { type: 'text', text: 'Array item 2' }], expected: 'Array item 1\nArray item 2' },
      { content: { type: 'text', text: 'Object content' }, expected: 'Object content' },
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
      expect(result).toBe('{"type":"complex","data":[{"type":"text","text":"Nested text"},{"content":"Nested content"}],"metadata":{"key":"value"}}');
    });
  });
});
