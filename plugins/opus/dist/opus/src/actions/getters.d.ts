import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { GetTroveHealthParams, GetUserTrovesParams } from '../schemas';
export declare const getUserTroves: (agent: StarknetAgentInterface, params: GetUserTrovesParams) => Promise<string>;
export declare const getTroveHealth: (agent: StarknetAgentInterface, params: GetTroveHealthParams) => Promise<string>;
export declare const getBorrowFee: (agent: StarknetAgentInterface) => Promise<string>;
