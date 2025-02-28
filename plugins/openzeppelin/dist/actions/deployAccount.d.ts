import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { z } from 'zod';
import { accountDetailsSchema } from '../schemas/schema';
export declare const DeployOZAccount: (agent: StarknetAgentInterface, params: z.infer<typeof accountDetailsSchema>) => Promise<string>;
export declare const DeployOZAccountSignature: (params: z.infer<typeof accountDetailsSchema>) => Promise<string>;
