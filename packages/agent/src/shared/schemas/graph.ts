import { getGuardValue } from '@snakagent/core';
import z from 'zod';

export const tools_call = z.object({
  description: z
    .string().max(getGuardValue('execution_graph.tools.max_description_length'))
    .describe(
      'Tool execution details: what it does, parameters used, and configuration'
    ),
  required: z
    .string().max(getGuardValue('execution_graph.tools.max_required_length'))
    .describe(
      'Required inputs and their sources (e.g., "user query, step 2 filters")'
    ),
  expected_result: z.string().max(getGuardValue('execution_graph.tools.max_expected_result_length')).describe('Expected output data.'),
  result: z.string().max(getGuardValue('execution_graph.tools.max_result_length')).describe('should be empty'),
});

export const resultSchema = z.object({
  content: z
    .string().max(getGuardValue('execution_graph.result_schema.max_content_length'))
    .describe(
      'Output content placeholder - empty during planning, populated during execution'
    )
    .default(''),
  tokens: z
    .number().max(getGuardValue('execution_graph.result_schema.max_tokens'))
    .describe('Ouput Token Count - empty during planning')
    .default(0),
});

export const StepInfoSchema = z.object({
  stepNumber: z
    .number()
    .int()
    .min(getGuardValue('execution_graph.step.min_steps'))
    .max(getGuardValue('execution_graph.step.max_steps'))
    .describe('Execution order (1-100)'),
  stepName: z
    .string()
    .min(getGuardValue('execution_graph.step.min_name_length'))
    .max(getGuardValue('execution_graph.step.max_name_length'))
    .describe('Action-oriented step title under 200 chars'),
  description: z
    .string().max(getGuardValue('execution_graph.step.max_description_length'))
    .describe(
      'Full step details: objective, inputs/sources, methodology, outputs, success criteria'
    ),
  type: z
    .enum(['tools', 'message', 'human_in_the_loop'])
    .describe(
      'Step type: tools (automated), message (AI processing), human_in_the_loop (human input)'
    ),

  tools: z
    .array(tools_call)
    .max(getGuardValue('execution_graph.step.max_parallel_tools'))
    .optional()
    .describe(
      'Parallel tool executions (only for type="tools"). Must be independent'
    ),
  message: resultSchema
    .describe(
      'Message Output (only for type="message") - empty during planning, populated during execution'
    )
    .optional()
    .default({ content: '', tokens: 0 }),
  status: z
    .enum(['pending', 'completed', 'failed'])
    .default('pending')
    .describe('Execution state of this step'),
});

export const PlanSchema = z.object({
  steps: z
    .array(StepInfoSchema)
    .min(getGuardValue('execution_graph.plan.min_steps'))
    .max(getGuardValue('execution_graph.plan.max_steps'))
    .describe('Executable workflow steps (1-20) with clear dependencies'),
  summary: z
    .string().max(getGuardValue('execution_graph.plan.max_summary_length'))
    .describe('Plan overview: objectives, approach, outcomes (max 300 chars)'),
});

export type PlanSchemaType = z.infer<typeof PlanSchema>;

export const ValidatorResponseSchema = z.object({
  success: z.boolean().describe('true if sucess | false if failure'),
  results: z.array(z.string()).describe('The results of the validator'),
});
