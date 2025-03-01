import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { z } from 'zod';
import { getTotalSupplySchema } from '../schemas/schema';
export declare const getTotalSupply: (agent: StarknetAgentInterface, params: z.infer<typeof getTotalSupplySchema>) => Promise<string>;
