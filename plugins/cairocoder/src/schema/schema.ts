import { z } from 'zod';

/**
 * Schema for generating Cairo code using AI
 * @typedef {Object} GenerateCairoCodeSchema
 * @property {string} prompt - The prompt describing the Cairo code to be generated
 * @property {string} contractName - The name of the contract file to be created (without .cairo extension)
 */
export const generateCairoCodeSchema = z.object({
  prompt: z
    .string()
    .describe('The prompt describing what Cairo code to generate'),
  programName: z
    .string()
    .describe(
      'The name of the Cairo program/contract file to be created (with .cairo extension)'
    ),
});

/**
 * Schema for fixing Cairo code using AI
 * @typedef {Object} FixCairoCodeSchema
 * @property {string} programName - The name of the program to fix (with .cairo extension)
 * @property {string} error - The error message or issue to fix in the code
 */
export const fixCairoCodeSchema = z.object({
  programName: z
    .string()
    .describe('The name of the Cairo program to fix (with .cairo extension)'),
  error: z
    .string()
    .describe('The error message or issue description that needs to be fixed'),
});
