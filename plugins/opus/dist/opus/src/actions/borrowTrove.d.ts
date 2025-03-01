import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { BorrowTroveParams } from '../schemas';
export declare const borrowTrove: (agent: StarknetAgentInterface, params: BorrowTroveParams) => Promise<string>;
