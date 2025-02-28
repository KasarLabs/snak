import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { z } from 'zod';
import { isApprovedForAllSchema } from '../schemas/schema';
export declare const isApprovedForAll: (agent: StarknetAgentInterface, params: z.infer<typeof isApprovedForAllSchema>) => Promise<string>;
