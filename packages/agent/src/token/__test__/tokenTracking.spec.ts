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

// Message factory functions
const makeMessage = (content = 'test', type = 'ai') => ({
  content,
  _getType: () => type,
});

const makeGeminiMessage = (
  inputTokens = 3,
  outputTokens = 2,
  totalTokens?: number
) => ({
  ...makeMessage(),
  usage_metadata: {
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    total_tokens: totalTokens ?? inputTokens + outputTokens,
  },
});

const makeOpenAIMessage = (
  promptTokens = 4,
  completionTokens = 1,
  totalTokens?: number
) => ({
  ...makeMessage(),
  response_metadata: {
    tokenUsage: {
      promptTokens,
      completionTokens,
      totalTokens: totalTokens ?? promptTokens + completionTokens,
    },
  },
});

const makeAnthropicMessage = (inputTokens = 7, outputTokens = 3) => ({
  ...makeMessage(),
  response_metadata: {
    usage: {
      input_tokens: inputTokens,
      output_tokens: outputTokens,
    },
  },
});

const makeLangChainResult = (
  promptTokens = 10,
  completionTokens = 5,
  totalTokens?: number
) => ({
  llmOutput: {
    tokenUsage: {
      promptTokens,
      completionTokens,
      totalTokens: totalTokens ?? promptTokens + completionTokens,
    },
  },
  generations: [],
});

const expectUsage = (
  usage: any,
  prompt: number,
  response: number,
  total?: number
) => {
  expect(usage).toEqual({
    promptTokens: prompt,
    responseTokens: response,
    totalTokens: total ?? prompt + response,
  });
};

