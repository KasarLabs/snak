jest.mock('@snakagent/core', () => ({
  AgentConfig: jest.fn(),
}));

import { baseSystemPrompt, modelSelectorSystemPrompt } from '../index.js';
import { AgentConfig } from '@snakagent/core';

describe('prompts', () => {
  const createMockPrompt = (content = 'Test system prompt content') => ({
    content: { toString: jest.fn().mockReturnValue(content) },
  });

  const createMockAgentConfig = (prompt = createMockPrompt()): AgentConfig =>
    ({
      prompt,
    }) as unknown as AgentConfig;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('baseSystemPrompt', () => {
    it('should return prompt content', () => {
      const config = createMockAgentConfig(createMockPrompt('Test content'));
      const result = baseSystemPrompt(config);
      expect(result).toBe('Test content');
    });
  });

  describe('modelSelectorSystemPrompt', () => {
    it('should return model selector prompt without next steps section', () => {
      const result = modelSelectorSystemPrompt('');
      expect(result).toContain('You are a model selector');
      expect(result).toContain('SELECTION CRITERIA');
    });

    it('should return model selector prompt with next steps section', () => {
      const nextSteps = 'Next planned actions: Step 1, Step 2';
      const result = modelSelectorSystemPrompt(nextSteps);
      expect(result).toContain('You are a model selector');
      expect(result).toContain("Focus primarily on the 'Next planned actions'");
    });
  });
});
