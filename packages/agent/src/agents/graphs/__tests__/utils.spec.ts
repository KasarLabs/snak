import { logger } from '@snakagent/core';
import {
  AIMessage,
  AIMessageChunk,
  BaseMessage,
  HumanMessage,
  ToolMessage,
} from '@langchain/core/messages';
import {
  ParsedPlan,
  ValidatorStepResponse,
  StepInfo,
} from '../../../shared/types/index.js';
import {
  formatParsedPlanSimple,
  createMaxIterationsResponse,
  getLatestMessageForMessage,
  isTerminalMessage,
  isTokenLimitError,
  handleNodeError,
} from '../utils/graph-utils.js';

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
  ...overrides,
});

const makeParsedPlan = (overrides: Partial<ParsedPlan> = {}): ParsedPlan => ({
  type: 'plan',
  id: 'test-plan-id',
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
      expect(result).toContain('1. Test Step [tools] - completed');
      expect(result).toContain('2. Test Step [tools] - pending');
      expect(result).toContain('3. Test Step [tools] - failed');
      expect(result).toContain('Description: Test description');
    });

    it('should handle empty plan', () => {
      const result = formatParsedPlanSimple({
        type: 'plan',
        id: 'empty-plan',
        summary: 'Empty plan',
        steps: [],
      });

      expect(result).toContain('Plan Summary: Empty plan');
      expect(result).toContain('Steps (0 total):');
    });
  });

  // formatStepsStatusCompact function doesn't exist, removing test

  describe('createMaxIterationsResponse', () => {
    it('should create max iterations response with correct structure', () => {
      const graphStep = 10;
      const currentNode = 'test_node';
      const result = createMaxIterationsResponse(graphStep, currentNode);

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]).toBeInstanceOf(AIMessageChunk);
      expect(result.last_node).toBe(currentNode);

      const message = result.messages[0] as AIMessageChunk;
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

  // filterMessagesByShortTermMemory function doesn't exist, removing test

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
    ])(
      'should return $expected for error message "$message"',
      ({ message, expected }) => {
        const error = new Error(message);
        const result = isTokenLimitError(error);
        expect(result).toBe(expected);
      }
    );

    it('should return false for non-Error objects', () => {
      const result = isTokenLimitError({ message: 'token limit exceeded' });
      expect(result).toBe(false);
    });

    it('should return false for undefined', () => {
      const result = isTokenLimitError(undefined);
      expect(result).toBe(false);
    });
  });

  describe('handleNodeError', () => {
    it('should handle error correctly', () => {
      const error = new Error('test error');
      const source = 'test_source';

      const result = handleNodeError(error, source);

      expect(result).toBeDefined();
      expect(logger.error).toHaveBeenCalled();
    });

    it('should handle error with additional context', () => {
      const error = new Error('test error');
      const source = 'test_source';
      const additionalContext = 'additional context';

      const result = handleNodeError(
        error,
        source,
        undefined,
        additionalContext
      );

      expect(result).toBeDefined();
    });
  });
});
