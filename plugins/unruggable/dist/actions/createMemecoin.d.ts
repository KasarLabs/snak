import { CreateMemecoinParams } from '../schema/';
import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
export declare const createMemecoin: (agent: StarknetAgentInterface, params: CreateMemecoinParams) => Promise<string | {
    status: string;
    error: string;
}>;
