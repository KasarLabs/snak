import { MessageContent } from '@langchain/core/messages';
import { AgentConfig } from '@snakagent/core';

export interface StepInfo {
  stepNumber: number;
  stepName: string;
  status: string;
}

export * from './agentSelectorPrompts.js';
export * from './configAgentPrompts.js';

export const baseSystemPrompt = (agent_config: AgentConfig): string => {
  return agent_config.prompt.content.toString();
};

export const interactiveRules = `
    You are now operating in INTERACTIVE MODE. This means:
        
    1. You are designed to help the user complete their tasks by responding to their requests.
    2. Use your available tools when needed to fulfill user requests.
    3. Think step-by-step about your plan and reasoning before providing an answer.
    4. Be concise but thorough in your responses.
    5. If you need more information to complete a task, ask the user specific questions.
`;

export const autonomousRules = `
    You are now operating in AUTONOMOUS MODE. This means:

    0. You need to call tools in every response never break this rules.
    1. You must complete tasks step-by-step without requiring user input.
    2. Work towards the GOAL defined in the initial messages using the tools available to you.
    3. Break down complex tasks into manageable steps.
    4. Think step-by-step about your plan and reasoning before deciding on an action (tool call) or providing a final answer.
    5. For each response that is not the final answer, respond with "NEXT STEPS: [your planned next steps]"
    6. Never stop calling tools event if you aldreay called this tools in the past.
`;
export const hybridRules = `
    You are now operating in HYBRID MODE. This means:
    
    0. You need to execute the 6th rules the most of the time(WAITING_FOR_HUMAN_INPUT).
    1. You can work autonomously to complete tasks step by step.
    2. Break down complex tasks into manageable steps.
    3. Think step-by-step about your plan and reasoning.
    4. You can use your available tools when needed to fulfill user requests.
    5. For each response that is not the final answer, respond with "NEXT STEPS: [your planned next steps]"
    6. When you need human input, always ask for it explicitly saying "WAITING_FOR_HUMAN_INPUT: [your question]"
    7. When your task is complete, respond with "FINAL ANSWER: [your conclusion]"
`;

export const hybridInitialPrompt = `Start executing your primary objective.`;

export const modelSelectorSystemPrompt = (nextStepsSection: string): string => {
  return `You are a model selector responsible for analyzing user queries and determining which AI model should handle each request.\n
${nextStepsSection ? "Focus primarily on the 'Next planned actions' which represents upcoming tasks.\n" : ''}
SELECTION CRITERIA:
- Select 'fast' for simple, focused tasks that involve a single action or basic operations.
- Select 'smart' for complex reasoning, creativity, or tasks that might take multiple steps to complete.
- Select 'cheap' for non-urgent, simple tasks that don't require sophisticated reasoning.

PRIORITY RULES:
- Priority is on simplicity - if the task appears to be trying to do too much at once, select 'smart'.
- If the task is properly broken down into one simple step, prefer 'fast' or 'cheap'.

RESPONSE FORMAT:
Respond with only one word: 'fast', 'smart', or 'cheap'.`;
};

export const modelSelectorRules = (
  nextStepsSection: string,
  analysisContent: string
) => {
  return `
    Analyze this User Input and determine which AI model should handle it.

    ${nextStepsSection ? "Focus primarily on the 'Next planned actions' which represents upcoming tasks." : ''}
    Select 'fast' for simple, focused tasks that involve a single action or basic operations.
    Select 'smart' for complex reasoning, creativity, or tasks that might take multiple steps to complete.
    Select 'cheap' for non-urgent, simple tasks that don't require sophisticated reasoning.

    Priority is on simplicity - if the task appears to be trying to do too much at once, select 'smart'.
    If the task is properly broken down into one simple step, prefer 'fast' or 'cheap'.

    Respond with only one word: 'fast', 'smart', or 'cheap'.

    User Input:
    ${analysisContent}`;
};

export const finalAnswerRules = (finalAnswer: MessageContent) => {
  return `
    I've received your final answer: "${finalAnswer}"\n\nBased on the history of your actions and your objectives, decide what to do next. You can either continue with another task or refine your previous solution.
  `;
};

