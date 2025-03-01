import { BlockIdParams } from '../schema';
import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
export declare const getBlockWithReceipts: (agent: StarknetAgentInterface, params: BlockIdParams) => Promise<string>;
