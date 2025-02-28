import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { RepayTroveParams } from '../schemas';
export declare const repayTrove: (agent: StarknetAgentInterface, params: RepayTroveParams) => Promise<string>;
