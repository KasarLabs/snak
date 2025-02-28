import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { OpenTroveParams } from '../schemas';
export declare const openTrove: (agent: StarknetAgentInterface, params: OpenTroveParams) => Promise<string>;
