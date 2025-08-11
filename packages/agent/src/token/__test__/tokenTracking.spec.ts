import { TokenTracker } from '../tokenTracking.js';

// Mock the logger before importing the module
jest.mock(
  '@snakagent/core',
  () => ({
    logger: {
      warn: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
    },
  }),
  { virtual: true }
);

// Define interfaces for different message structures
interface BaseMessage {
  content: string;
  _getType: () => string;
}

interface GeminiMessage extends BaseMessage {
  usage_metadata: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
  };
}

interface OpenAIMessage extends BaseMessage {
  response_metadata: {
    tokenUsage: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
  };
}

interface AnthropicMessage extends BaseMessage {
  response_metadata: {
    usage: {
      input_tokens: number;
      output_tokens: number;
    };
  };
}

interface LangChainResult {
  llmOutput: {
    tokenUsage: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
  };
  generations: Array<Array<{ message: BaseMessage; text?: string }>>;
}

describe('TokenTracker', () => {
  let mockLogger: any;

  beforeEach(() => {
    TokenTracker.resetSessionCounters();
    // Get the mocked logger instance
    mockLogger = require('@snakagent/core').logger;
    jest.clearAllMocks();
  });

  describe('trackCall', () => {
    describe('with valid token metadata', () => {
      it('tracks tokens from standard usage_metadata (Gemini)', () => {
        const message: GeminiMessage = {
          content: 'hello world',
          _getType: () => 'ai',
          usage_metadata: { input_tokens: 3, output_tokens: 2, total_tokens: 5 },
        };

        const usage = TokenTracker.trackCall(message, 'gemini');
        
        expect(usage).toEqual({ promptTokens: 3, responseTokens: 2, totalTokens: 5 });
        expect(TokenTracker.getSessionTokenUsage()).toEqual({ promptTokens: 3, responseTokens: 2, totalTokens: 5 });
        expect(mockLogger.debug).toHaveBeenCalledWith(
          'Token usage for model [gemini]: Prompt tokens: 3, Response tokens: 2, Total tokens: 5'
        );
      });

      it('tracks tokens from OpenAI response metadata', () => {
        const message: OpenAIMessage = {
          content: 'openai response',
          _getType: () => 'ai',
          response_metadata: {
            tokenUsage: { promptTokens: 4, completionTokens: 1, totalTokens: 5 },
          },
        };

        const usage = TokenTracker.trackCall(message, 'openai');
        
        expect(usage).toEqual({ promptTokens: 4, responseTokens: 1, totalTokens: 5 });
        expect(TokenTracker.getSessionTokenUsage()).toEqual({ promptTokens: 4, responseTokens: 1, totalTokens: 5 });
      });

      it('tracks tokens from Anthropic usage', () => {
        const message: AnthropicMessage = {
          content: 'anthropic response',
          _getType: () => 'ai',
          response_metadata: { usage: { input_tokens: 7, output_tokens: 3 } },
        };

        const usage = TokenTracker.trackCall(message, 'anthropic');
        
        expect(usage).toEqual({ promptTokens: 7, responseTokens: 3, totalTokens: 10 });
        expect(TokenTracker.getSessionTokenUsage()).toEqual({ promptTokens: 7, responseTokens: 3, totalTokens: 10 });
      });

      it('handles missing total_tokens by calculating from input + output', () => {
        const message: GeminiMessage = {
          content: 'test content',
          _getType: () => 'ai',
          usage_metadata: { input_tokens: 5, output_tokens: 3, total_tokens: 0 },
        };

        const usage = TokenTracker.trackCall(message, 'gemini');
        
        expect(usage.totalTokens).toBe(8);
        expect(TokenTracker.getSessionTokenUsage().totalTokens).toBe(8);
      });
    });

    describe('with array results', () => {
      it('finds and processes AIMessage in array', () => {
        const messages = [
          { content: 'user message', _getType: () => 'human' },
          { content: 'ai response', _getType: () => 'ai', usage_metadata: { input_tokens: 2, output_tokens: 1, total_tokens: 3 } },
        ];

        const usage = TokenTracker.trackCall(messages, 'test-model');
        
        expect(usage).toEqual({ promptTokens: 2, responseTokens: 1, totalTokens: 3 });
      });

      it('processes last AIMessage in array when multiple exist', () => {
        const messages = [
          { content: 'first ai', _getType: () => 'ai', usage_metadata: { input_tokens: 1, output_tokens: 1, total_tokens: 2 } },
          { content: 'second ai', _getType: () => 'ai', usage_metadata: { input_tokens: 3, output_tokens: 2, total_tokens: 5 } },
        ];

        const usage = TokenTracker.trackCall(messages, 'test-model');
        
        expect(usage).toEqual({ promptTokens: 3, responseTokens: 2, totalTokens: 5 });
      });

      it('handles empty array gracefully', () => {
        const usage = TokenTracker.trackCall([], 'test-model');
        
        expect(usage).toEqual({ promptTokens: 0, responseTokens: 0, totalTokens: 0 });
        expect(mockLogger.warn).toHaveBeenCalledWith(
          'No token usage information available for model [test-model], using fallback estimation.'
        );
      });
    });

    describe('with invalid or edge cases', () => {
      it('handles null result gracefully', () => {
        const usage = TokenTracker.trackCall(null, 'test-model');
        
        expect(usage).toEqual({ promptTokens: 0, responseTokens: 0, totalTokens: 0 });
        expect(mockLogger.warn).toHaveBeenCalledWith(
          'trackCall received null or undefined result for model [test-model]. Returning zero tokens.'
        );
      });

      it('handles undefined result gracefully', () => {
        const usage = TokenTracker.trackCall(undefined, 'test-model');
        
        expect(usage).toEqual({ promptTokens: 0, responseTokens: 0, totalTokens: 0 });
        expect(mockLogger.warn).toHaveBeenCalledWith(
          'trackCall received null or undefined result for model [test-model]. Returning zero tokens.'
        );
      });

      it('handles non-AIMessage objects gracefully', () => {
        const invalidMessage = { content: 'test', _getType: () => 'human' };
        
        const usage = TokenTracker.trackCall(invalidMessage, 'test-model');
        
        expect(usage.promptTokens).toBe(0);
        expect(usage.responseTokens).toBeGreaterThan(0); // Should estimate from content
        expect(mockLogger.warn).toHaveBeenCalledWith(
          'No token usage information available for model [test-model], using fallback estimation.'
        );
      });

      it('handles string results', () => {
        const usage = TokenTracker.trackCall('simple string response', 'test-model');
        
        expect(usage.promptTokens).toBe(0);
        expect(usage.responseTokens).toBeGreaterThan(0);
        expect(mockLogger.warn).toHaveBeenCalledWith(
          'No token usage information available for model [test-model], using fallback estimation.'
        );
      });

      it('handles complex nested objects', () => {
        const complexObject = {
          nested: {
            content: { text: 'complex response', metadata: { type: 'ai' } },
            other: 'data'
          }
        };
        
        const usage = TokenTracker.trackCall(complexObject, 'test-model');
        
        expect(usage.promptTokens).toBe(0);
        expect(usage.responseTokens).toBeGreaterThan(0);
      });
    });

    describe('fallback estimation', () => {
      it('estimates tokens when no metadata is available', () => {
        const message = { content: 'This is a test response with multiple words.', _getType: () => 'ai' };
        
        const usage = TokenTracker.trackCall(message, 'test-model');
        
        expect(usage.promptTokens).toBe(0);
        expect(usage.responseTokens).toBeGreaterThan(0);
        expect(usage.totalTokens).toBe(usage.responseTokens);
        expect(mockLogger.warn).toHaveBeenCalledWith(
          'No token usage information available for model [test-model], using fallback estimation.'
        );
      });

      it('handles content as JSON string', () => {
        const message = { content: { text: 'JSON content', type: 'response' }, _getType: () => 'ai' };
        
        const usage = TokenTracker.trackCall(message, 'test-model');
        
        expect(usage.responseTokens).toBeGreaterThan(0);
      });
    });
  });

  describe('trackFullUsage', () => {
    it('prioritizes explicit token usage data from llmOutput', () => {
      const resultObj: LangChainResult = {
        llmOutput: {
          tokenUsage: {
            promptTokens: 10,
            completionTokens: 5,
            totalTokens: 15
          }
        },
        generations: []
      };

      const usage = TokenTracker.trackFullUsage('test prompt', resultObj, 'test-model');
      
      expect(usage).toEqual({ promptTokens: 10, responseTokens: 5, totalTokens: 15 });
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Token usage for model [test-model]: Prompt tokens: 10, Response tokens: 5, Total tokens: 15'
      );
    });

    it('handles missing totalTokens by calculating from prompt + completion', () => {
      const resultObj: LangChainResult = {
        llmOutput: {
          tokenUsage: {
            promptTokens: 8,
            completionTokens: 4,
            totalTokens: 0
          }
        },
        generations: []
      };

      const usage = TokenTracker.trackFullUsage('test prompt', resultObj, 'test-model');
      
      expect(usage.totalTokens).toBe(12);
    });

    it('processes AIMessage from generations when llmOutput is not available', () => {
      const resultObj = {
        generations: [[
          {
            message: {
              content: 'ai response',
              _getType: () => 'ai',
              usage_metadata: { input_tokens: 3, output_tokens: 2, total_tokens: 5 }
            }
          }
        ]]
      };

      const usage = TokenTracker.trackFullUsage('test prompt', resultObj, 'test-model');
      
      expect(usage).toEqual({ promptTokens: 3, responseTokens: 2, totalTokens: 5 });
    });

    it('estimates prompt tokens when only response metadata is available', () => {
      const resultObj = {
        generations: [[
          {
            message: {
              content: 'ai response',
              _getType: () => 'ai',
              usage_metadata: { input_tokens: 0, output_tokens: 3, total_tokens: 3 }
            }
          }
        ]]
      };

      const usage = TokenTracker.trackFullUsage('This is a test prompt', resultObj, 'test-model');
      
      expect(usage.promptTokens).toBeGreaterThan(0);
      expect(usage.responseTokens).toBe(3);
      expect(usage.totalTokens).toBe(usage.promptTokens + 3);
    });

    it('falls back to text extraction from generations', () => {
      const resultObj = {
        generations: [[
          {
            text: 'extracted text response'
          }
        ]]
      };

      const usage = TokenTracker.trackFullUsage('test prompt', resultObj, 'test-model');
      
      expect(usage.promptTokens).toBeGreaterThan(0);
      expect(usage.responseTokens).toBeGreaterThan(0);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('[FALLBACK ESTIMATE - FULL]')
      );
    });

    it('handles complex fallback scenarios', () => {
      const resultObj = { some: 'complex object', without: 'expected structure' };
      
      const usage = TokenTracker.trackFullUsage('test prompt', resultObj, 'test-model');
      
      expect(usage.promptTokens).toBeGreaterThan(0);
      expect(usage.responseTokens).toBeGreaterThan(0);
    });
  });

  describe('session management', () => {
    it('accumulates tokens across multiple calls', () => {
      const message1: GeminiMessage = {
        content: 'first call',
        _getType: () => 'ai',
        usage_metadata: { input_tokens: 2, output_tokens: 1, total_tokens: 3 }
      };

      const message2: GeminiMessage = {
        content: 'second call',
        _getType: () => 'ai',
        usage_metadata: { input_tokens: 3, output_tokens: 2, total_tokens: 5 }
      };

      TokenTracker.trackCall(message1, 'model1');
      TokenTracker.trackCall(message2, 'model2');

      const sessionUsage = TokenTracker.getSessionTokenUsage();
      expect(sessionUsage.promptTokens).toBe(5);
      expect(sessionUsage.responseTokens).toBe(3);
      expect(sessionUsage.totalTokens).toBe(8);
    });

    it('resets session counters correctly', () => {
      const message: GeminiMessage = {
        content: 'test',
        _getType: () => 'ai',
        usage_metadata: { input_tokens: 1, output_tokens: 1, total_tokens: 2 }
      };

      TokenTracker.trackCall(message, 'test-model');
      expect(TokenTracker.getSessionTokenUsage().totalTokens).toBe(2);

      TokenTracker.resetSessionCounters();
      expect(TokenTracker.getSessionTokenUsage()).toEqual({ promptTokens: 0, responseTokens: 0, totalTokens: 0 });
    });
  });

  describe('token estimation', () => {
    it('estimates tokens from simple text', () => {
      const text = 'Hello world';
      // This tests the private method indirectly through trackCall
      const message = { content: text, _getType: () => 'ai' };
      
      const usage = TokenTracker.trackCall(message, 'test-model');
      
      expect(usage.responseTokens).toBeGreaterThan(0);
    });

    it('handles empty text gracefully', () => {
      const message = { content: '', _getType: () => 'ai' };
      
      const usage = TokenTracker.trackCall(message, 'test-model');
      
      expect(usage.responseTokens).toBe(0);
    });

    it('handles text with special characters', () => {
      const text = 'Hello! How are you? This is a test...';
      const message = { content: text, _getType: () => 'ai' };
      
      const usage = TokenTracker.trackCall(message, 'test-model');
      
      expect(usage.responseTokens).toBeGreaterThan(0);
    });
  });

  describe('logging behavior', () => {
    it('logs debug messages for successful token tracking', () => {
      const message: GeminiMessage = {
        content: 'test',
        _getType: () => 'ai',
        usage_metadata: { input_tokens: 1, output_tokens: 1, total_tokens: 2 }
      };

      TokenTracker.trackCall(message, 'test-model');
      
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Token usage for model [test-model]: Prompt tokens: 1, Response tokens: 1, Total tokens: 2'
      );
    });

    it('logs warning for fallback estimation', () => {
      const message = { content: 'test without metadata', _getType: () => 'ai' };
      
      TokenTracker.trackCall(message, 'test-model');
      
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'No token usage information available for model [test-model], using fallback estimation.'
      );
    });

    it('logs warning for null/undefined results', () => {
      TokenTracker.trackCall(null, 'test-model');
      
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'trackCall received null or undefined result for model [test-model]. Returning zero tokens.'
      );
    });
  });
});