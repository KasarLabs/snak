import { logger } from '@snakagent/core';
import {
  AIMessage,
  AIMessageChunk,
  BaseMessage,
  HumanMessage,
  ToolMessage,
} from '@langchain/core/messages';
import {
  Agent,
  ParsedPlan,
  ValidatorStepResponse,
  StepInfo,
} from '../types/index.js';
import {
  formatParsedPlanSimple,
  formatStepsStatusCompact,
  createMaxIterationsResponse,
  getLatestMessageForMessage,
  filterMessagesByShortTermMemory,
  isTerminalMessage,
  isTokenLimitError,
  handleModelError,
} from '../utils.js';

// -----------------------
// Mocks
// -----------------------
jest.mock('@snakagent/core', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// -----------------------
// Test Data & Factories
// -----------------------
const makeStep = (overrides: Partial<StepInfo> = {}): StepInfo => ({
  stepNumber: 1,
  stepName: 'Test Step',
  description: 'Test description',
  type: 'tools',
  status: 'completed',
  result: 'Success',
  ...overrides,
});

const makeParsedPlan = (overrides: Partial<ParsedPlan> = {}): ParsedPlan => ({
  summary: 'Test plan',
  steps: [
    makeStep({ stepNumber: 1, status: 'completed' }),
    makeStep({ stepNumber: 2, status: 'pending' }),
    makeStep({ stepNumber: 3, status: 'failed' }),
  ],
  ...overrides,
});

const makeValidatorResponse = (
  overrides: Partial<ValidatorStepResponse> = {}
): ValidatorStepResponse => ({
  steps: [
    { number: 1, validated: true },
    { number: 2, validated: false },
    { number: 3, validated: true },
  ],
  nextSteps: 4,
  isFinal: false,
  ...overrides,
});

const makeMessage = (
  type: 'human' | 'ai' | 'tool',
  content: string,
  overrides: any = {}
) => {
  switch (type) {
    case 'human':
      return new HumanMessage(content);
    case 'ai':
      const msg = new AIMessageChunk(content);
      if (overrides.from) msg.additional_kwargs = { from: overrides.from };
      if (overrides.final)
        msg.additional_kwargs = {
          ...msg.additional_kwargs,
          final: overrides.final,
        };
      return msg;
    case 'tool':
      return new ToolMessage(content, 'tool1');
    default:
      return new HumanMessage(content);
  }
};

const mockMessages: BaseMessage[] = [
  makeMessage('human', 'Hello'),
  makeMessage('ai', 'Hi there'),
  makeMessage('tool', 'Tool result'),
  makeMessage('ai', 'Response'),
];

// -----------------------
// Tests
// -----------------------
describe('Utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('formatParsedPlanSimple', () => {
    it('should format a parsed plan with all status types', () => {
      const result = formatParsedPlanSimple(makeParsedPlan());

      expect(result).toContain('Plan Summary: Test plan');
      expect(result).toContain('Steps (3 total):');
      expect(result).toContain('✓ 1. Test Step - Test description');
      expect(result).toContain('○ 2. Test Step - Test description');
      expect(result).toContain('✗ 3. Test Step - Test description');
    });

    it('should handle empty plan', () => {
      const result = formatParsedPlanSimple({
        summary: 'Empty plan',
        steps: [],
      });

      expect(result).toContain('Plan Summary: Empty plan');
      expect(result).toContain('Steps (0 total):');
    });
  });

  describe('formatStepsStatusCompact', () => {
    it.each([
      {
        name: 'progress status',
        response: makeValidatorResponse(),
        expected: 'Progress: [1,3] Step 4',
      },
      {
        name: 'final status',
        response: makeValidatorResponse({ isFinal: true, nextSteps: 0 }),
        expected: 'Complete (2/3)',
      },
      {
        name: 'empty steps',
        response: { steps: [], nextSteps: 0, isFinal: true },
        expected: 'Complete (0/0)',
      },
    ])('should format $name correctly', ({ response, expected }) => {
      const result = formatStepsStatusCompact(response);
      expect(result).toBe(expected);
    });
  });

  describe('createMaxIterationsResponse', () => {
    it('should create max iterations response with correct structure', () => {
      const graphStep = 10;
      const result = createMaxIterationsResponse(graphStep);

      expect(result.messages).toBeInstanceOf(AIMessageChunk);
      expect(result.last_message).toBeInstanceOf(AIMessageChunk);
      expect(result.last_agent).toBe(Agent.EXECUTOR);

      const message = result.messages as AIMessageChunk;
      expect(message.content).toBe(
        'Reaching maximum iterations for interactive agent. Ending workflow.'
      );
      expect(message.additional_kwargs.final).toBe(true);
      expect(message.additional_kwargs.graph_step).toBe(graphStep);
    });
  });

  describe('getLatestMessageForMessage', () => {
    it.each([
      { type: ToolMessage, expectedContent: 'Tool result' },
      { type: AIMessageChunk, expectedContent: 'Response' },
      { type: HumanMessage, expectedContent: 'Hello' },
    ])('should return latest $type.name', ({ type, expectedContent }) => {
      const result = getLatestMessageForMessage(mockMessages, type);

      expect(result).toBeInstanceOf(type);
      expect(result?.content).toBe(expectedContent);
    });

    it('should return null when no message of specified type found', () => {
      const result = getLatestMessageForMessage([], ToolMessage);
      expect(result).toBeNull();
    });

    it('should handle error and throw', () => {
      expect(() => {
        getLatestMessageForMessage(mockMessages, null as any);
      }).toThrow(TypeError);

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Helper: Error in getLatestMessageForMessage')
      );
    });
  });

  describe('filterMessagesByShortTermMemory', () => {
    it('should filter messages based on short term memory limit', () => {
      const result = filterMessagesByShortTermMemory(mockMessages, 2);
      expect(result.length).toBeLessThanOrEqual(2);
    });

    it('should prioritize iteration agent messages', () => {
      const messagesWithIterationAgents = [
        makeMessage('ai', 'Executor message', { from: Agent.EXECUTOR }),
        makeMessage('ai', 'Planner message', { from: Agent.PLANNER }),
        makeMessage('human', 'Human message'),
        makeMessage('tool', 'Tool message'),
      ];

      const result = filterMessagesByShortTermMemory(
        messagesWithIterationAgents,
        3
      );

      expect(result.length).toBeGreaterThan(0);
      expect(result.some((msg) => msg instanceof HumanMessage)).toBe(true);
      expect(result.some((msg) => msg instanceof ToolMessage)).toBe(true);
    });

    it.each([
      { messages: [], limit: 5, expected: [] },
      { messages: mockMessages, limit: 0, expected: [] },
    ])(
      'should handle edge case: $messages.length messages, limit $limit',
      ({ messages, limit, expected }) => {
        const result = filterMessagesByShortTermMemory(messages, limit);
        expect(result).toEqual(expected);
      }
    );
  });

  describe('isTerminalMessage', () => {
    it.each([
      { content: 'Test message', final: true, expected: true },
      {
        content: 'This is the FINAL ANSWER to your question',
        final: false,
        expected: true,
      },
      {
        content: 'The PLAN_COMPLETED successfully',
        final: false,
        expected: true,
      },
      { content: 'This is a regular message', final: false, expected: false },
    ])(
      'should return $expected for message with content "$content" and final=$final',
      ({ content, final, expected }) => {
        const message = new AIMessageChunk(content);
        if (final) message.additional_kwargs = { final };
        const result = isTerminalMessage(message);
        expect(result).toBe(expected);
      }
    );
  });

  describe('isTokenLimitError', () => {
    it.each([
      { message: 'token limit exceeded', expected: true },
      { message: 'tokens exceed maximum', expected: true },
      { message: 'context length too long', expected: true },
      { message: 'network error', expected: false },
      { message: undefined, expected: undefined },
    ])(
      'should return $expected for error message "$message"',
      ({ message, expected }) => {
        const error = message !== undefined ? { message } : {};
        const result = isTokenLimitError(error);
        expect(result).toBe(expected);
      }
    );
  });

  describe('handleModelError', () => {
    it('should handle token limit error correctly', () => {
      const tokenError = { message: 'token limit exceeded' };

      const result = handleModelError(tokenError);

      expect(result.messages).toBeInstanceOf(AIMessageChunk);
      expect(result.last_agent).toBe(Agent.EXECUTOR);

      const message = result.messages as AIMessageChunk;
      expect(message.content).toContain('token limits');
      expect(message.additional_kwargs.error).toBe('token_limit_exceeded');
      expect(message.additional_kwargs.final).toBe(true);

      expect(logger.error).toHaveBeenCalledWith(
        'Executor: Token limit error during model invocation - token limit exceeded'
      );
    });

    it('should handle unexpected error correctly', () => {
      const unexpectedError = { message: 'network error' };

      const result = handleModelError(unexpectedError);

      expect(result.messages).toBeInstanceOf(AIMessageChunk);
      expect(result.last_agent).toBe(Agent.EXECUTOR);

      const message = result.messages as AIMessageChunk;
      expect(message.content).toContain('unexpected error');
      expect(message.additional_kwargs.error).toBe('unexpected_error');
      expect(message.additional_kwargs.final).toBe(true);

      expect(logger.error).toHaveBeenCalledWith(
        'Executor: Error calling model - [object Object]'
      );
    });

    it('should handle error without message property', () => {
      const error = {};

      const result = handleModelError(error);

      expect(result.messages).toBeInstanceOf(AIMessageChunk);
      expect(result.last_agent).toBe(Agent.EXECUTOR);

      const message = result.messages as AIMessageChunk;
      expect(message.content).toContain('unexpected error');
      expect(message.additional_kwargs.error).toBe('unexpected_error');
    });
  });
});
