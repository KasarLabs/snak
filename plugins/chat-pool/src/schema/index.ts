import z from 'zod'

export const insertChatIntructionSchema = z.object({
  instruction: z.string(),
});

export type insertChatIntructionParams = z.infer<typeof insertChatIntructionSchema>