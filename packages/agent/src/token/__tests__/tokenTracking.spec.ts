import { TokenTracker } from '../tokenTracking.js';
import { logger as coreLogger } from '@snakagent/core';

type TokenUsage = {
	promptTokens: number;
	responseTokens: number;
	totalTokens: number;
};

jest.mock(
	'@snakagent/core',
	() => ({
		logger: {
			warn: jest.fn(),
			debug: jest.fn(),
		},
	}),
	{ virtual: true }
);

// Fixtures / helpers (local only)
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
		total_tokens: totalTokens ?? (inputTokens + outputTokens),
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
			totalTokens: totalTokens ?? (promptTokens + completionTokens),
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
			totalTokens: totalTokens ?? (promptTokens + completionTokens),
		},
	},
	generations: [],
});

const expectUsage = (
	usage: TokenUsage,
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
	let mockLogger: jest.Mocked<typeof coreLogger>;

	beforeEach(() => {
		TokenTracker.resetSessionCounters();
		mockLogger = jest.mocked(coreLogger);
	});

	afterEach(() => {
		jest.restoreAllMocks();
		jest.clearAllMocks();
	});

	describe('trackCall', () => {
		describe('provider token formats', () => {
			it.each([
				['Gemini usage_metadata', makeGeminiMessage(3, 2, 5), 'gemini', 3, 2, 5],
				['OpenAI response_metadata', makeOpenAIMessage(4, 1, 5), 'openai', 4, 1, 5],
				['Anthropic usage', makeAnthropicMessage(7, 3), 'anthropic', 7, 3, 10],
			])('tracks tokens from %s', (_, message, model, p, r, t) => {
				const usage = TokenTracker.trackCall(message, model);
				expectUsage(usage, p, r, t);
				expectUsage(TokenTracker.getSessionTokenUsage(), p, r, t);
			});

			it('calculates total tokens when 0', () => {
				const usage = TokenTracker.trackCall(makeGeminiMessage(5, 3, 0), 'gemini');
				expect(usage.totalTokens).toBe(8);
				expect(TokenTracker.getSessionTokenUsage().totalTokens).toBe(8);
			});

			it('calculates total tokens when undefined', () => {
				const usage = TokenTracker.trackCall(makeGeminiMessage(5, 3, undefined as any), 'gemini');
				expect(usage.totalTokens).toBe(8);
				expect(TokenTracker.getSessionTokenUsage().totalTokens).toBe(8);
			});
		});

		describe('array processing', () => {
			it.each([
				[
					'mixed array returns AI message usage',
					[makeMessage('user message', 'human'), makeGeminiMessage(2, 1, 3)],
					2,
					1,
					3,
				],
				[
					'last AIMessage wins',
					[makeGeminiMessage(1, 1, 2), makeGeminiMessage(3, 2, 5)],
					3,
					2,
					5,
				],
			])('%s', (_, messages, p, r, t) => {
				const usage = TokenTracker.trackCall(messages, 'test-model');
				expectUsage(usage, p, r, t);
			});

			it('handles empty array with fallback', () => {
				const usage = TokenTracker.trackCall([], 'test-model');
				expectUsage(usage, 0, 0, 0);
				expect(mockLogger.warn).toHaveBeenCalledWith(
					'No token usage information available for model [test-model], using fallback estimation.'
				);
			});
		});

		describe('edge cases and fallback', () => {
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

			it('handles JSON content in fallback', () => {
				const message = { ...makeMessage(), content: { text: 'JSON content' } };
				const usage = TokenTracker.trackCall(message, 'test-model');
				expect(usage.responseTokens).toBeGreaterThan(0);
				expect(usage.totalTokens).toBe(usage.responseTokens);
			});
		});
	});

	describe('trackFullUsage', () => {
		describe('llmOutput priority', () => {
			it.each([
				['uses explicit tokens', makeLangChainResult(10, 5, 15), 10, 5, 15],
				['computes missing total', makeLangChainResult(8, 4, 0), 8, 4, 12],
			])('%s', (_, resultObj, p, r, t) => {
				const usage = TokenTracker.trackFullUsage('test prompt', resultObj, 'test-model');
				expectUsage(usage, p, r, t);
			});
		});

		describe('generation processing and fallbacks', () => {
			it('uses message metadata from generations', () => {
				const resultObj = { generations: [[{ message: makeGeminiMessage(3, 2, 5) }]] };
				const usage = TokenTracker.trackFullUsage('test prompt', resultObj, 'test-model');
				expectUsage(usage, 3, 2, 5);
			});

			it('estimates prompt tokens when only response available', () => {
				const resultObj = { generations: [[{ message: makeGeminiMessage(0, 3, 3) }]] };
				const usage = TokenTracker.trackFullUsage('This is a test prompt', resultObj, 'test-model');
				expect(usage.promptTokens).toBeGreaterThan(0);
				expect(usage.responseTokens).toBe(3);
				expect(usage.totalTokens).toBe(usage.promptTokens + 3);
			});

			it('estimates prompt tokens when message has no token metadata', () => {
				const resultObj = { generations: [[{ message: { content: 'response content', _getType: () => 'ai' } }]] };
				const usage = TokenTracker.trackFullUsage('test prompt for estimation', resultObj, 'test-model');
				expect(usage.promptTokens).toBeGreaterThan(0);
				expect(usage.responseTokens).toBeGreaterThan(0);
				expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('[ESTIMATED PROMPT]'));
			});

			it.each([
				['generations text', { generations: [[{ text: 'extracted text response' }]] }],
				['object content', { content: { text: 'Object content', metadata: { type: 'response' } } }],
				['unknown structure', { someOtherProperty: 'value', generations: [[{ someOtherField: 'value' }]] }],
			])('uses fallback estimation for %s', (_, resultObj) => {
				const usage = TokenTracker.trackFullUsage('test prompt', resultObj, 'test-model');
				expect(usage.promptTokens).toBeGreaterThan(0);
				expect(usage.responseTokens).toBeGreaterThan(0);
				expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('[FALLBACK ESTIMATE - FULL]'));
			});

			it('handles non-string promptText', () => {
				const promptText = { text: 'Object prompt', metadata: { type: 'input' } };
				const usage = TokenTracker.trackFullUsage(promptText, { content: 'Response content' }, 'test-model');
				expect(usage.promptTokens).toBeGreaterThan(0);
				expect(usage.responseTokens).toBeGreaterThan(0);
				expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('[FALLBACK ESTIMATE - FULL]'));
			});
		});
	});

	describe('session management', () => {
		it('accumulates tokens across multiple calls', () => {
			TokenTracker.trackCall(makeGeminiMessage(2, 1, 3), 'model1');
			TokenTracker.trackCall(makeGeminiMessage(3, 2, 5), 'model2');
			expectUsage(TokenTracker.getSessionTokenUsage(), 5, 3, 8);
		});

		it('accumulates tokens when mixing trackCall and trackFullUsage', () => {
			// Reset session counters at the start
			TokenTracker.resetSessionCounters();
			
			// Call trackCall with a Gemini message
			TokenTracker.trackCall(makeGeminiMessage(5, 3, 8), 'modelA');
			
			// Call trackFullUsage with explicit token counts using LangChain result structure
			TokenTracker.trackFullUsage('test prompt', makeLangChainResult(7, 5, 12), 'modelB');
			
			// Assert session token usage reflects the summed totals
			const sessionUsage = TokenTracker.getSessionTokenUsage();
			expect(sessionUsage.totalTokens).toBe(20); // 8 + 12
			expect(sessionUsage.promptTokens).toBe(12); // 5 + 7
			expect(sessionUsage.responseTokens).toBe(8); // 3 + 5
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
			['only whitespace', '   \n\t\r  ', false],
			['special characters', '!!!@@@###$$$%%%^^^&&&***()()()[]{}|\\:;"\'<>,.?/~`', true],
		])('estimates tokens from %s', (_, text, expectTokens) => {
			const usage = TokenTracker.trackCall(makeMessage(text), 'test-model');
			if (expectTokens) {
				expect(usage.responseTokens).toBeGreaterThan(0);
			} else {
				expect(usage.responseTokens).toBeGreaterThanOrEqual(0);
			}
		});

		it('estimates tokens from text with mixed content', () => {
			const text = 'Hello! How are you? This is a test... with special chars: @#$%^&*()';
			const usage = TokenTracker.trackCall(makeMessage(text), 'test-model');
			const wordCount = text.split(/\s+/).filter(Boolean).length;
			expect(usage.responseTokens).toBeGreaterThanOrEqual(wordCount);
		});

		it('handles object content in array messages', () => {
			const messages = [
				{ content: { text: 'Hello world', metadata: { type: 'greeting' } } },
				{ content: 'Simple string content' },
			];
			const usage = TokenTracker.trackCall(messages, 'test-model');
			expect(usage.responseTokens).toBeGreaterThan(0);
			expect(mockLogger.warn).toHaveBeenCalledWith(
				'No token usage information available for model [test-model], using fallback estimation.'
			);
		});
	});

	describe('logging', () => {
		it('logs debug for successful tracking', () => {
			TokenTracker.trackCall(makeGeminiMessage(1, 1, 2), 'test-model');
			expect(mockLogger.debug).toHaveBeenCalledWith(
				expect.stringContaining('Token usage for model [test-model]')
			);
		});

		it.each([
			[
				'fallback estimation',
				{ ...makeMessage('test without metadata') },
				'No token usage information available for model [test-model], using fallback estimation.',
			],
			[
				'null result',
				null,
				'trackCall received null or undefined result for model [test-model]. Returning zero tokens.',
			],
		])('logs warning for %s', (_, input, expectedMessage) => {
			TokenTracker.trackCall(input as unknown, 'test-model');
			expect(mockLogger.warn).toHaveBeenCalledWith(expectedMessage);
		});
	});

	describe('pass-through (no mutation)', () => {
		it('does not mutate nested objects/arrays provided as inputs', () => {
			const prompt = { a: 1, b: ['x', { y: 2 }] };
			const resultObj: Record<string, unknown> = { content: { nested: { z: 3 } }, extra: [{ k: 1 }] };
			const promptClone = JSON.parse(JSON.stringify(prompt));
			const resultClone = JSON.parse(JSON.stringify(resultObj));
			TokenTracker.trackFullUsage(prompt, resultObj, 'test-model');
			expect(prompt).toEqual(promptClone);
			expect(resultObj).toEqual(resultClone);
		});
	});
});
