import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { GetBalanceParams, GetOwnBalanceParams } from '../types/balance';
export declare const getOwnBalance: (agent: StarknetAgentInterface, params: GetOwnBalanceParams) => Promise<string>;
export declare const getBalance: (agent: StarknetAgentInterface, params: GetBalanceParams) => Promise<string>;
export declare const getBalanceSignature: (params: GetBalanceParams) => Promise<string>;
