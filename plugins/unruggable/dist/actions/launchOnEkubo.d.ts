import { LaunchOnEkuboParams } from '../schema/';
import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
export declare const launchOnEkubo: (agent: StarknetAgentInterface, params: LaunchOnEkuboParams) => Promise<string>;
