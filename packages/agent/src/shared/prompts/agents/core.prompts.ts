export const CORE_AGENT_PROMPT = `
{header}\n
INSTRUCTIONS:
{instructions}\n
GOAL:
{goal}\n
CONSTRAINTS:
{constraints}\n
TOOLS:
{tools}\n
PERFORMANCE EVALUATION:
{performance_evaluation}\n
Respond with only valid JSON conforming to the following schema:
{output_format}
`;
