import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { DepositTroveParams } from '../schemas';
export declare const depositTrove: (agent: StarknetAgentInterface, params: DepositTroveParams) => Promise<string>;
