import { BaseMessage, MessageContent } from '@langchain/core/messages';
import { AgentConfig } from '@snakagent/core';
import { StepInfo } from 'agents/modes/types/index.js';

export * from './agentSelectorPrompts.js';
export * from './configAgentPrompts.js';

export const baseSystemPrompt = (agent_config: AgentConfig): string => {
  return agent_config.prompt.content.toString();
};

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

