// Mock dependencies
const MockSystemMessage = jest.fn().mockImplementation((content: string) => ({
  type: 'system',
  content: content,
  toString: () => content,
}));

jest.mock('@langchain/core/messages', () => {
  const actual = jest.requireActual('@langchain/core/messages');
  return { ...actual, SystemMessage: MockSystemMessage };
});

jest.mock('@snakagent/core', () => ({
  AgentConfig: jest.fn(),
}));

import { baseSystemPrompt, interactiveRules, autonomousRules, hybridRules, modelSelectorSystemPrompt, modelSelectorRules, finalAnswerRules, agentSelectorPromptContent, planPrompt, PromptPlanInteractive } from '../prompts.js';
import { AgentConfig } from '@snakagent/core';
import { MessageContent } from '@langchain/core/messages';

// Define StepInfo interface since it's not exported from the source
interface StepInfo {
  stepNumber: number;
  stepName: string;
  status: string;
}

describe('prompts', () => {
  let mockAgentConfig: AgentConfig;
  let mockSystemMessage: any;

  beforeEach(() => {
    // Reset des mocks
    jest.clearAllMocks();

    // Mock SystemMessage
    mockSystemMessage = {
      type: 'system',
      content: {
        toString: jest.fn().mockReturnValue('Test system prompt content'),
      },
      toString: jest.fn().mockReturnValue('Test system prompt content'),
    };

    // Mock AgentConfig
    mockAgentConfig = {
      id: 'test-agent-id',
      name: 'Test Agent',
      group: 'test-group',
      description: 'Test agent description',
      interval: 5,
      chatId: 'test-chat-id',
      plugins: ['plugin1', 'plugin2'],
      memory: {
        enabled: true,
        shortTermMemorySize: 10,
        memorySize: 100,
      },
      rag: {
        enabled: true,
        embeddingModel: 'test-model',
      },
      mode: 'interactive',
      maxIterations: 10,
      prompt: mockSystemMessage,
    } as unknown as AgentConfig;
  });

  describe('baseSystemPrompt', () => {
    it('should return the agent config prompt content as string', () => {
      const result = baseSystemPrompt(mockAgentConfig);
      
      expect(result).toBe('Test system prompt content');
      expect(mockAgentConfig.prompt.content.toString).toHaveBeenCalled();
    });

    it('should handle different prompt content types', () => {
      const customPrompt = {
        type: 'system',
        content: {
          toString: jest.fn().mockReturnValue('Custom prompt content'),
        },
        toString: jest.fn().mockReturnValue('Custom prompt content'),
      };

      const customConfig = {
        ...mockAgentConfig,
        prompt: customPrompt,
      } as unknown as AgentConfig;

      const result = baseSystemPrompt(customConfig);
      
      expect(result).toBe('Custom prompt content');
      expect(customPrompt.content.toString).toHaveBeenCalled();
    });
  });

  describe('interactiveRules', () => {
    it('should contain the correct interactive mode rules', () => {
      expect(interactiveRules).toContain('INTERACTIVE MODE');
      expect(interactiveRules).toContain('You are designed to help the user complete their tasks');
      expect(interactiveRules).toContain('Use your available tools when needed');
      expect(interactiveRules).toContain('Think step-by-step');
      expect(interactiveRules).toContain('Be concise but thorough');
      expect(interactiveRules).toContain('ask the user specific questions');
    });

    it('should be a string', () => {
      expect(typeof interactiveRules).toBe('string');
      expect(interactiveRules.length).toBeGreaterThan(0);
    });
  });

  describe('autonomousRules', () => {
    it('should contain the correct autonomous mode rules', () => {
      expect(autonomousRules).toContain('AUTONOMOUS MODE');
      expect(autonomousRules).toContain('You need to call tools in every response');
      expect(autonomousRules).toContain('complete tasks step-by-step without requiring user input');
      expect(autonomousRules).toContain('Work towards the GOAL');
      expect(autonomousRules).toContain('Break down complex tasks');
      expect(autonomousRules).toContain('NEXT STEPS:');
      expect(autonomousRules).toContain('Never stop calling tools');
    });

    it('should be a string', () => {
      expect(typeof autonomousRules).toBe('string');
      expect(autonomousRules.length).toBeGreaterThan(0);
    });
  });

  describe('hybridRules', () => {
    it('should contain the correct hybrid mode rules', () => {
      expect(hybridRules).toContain('HYBRID MODE');
      expect(hybridRules).toContain('WAITING_FOR_HUMAN_INPUT');
      expect(hybridRules).toContain('work autonomously to complete tasks');
      expect(hybridRules).toContain('Think step-by-step');
      expect(hybridRules).toContain('use your available tools');
      expect(hybridRules).toContain('NEXT STEPS:');
      expect(hybridRules).toContain('FINAL ANSWER:');
    });

    it('should be a string', () => {
      expect(typeof hybridRules).toBe('string');
      expect(hybridRules.length).toBeGreaterThan(0);
    });
  });

  describe('modelSelectorSystemPrompt', () => {
    it('should generate prompt with nextStepsSection when provided', () => {
      const nextStepsSection = 'Next planned actions: analyze data, create report';
      const result = modelSelectorSystemPrompt(nextStepsSection);

      expect(result).toContain('model selector');
      expect(result).toContain('Focus primarily on the \'Next planned actions\'');
      expect(result).toContain('SELECTION CRITERIA:');
      expect(result).toContain('fast');
      expect(result).toContain('smart');
      expect(result).toContain('cheap');
      expect(result).toContain('PRIORITY RULES:');
      expect(result).toContain('RESPONSE FORMAT:');
    });

    it('should generate prompt without nextStepsSection when not provided', () => {
      const result = modelSelectorSystemPrompt('');

      expect(result).toContain('model selector');
      expect(result).not.toContain('Focus primarily on the \'Next planned actions\'');
      expect(result).toContain('SELECTION CRITERIA:');
      expect(result).toContain('fast');
      expect(result).toContain('smart');
      expect(result).toContain('cheap');
    });

    it('should include all required selection criteria', () => {
      const result = modelSelectorSystemPrompt('test steps');

      expect(result).toContain("Select 'fast' for simple, focused tasks");
      expect(result).toContain("Select 'smart' for complex reasoning");
      expect(result).toContain("Select 'cheap' for non-urgent, simple tasks");
    });

    it('should include priority rules', () => {
      const result = modelSelectorSystemPrompt('test steps');

      expect(result).toContain('Priority is on simplicity');
      expect(result).toContain('if the task appears to be trying to do too much at once, select \'smart\'');
      expect(result).toContain('If the task is properly broken down into one simple step, prefer \'fast\' or \'cheap\'');
    });
  });

  describe('modelSelectorRules', () => {
    it('should generate rules with nextStepsSection and analysisContent', () => {
      const nextStepsSection = 'Next planned actions: analyze data';
      const analysisContent = 'User wants to analyze blockchain data';
      const result = modelSelectorRules(nextStepsSection, analysisContent);

      expect(result).toContain('Analyze this User Input');
      expect(result).toContain('Focus primarily on the \'Next planned actions\'');
      expect(result).toContain('Select \'fast\' for simple, focused tasks');
      expect(result).toContain('Select \'smart\' for complex reasoning');
      expect(result).toContain('Select \'cheap\' for non-urgent, simple tasks');
      expect(result).toContain('Priority is on simplicity');
      expect(result).toContain('Respond with only one word: \'fast\', \'smart\', or \'cheap\'');
      expect(result).toContain('User Input:');
      expect(result).toContain(analysisContent);
    });

    it('should generate rules without nextStepsSection when not provided', () => {
      const analysisContent = 'User wants to analyze blockchain data';
      const result = modelSelectorRules('', analysisContent);

      expect(result).toContain('Analyze this User Input');
      expect(result).not.toContain('Focus primarily on the \'Next planned actions\'');
      expect(result).toContain(analysisContent);
    });

    it('should include all selection criteria', () => {
      const result = modelSelectorRules('', 'test content');

      expect(result).toContain("Select 'fast' for simple, focused tasks that involve a single action");
      expect(result).toContain("Select 'smart' for complex reasoning, creativity, or tasks that might take multiple steps");
      expect(result).toContain("Select 'cheap' for non-urgent, simple tasks that don't require sophisticated reasoning");
    });
  });

  describe('finalAnswerRules', () => {
    it('should generate rules with the provided final answer', () => {
      const finalAnswer: MessageContent = 'The analysis is complete. Results show positive trends.';
      const result = finalAnswerRules(finalAnswer);

      expect(result).toContain('I\'ve received your final answer:');
      expect(result).toContain(`"${finalAnswer}"`);
      expect(result).toContain('Based on the history of your actions and your objectives');
      expect(result).toContain('decide what to do next');
      expect(result).toContain('continue with another task or refine your previous solution');
    });

    it('should handle different types of final answers', () => {
      const finalAnswer: MessageContent = 'Simple answer';
      const result = finalAnswerRules(finalAnswer);

      expect(result).toContain(`"${finalAnswer}"`);
    });

    it('should handle empty final answer', () => {
      const finalAnswer: MessageContent = '';
      const result = finalAnswerRules(finalAnswer);

      expect(result).toContain('I\'ve received your final answer:');
      expect(result).toContain('""');
    });
  });

  describe('agentSelectorPromptContent', () => {
    it('should generate prompt content with agent info and input', () => {
      const agentInfo = new Map([
        ['agent_1', 'Blockchain analysis specialist'],
        ['agent_2', 'Data processing expert'],
        ['agent_3', 'Report generation agent'],
      ]);
      const input = 'Analyze blockchain transaction data and generate a report';

      const result = agentSelectorPromptContent(agentInfo, input);

      expect(result).toContain('Agent Router');
      expect(result).toContain('ROUTING RULES:');
      expect(result).toContain('Analyze the request to identify: domain, required skills, task type, and complexity');
      expect(result).toContain('Match request requirements with agent capabilities');
      expect(result).toContain('Select the agent with the highest alignment');
      expect(result).toContain('Consider specialist agents over generalists');
      expect(result).toContain('For multi-domain requests, prioritize the agent covering the main objective');
      expect(result).toContain('Respond with the agent\'s name only');
      expect(result).toContain('AGENT DESCRIPTIONS:');
      expect(result).toContain('**agent_1**: Blockchain analysis specialist');
      expect(result).toContain('**agent_2**: Data processing expert');
      expect(result).toContain('**agent_3**: Report generation agent');
      expect(result).toContain('USER REQUEST:');
      expect(result).toContain(input);
      expect(result).toContain('RESPONSE FORMAT:');
      expect(result).toContain('response with the agent_name');
      expect(result).toContain('Example of response: "agent_1"');
    });

    it('should handle empty agent info map', () => {
      const agentInfo = new Map();
      const input = 'Test request';

      const result = agentSelectorPromptContent(agentInfo, input);

      expect(result).toContain('Agent Router');
      expect(result).toContain('AGENT DESCRIPTIONS:');
      expect(result).toContain('USER REQUEST:');
      expect(result).toContain(input);
    });

    it('should handle single agent in map', () => {
      const agentInfo = new Map([
        ['single_agent', 'Only agent available'],
      ]);
      const input = 'Test request';

      const result = agentSelectorPromptContent(agentInfo, input);

      expect(result).toContain('**single_agent**: Only agent available');
    });
  });

  describe('planPrompt', () => {
    it('should generate plan prompt with input', () => {
      const input = 'Analyze blockchain data and create a comprehensive report';
      const result = planPrompt(input);

      expect(result).toContain('Create a SIMPLE action plan');
      expect(result).toContain('Combine related tasks to minimize steps');
      expect(result).toContain('RULES:');
      expect(result).toContain('Maximum 5-7 steps total');
      expect(result).toContain('Merge similar actions into single steps');
      expect(result).toContain('Focus on essential tasks only');
      expect(result).toContain('Keep the exact format below for parsing');
      expect(result).toContain('FORMAT:');
      expect(result).toContain('SOLUTION PLAN:');
      expect(result).toContain('Step 1: [Action name] - [Description of what to do]');
      expect(result).toContain('Step 2: [Action name] - [Description of what to do]');
      expect(result).toContain('Step 3: [Action name] - [Description of what to do]');
      expect(result).toContain('Checkpoints:');
      expect(result).toContain('After step X: [What to verify]');
      expect(result).toContain('REQUEST:');
      expect(result).toContain(input);
    });

    it('should handle empty input', () => {
      const result = planPrompt('');

      expect(result).toContain('Create a SIMPLE action plan');
      expect(result).toContain('REQUEST:');
    });

    it('should handle complex input with special characters', () => {
      const input = 'Analyze data with special chars: @#$%^&*() and create report';
      const result = planPrompt(input);

      expect(result).toContain(input);
    });
  });

  describe('PromptPlanInteractive', () => {
    let currentStep: StepInfo;
    let stepHistory: StepInfo[];
    let rawPlan: string;

    beforeEach(() => {
      currentStep = {
        stepNumber: 3,
        stepName: 'create_report',
        status: 'pending',
      };

      stepHistory = [
        {
          stepNumber: 1,
          stepName: 'collect_data',
          status: 'completed',
        },
        {
          stepNumber: 2,
          stepName: 'analyze_data',
          status: 'completed',
        },
      ];

      rawPlan = `PLAN: Analyze blockchain data and create report
Total Steps: 3
Step 1: collect_data
  Action: Gather blockchain transaction data
  Dependencies: None
  Checkpoint: Data collection complete
Step 2: analyze_data
  Action: Process and analyze collected data
  Dependencies: Step 1
  Checkpoint: Analysis complete
Step 3: create_report
  Action: Generate comprehensive report
  Dependencies: Step 2
  Checkpoint: Report ready`;
    });

    it('should generate interactive plan prompt with all components', () => {
      const result = PromptPlanInteractive(currentStep, stepHistory, rawPlan);

      expect(result).toContain('PLAN-EXECUTION MODE with REAL-TIME TRACKING');
      expect(result).toContain('THE PLAN :');
      expect(result).toContain(rawPlan);
      expect(result).toContain('CURRENT POSITION:');
      expect(result).toContain('Current Step: STEP 3: create_report');
      expect(result).toContain('Completed Steps:');
      expect(result).toContain('  - STEP 1: collect_data (completed)');
      expect(result).toContain('  - STEP 2: analyze_data (completed)');
      expect(result).toContain('CORE RULES:');
      expect(result).toContain('ALWAYS acknowledge your current step first');
      expect(result).toContain('Executing Step 3: create_report');
      expect(result).toContain('You CAN complete the current step and immediately start the next one');
      expect(result).toContain('NEVER skip steps - execute them in order');
      expect(result).toContain('NEVER ask questions to the user');
      expect(result).toContain('NO RECAPS or summaries until the FINAL step');
      expect(result).toContain('Follow the plan EXACTLY');
    });

    it('should include plan format section', () => {
      const result = PromptPlanInteractive(currentStep, stepHistory, rawPlan);

      expect(result).toContain('PLAN FORMAT:');
      expect(result).toContain('PLAN: [Goal]');
      expect(result).toContain('Total Steps: [X]');
      expect(result).toContain('Step N: [stepName]');
      expect(result).toContain('Action: [What to do]');
      expect(result).toContain('Dependencies: [Previous steps or None]');
      expect(result).toContain('Checkpoint: [Optional milestone name]');
    });

    it('should include execution flow section', () => {
      const result = PromptPlanInteractive(currentStep, stepHistory, rawPlan);

      expect(result).toContain('EXECUTION FLOW:');
      expect(result).toContain('State current step: "Executing Step X: stepName"');
      expect(result).toContain('Execute the step WITHOUT asking for user input');
      expect(result).toContain('Mark completed: **STEP_COMPLETED: Step X - stepName - [Result in 1-2 words max]**');
      expect(result).toContain('IF step was quick/simple, continue: "Executing Step X+1: nextStepName"');
      expect(result).toContain('**FINAL STEP ONLY: PLAN_COMPLETED must include FULL SUMMARY of all steps and results**');
    });

    it('should include error handling section', () => {
      const result = PromptPlanInteractive(currentStep, stepHistory, rawPlan);

      expect(result).toContain('ERROR HANDLING:');
      expect(result).toContain('If step fails: **STEP_FAILED: Step X - stepName - [Reason]**');
      expect(result).toContain('If you need information: Use available tools, don\'t ask the user');
      expect(result).toContain('If truly blocked: Mark step as failed and explain why');
    });

    it('should include critical plan completed section', () => {
      const result = PromptPlanInteractive(currentStep, stepHistory, rawPlan);

      expect(result).toContain('CRITICAL FOR PLAN_COMPLETED:');
      expect(result).toContain('ONLY use after completing the FINAL step');
      expect(result).toContain('MUST include comprehensive summary of:');
      expect(result).toContain('What was accomplished in each step');
      expect(result).toContain('Key findings and results');
      expect(result).toContain('Final deliverables');
      expect(result).toContain('Overall outcome');
      expect(result).toContain('This is the ONLY place for a detailed recap');
    });

    it('should include example section', () => {
      const result = PromptPlanInteractive(currentStep, stepHistory, rawPlan);

      expect(result).toContain('EXAMPLE (Final step with summary):');
      expect(result).toContain('Current Step: {{stepNumber: 3, stepName: "create_report", status: "pending"}}');
      expect(result).toContain('History: [{{stepNumber: 1, stepName: "collect_data", status: "completed"}}, {{stepNumber: 2, stepName: "analyze_data", status: "completed"}}]');
      expect(result).toContain('Response:');
      expect(result).toContain('"Executing Step 3: create_report');
      expect(result).toContain('**STEP_COMPLETED: Step 3 - create_report - Done**');
      expect(result).toContain('**PLAN_COMPLETED: Successfully completed all tasks:');
    });

    it('should handle empty step history', () => {
      const emptyHistory: StepInfo[] = [];
      const result = PromptPlanInteractive(currentStep, emptyHistory, rawPlan);

      expect(result).toContain('Completed Steps:');
      expect(result).not.toContain('  - STEP');
    });

    it('should handle different step statuses', () => {
      const mixedHistory: StepInfo[] = [
        { stepNumber: 1, stepName: 'step1', status: 'completed' },
        { stepNumber: 2, stepName: 'step2', status: 'failed' },
        { stepNumber: 3, stepName: 'step3', status: 'in_progress' },
      ];

      const result = PromptPlanInteractive(currentStep, mixedHistory, rawPlan);

      expect(result).toContain('  - STEP 1: step1 (completed)');
      expect(result).toContain('  - STEP 2: step2 (failed)');
      expect(result).toContain('  - STEP 3: step3 (in_progress)');
    });

    it('should handle different current step numbers', () => {
      const step1: StepInfo = { stepNumber: 1, stepName: 'first_step', status: 'pending' };
      const result = PromptPlanInteractive(step1, stepHistory, rawPlan);

      expect(result).toContain('Current Step: STEP 1: first_step');
      expect(result).toContain('Executing Step 1: first_step');
    });
  });

  describe('Integration Tests', () => {
    it('should generate consistent prompts across different functions', () => {
      const agentConfig: AgentConfig = {
        ...mockAgentConfig,
        prompt: {
          content: {
            toString: () => 'Test content',
          },
          toString: () => 'Test content',
        },
      } as unknown as AgentConfig;

      const basePrompt = baseSystemPrompt(agentConfig);
      expect(basePrompt).toBe('Test content');

      const modelPrompt = modelSelectorSystemPrompt('test steps');
      expect(modelPrompt).toContain('model selector');

      const planPromptResult = planPrompt('test request');
      expect(planPromptResult).toContain('Create a SIMPLE action plan');
    });

    it('should handle all rule types consistently', () => {
      expect(interactiveRules).toContain('INTERACTIVE MODE');
      expect(autonomousRules).toContain('AUTONOMOUS MODE');
      expect(hybridRules).toContain('HYBRID MODE');

      expect(interactiveRules).toContain('Think step-by-step');
      expect(autonomousRules).toContain('Think step-by-step');
      expect(hybridRules).toContain('Think step-by-step');
    });

    it('should validate prompt format consistency', () => {
      const agentInfo = new Map([['test_agent', 'Test description']]);
      const agentPrompt = agentSelectorPromptContent(agentInfo, 'test input');
      
      expect(agentPrompt).toContain('ROUTING RULES:');
      expect(agentPrompt).toContain('AGENT DESCRIPTIONS:');
      expect(agentPrompt).toContain('USER REQUEST:');
      expect(agentPrompt).toContain('RESPONSE FORMAT:');
    });
  });
});
