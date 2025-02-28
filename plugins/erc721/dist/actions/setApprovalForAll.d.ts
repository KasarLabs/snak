import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { z } from 'zod';
import { setApprovalForAllSchema } from '../schemas/schema';
export declare const setApprovalForAll: (agent: StarknetAgentInterface, params: z.infer<typeof setApprovalForAllSchema>) => Promise<string>;
export declare const setApprovalForAllSignature: (params: z.infer<typeof setApprovalForAllSchema>) => Promise<string>;
