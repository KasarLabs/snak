import { BaseMessage } from '@langchain/core/messages';
import { IterationResponse } from './core/snakAgent.js';

export interface Conversation {
  conversation_name: string;
}

export interface AgentIterations {
  data: IterationResponse;
}

export interface MessageRequest {
  agent_id: string;
  user_request: string;
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

export interface ExecutionState {
  messages: BaseMessage[];
}
