import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { z } from 'zod';
import { ownerOfSchema } from '../schemas/schema';
export declare const getOwner: (agent: StarknetAgentInterface, params: z.infer<typeof ownerOfSchema>) => Promise<string>;
