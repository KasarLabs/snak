import { GetStorageParams } from '../schema';
import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
export declare const getStorageAt: (agent: StarknetAgentInterface, params: GetStorageParams) => Promise<string>;
