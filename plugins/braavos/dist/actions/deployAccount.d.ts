import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { z } from 'zod';
import { accountDetailsSchema } from '../schemas/schema';
export declare const DeployBraavosAccount: (agent: StarknetAgentInterface, params: z.infer<typeof accountDetailsSchema>) => Promise<string>;
export declare const DeployBraavosAccountSignature: (params: z.infer<typeof accountDetailsSchema>) => Promise<string>;
