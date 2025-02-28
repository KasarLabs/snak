import { SimulateDeployTransactionAccountParams, SimulateInvokeTransactionParams, SimulateDeployTransactionParams, SimulateDeclareTransactionAccountParams } from '../types/simulateTransactionTypes';
import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
export declare const simulateInvokeTransaction: (agent: StarknetAgentInterface, params: SimulateInvokeTransactionParams) => Promise<string>;
export declare const simulateDeployAccountTransaction: (agent: StarknetAgentInterface, params: SimulateDeployTransactionAccountParams) => Promise<string>;
export declare const simulateDeployTransaction: (agent: StarknetAgentInterface, params: SimulateDeployTransactionParams) => Promise<string>;
export declare const simulateDeclareTransaction: (agent: StarknetAgentInterface, params: SimulateDeclareTransactionAccountParams) => Promise<string>;
