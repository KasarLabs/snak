import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { GetClassAtParams } from '../schema';
export declare const getClassAt: (agent: StarknetAgentInterface, params: GetClassAtParams) => Promise<string>;
