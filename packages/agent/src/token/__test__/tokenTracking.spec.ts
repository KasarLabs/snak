import { TokenTracker } from '../tokenTracking.js';

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

describe('TokenTracker.trackCall', () => {
  beforeEach(() => {
    TokenTracker.resetSessionCounters();
  });

  it('tracks tokens from standard usage_metadata (Gemini)', () => {
    const message: GeminiMessage = {
      content: 'hello world',
      _getType: () => 'ai',
      usage_metadata: { input_tokens: 3, output_tokens: 2, total_tokens: 5 },
    };

    const usage = TokenTracker.trackCall(message, 'gemini');
    expect(usage).toEqual({ promptTokens: 3, responseTokens: 2, totalTokens: 5 });
    expect(TokenTracker.getSessionTokenUsage()).toEqual({ promptTokens: 3, responseTokens: 2, totalTokens: 5 });
  });

  it('tracks tokens from OpenAI response metadata', () => {
    const message: OpenAIMessage = {
      content: 'openai',
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
      content: 'anthropic',
      _getType: () => 'ai',
      response_metadata: { usage: { input_tokens: 7, output_tokens: 3 } },
    };

    const usage = TokenTracker.trackCall(message, 'anthropic');
    expect(usage).toEqual({ promptTokens: 7, responseTokens: 3, totalTokens: 10 });
    expect(TokenTracker.getSessionTokenUsage()).toEqual({ promptTokens: 7, responseTokens: 3, totalTokens: 10 });
  });
});