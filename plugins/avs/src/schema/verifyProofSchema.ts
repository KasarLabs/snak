import { z } from 'zod';
export const verifyProofSchema = z.object({
  blockHash: z
    .string()
    .startsWith('0x')
    .describe('The Starknet block hash to verify'),
  proof: z
    .object({
      programOutput: z
        .array(z.string())
        .describe('Program output for the STARK proof'),
      publicInput: z
        .array(z.string())
        .describe('Public inputs for verification'),
      proofParams: z
        .object({
          securityLevel: z.number().describe('Security level of the proof'),
          numQueries: z.number().describe('Number of queries in the proof'),
          blowupFactor: z
            .number()
            .describe('Blowup factor used in the proof generation'),
        })
        .describe('Parameters used in generating the proof'),
    })
    .describe('The STARK proof data'),
});
