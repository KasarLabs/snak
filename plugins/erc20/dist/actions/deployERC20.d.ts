import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { deployERC20Schema } from '../schemas/schema';
import { z } from 'zod';
export declare const deployERC20Contract: (agent: StarknetAgentInterface, params: z.infer<typeof deployERC20Schema>) => Promise<string>;
