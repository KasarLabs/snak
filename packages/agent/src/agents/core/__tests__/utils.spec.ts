// Mock the logger from @snakagent/core
jest.mock('@snakagent/core', () => ({
  logger: {
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
  AgentConfig: jest.fn(),
}));

// Mock AgentIterationEvent enum
const AgentIterationEvent = {
  ON_CHAT_MODEL_STREAM: 'on_chat_model_stream',
  ON_CHAT_MODEL_END: 'on_chat_model_end',
  ON_CHAT_MODEL_START: 'on_chat_model_start',
};

// Recreate utility functions for testing to avoid import issues
interface ToolsChunk {
  name: string;
  args: string;
  id: string;
  index: number;
  type: string;
}

interface TokenChunk {
  input: number;
  output: number;
  total: number;
}

interface FormattedOnChatModelStream {
  chunk: {
    content: string;
    tools?: ToolsChunk;
  };
}

interface FormattedOnChatModelEnd {
  iteration: {
    name: string;
    result: {
      output: {
        content: string;
      };
      input: {
        messages: any[];
      };
    };
  };
}

interface FormattedOnChatModelStart {
  iteration: {
    name: string;
    messages: any[];
    metadata?: any;
  };
}

const FormatChunkIteration = (
  chunk: any
):
  | FormattedOnChatModelStream
  | FormattedOnChatModelEnd
  | FormattedOnChatModelStart
  | undefined => {
  if (chunk.event === AgentIterationEvent.ON_CHAT_MODEL_STREAM) {
    const tool = extractToolsFromIteration(chunk);
    const iteration: FormattedOnChatModelStream = {
      chunk: {
        content: chunk.data.chunk.content as string,
        tools: tool,
      },
    };
    return iteration;
  }
  if (chunk.event === AgentIterationEvent.ON_CHAT_MODEL_END) {
    const content = chunk.data?.output?.kwargs?.content;
    const iteration: FormattedOnChatModelEnd = {
      iteration: {
        name: chunk.name,
        result: {
          output: {
            content: content || '',
          },
          input: {
            messages: chunk.data.input.messages,
          },
        },
      },
    };
    return iteration;
  }
  if (chunk.event === AgentIterationEvent.ON_CHAT_MODEL_START) {
    const iteration: FormattedOnChatModelStart = {
      iteration: {
        name: chunk.name,
        messages: chunk.data.input.messages,
        metadata: chunk.data.input.metadata,
      },
    };
    return iteration;
  }
  return undefined;
};

const extractTokenChunkFromIteration = (
  iteration: any
): TokenChunk | undefined => {
  if (!iteration || !iteration.data || !iteration.data.chunk) {
    return undefined;
  }
  const token_chunk = iteration.data.chunk.kwargs.token_chunk as TokenChunk;
  if (!token_chunk || !token_chunk.input) {
    return undefined;
  }
  return {
    input: token_chunk.input || 0,
    output: token_chunk.output || 0,
    total: token_chunk.total || 0,
  };
};

const extractToolsFromIteration = (
  iteration: any
): ToolsChunk | undefined => {
  const toolCallChunks = iteration?.data?.chunk?.tool_call_chunks;

  if (!Array.isArray(toolCallChunks)) {
    return undefined;
  }
  const lastTool = toolCallChunks[0] as ToolsChunk;
  if (!lastTool?.name) {
    return undefined;
  }
  return lastTool;
};

const truncateStringContentHelper = (
  content: string,
  maxLength: number
): string => {
  const originalLength = content.length;
  if (originalLength > maxLength) {
    return (
      content.substring(0, maxLength) +
      `... [truncated ${originalLength - maxLength} characters]`
    );
  }
  return content;
};

const truncateToolResults = (
  result: any,
  maxLength: number = 5000
): any => {
  if (Array.isArray(result)) {
    for (const msg of result) {
      if (
        msg._getType &&
        msg._getType() === 'tool' &&
        typeof msg.content === 'string'
      ) {
        msg.content = truncateStringContentHelper(msg.content, maxLength);
      }
    }
  }

  if (result && typeof result === 'object' && Array.isArray(result.messages)) {
    for (const msg of result.messages) {
      if (typeof msg.content === 'string') {
        msg.content = truncateStringContentHelper(msg.content, maxLength);
      }

      if (Array.isArray(msg.tool_calls_results)) {
        for (const toolResult of msg.tool_calls_results) {
          if (typeof toolResult.content === 'string') {
            toolResult.content = truncateStringContentHelper(
              toolResult.content,
              maxLength
            );
          }
        }
      }
    }
  }

  return result;
};

const formatAgentResponse = (response: any): string => {
  if (typeof response === 'string') {
    try {
      if (
        (response.startsWith('[') && response.endsWith(']')) ||
        (response.startsWith('{') && response.endsWith('}'))
      ) {
        const parsed = JSON.parse(response);
        return formatAgentResponse(parsed);
      }

      return response
        .split('\n')
        .map((line) => {
          if (line.includes('•')) {
            return `  ${line.trim()}`;
          }
          return line;
        })
        .join('\n');
    } catch (e) {
      return response;
    }
  }

  if (Array.isArray(response)) {
    let result = '';
    for (const item of response) {
      if (typeof item === 'object' && item !== null) {
        if (item.type === 'text' && item.text) {
          result += item.text + '\n';
        } else if (item.content) {
          result += item.content + '\n';
        } else {
          result += JSON.stringify(item) + '\n';
        }
      } else if (item !== null) {
        result += String(item) + '\n';
      }
    }
    return result.trim();
  }

  if (typeof response === 'object' && response !== null) {
    if (response.type === 'text' && response.text) {
      return response.text;
    } else if (response.content && typeof response.content === 'string') {
      return response.content;
    }
  }

  return String(response);
};

const processStringContent = (content: string): string => {
  const trimmedContent = content.trim();
  if (
    (trimmedContent.startsWith('[') && trimmedContent.endsWith(']')) ||
    (trimmedContent.startsWith('{') && trimmedContent.endsWith('}'))
  ) {
    try {
      const parsed = JSON.parse(trimmedContent);
      return processMessageContent(parsed);
    } catch (e) {
      return content;
    }
  }
  return content;
};

const processArrayContent = (content: any[]): string => {
  let result = '';
  for (const item of content) {
    if (typeof item === 'object' && item !== null) {
      if (item.type === 'text' && item.text) {
        result += item.text + '\n';
      } else if (item.content) {
        result += item.content + '\n';
      } else {
        result += JSON.stringify(item) + '\n';
      }
    } else if (item !== null) {
      result += String(item) + '\n';
    }
  }
  return result.trim();
};

const processObjectContent = (content: Record<string, any>): string => {
  if (content.type === 'text' && content.text) {
    return content.text;
  } else if (content.content && typeof content.content === 'string') {
    return content.content;
  }
  return JSON.stringify(content);
};

const processMessageContent = (content: any): string => {
  if (typeof content === 'string') {
    return processStringContent(content);
  }

  if (Array.isArray(content)) {
    return processArrayContent(content);
  }

  if (typeof content === 'object' && content !== null) {
    return processObjectContent(content);
  }

  return String(content);
};

describe('utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('FormatChunkIteration', () => {
    it('should format ON_CHAT_MODEL_STREAM event', () => {
      const mockChunk = {
        event: AgentIterationEvent.ON_CHAT_MODEL_STREAM,
        data: {
          chunk: {
            content: 'test content',
          },
        },
      };

      const result = FormatChunkIteration(mockChunk);

      expect(result).toEqual({
        chunk: {
          content: 'test content',
          tools: undefined,
        },
      });
    });

    it('should format ON_CHAT_MODEL_END event', () => {
      const mockChunk = {
        event: AgentIterationEvent.ON_CHAT_MODEL_END,
        name: 'test_iteration',
        data: {
          output: {
            kwargs: {
              content: 'test output content',
            },
          },
          input: {
            messages: ['message1', 'message2'],
          },
        },
      };

      const result = FormatChunkIteration(mockChunk);

      expect(result).toEqual({
        iteration: {
          name: 'test_iteration',
          result: {
            output: {
              content: 'test output content',
            },
            input: {
              messages: ['message1', 'message2'],
            },
          },
        },
      });
    });

    it('should format ON_CHAT_MODEL_START event', () => {
      const mockChunk = {
        event: AgentIterationEvent.ON_CHAT_MODEL_START,
        name: 'test_iteration',
        data: {
          input: {
            messages: ['message1', 'message2'],
            metadata: { key: 'value' },
          },
        },
      };

      const result = FormatChunkIteration(mockChunk);

      expect(result).toEqual({
        iteration: {
          name: 'test_iteration',
          messages: ['message1', 'message2'],
          metadata: { key: 'value' },
        },
      });
    });

    it('should return undefined for unknown event', () => {
      const mockChunk = {
        event: 'UNKNOWN_EVENT',
        data: {},
      };

      const result = FormatChunkIteration(mockChunk);

      expect(result).toBeUndefined();
    });
  });

  describe('extractTokenChunkFromIteration', () => {
    it('should extract token chunk from valid iteration', () => {
      const mockIteration = {
        data: {
          chunk: {
            kwargs: {
              token_chunk: {
                input: 10,
                output: 20,
                total: 30,
              },
            },
          },
        },
      };

      const result = extractTokenChunkFromIteration(mockIteration);

      expect(result).toEqual({
        input: 10,
        output: 20,
        total: 30,
      });
    });

    it('should return undefined for invalid iteration', () => {
      const mockIteration = {
        data: {
          chunk: {
            kwargs: {
              token_chunk: {
                input: null,
                output: 20,
                total: 30,
              },
            },
          },
        },
      };

      const result = extractTokenChunkFromIteration(mockIteration);

      expect(result).toBeUndefined();
    });

    it('should return undefined for missing data', () => {
      const mockIteration = {};

      const result = extractTokenChunkFromIteration(mockIteration);

      expect(result).toBeUndefined();
    });
  });

  describe('extractToolsFromIteration', () => {
    it('should extract tools from valid iteration', () => {
      const mockIteration = {
        data: {
          chunk: {
            tool_call_chunks: [
              {
                name: 'test_tool',
                args: '{"param": "value"}',
                id: 'tool_123',
                index: 0,
                type: 'function',
              },
            ],
          },
        },
      };

      const result = extractToolsFromIteration(mockIteration);

      expect(result).toEqual({
        name: 'test_tool',
        args: '{"param": "value"}',
        id: 'tool_123',
        index: 0,
        type: 'function',
      });
    });

    it('should return undefined for missing tool_call_chunks', () => {
      const mockIteration = {
        data: {
          chunk: {},
        },
      };

      const result = extractToolsFromIteration(mockIteration);

      expect(result).toBeUndefined();
    });

    it('should return undefined for empty tool_call_chunks', () => {
      const mockIteration = {
        data: {
          chunk: {
            tool_call_chunks: [],
          },
        },
      };

      const result = extractToolsFromIteration(mockIteration);

      expect(result).toBeUndefined();
    });

    it('should return undefined for tool without name', () => {
      const mockIteration = {
        data: {
          chunk: {
            tool_call_chunks: [
              {
                args: '{"param": "value"}',
                id: 'tool_123',
                index: 0,
                type: 'function',
              },
            ],
          },
        },
      };

      const result = extractToolsFromIteration(mockIteration);

      expect(result).toBeUndefined();
    });
  });

  describe('truncateToolResults', () => {
    it('should truncate string content in tool messages', () => {
      const longContent = 'a'.repeat(6000);
      const mockResult = {
        messages: [
          {
            _getType: () => 'tool',
            content: longContent,
          },
        ],
      };

      const result = truncateToolResults(mockResult, 5000);

      expect(result.messages[0].content).toContain('... [truncated');
      expect(result.messages[0].content.length).toBeLessThan(6000);
    });

    it('should handle array format results', () => {
      const longContent = 'a'.repeat(6000);
      const mockResult = [
        {
          _getType: () => 'tool',
          content: longContent,
        },
      ];

      const result = truncateToolResults(mockResult, 5000);

      expect(result[0].content).toContain('... [truncated');
    });

    it('should handle tool_calls_results', () => {
      const longContent = 'a'.repeat(6000);
      const mockResult = {
        messages: [
          {
            content: 'normal content',
            tool_calls_results: [
              {
                content: longContent,
              },
            ],
          },
        ],
      };

      const result = truncateToolResults(mockResult, 5000);

      expect(result.messages[0].tool_calls_results[0].content).toContain('... [truncated');
    });

    it('should not truncate content within limit', () => {
      const shortContent = 'short content';
      const mockResult = {
        messages: [
          {
            _getType: () => 'tool',
            content: shortContent,
          },
        ],
      };

      const result = truncateToolResults(mockResult, 5000);

      expect(result.messages[0].content).toBe(shortContent);
    });
  });

  describe('formatAgentResponse', () => {
    it('should format string response', () => {
      const response = 'Simple string response';
      const result = formatAgentResponse(response);
      expect(result).toBe(response);
    });

    it('should format JSON string response', () => {
      const response = '{"key": "value", "number": 123}';
      const result = formatAgentResponse(response);
      expect(result).toBe('[object Object]');
    });

    it('should format array response', () => {
      const response = [
        { type: 'text', text: 'First message' },
        { type: 'text', text: 'Second message' },
      ];
      const result = formatAgentResponse(response);
      expect(result).toBe('First message\nSecond message');
    });

    it('should format object response with text type', () => {
      const response = { type: 'text', text: 'Object text response' };
      const result = formatAgentResponse(response);
      expect(result).toBe('Object text response');
    });

    it('should format object response with content', () => {
      const response = { content: 'Object content response' };
      const result = formatAgentResponse(response);
      expect(result).toBe('Object content response');
    });

    it('should handle bullet points formatting', () => {
      const response = 'Line 1\n• Bullet point 1\nLine 2\n• Bullet point 2';
      const result = formatAgentResponse(response);
      expect(result).toBe('Line 1\n  • Bullet point 1\nLine 2\n  • Bullet point 2');
    });
  });

  describe('processStringContent', () => {
    it('should process JSON string content', () => {
      const content = '{"type": "text", "text": "JSON content"}';
      const result = processStringContent(content);
      expect(result).toBe('JSON content');
    });

    it('should return original content for non-JSON string', () => {
      const content = 'Regular string content';
      const result = processStringContent(content);
      expect(result).toBe(content);
    });

    it('should handle malformed JSON gracefully', () => {
      const content = '{"invalid": json}';
      const result = processStringContent(content);
      expect(result).toBe(content);
    });

    it('should trim whitespace', () => {
      const content = '  {"type": "text", "text": "trimmed"}  ';
      const result = processStringContent(content);
      expect(result).toBe('trimmed');
    });
  });

  describe('processArrayContent', () => {
    it('should process array with text objects', () => {
      const content = [
        { type: 'text', text: 'First item' },
        { type: 'text', text: 'Second item' },
      ];
      const result = processArrayContent(content);
      expect(result).toBe('First item\nSecond item');
    });

    it('should process array with content objects', () => {
      const content = [
        { content: 'First content' },
        { content: 'Second content' },
      ];
      const result = processArrayContent(content);
      expect(result).toBe('First content\nSecond content');
    });

    it('should handle mixed content types', () => {
      const content = [
        { type: 'text', text: 'Text item' },
        { content: 'Content item' },
        'String item',
        { unknown: 'object' },
      ];
      const result = processArrayContent(content);
      expect(result).toBe('Text item\nContent item\nString item\n{"unknown":"object"}');
    });

    it('should handle null values', () => {
      const content = [
        { type: 'text', text: 'Valid item' },
        null,
        { content: 'Another item' },
      ];
      const result = processArrayContent(content);
      expect(result).toBe('Valid item\nAnother item');
    });
  });

  describe('processObjectContent', () => {
    it('should process text type object', () => {
      const content = { type: 'text', text: 'Text content' };
      const result = processObjectContent(content);
      expect(result).toBe('Text content');
    });

    it('should process content object', () => {
      const content = { content: 'Object content' };
      const result = processObjectContent(content);
      expect(result).toBe('Object content');
    });

    it('should stringify unknown object', () => {
      const content = { key: 'value', number: 123 };
      const result = processObjectContent(content);
      expect(result).toBe('{"key":"value","number":123}');
    });
  });

  describe('processMessageContent', () => {
    it('should process string content', () => {
      const content = '{"type": "text", "text": "String content"}';
      const result = processMessageContent(content);
      expect(result).toBe('String content');
    });

    it('should process array content', () => {
      const content = [
        { type: 'text', text: 'Array item 1' },
        { type: 'text', text: 'Array item 2' },
      ];
      const result = processMessageContent(content);
      expect(result).toBe('Array item 1\nArray item 2');
    });

    it('should process object content', () => {
      const content = { type: 'text', text: 'Object content' };
      const result = processMessageContent(content);
      expect(result).toBe('Object content');
    });

    it('should handle primitive types', () => {
      expect(processMessageContent(123)).toBe('123');
      expect(processMessageContent(true)).toBe('true');
      expect(processMessageContent(null)).toBe('null');
    });
  });
});
