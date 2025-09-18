import z from 'zod';
import { th } from 'zod/v4/locales';

export const tools_call = z
  .object({
    description: z
      .string()
      .describe(
        'Tool execution details: what it does, parameters used, and configuration'
      ),
    required: z
      .string()
      .describe(
        'Required inputs and their sources (e.g., "user query, step 2 filters")'
      ),
    expected_result: z.string().describe('Expected output data.'),
    result: z.string().describe('should be empty'),
  })
  .strict();

export const resultSchema = z
  .object({
    content: z
      .string()
      .describe(
        'Output content placeholder - empty during planning, populated during execution'
      )
      .default(''),
    tokens: z
      .number()
      .describe('Ouput Token Count - empty during planning')
      .default(0),
  })
  .strict();

export const StepInfoSchema = z
  .object({
    stepNumber: z
      .number()
      .int()
      .min(1)
      .max(100)
      .describe('Execution order (1-100)'),
    stepName: z
      .string()
      .min(1)
      .max(200)
      .describe('Action-oriented step title under 200 chars'),
    description: z
      .string()
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
  })
  .strict();

export const PlanSchema = z
  .object({
    steps: z
      .array(StepInfoSchema)
      .min(1)
      .max(20)
      .describe('Executable workflow steps (1-20) with clear dependencies'),
    summary: z
      .string()
      .describe(
        'Plan overview: objectives, approach, outcomes (max 300 chars)'
      ),
  })
  .strict();

export const ThoughtsSchema = z.object({
  text: z.string().describe('thought'),
  reasoning: z.string().describe('reasoning'),
  criticism: z.string().describe('constructive self-criticism'),
  speak: z.string().describe('thoughts summary to say to user'),
});

export const TaskObjectSchema = z
  .object({
    analysis: z
      .string()
      .describe('Detailed task analysis and considerations (max 300 chars)'),
    directive: z
      .string()
      .describe(
        'Clear, actionable directive for the next step (max 200 chars)'
      ),
    success_check: z
      .string()
      .describe(
        'Criteria to determine successful completion of this task (max 200 chars)'
      ),
  })
  .strict();
// Define the task schema
export const TaskSchema = z
  .object({
    thought: ThoughtsSchema,
    task: TaskObjectSchema,
  })
  .strict();

export const StepSchema = z
  .object({
    thoughts: z.object({
      text: z.string().describe('thought'),
      reasoning: z.string().describe('reasoning'),
      criticism: z.string().describe('constructive self-criticism'),
      speak: z.string().describe('thoughts summary to say to user'),
    }),
    tool: z.object({
      name: z.string().describe('tool name'),
      args: z.record(z.any()).describe('tool arguments').nullable(),
    }),
  })
  .strict();

export type StepSchemaType = z.infer<typeof StepSchema>;
export type ThoughtsSchemaType = z.infer<typeof ThoughtsSchema>;
// Type inference (optional)
export type TaskSchemaType = z.infer<typeof TaskSchema>;
export type PlanSchemaType = z.infer<typeof PlanSchema>;
