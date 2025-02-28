import z from 'zod';

export const getTelegramMessageUpdateFromConversationSchema = z.object({
  max_message: z
    .number()
    .describe(
      'The maximum massage you want to get from the channel by default is set to 10'
    )
    .optional()
    .default(10),
  channel_id: z
    .number()
    .describe('The id of the channel you want to get the message'),
});

export type getTelegramMessageUpdateFromConversationParams = z.infer<
  typeof getTelegramMessageUpdateFromConversationSchema
>;
