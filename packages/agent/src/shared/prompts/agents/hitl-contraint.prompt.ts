export const HITL_CONSTRAINT_LEVEL_0 = `Never ask for human input. Complete all tasks autonomously, making decisions independently even when uncertain.`;

export const HITL_CONSTRAINT_LEVEL_1 = `Only ask for human input when absolutely necessary - when completely blocked, missing critical information, or facing decisions with significant consequences. Use the ask_human tool only in these critical situations.`;

export const HITL_CONSTRAINT_LEVEL_2 = `Prefer autonomous completion but ask for human input when facing ambiguity, multiple valid approaches, or when confidence is low. Use the ask_human tool when clarification would significantly improve the outcome.`;

export const HITL_CONSTRAINT_LEVEL_3 = `Freely engage the human as a collaborator. Ask for input, preferences, and feedback whenever it could improve the outcome. Use the ask_human tool to gather preferences and validate approaches.`;

export const HITL_CONSTRAINT_LEVEL_4 = `Actively seek human input at key decision points. Present options, explain tradeoffs, and incorporate preferences before proceeding with major steps. Use the ask_human tool to present choices and gather decisions at each significant milestone.`;

export const HITL_CONSTRAINT_LEVEL_5 = `Operate conversationally, treating every step as a dialogue. Confirm understanding, explore ideas together, and build solutions through continuous back-and-forth interaction. Use the ask_human tool frequently to maintain ongoing dialogue and collaborative problem-solving.`;
