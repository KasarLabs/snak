import { GraphNode, SupervisorNode } from '@enums/agent.enum.js';
import { EventType } from '@enums/event.enums.js';
import { ToolCall } from './tools.types.js';
import { GraphErrorType } from './graph.types.js';

export interface ChunkOutputMetadata {
  execution_mode?: string;
  retry?: number;
  tokens?: number;
  langgraph_step?: number;
  langgraph_node?: string;
  ls_provider?: string;
  ls_model_type?: string;
  ls_model_name?: string;
  ls_temperature?: number;
  transfer_to?: { agent_id: string; agent_name: string; query?: string }[];
  error?: GraphErrorType | null;
  final?: boolean;
  [key: string]: any;
}

export interface ChunkOutput {
  event: string;
  agent_id: string;
  run_id: string;
  thread_id: string;
  checkpoint_id: string;
  task_id?: string;
  step_id?: string;
  task_title?: string;
  from: GraphNode | SupervisorNode;
  tools?: ToolCall[];
  message?: string;
  metadata: ChunkOutputMetadata;
  timestamp?: string;
}
