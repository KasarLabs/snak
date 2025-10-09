import { z } from 'zod';

export const MessageAskUserSchema = z
  .object({
    text: z.string().describe('Question text to present to user'),
    attachments: z
      .union([z.string(), z.array(z.string())])
      .optional()
      .describe(
        '(Optional) List of question-related files or reference materials'
      ),
  })
  .strict();

export type MessageAskUserType = z.infer<typeof MessageAskUserSchema>;
