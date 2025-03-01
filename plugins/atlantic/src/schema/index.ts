import { z } from 'zod';

export const GetProofServiceSchema = z.object({
  filename: z
    .string()
    .describe('The name of the file you wish to generate the proof'),
});

export const VerifyProofServiceSchema = z.object({
  filename: z
    .string()
    .describe('The name of the file you wish to verify the proof'),
  memoryVerification: z
    .string()
    .describe('Type of public memory verification.'),
});