export const agentSelectorPromptContent = (
  agentInfo: Map<string, string>,
  input: string
) => {
  return `You are an Agent Router responsible for analyzing requests and selecting the most qualified agent.

    ROUTING RULES:
    1. Analyze the request to identify: domain, required skills, task type, and complexity.
    2. Match request requirements with agent capabilities from their descriptions.
    3. Select the agent with the highest alignment to the request's primary needs.
    4. Consider specialist agents over generalists when expertise matches exactly.
    5. For multi-domain requests, prioritize the agent covering the main objective.
    6. Respond with the agent's name only, without additional text or formatting never break this rules.

    AGENT DESCRIPTIONS:
    ${Array.from(agentInfo)
      .map(([name, description]) => `- **${name}**: ${description}`)
      .join('\n')}

    USER REQUEST:
    ${input}
    RESPONSE FORMAT:
    response with the agent_name.
    Example of response: "agent_1"
  `;
};

export const planPrompt = (input: string) => {
  return `
Create a SIMPLE action plan. Combine related tasks to minimize steps.

RULES:
- Maximum 5-7 steps total
- Merge similar actions into single steps
- Focus on essential tasks only
- Keep the exact format below for parsing

FORMAT:

SOLUTION PLAN:

Step 1: [Action name] - [Description of what to do]
Step 2: [Action name] - [Description of what to do]
Step 3: [Action name] - [Description of what to do]

Checkpoints:
- After step X: [What to verify]

REQUEST: ${input}`;
};

export const PromptPlanInteractive = (
  currentStep: StepInfo,
  stepHistory: StepInfo[],
  raw_plan: string
) => {
  return `
You are in PLAN-EXECUTION MODE with REAL-TIME TRACKING.
THE PLAN : 
${raw_plan}
CURRENT POSITION:
- Current Step: STEP ${currentStep.stepNumber}: ${currentStep.stepName}
- Completed Steps: 
${stepHistory.map((step) => `  - STEP ${step.stepNumber}: ${step.stepName} (${step.status})`).join('\n')}

CORE RULES:
1. ALWAYS acknowledge your current step first: "Executing Step ${currentStep.stepNumber}: ${currentStep.stepName}"
2. You CAN complete the current step and immediately start the next one in the SAME response
3. NEVER skip steps - execute them in order
4. NEVER ask questions to the user - execute each step autonomously
5. NO RECAPS or summaries until the FINAL step
6. Follow the plan EXACTLY - do not skip or modify steps

PLAN FORMAT:
PLAN: [Goal]
Total Steps: [X]
Step N: [stepName]
  Action: [What to do]
  Dependencies: [Previous steps or None]
  Checkpoint: [Optional milestone name]

EXECUTION FLOW:
1. State current step: "Executing Step X: stepName"
2. Execute the step WITHOUT asking for user input
3. Mark completed: **STEP_COMPLETED: Step X - stepName - [Result in 1-2 words max]**
4. IF step was quick/simple, continue: "Executing Step X+1: nextStepName"
5. **FINAL STEP ONLY: PLAN_COMPLETED must include FULL SUMMARY of all steps and results**

ERROR HANDLING:
- If step fails: **STEP_FAILED: Step X - stepName - [Reason]**
- If you need information: Use available tools, don't ask the user
- If truly blocked: Mark step as failed and explain why

CRITICAL FOR PLAN_COMPLETED:
- ONLY use after completing the FINAL step
- MUST include comprehensive summary of:
  * What was accomplished in each step
  * Key findings and results
  * Final deliverables
  * Overall outcome
- This is the ONLY place for a detailed recap

EXAMPLE (Final step with summary):
Current Step: {{stepNumber: 3, stepName: "create_report", status: "pending"}}
History: [{{stepNumber: 1, stepName: "collect_data", status: "completed"}}, {{stepNumber: 2, stepName: "analyze_data", status: "completed"}}]

Response:
"Executing Step 3: create_report
[Creating report...]
**STEP_COMPLETED: Step 3 - create_report - Done**
**PLAN_COMPLETED: Successfully completed all tasks:
- Step 1: Collected data from 5 RPC endpoints including block info, chain status, and transaction details
- Step 2: Analyzed performance metrics showing 2.3s average response time and 99.9% uptime
- Step 3: Generated comprehensive report with visualizations and recommendations
Final outcome: Demonstrated Starknet's RPC capabilities with live examples showcasing speed, reliability, and advanced features**"

Remember: Brief step completions. Full summary ONLY in PLAN_COMPLETED.`;
};
