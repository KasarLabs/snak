import { getBalanceSchema } from '@/schema/index.ts';
import { z } from 'zod';

export type GetBalanceInput = z.infer<typeof getBalanceSchema>;
