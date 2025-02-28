import { z } from 'zod';

/**
 * Zod schema for validating account details.
 * @type {z.ZodObject<{
 *   contractAddress: z.ZodString,
 *   publicKey: z.ZodString,
 *   privateKey: z.ZodString
 * }>}
 */
export const accountDetailsSchema = z.object({
  contractAddress: z.string().describe("The address of the account's contract"),
  publicKey: z.string().describe('The public key of the account'),
  privateKey: z.string().describe('The private key of the account'),
});
