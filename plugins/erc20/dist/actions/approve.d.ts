import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { z } from 'zod';
import { approveSchema, approveSignatureSchema } from '../schemas/schema';
export declare const approve: (agent: StarknetAgentInterface, params: z.infer<typeof approveSchema>) => Promise<string>;
export declare const approveSignature: (params: z.infer<typeof approveSignatureSchema>) => Promise<string>;
