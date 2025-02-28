import { TransactionHashParams } from '../schema';
import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
export declare const getTransactionReceipt: (agent: StarknetAgentInterface, params: TransactionHashParams) => Promise<string>;
