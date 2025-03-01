import { BlockIdAndContractAddressParams } from '../schema';
import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
export declare const getClassHashAt: (agent: StarknetAgentInterface, params: BlockIdAndContractAddressParams) => Promise<string>;
