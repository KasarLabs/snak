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
  SummarizeAgent,
  hybridInitialPrompt,
  STEP_EXECUTOR_SYSTEM_PROMPT,
  RETRY_EXECUTOR_SYSTEM_PROMPT,
  RETRY_CONTENT,
  STEP_EXECUTOR_CONTEXT,
  REPLAN_EXECUTOR_SYSTEM_PROMPT,
  ADAPTIVE_PLANNER_SYSTEM_PROMPT,
  ADAPTIVE_PLANNER_CONTEXT,
  AUTONOMOUS_PLAN_EXECUTOR_SYSTEM_PROMPT,
  HYBRID_PLAN_EXECUTOR_SYSTEM_PROMPT,
  INTERACTIVE_PLAN_EXECUTOR_SYSTEM_PROMPT,
  INTERACTIVE_PLAN_VALIDATOR_SYSTEM_PROMPT,
  AUTONOMOUS_PLAN_VALIDATOR_SYSTEM_PROMPT,
  STEPS_VALIDATOR_SYSTEM_PROMPT,
} from '../prompts.js';
import { AgentConfig } from '@snakagent/core';
import { MessageContent } from '@langchain/core/messages';

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
        ['REAL TOOL USAGE', 'AUTHENTIC OUTPUTS', 'MACHINE-READABLE FORMAT'],
      ],
      [
        'autonomousRules',
        autonomousRules,
        'AUTONOMOUS MODE',
        ['call tools in every response', 'NEXT STEPS:', 'GOAL defined in the initial messages'],
      ],
      [
        'hybridRules',
        hybridRules,
        'HYBRID MODE',
        ['WAITING_FOR_HUMAN_INPUT', 'FINAL ANSWER:', 'autonomously to complete tasks'],
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

  describe('SummarizeAgent', () => {
    it('should contain correct content', () => {
      expect(SummarizeAgent).toContain('Summarization Agent');
      expect(SummarizeAgent).toContain('Compress AIMessages and ToolMessages');
      expect(SummarizeAgent).toContain('MESSAGES TO SUMMARY : {messagesContent}');
    });
  });

  describe('hybridInitialPrompt', () => {
    it('should return the correct initial prompt', () => {
      expect(hybridInitialPrompt).toBe('Start executing your primary objective.');
    });
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
        'Merge similar actions into single steps',
        'Focus on essential tasks only',
        'Keep the exact format below for parsing',
      ];

      expectedSections.forEach((section) => expect(result).toContain(section));
    });
  });

  describe('STEP_EXECUTOR_SYSTEM_PROMPT', () => {
    it('should contain correct content', () => {
      expect(STEP_EXECUTOR_SYSTEM_PROMPT).toContain('AI Step Executor with REAL tool access');
      expect(STEP_EXECUTOR_SYSTEM_PROMPT).toContain('Execute STEP {stepNumber}: {stepName}');
      expect(STEP_EXECUTOR_SYSTEM_PROMPT).toContain('TOOL EXECUTION MODE');
      expect(STEP_EXECUTOR_SYSTEM_PROMPT).toContain('AI RESPONSE MODE');
    });
  });

  describe('RETRY_EXECUTOR_SYSTEM_PROMPT', () => {
    it('should contain correct content', () => {
      expect(RETRY_EXECUTOR_SYSTEM_PROMPT).toContain('validator rejected your previous execution attempt');
      expect(RETRY_EXECUTOR_SYSTEM_PROMPT).toContain('RETRY EXECUTION');
      expect(RETRY_EXECUTOR_SYSTEM_PROMPT).toContain('REQUEST REPLANNING');
      expect(RETRY_EXECUTOR_SYSTEM_PROMPT).toContain('REQUEST_REPLAN');
    });
  });

  describe('RETRY_CONTENT', () => {
    it('should contain correct placeholders', () => {
      expect(RETRY_CONTENT).toContain('{toolsList}');
      expect(RETRY_CONTENT).toContain('{retry}');
      expect(RETRY_CONTENT).toContain('{maxRetry}');
      expect(RETRY_CONTENT).toContain('{reason}');
      expect(RETRY_CONTENT).toContain('{stepNumber}');
      expect(RETRY_CONTENT).toContain('{stepName}');
      expect(RETRY_CONTENT).toContain('{stepDescription}');
    });
  });

  describe('STEP_EXECUTOR_CONTEXT', () => {
    it('should contain correct placeholders', () => {
      expect(STEP_EXECUTOR_CONTEXT).toContain('{toolsList}');
      expect(STEP_EXECUTOR_CONTEXT).toContain('{stepNumber}');
      expect(STEP_EXECUTOR_CONTEXT).toContain('{stepName}');
      expect(STEP_EXECUTOR_CONTEXT).toContain('{stepDescription}');
    });
  });

  describe('REPLAN_EXECUTOR_SYSTEM_PROMPT', () => {
    it('should contain correct content', () => {
      expect(REPLAN_EXECUTOR_SYSTEM_PROMPT).toContain('re-planning assistant');
      expect(REPLAN_EXECUTOR_SYSTEM_PROMPT).toContain('Create a NEW plan that:');
      expect(REPLAN_EXECUTOR_SYSTEM_PROMPT).toContain('{formatPlan}');
      expect(REPLAN_EXECUTOR_SYSTEM_PROMPT).toContain('{lastAiMessage}');
    });
  });

  describe('ADAPTIVE_PLANNER_SYSTEM_PROMPT', () => {
    it('should contain correct content', () => {
      expect(ADAPTIVE_PLANNER_SYSTEM_PROMPT).toContain('autonomous agent graph');
      expect(ADAPTIVE_PLANNER_SYSTEM_PROMPT).toContain('AUTONOMOUS AGENT system');
      expect(ADAPTIVE_PLANNER_SYSTEM_PROMPT).toContain('Step {stepLength}');
      expect(ADAPTIVE_PLANNER_SYSTEM_PROMPT).toContain('NEVER repeat or rewrite a step');
    });
  });

  describe('ADAPTIVE_PLANNER_CONTEXT', () => {
    it('should contain correct placeholders', () => {
      expect(ADAPTIVE_PLANNER_CONTEXT).toContain('{agent_config}');
      expect(ADAPTIVE_PLANNER_CONTEXT).toContain('{toolsList}');
      expect(ADAPTIVE_PLANNER_CONTEXT).toContain('{lastStepResult}');
    });
  });

  describe('AUTONOMOUS_PLAN_EXECUTOR_SYSTEM_PROMPT', () => {
    it('should contain correct content', () => {
      expect(AUTONOMOUS_PLAN_EXECUTOR_SYSTEM_PROMPT).toContain('strategic planning AI');
      expect(AUTONOMOUS_PLAN_EXECUTOR_SYSTEM_PROMPT).toContain('autonomous agent');
      expect(AUTONOMOUS_PLAN_EXECUTOR_SYSTEM_PROMPT).toContain('Every Tool has to be considered as a step');
      expect(AUTONOMOUS_PLAN_EXECUTOR_SYSTEM_PROMPT).toContain('{agentConfig}');
      expect(AUTONOMOUS_PLAN_EXECUTOR_SYSTEM_PROMPT).toContain('{toolsAvailable}');
    });
  });

  describe('HYBRID_PLAN_EXECUTOR_SYSTEM_PROMPT', () => {
    it('should contain correct content', () => {
      expect(HYBRID_PLAN_EXECUTOR_SYSTEM_PROMPT).toContain('autonomous agent with human-in-the-loop capabilities');
      expect(HYBRID_PLAN_EXECUTOR_SYSTEM_PROMPT).toContain('Human-in-the Loop has to be considered as a step');
      expect(HYBRID_PLAN_EXECUTOR_SYSTEM_PROMPT).toContain('human_in_the_loop');
    });
  });

  describe('INTERACTIVE_PLAN_EXECUTOR_SYSTEM_PROMPT', () => {
    it('should contain correct content', () => {
      expect(INTERACTIVE_PLAN_EXECUTOR_SYSTEM_PROMPT).toContain('interactive planning AI');
      expect(INTERACTIVE_PLAN_EXECUTOR_SYSTEM_PROMPT).toContain('end-to-end execution plans');
      expect(INTERACTIVE_PLAN_EXECUTOR_SYSTEM_PROMPT).toContain('{userRequest}');
      expect(INTERACTIVE_PLAN_EXECUTOR_SYSTEM_PROMPT).toContain('{agentConfig}');
    });
  });

  describe('INTERACTIVE_PLAN_VALIDATOR_SYSTEM_PROMPT', () => {
    it('should contain correct content', () => {
      expect(INTERACTIVE_PLAN_VALIDATOR_SYSTEM_PROMPT).toContain('plan validator');
      expect(INTERACTIVE_PLAN_VALIDATOR_SYSTEM_PROMPT).toContain('Be supportive, not critical');
      expect(INTERACTIVE_PLAN_VALIDATOR_SYSTEM_PROMPT).toContain('end with summarize');
    });
  });

  describe('AUTONOMOUS_PLAN_VALIDATOR_SYSTEM_PROMPT', () => {
    it('should contain correct content', () => {
      expect(AUTONOMOUS_PLAN_VALIDATOR_SYSTEM_PROMPT).toContain('plan validator');
      expect(AUTONOMOUS_PLAN_VALIDATOR_SYSTEM_PROMPT).toContain('Verify dependencies');
      expect(AUTONOMOUS_PLAN_VALIDATOR_SYSTEM_PROMPT).toContain('{agentConfig}');
      expect(AUTONOMOUS_PLAN_VALIDATOR_SYSTEM_PROMPT).toContain('{currentPlan}');
    });
  });

  describe('STEPS_VALIDATOR_SYSTEM_PROMPT', () => {
    it('should contain correct content', () => {
      expect(STEPS_VALIDATOR_SYSTEM_PROMPT).toContain('step validator');
      expect(STEPS_VALIDATOR_SYSTEM_PROMPT).toContain('TOOL_EXECUTION_MODE');
      expect(STEPS_VALIDATOR_SYSTEM_PROMPT).toContain('AI_RESPONSE_MODE');
      expect(STEPS_VALIDATOR_SYSTEM_PROMPT).toContain('step validated');
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
