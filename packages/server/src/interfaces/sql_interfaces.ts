import { AgentMode } from '@snakagent/core';

export interface ConversationSQL {
  conversation_id: number;
  conversation_name: string;
  created_at: Date;
  status: string;
}

export interface MessageSQL {
  id: string;
  agent_id: string;
  user_request: string;
  agent_iteration: any;
  created_at: Date;
}
