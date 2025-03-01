import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { z } from 'zod';
import { transferSchema, transferSignatureSchema } from '../schemas/schema';
export declare const transfer: (agent: StarknetAgentInterface, params: z.infer<typeof transferSchema>) => Promise<string>;
export declare const transferSignature: (params: z.infer<typeof transferSignatureSchema>) => Promise<string>;
