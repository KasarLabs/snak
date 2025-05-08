import { MessageContent } from '@langchain/core/messages';
import { AgentConfig } from '../config/agentConfig.js';

export const baseSystemPrompt = (agent_config: AgentConfig): string => {
  return `
        ${agent_config?.prompt?.content || ''}

        Your name: ${agent_config?.name}
        Your bio: ${(agent_config as any)?.bio}

        Your Lore:
        ${((agent_config as any).lore as string[])
          .map((lore: string) => `- ${lore}`)
          .join('\n')}

        Your objectives:
        ${((agent_config as any).objectives as string[])
          .map((obj: string) => `- ${obj}`)
          .join('\n')}

        Your knowledge:
        ${((agent_config as any).knowledge as string[])
          .map((k: string) => `- ${k}`)
          .join('\n')}
    `;
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

    1. You must complete tasks step-by-step without requiring user input.
    2. Work towards the GOAL defined in the initial messages using the tools available to you.
    3. Break down complex tasks into manageable steps.
    4. Think step-by-step about your plan and reasoning before deciding on an action (tool call) or providing a final answer.
    5. For each response that is not the final answer, respond with "NEXT STEPS: [your planned next steps]"
    6. When your task is complete, respond with "FINAL ANSWER: [your conclusion]"
`;

export const hybridRules = `
    You are now operating in HYBRID MODE. This means:
        
    1. You can work autonomously to complete tasks step by step.
    2. Break down complex tasks into manageable steps.
    3. Think step-by-step about your plan and reasoning.
    4. You can use your available tools when needed to fulfill user requests.
    5. For each response that is not the final answer, respond with "NEXT STEPS: [your planned next steps]"
    6. When you need human input, always ask for it explicitly saying "WAITING_FOR_HUMAN_INPUT: [your question]"
    7. When your task is complete, respond with "FINAL ANSWER: [your conclusion]"
`;

export const hybridInitialPrompt = `Start executing your primary objective.`;

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
