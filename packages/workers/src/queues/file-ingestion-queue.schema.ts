import { getGuardValue } from '@core/dist/index.js';
import { z } from 'zod';

const ALLOWED_MIME_TYPES = [
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/csv',
  'application/json',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'text/html',
  'application/octet-stream',
] as const;

export const FileIngestionJobPayloadSchema = z
  .object({
    agentId: z.string().uuid('Invalid agentId format'),
    userId: z.string().uuid('Invalid userId format'),
    fileId: z.string().uuid('Invalid fileId format'),
    originalName: z
      .string()
      .min(getGuardValue('rag.min_original_name_length'))
      .max(getGuardValue('rag.max_original_name_length'))
      .regex(/^[^<>:"/\\|?*]+$/, 'Invalid characters in filename'),
    mimeType: z.enum(ALLOWED_MIME_TYPES, {
      errorMap: () => ({ message: 'Unsupported file type' }),
    }),
    buffer: z.instanceof(Buffer, { message: 'Buffer is required' }),
    size: z
      .number()
      .int('Size must be an integer')
      .min(getGuardValue('rag.rag_min_size'))
      .max(getGuardValue('rag.rag_max_size')),
  })
  .refine((data) => data.buffer.length === data.size, {
    message: 'Buffer size does not match declared size',
    path: ['size'],
  });

export type FileIngestionJobPayload = z.infer<
  typeof FileIngestionJobPayloadSchema
>;

export function validateFileIngestionPayload(
  payload: unknown
): FileIngestionJobPayload {
  try {
    return FileIngestionJobPayloadSchema.parse(payload);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors
        .map((err) => `${err.path.join('.')}: ${err.message}`)
        .join(', ');
      throw new Error(`Validation failed: ${errorMessages}`);
    }
    throw error;
  }
}
