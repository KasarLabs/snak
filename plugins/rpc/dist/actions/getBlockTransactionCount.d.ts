import { BlockIdParams } from '../schema';
import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
export declare const getBlockTransactionCount: (agent: StarknetAgentInterface, params: BlockIdParams) => Promise<number>;
