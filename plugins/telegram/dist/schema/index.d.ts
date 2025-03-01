import z from 'zod';
export declare const getTelegramMessageUpdateFromConversationSchema: z.ZodObject<{
    max_message: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    channel_id: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    max_message: number;
    channel_id: number;
}, {
    channel_id: number;
    max_message?: number | undefined;
}>;
export type getTelegramMessageUpdateFromConversationParams = z.infer<typeof getTelegramMessageUpdateFromConversationSchema>;
