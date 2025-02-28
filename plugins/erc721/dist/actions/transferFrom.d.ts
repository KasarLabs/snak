import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { z } from 'zod';
import { transferFromSchema, transferSchema } from '../schemas/schema';
export declare const transferFrom: (agent: StarknetAgentInterface, params: z.infer<typeof transferFromSchema>) => Promise<string>;
export declare const transfer: (agent: StarknetAgentInterface, params: z.infer<typeof transferSchema>) => Promise<string>;
export declare const transferFromSignature: (params: z.infer<typeof transferFromSchema>) => Promise<string>;
