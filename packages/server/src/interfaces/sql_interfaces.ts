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

export interface AgentMemorySQL {
  enabled: boolean;
  short_term_memory_size: number;
}

export interface AgentDocumentsSQL {
  enabled: boolean;
  embedding_model: string | null;
}

export interface AgentConfigSQL {
  id: string;
  name: string;
  group: string;
  description: string;
  lore: string[];
  objectives: string[];
  knowledge: string[];
  system_prompt?: string;
  interval: number;
  plugins: string[];
  memory: AgentMemorySQL;
  documents: AgentDocumentsSQL;
  mode: AgentMode;
  max_iterations: number;
}
