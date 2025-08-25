import { RpcProvider } from 'starknet';
import { AgentConfig, ModelsConfig } from '@snakagent/core';
import { AgentMode } from '../config/agentConfig.js';

export interface Conversation {
  conversation_name: string;
}

export interface AgentIterations {
  data: any;
}

export interface Message {
  agent_id: string;
  user_request: string;
  agent_iteration_id: string;
}

export interface ConversationResponse {
  conversation_id: number;
  conversation_name: string;
}

export interface OutputResponse {
  index: number;
  type: string;
  text: string;
}

export interface Response {
  output: Message;
  input: Message;
}

export interface ErrorResponse {
  statusCode: number;
  name: string;
  errorCode: string;
  errorMessage: string;
}

export interface ServerState {
  index: number;
  type: string;
  status: string;
  text: string;
}

/**
 * Configuration for the agent system initialization
 */
export interface AgentSystemConfig {
  starknetProvider: RpcProvider;
  accountPrivateKey: string;
  accountPublicKey: string;
  modelsConfig: ModelsConfig;
  agentMode: AgentMode;
  databaseCredentials: any;
  agentConfigPath?: AgentConfig;
  debug?: boolean;
}

/**
 * Main class for initializing and managing the agent system
 */
