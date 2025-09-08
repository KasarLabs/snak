/**
 * Comprehensive constraint mapping for autonomous AI systems
 * Based on AutoGPT, SuperAGI, and BabyAGI patterns
 */

export const AUTONOMOUS_AI_CONSTRAINTS = {
  // Core Operational Constraints
  INDEPENDENT_DECISION_MAKING:
    'Your decisions must always be made independently without seeking user assistance',
  LEVERAGE_LLM_STRENGTHS:
    'Play to your strengths as an LLM and pursue simple strategies with no legal complications',
  COMMAND_RESTRICTION:
    'These are the ONLY commands you can use. Any action you perform must be possible through one of these commands',
  TOOL_EXCLUSIVITY:
    "Exclusively use the tools listed in double quotes e.g. 'tool name'",
  DECISION_BASED_ON_DATA_TOOLS:
    'Make decisions based solely on available data and tools',
  SUBSEQUENT_TASKS: `Subsequent tasks depend on what you'll discover in past task`,
  DECISITION_SAFEST_POSSIBLE: `If uncertain about a decision, choose the safest option`,
  NEVER_WAIT_HUMAN: `Never wait for human approval before proceeding`,
  THINK_CHECK_AND_ADAPT: `Think "check and adapt" not "build from scratch"`,
  TOOL_END_TASK: `USE TOOL END_TASK WHEN YOU RESOLVE YOUR GOAL.`,
  TOOL_END_TASK_IF: `USE TOOL END_TASK IMMEDIATELY IF:
   - You attempt the same action more than twice with the same result
   - You cannot proceed to the next logical step
   - You encounter any error or blocking situation`,
  WORKING_MEMORY_BLOCKED: `If you see repeated attempts in WORKING_MEMORY with the same result, you are blocked and must use end_task`,
  // Output Format Constraints
  JSON_RESPONSE_MANDATORY: 'YOU MUST ALWAYS RESPOND WITH A JSON OBJECT.',
  TOOL_INVOCATION_REQUIRED:
    'YOU MUST ALSO INVOKE A TOOL! (when use_functions_api is enabled)',
  VALID_JSON_ONLY:
    'Respond with only valid JSON conforming to the following schema',
  STRUCTURED_OUTPUT_FIELDS:
    'Must include required fields: thoughts (text, reasoning, plan, criticism, speak) and tool (name, args)',
  NO_ADDITIONAL_PROPERTIES:
    'additionalProperties: false (no extra fields allowed in JSON response)',
  NO_EXTRA_TEXT:
    'Ensure response is valid JSON with no additional text outside of the JSON',

  // Ethical and Legal Constraints
  NO_ILLEGAL_PLANS: 'Do not suggest illegal or unethical plans or strategies',
  BUDGET_AWARENESS: 'Take reasonable budgetary limits into account',
  SAFETY_BOUNDARIES: 'Maintain legal and ethical guardrails in all operations',

  // Technical Constraints
  REQUIRED_PARAMETERS:
    'Function parameters that has no default value and not optional typed has to be provided',
  NO_MISSING_ARGUMENTS: 'No missing argument is allowed',
  FUNCTION_SIGNATURE_MATCH:
    'Always choose a function call from the list of function signatures',
  TYPE_MATCHING:
    'Always provide the complete argument with type matching the required jsonschema signature',

  // Performance and Efficiency Constraints
  COST_AWARENESS: 'Every tool has a cost, so be smart and efficient',
  CONTINUOUS_REVIEW:
    'Continuously review and analyze your actions to ensure you are performing to the best of your abilities',
  SELF_CRITICISM:
    'Constructively self-criticize your big-picture behavior constantly',
  REFLECTION_BASED_IMPROVEMENT:
    'Reflect on past decisions and strategies to refine your approach',
  RESOURCE_EFFICIENCY: 'Be mindful of computational and resource costs',

  // Task Management Constraints
  NO_DUPLICATE_TASKS:
    "Don't create any task if it is already covered in incomplete or completed tasks",
  REMOVE_UNNECESSARY_TASKS: 'Remove tasks if they are unnecessary or duplicate',
  GOAL_ALIGNED_TASKS:
    "Remove tasks if they don't help in achieving the main goal",
  NO_GOAL_DEVIATION:
    'Ensure new tasks are not deviated from completing the goal',
  MAX_INITIAL_STEPS: 'Maximum of 3 steps in initial task sequence',

  // Execution Flow Constraints
  INSTRUCTION_BASED_FLOW:
    'Use instruction to decide the flow of execution and decide the next steps',
  TASK_COMPLETION_RECOGNITION:
    "If you have completed all your tasks or reached end state, make sure to use the 'finish' tool",
  AUTONOMOUS_TERMINATION:
    'Recognize when tasks are complete and terminate appropriately',

  // Error Handling and State Management
  EXCEPTION_MANAGEMENT: 'Manage exceptions and unexpected states gracefully',
  STATE_AWARENESS: 'Maintain awareness of current system state and progress',
  ERROR_RECOVERY: 'Implement appropriate error recovery mechanisms',

  // Goal Alignment
  OBJECTIVE_FOCUS: 'All actions must serve the main objective',
  STRATEGIC_ALIGNMENT: 'Ensure all strategies align with primary goals',
  PURPOSE_DRIVEN_ACTIONS: 'Every action should contribute to goal achievement',
} as const;

