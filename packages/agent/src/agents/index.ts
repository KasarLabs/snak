export interface MessageRequest {
  agent_id: string;
  user_request: string | null;
}

export interface Message {
  agent_id: string;
  user_request: string;
  agent_iteration_id: string;
}
