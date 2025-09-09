import { z } from 'zod';

// MIME types autorisés
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
] as const;

// Limites de taille (en bytes)
const MAX_FILE_SIZE = 523 * 1024 * 1024; // 523MB
const MIN_FILE_SIZE = 1; // 1 byte

export const FileIngestionJobPayloadSchema = z
  .object({
    agentId: z.string().uuid('Invalid agentId format'),
    userId: z.string().uuid('Invalid userId format'),
    fileId: z.string().min(1, 'fileId is required').max(255, 'fileId too long'),
    originalName: z
      .string()
      .min(1, 'originalName is required')
      .max(255, 'originalName too long')
      .regex(/^[^<>:"/\\|?*]+$/, 'Invalid characters in filename'),
    mimeType: z.enum(ALLOWED_MIME_TYPES, {
      errorMap: () => ({ message: 'Unsupported file type' }),
    }),
    buffer: z.instanceof(Buffer, { message: 'Buffer is required' }),
    size: z
      .number()
      .int('Size must be an integer')
      .min(MIN_FILE_SIZE, 'File too small')
      .max(MAX_FILE_SIZE, 'File too large'),
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
