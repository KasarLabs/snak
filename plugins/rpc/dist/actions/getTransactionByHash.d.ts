import { TransactionHashParams } from '../schema';
import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
export declare const getTransactionByHash: (agent: StarknetAgentInterface, params: TransactionHashParams) => Promise<string>;
