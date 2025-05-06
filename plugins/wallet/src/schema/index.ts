import { z } from 'zod';

export const getBalanceSchema = z.object({
  address: z.string().describe('Starknet wallet address to query balance for'),
});