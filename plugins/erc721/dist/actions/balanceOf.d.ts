import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { z } from 'zod';
import { getBalanceSchema, getOwnBalanceSchema } from '../schemas/schema';
export declare const getBalance: (agent: StarknetAgentInterface, params: z.infer<typeof getBalanceSchema>) => Promise<string>;
export declare const getOwnBalance: (agent: StarknetAgentInterface, params: z.infer<typeof getOwnBalanceSchema>) => Promise<string>;
