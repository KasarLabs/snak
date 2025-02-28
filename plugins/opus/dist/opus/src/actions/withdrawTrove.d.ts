import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { WithdrawTroveParams } from '../schemas';
export declare const withdrawTrove: (agent: StarknetAgentInterface, params: WithdrawTroveParams) => Promise<string>;