describe('TokenTracker', () => {
  let mockLogger: any;

  beforeEach(() => {
    TokenTracker.resetSessionCounters();
    mockLogger = require('@snakagent/core').logger;
    jest.clearAllMocks();
  });

  describe('trackCall', () => {
    describe('provider token formats', () => {
      it.each([
        [
          'Gemini usage_metadata',
          makeGeminiMessage(3, 2, 5),
          'gemini',
          3,
          2,
          5,
        ],
        [
          'OpenAI response_metadata',
          makeOpenAIMessage(4, 1, 5),
          'openai',
          4,
          1,
          5,
        ],
        ['Anthropic usage', makeAnthropicMessage(7, 3), 'anthropic', 7, 3, 10],
      ])(
        'tracks tokens from %s',
        (
          _,
          message,
          model,
          expectedPrompt,
          expectedResponse,
          expectedTotal
        ) => {
          const usage = TokenTracker.trackCall(message, model);

          expectUsage(usage, expectedPrompt, expectedResponse, expectedTotal);
          expectUsage(
            TokenTracker.getSessionTokenUsage(),
            expectedPrompt,
            expectedResponse,
            expectedTotal
          );
        }
      );

      it('calculates total tokens when missing', () => {
        const message = makeGeminiMessage(5, 3, 0);
        const usage = TokenTracker.trackCall(message, 'gemini');

        expect(usage.totalTokens).toBe(8);
        expect(TokenTracker.getSessionTokenUsage().totalTokens).toBe(8);
      });
    });

    describe('array processing', () => {
      it('finds AIMessage in mixed array', () => {
        const messages = [
          makeMessage('user message', 'human'),
          makeGeminiMessage(2, 1, 3),
        ];
        const usage = TokenTracker.trackCall(messages, 'test-model');

        expectUsage(usage, 2, 1, 3);
      });

      it('uses last AIMessage when multiple exist', () => {
        const messages = [
          makeGeminiMessage(1, 1, 2),
          makeGeminiMessage(3, 2, 5),
        ];
        const usage = TokenTracker.trackCall(messages, 'test-model');

        expectUsage(usage, 3, 2, 5);
      });

      it('handles empty array with fallback', () => {
        const usage = TokenTracker.trackCall([], 'test-model');

        expectUsage(usage, 0, 0, 0);
        expect(mockLogger.warn).toHaveBeenCalledWith(
          'No token usage information available for model [test-model], using fallback estimation.'
        );
      });
    });

    describe('edge cases and errors', () => {
      it.each([
        ['null', null],
        ['undefined', undefined],
      ])('returns zero tokens for %s result', (_, input) => {
        const usage = TokenTracker.trackCall(input, 'test-model');

        expectUsage(usage, 0, 0, 0);
        expect(mockLogger.warn).toHaveBeenCalledWith(
          'trackCall received null or undefined result for model [test-model]. Returning zero tokens.'
        );
      });

      it.each([
        ['non-AI message', makeMessage('test', 'human')],
        ['string result', 'simple string response'],
        ['complex object', { nested: { content: 'complex response' } }],
      ])('uses fallback estimation for %s', (_, input) => {
        const usage = TokenTracker.trackCall(input, 'test-model');

        expect(usage.promptTokens).toBe(0);
        expect(usage.responseTokens).toBeGreaterThan(0);
        expect(mockLogger.warn).toHaveBeenCalledWith(
          'No token usage information available for model [test-model], using fallback estimation.'
        );
      });
    });

    it('handles JSON content in fallback', () => {
      const message = { ...makeMessage(), content: { text: 'JSON content' } };
      const usage = TokenTracker.trackCall(message, 'test-model');

      expect(usage.responseTokens).toBeGreaterThan(0);
      expect(usage.totalTokens).toBe(usage.responseTokens);
    });
  });

  describe('trackFullUsage', () => {
    describe('llmOutput priority', () => {
      it('uses explicit token data from llmOutput', () => {
        const resultObj = makeLangChainResult(10, 5, 15);
        const usage = TokenTracker.trackFullUsage(
          'test prompt',
          resultObj,
          'test-model'
        );

        expectUsage(usage, 10, 5, 15);
        expect(mockLogger.debug).toHaveBeenCalledWith(
          'Token usage for model [test-model]: Prompt tokens: 10, Response tokens: 5, Total tokens: 15'
        );
      });

      it('calculates missing total tokens', () => {
        const resultObj = makeLangChainResult(8, 4, 0);
        const usage = TokenTracker.trackFullUsage(
          'test prompt',
          resultObj,
          'test-model'
        );

        expect(usage.totalTokens).toBe(12);
      });
    });

    describe('generation processing', () => {
      it('uses message metadata from generations', () => {
        const resultObj = {
          generations: [[{ message: makeGeminiMessage(3, 2, 5) }]],
        };
        const usage = TokenTracker.trackFullUsage(
          'test prompt',
          resultObj,
          'test-model'
        );

        expectUsage(usage, 3, 2, 5);
      });

      it('estimates prompt tokens when only response available', () => {
        const resultObj = {
          generations: [[{ message: makeGeminiMessage(0, 3, 3) }]],
        };
        const usage = TokenTracker.trackFullUsage(
          'This is a test prompt',
          resultObj,
          'test-model'
        );

        expect(usage.promptTokens).toBeGreaterThan(0);
        expect(usage.responseTokens).toBe(3);
        expect(usage.totalTokens).toBe(usage.promptTokens + 3);
      });

      it('uses fallback estimation for text extraction', () => {
        const resultObj = {
          generations: [[{ text: 'extracted text response' }]],
        };
        const usage = TokenTracker.trackFullUsage(
          'test prompt',
          resultObj,
          'test-model'
        );

        expect(usage.promptTokens).toBeGreaterThan(0);
        expect(usage.responseTokens).toBeGreaterThan(0);
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining('[FALLBACK ESTIMATE - FULL]')
        );
      });

      it('uses fallback estimation for complex object', () => {
        const resultObj = {
          some: 'complex object',
          without: 'expected structure',
        };
        const usage = TokenTracker.trackFullUsage(
          'test prompt',
          resultObj,
          'test-model'
        );

        expect(usage.promptTokens).toBeGreaterThan(0);
        expect(usage.responseTokens).toBeGreaterThan(0);
      });
    });
  });

  describe('session management', () => {
    it('accumulates tokens across multiple calls', () => {
      TokenTracker.trackCall(makeGeminiMessage(2, 1, 3), 'model1');
      TokenTracker.trackCall(makeGeminiMessage(3, 2, 5), 'model2');

      expectUsage(TokenTracker.getSessionTokenUsage(), 5, 3, 8);
    });

    it('resets session counters', () => {
      TokenTracker.trackCall(makeGeminiMessage(1, 1, 2), 'test-model');
      expect(TokenTracker.getSessionTokenUsage().totalTokens).toBe(2);

      TokenTracker.resetSessionCounters();
      expectUsage(TokenTracker.getSessionTokenUsage(), 0, 0, 0);
    });
  });

  describe('token estimation', () => {
    it.each([
      ['simple text', 'Hello world', true],
      ['empty text', '', false],
      ['special characters', 'Hello! How are you? This is a test...', true],
    ])('estimates tokens from %s', (_, text, expectTokens) => {
      const message = makeMessage(text);
      const usage = TokenTracker.trackCall(message, 'test-model');

      if (expectTokens) {
        expect(usage.responseTokens).toBeGreaterThan(0);
      } else {
        expect(usage.responseTokens).toBe(0);
      }
    });
  });

  describe('logging', () => {
    it('logs debug for successful tracking', () => {
      TokenTracker.trackCall(makeGeminiMessage(1, 1, 2), 'test-model');

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Token usage for model [test-model]: Prompt tokens: 1, Response tokens: 1, Total tokens: 2'
      );
    });

    it.each([
      [
        'fallback estimation',
        makeMessage('test without metadata'),
        'No token usage information available for model [test-model], using fallback estimation.',
      ],
      [
        'null result',
        null,
        'trackCall received null or undefined result for model [test-model]. Returning zero tokens.',
      ],
    ])('logs warning for %s', (_, input, expectedMessage) => {
      TokenTracker.trackCall(input, 'test-model');

      expect(mockLogger.warn).toHaveBeenCalledWith(expectedMessage);
    });
  });
});
