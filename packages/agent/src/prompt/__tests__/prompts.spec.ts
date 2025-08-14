jest.mock('@snakagent/core', () => ({
  AgentConfig: jest.fn(),
}));

import {
  baseSystemPrompt,
  interactiveRules,
  autonomousRules,
  hybridRules,
  modelSelectorSystemPrompt,
  modelSelectorRules,
  finalAnswerRules,
  agentSelectorPromptContent,
  planPrompt,
  PromptPlanInteractive,
} from '../prompts.js';
import { AgentConfig } from '@snakagent/core';
import { MessageContent } from '@langchain/core/messages';
import { StepInfo } from '../prompts.js';

// Test constants
const DEFAULT_PLAN = `PLAN: Test plan
Total Steps: 3
Step 1: collect_data
Step 2: analyze_data
Step 3: create_report`;

describe('prompts', () => {
  // Factory functions
  const createMockPrompt = (content = 'Test system prompt content') => ({
    type: 'system',
    content: { toString: jest.fn().mockReturnValue(content) },
    toString: jest.fn().mockReturnValue(content),
  });

  const createMockAgentConfig = (prompt = createMockPrompt()): AgentConfig =>
    ({
      id: 'test-agent-id',
      name: 'Test Agent',
      group: 'test-group',
      description: 'Test agent description',
      interval: 5,
      chatId: 'test-chat-id',
      plugins: ['plugin1', 'plugin2'],
      memory: { enabled: true, shortTermMemorySize: 10, memorySize: 100 },
      rag: { enabled: true, embeddingModel: 'test-model' },
      mode: 'interactive',
      maxIterations: 10,
      prompt,
    }) as unknown as AgentConfig;

  const createStepInfo = (
    stepNumber: number,
    stepName: string,
    status: string
  ): StepInfo => ({
    stepNumber,
    stepName,
    status,
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('baseSystemPrompt', () => {
    it.each([
      ['default content', 'Test system prompt content'],
      ['custom content', 'Custom prompt content'],
      ['empty content', ''],
    ])('should return prompt content for %s', (_, expected) => {
      const config = createMockAgentConfig(createMockPrompt(expected));
      const result = baseSystemPrompt(config);
      expect(result).toBe(expected);
    });
  });

  describe('rule constants', () => {
    it.each([
      [
        'interactiveRules',
        interactiveRules,
        'INTERACTIVE MODE',
        ['Think step-by-step', 'ask the user specific questions'],
      ],
      [
        'autonomousRules',
        autonomousRules,
        'AUTONOMOUS MODE',
        ['call tools in every response', 'NEXT STEPS:'],
      ],
      [
        'hybridRules',
        hybridRules,
        'HYBRID MODE',
        ['WAITING_FOR_HUMAN_INPUT', 'FINAL ANSWER:'],
      ],
    ])(
      '%s should contain correct content',
      (_, rules, modeHeader, keyPhrases) => {
        expect(typeof rules).toBe('string');
        expect(rules.length).toBeGreaterThan(0);
        expect(rules).toContain(modeHeader);
        keyPhrases.forEach((phrase) => expect(rules).toContain(phrase));
      }
    );
  });

  describe('modelSelectorSystemPrompt', () => {
    it.each([
      ['with nextStepsSection', 'test steps', true],
      ['without nextStepsSection', '', false],
    ])(
      'should generate prompt %s',
      (_, nextStepsSection, shouldContainFocus) => {
        const result = modelSelectorSystemPrompt(nextStepsSection);

        expect(result).toContain('model selector');
        expect(result).toContain('SELECTION CRITERIA:');
        expect(result).toContain('fast');
        expect(result).toContain('smart');
        expect(result).toContain('cheap');

        if (shouldContainFocus) {
          expect(result).toContain(
            "Focus primarily on the 'Next planned actions'"
          );
        } else {
          expect(result).not.toContain(
            "Focus primarily on the 'Next planned actions'"
          );
        }
      }
    );

    it('should include all selection criteria and priority rules', () => {
      const result = modelSelectorSystemPrompt('test steps');

      const expectedPhrases = [
        "Select 'fast' for simple, focused tasks",
        "Select 'smart' for complex reasoning",
        "Select 'cheap' for non-urgent, simple tasks",
        'Priority is on simplicity',
        "if the task appears to be trying to do too much at once, select 'smart'",
        "If the task is properly broken down into one simple step, prefer 'fast' or 'cheap'",
      ];

      expectedPhrases.forEach((phrase) => expect(result).toContain(phrase));
    });
  });

  describe('modelSelectorRules', () => {
    it.each([
      ['with nextStepsSection', 'test steps', 'test content', true],
      ['without nextStepsSection', '', 'test content', false],
    ])(
      'should generate rules %s',
      (_, nextStepsSection, analysisContent, shouldContainFocus) => {
        const result = modelSelectorRules(nextStepsSection, analysisContent);

        expect(result).toContain('Analyze this User Input');
        expect(result).toContain('User Input:');
        expect(result).toContain(analysisContent);
        expect(result).toContain(
          "Respond with only one word: 'fast', 'smart', or 'cheap'"
        );

        if (shouldContainFocus) {
          expect(result).toContain(
            "Focus primarily on the 'Next planned actions'"
          );
        } else {
          expect(result).not.toContain(
            "Focus primarily on the 'Next planned actions'"
          );
        }
      }
    );

    it('should include all selection criteria', () => {
      const result = modelSelectorRules('', 'test content');

      const expectedPhrases = [
        "Select 'fast' for simple, focused tasks",
        "Select 'smart' for complex reasoning",
        "Select 'cheap' for non-urgent, simple tasks",
      ];

      expectedPhrases.forEach((phrase) => expect(result).toContain(phrase));
    });
  });

  describe('finalAnswerRules', () => {
    it.each([
      [
        'complex answer',
        'The analysis is complete. Results show positive trends.',
      ],
      ['simple answer', 'Simple answer'],
      ['empty answer', ''],
    ])('should generate rules with %s', (_, finalAnswer) => {
      const result = finalAnswerRules(finalAnswer);

      expect(result).toContain("I've received your final answer:");
      expect(result).toContain(`"${finalAnswer}"`);
      expect(result).toContain(
        'Based on the history of your actions and your objectives'
      );
      expect(result).toContain('decide what to do next');
    });
  });

  describe('agentSelectorPromptContent', () => {
    const createAgentMap = (count: number) => {
      const map = new Map();
      for (let i = 1; i <= count; i++) {
        map.set(`agent_${i}`, `Agent ${i} description`);
      }
      return map;
    };

    it.each([
      ['multiple agents', createAgentMap(3), 'Test request', 3],
      ['single agent', createAgentMap(1), 'Test request', 1],
      ['empty map', new Map(), 'Test request', 0],
    ])(
      'should generate prompt content with %s',
      (_, agentInfo, input, expectedAgentCount) => {
        const result = agentSelectorPromptContent(agentInfo, input);

        expect(result).toContain('Agent Router');
        expect(result).toContain('ROUTING RULES:');
        expect(result).toContain('AGENT DESCRIPTIONS:');
        expect(result).toContain('USER REQUEST:');
        expect(result).toContain(input);
        expect(result).toContain('RESPONSE FORMAT:');

        if (expectedAgentCount > 0) {
          expect(result).toContain('**agent_1**: Agent 1 description');
        }
      }
    );

    it('should include all routing rules', () => {
      const result = agentSelectorPromptContent(createAgentMap(2), 'test');

      const expectedRules = [
        'Analyze the request to identify: domain, required skills, task type, and complexity',
        'Match request requirements with agent capabilities',
        'Select the agent with the highest alignment',
        'Consider specialist agents over generalists',
      ];

      expectedRules.forEach((rule) => expect(result).toContain(rule));
    });
  });

  describe('planPrompt', () => {
    it.each([
      [
        'complex input',
        'Analyze blockchain data and create a comprehensive report',
      ],
      ['empty input', ''],
      [
        'special characters',
        'Analyze data with special chars: @#$%^&*() and create report',
      ],
    ])('should generate plan prompt with %s', (_, input) => {
      const result = planPrompt(input);

      expect(result).toContain('Create a SIMPLE action plan');
      expect(result).toContain('REQUEST:');
      expect(result).toContain(input);
    });

    it('should include all required sections', () => {
      const result = planPrompt('test input');

      const expectedSections = [
        'RULES:',
        'Maximum 5-7 steps total',
        'FORMAT:',
        'SOLUTION PLAN:',
        'Step 1: [Action name] - [Description of what to do]',
        'Checkpoints:',
        'After step X: [What to verify]',
      ];

      expectedSections.forEach((section) => expect(result).toContain(section));
    });
  });

  describe('PromptPlanInteractive', () => {
    const defaultPlan = DEFAULT_PLAN;

    it('should generate interactive plan prompt with all main sections', () => {
      const currentStep = createStepInfo(3, 'create_report', 'pending');
      const stepHistory = [
        createStepInfo(1, 'collect_data', 'completed'),
        createStepInfo(2, 'analyze_data', 'completed'),
      ];

      const result = PromptPlanInteractive(
        currentStep,
        stepHistory,
        defaultPlan
      );

      const expectedSections = [
        'PLAN-EXECUTION MODE with REAL-TIME TRACKING',
        'THE PLAN :',
        'CURRENT POSITION:',
        'CORE RULES:',
        'PLAN FORMAT:',
        'EXECUTION FLOW:',
        'ERROR HANDLING:',
        'CRITICAL FOR PLAN_COMPLETED:',
      ];

      expectedSections.forEach((section) => expect(result).toContain(section));
      expect(result).toContain(defaultPlan);
      expect(result).toContain('Current Step: STEP 3: create_report');
    });

    it.each([
      ['empty history', [], 'should not contain step history items'],
      [
        'mixed statuses',
        [
          createStepInfo(1, 'step1', 'completed'),
          createStepInfo(2, 'step2', 'failed'),
          createStepInfo(3, 'step3', 'in_progress'),
        ],
        'should contain all step history items',
      ],
    ])('should handle %s', (_, history, _description) => {
      const currentStep = createStepInfo(1, 'test_step', 'pending');
      const result = PromptPlanInteractive(currentStep, history, defaultPlan);

      expect(result).toContain('Completed Steps:');

      if (history.length > 0) {
        history.forEach((step) => {
          expect(result).toContain(
            `STEP ${step.stepNumber}: ${step.stepName} (${step.status})`
          );
        });
      }
    });

    it('should include all core rules and instructions', () => {
      const currentStep = createStepInfo(1, 'test', 'pending');
      const result = PromptPlanInteractive(currentStep, [], defaultPlan);

      const expectedRules = [
        'ALWAYS acknowledge your current step first',
        'NEVER skip steps - execute them in order',
        'NEVER ask questions to the user',
        'Follow the plan EXACTLY',
      ];

      expectedRules.forEach((rule) => expect(result).toContain(rule));
    });
  });

  describe('Integration Tests', () => {
    it('should generate consistent prompts across all functions', () => {
      const agentConfig = createMockAgentConfig(
        createMockPrompt('Test content')
      );
      const agentMap = new Map([['test_agent', 'Test description']]);

      // Test that all main functions return non-empty strings
      expect(baseSystemPrompt(agentConfig)).toBe('Test content');
      expect(modelSelectorSystemPrompt('test steps')).toContain(
        'model selector'
      );
      expect(planPrompt('test request')).toContain(
        'Create a SIMPLE action plan'
      );
      expect(agentSelectorPromptContent(agentMap, 'test')).toContain(
        'Agent Router'
      );

      // Test that all rule constants contain common patterns
      const allRules = [interactiveRules, autonomousRules, hybridRules];
      allRules.forEach((rules) => {
        expect(typeof rules).toBe('string');
        expect(rules.length).toBeGreaterThan(0);
      });
    });
  });
});
