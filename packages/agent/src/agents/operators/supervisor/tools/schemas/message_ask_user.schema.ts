import { z } from 'zod';

export const MessageAskUserSchema = z
  .object({
    enum: z
      .enum(['boolean', 'select', 'text'])
      .describe('Type of expected response from user'),
    text: z.string().describe('Question text to present to user'),
    choices: z
      .array(z.string())
      .optional()
      .describe('List of choices for select type questions'),
  })
  .strict();

export type MessageAskUserType = z.infer<typeof MessageAskUserSchema>;
