import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { deployERC721Schema } from '../schemas/schema';
import { z } from 'zod';
export declare const deployERC721Contract: (agent: StarknetAgentInterface, params: z.infer<typeof deployERC721Schema>) => Promise<string>;
