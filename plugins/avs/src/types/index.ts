import { verifyProofSchema } from '../schema/verifyProofSchema.ts';
import { z } from 'zod';
export type ProofVerifier = (data: VerifyProofInput) => Promise<boolean>;
export type VerifyProofInput = z.infer<typeof verifyProofSchema>;
