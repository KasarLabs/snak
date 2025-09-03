export interface MessageRequest {
  agent_id: string;
  user_request: string;
}

export interface Message {
  agent_id: string;
  user_request: string;
  agent_iteration_id: string;
}
