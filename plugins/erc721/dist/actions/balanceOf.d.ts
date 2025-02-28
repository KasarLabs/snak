import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { z } from 'zod';
import { getBalanceSchema } from '../schemas/schema';
export declare const getBalance: (agent: StarknetAgentInterface, params: z.infer<typeof getBalanceSchema>) => Promise<string>;
