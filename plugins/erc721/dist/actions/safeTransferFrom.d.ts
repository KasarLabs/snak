import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { z } from 'zod';
import { safeTransferFromSchema } from '../schemas/schema';
export declare const safeTransferFrom: (agent: StarknetAgentInterface, params: z.infer<typeof safeTransferFromSchema>) => Promise<string>;
export declare const safeTransferFromSignature: (params: z.infer<typeof safeTransferFromSchema>) => Promise<string>;
