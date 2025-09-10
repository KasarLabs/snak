export const CORE_AGENT_PROMPT = `
{header}\n
INSTRUCTIONS:
{instructions}\n
GOAL:
{goal}\n
CONSTRAINTS:
{constraints}\n
HISTORY:
// history past actions and task validations(newest first)
{short_term_memory}\n
LONG-TERM_MEMORY:
{long_term_memory}\n
TOOLS:
{tools}\n
PERFORMANCE EVALUATION:
{performance_evaluation}\n
Respond with only valid JSON conforming to the following schema:
{output_format}
`;
