import { ContractAddressParams } from '../schema';
import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
export declare const isMemecoin: (agent: StarknetAgentInterface, params: ContractAddressParams) => Promise<string>;
