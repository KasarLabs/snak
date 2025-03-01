import { GetTransactionByBlockIdAndIndexParams } from '../schema';
import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
export declare const getTransactionByBlockIdAndIndex: (agent: StarknetAgentInterface, params: GetTransactionByBlockIdAndIndexParams) => Promise<string>;
