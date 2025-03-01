import { BlockIdParams } from '../schema';
import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
export declare const getBlockWithTxs: (agent: StarknetAgentInterface, params: BlockIdParams) => Promise<string>;
