import { AgentRequestDTO } from '@snakagent/core';
import { IAgent } from './agent.interface.js';

export interface AgentExecutionResponse {
  status: 'success' | 'failure';
  data?: unknown;
  error?: {
    message: string;
    code?: string;
    details?: unknown;
  };
}

export interface AgentExecutionCallDataResponse {
  status: 'success' | 'failure';
  data?: unknown;
  error?: {
    message: string;
    code?: string;
    details?: unknown;
  };
}

export interface IWalletService {
  handleUserCalldataRequest(
    agent: IAgent,
    userRequest: AgentRequestDTO
  ): Promise<AgentExecutionResponse>;
  getAgentStatus(agent: IAgent): Promise<{
    isReady: boolean;
    walletConnected: boolean;
    apiKeyValid: boolean;
  }>;
}