/**
 * Categorized constraint groups for easier access
 */
export const CONSTRAINT_CATEGORIES = {
  OPERATIONAL: [
    'INDEPENDENT_DECISION_MAKING',
    'LEVERAGE_LLM_STRENGTHS',
    'COMMAND_RESTRICTION',
    'TOOL_EXCLUSIVITY',
  ],

  OUTPUT_FORMAT: [
    'JSON_RESPONSE_MANDATORY',
    'TOOL_INVOCATION_REQUIRED',
    'VALID_JSON_ONLY',
    'STRUCTURED_OUTPUT_FIELDS',
    'NO_ADDITIONAL_PROPERTIES',
    'NO_EXTRA_TEXT',
  ],

  ETHICAL_LEGAL: ['NO_ILLEGAL_PLANS', 'BUDGET_AWARENESS', 'SAFETY_BOUNDARIES'],

  TECHNICAL: [
    'REQUIRED_PARAMETERS',
    'NO_MISSING_ARGUMENTS',
    'FUNCTION_SIGNATURE_MATCH',
    'TYPE_MATCHING',
  ],

  PERFORMANCE: [
    'COST_AWARENESS',
    'CONTINUOUS_REVIEW',
    'SELF_CRITICISM',
    'REFLECTION_BASED_IMPROVEMENT',
    'RESOURCE_EFFICIENCY',
  ],

  TASK_MANAGEMENT: [
    'NO_DUPLICATE_TASKS',
    'REMOVE_UNNECESSARY_TASKS',
    'GOAL_ALIGNED_TASKS',
    'NO_GOAL_DEVIATION',
    'MAX_INITIAL_STEPS',
  ],

  EXECUTION_FLOW: [
    'INSTRUCTION_BASED_FLOW',
    'TASK_COMPLETION_RECOGNITION',
    'AUTONOMOUS_TERMINATION',
  ],

  ERROR_HANDLING: ['EXCEPTION_MANAGEMENT', 'STATE_AWARENESS', 'ERROR_RECOVERY'],

  GOAL_ALIGNMENT: [
    'OBJECTIVE_FOCUS',
    'STRATEGIC_ALIGNMENT',
    'PURPOSE_DRIVEN_ACTIONS',
  ],
} as const;

/**
 * Helper function to get constraints by category
 */
export function getConstraintsByCategory(
  category: keyof typeof CONSTRAINT_CATEGORIES
): string[] {
  return CONSTRAINT_CATEGORIES[category].map(
    (key) =>
      AUTONOMOUS_AI_CONSTRAINTS[key as keyof typeof AUTONOMOUS_AI_CONSTRAINTS]
  );
}

/**
 * Helper function to get all constraints as an array
 */
export function getAllConstraints(): string[] {
  return Object.values(AUTONOMOUS_AI_CONSTRAINTS);
}

/**
 * Helper function to get constraint by key
 */
export function getConstraint(
  key: keyof typeof AUTONOMOUS_AI_CONSTRAINTS
): string {
  return AUTONOMOUS_AI_CONSTRAINTS[key];
}
