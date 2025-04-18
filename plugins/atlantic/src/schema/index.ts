import { z } from '@starknet-agent-kit/agents';

export const GetProofServiceSchema = z.object({
  filename: z.string().describe('The filename you wish to generate the proof'),
});

export const VerifyProofServiceSchema = z.object({
  filename: z.string().describe('The filename you wish to verify the proof'),
  memoryVerification: z
    .string()
    .describe('Type of public memory verification.'),
});
