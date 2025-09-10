import z from 'zod';

export const tools_call = z.object({
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
});

export const resultSchema = z.object({
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
});

export const StepInfoSchema = z.object({
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
});

export const PlanSchema = z.object({
  steps: z
    .array(StepInfoSchema)
    .min(1)
    .max(20)
    .describe('Executable workflow steps (1-20) with clear dependencies'),
  summary: z
    .string()
    .describe('Plan overview: objectives, approach, outcomes (max 300 chars)'),
});

// Define the task schema
export const TaskSchema = z
  .object({
    text: z.string().describe('thought'),
    reasoning: z.string().describe('short reasoning about the goal'),
    plan: z
      .string()
      .describe('- short bulleted\n- list that conveys\n- long-term plan'),
    criticism: z.string().describe('constructive self-criticism'),
    speak: z.string().describe('thoughts summary to say to user'),
  })
  .strict();

// Define the main schema
const TasksSchema = z
  .object({
    tasks: z.array(TaskSchema),
  })
  .strict();

// Export the schema
export default TasksSchema;

export const StepSchema = z.object({
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
});

export type StepSchemaType = z.infer<typeof StepSchema>;

// Type inference (optional)
export type TasksSchemaType = z.infer<typeof TasksSchema>;
export type TaskSchemaType = z.infer<typeof TaskSchema>;
export type PlanSchemaType = z.infer<typeof PlanSchema>;

export const ValidatorResponseSchema = z.object({
  success: z.boolean().describe('true if sucess | false if failure'),
  results: z.array(z.string()).describe('The results of the validator'),
});
