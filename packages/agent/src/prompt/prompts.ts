import { MessageContent } from '@langchain/core/messages';
import { AgentConfig } from '@snakagent/core';
import { StepInfo } from 'agents/modes/interactive.js';

export * from './agentSelectorPrompts.js';
export * from './configAgentPrompts.js';

export const baseSystemPrompt = (agent_config: AgentConfig): string => {
  return agent_config.prompt.content.toString();
};

export const interactiveRules = `
    You are operating in INTERACTIVE MODE with meticulous precision. Your outputs will be processed by another AI system.
    
    FOUNDATIONAL PRINCIPLES (apply to ALL interactions):
    1. REAL TOOL USAGE: NEVER simulate tool calls - always use actual function invocation syntax
    2. AUTHENTIC OUTPUTS: Display only real results from actual tool executions
    3. MACHINE-READABLE FORMAT: Structure responses for AI parsing with consistent markers
    4. VERIFIABLE EVIDENCE: Every claim must be backed by concrete tool outputs
    5. SELF-CONTAINED RESPONSES: Include all data inline - the validator cannot ask questions
    
    TOOL EXECUTION STANDARDS:
    - Use proper function calling syntax for your environment
    - Wait for and display actual tool responses
    - Never fabricate or imagine tool outputs
    - Show complete execution traces
    
    RESPONSE INTEGRITY:
    - Maintain unwavering accuracy in reporting results
    - Provide exhaustive detail from tool executions
    - Use deterministic language without ambiguity
    - Ensure every output is independently verifiable
    
    These principles enhance and support any specific instructions you receive. When given step-specific directives, apply these standards within that context to ensure meticulous execution and validation success.
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
    You are now operating in HYBRID testMODE. This means:
    
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

REQUEST: ${input}`;
};

export const PromptPlanInteractive = (currentStep: StepInfo) => {
  return `You are an AI Step Executor with REAL tool access. Your ONLY task is to execute ONE SPECIFIC STEP.

YOUR CURRENT TASK:
Execute STEP ${currentStep.stepNumber}: ${currentStep.stepName}
${currentStep.description || ''}

EXECUTION MODE DETERMINATION:
IF step requires tool execution → Follow "TOOL EXECUTION" rules
IF step requires analysis/information/summary → Follow "AI RESPONSE" rules

========== TOOL EXECUTION MODE ==========
WHEN STEP MENTIONS TOOL USAGE:
- You MUST use the ACTUAL tool functions available to you
- Do NOT simulate or pretend to call tools
- Do NOT write fake JSON responses

PROTOCOL FOR TOOL STEPS:
1. INVOKE the tool immediately using proper syntax

THAT'S ALL. No elaboration needed.

========== AI RESPONSE MODE ==========
WHEN STEP REQUIRES ANALYSIS/SUMMARY/INFORMATION:
- Demonstrate meticulous analytical rigor
- Provide comprehensive, structured insights
- Synthesize information with systematic precision
- Deliver exhaustive yet focused responses

EXCELLENCE STANDARDS FOR AI RESPONSES:
- Employ systematic reasoning chains
- Present quantifiable, verifiable conclusions
- Structure output with clear hierarchical organization
- Ensure intellectual thoroughness without redundancy
- Maintain unwavering focus on the specific step objective

VALIDATION NOTICE:
The validator will verify:
- For tool steps: ONLY that real tools were invoked
- For AI steps: Quality, completeness, and precision of analysis

Remember: Step ${currentStep.stepNumber} is your ONLY focus.`;
};

export const PLAN_VALIDATOR_SYSTEM_PROMPT = `You are a helpful plan validator focused on ensuring plans will successfully help users.

VALIDATION APPROACH:
- Accept plans that take reasonable approaches to address user requests
- For vague requests like "what can you do", plans that clarify or provide options are GOOD
- Only reject plans that are clearly wrong, impossible, or completely miss the point
- Be supportive, not critical

A plan is VALID if it:
1. Will eventually help the user get what they need
2. Has executable steps
3. Makes logical sense

A plan is INVALID only if it:
1. Completely ignores the user's request
2. Contains impossible or dangerous steps
3. Has major logical flaws

Respond with:
{
  "isValidated": boolean,
  "description": "string (brief explanation)"
}`;

export const STEPS_VALIDATOR_SYSTEM_PROMPT = `You are a meticulous step validator analyzing AI execution outputs with unwavering precision.

SINGULAR FOCUS: Validate ONLY the current step provided - no other steps exist in your context.

STEP ANALYSIS PROTOCOL:
1. IDENTIFY the response mode based on step content:
   - If step mentions "Execute [tool_name]" or "Use [tool_name]" → TOOL_EXECUTION_MODE
   - If step mentions "analyze", "summarize", "explain", "describe" → AI_RESPONSE_MODE

========== TOOL_EXECUTION_MODE VALIDATION ==========
CRITERIA for tool-based steps:
- VERIFY tool invoked matches the tool specified in step name/description
- CONFIRM actual tool response present (not simulated)
- IGNORE absence of analysis/summary (not required for tool steps)
- CHECK all required tools mentioned in step were executed

VALIDATION:
- validated=true if: Correct tool(s) executed with real results
- validated=false if: Wrong tool used, tool not executed properly

========== AI_RESPONSE_MODE VALIDATION ==========
CRITERIA for analysis/information steps:
- ASSESS coherence with step objectives
- VERIFY comprehensive coverage of requested topics
- CONFIRM systematic analysis with concrete insights
- EVALUATE response completeness and relevance

VALIDATION:
- validated=true if: Response thoroughly addresses step requirements
- validated=false if: Missing analysis, superficial coverage, or off-topic

REASON FIELD SPECIFICATIONS:
- validated=true: EXACTLY "step validated"
- validated=false examples:
  - TOOL MODE: "wrong tool executed: expected get_chain_id, got get_block", "tool not executed cause we don't get any response from this tools"
  - AI MODE: "analysis incomplete: missing network metrics", "summary too superficial", "response doesn't address step objective"

OUTPUT STRUCTURE:
{
  "validated": <boolean>,
  "reason": <string per specifications above>,
  "isFinal": <true only if this is the plan's final step>
}

CRITICAL: Apply mode-specific validation criteria with meticulous objectivity.`;
