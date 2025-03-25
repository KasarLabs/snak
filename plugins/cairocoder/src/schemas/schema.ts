import { z } from 'zod';

/**
 * Schema for generating Cairo code using AI
 * @typedef {Object} GenerateCairoCodeSchema
 * @property {string} prompt - The prompt describing the Cairo code to be generated
 */
export const generateCairoCodeSchema = z.object({
  prompt: z
    .string()
    .describe('The prompt describing what Cairo code to generate'),
}); 