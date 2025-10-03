import z from 'zod';

export const ThoughtsSchema = z
  .object({
    text: z.string().describe('thought'),
    reasoning: z.string().describe('reasoning'),
    criticism: z.string().describe('constructive self-criticism'),
    speak: z.string().describe('thoughts summary to say to user'),
  })
  .strict();

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
export type TaskSchemaType = z.infer<typeof TaskSchema>;

export type ThoughtsSchemaType = z.infer<typeof ThoughtsSchema>;

export const TaskVerificationSchema = z
  .object({
    taskCompleted: z
      .boolean()
      .describe('true if the task was successfully completed, false otherwise'),
    confidenceScore: z
      .number()
      .min(0)
      .max(100)
      .describe('Confidence level (0-100) in the completion assessment'),
    reasoning: z
      .string()
      .describe('Detailed reasoning for the completion assessment'),
    missingElements: z
      .array(z.string())
      .describe(
        'List of missing elements or requirements if task is incomplete'
      ),
    nextActions: z
      .array(z.string())
      .describe(
        'Suggested next actions if task needs to continue. Can be empty'
      ),
  })
  .strict()
  .describe('Schema for verifying task completion status');
export type TaskVerificationSchemaType = z.infer<typeof TaskVerificationSchema>;
