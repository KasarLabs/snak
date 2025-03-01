import { BlockIdAndContractAddressParams } from '../schema';
import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
export declare const getNonceForAddress: (agent: StarknetAgentInterface, params: BlockIdAndContractAddressParams) => Promise<string>;
