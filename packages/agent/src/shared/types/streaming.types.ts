import { GraphNode } from '@enums/agent-modes.enum.js';
import { EventType } from '@enums/event.enums.js';
import { ToolCall } from './tools.types.js';
import { AgentMode } from '@snakagent/core';

export interface ChunkOutputMetadata {
  execution_mode?: string;
  agent_mode?: AgentMode;
  retry?: number;
  tokens?: number;
  langgraph_step?: number;
  langgraph_node?: string;
  ls_provider?: string;
  ls_model_type?: string;
  ls_model_name?: string;
  ls_temperature?: number;
  final?: boolean;
  [key: string]: any;
}

export interface ChunkOutput {
  event: string;
  run_id: string;
  thread_id: string;
  checkpoint_id: string;
  from: GraphNode;
  tools?: ToolCall[];
  content?: string;
  plan?: Record<string, any>;
  metadata: ChunkOutputMetadata;
  timestamp?: string;
}
