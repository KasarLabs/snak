import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { z } from 'zod';
import { getApprovedSchema } from '../schemas/schema';
export declare const getApproved: (agent: StarknetAgentInterface, params: z.infer<typeof getApprovedSchema>) => Promise<string>;
