import { IsNotEmpty } from 'class-validator';
import { AgentMode } from '../../agent.js';

/**
 * Configuration for agent memory settings
 */
export interface AgentMemory {
  enabled: boolean;
  short_term_memory_size: number;
  memory_size: number;
}

/**
 * Configuration for agent rag settings
 */
export interface AgentRag {
  enabled: boolean;
  embedding_model: string | null;
}

/**
 * Unified agent configuration interface for database storage
 */
export interface AgentConfigDatabase {
  name: string;
  group: string;
  description: string;
  lore: string[];
  objectives: string[];
  knowledge: string[];
  system_prompt?: string;
  interval: number;
  plugins: string[];
  memory: AgentMemory;
  rag: AgentRag;
  mode: AgentMode;
  max_iterations: number;
}

/**
 * DTO for adding a new agent
 */
export class AddAgentRequestDTO {
  @IsNotEmpty()
  agent: AgentConfigDatabase;
}

/**
 * DTO for retrieving messages from a specific agent
 */
export class MessageFromAgentIdDTO {
  @IsNotEmpty()
  agent_id: string;
  @IsNotEmpty()
  thread_id: string;
  limit_message: number | undefined;
}

/**
 * Interface for message requests to agents
 */
export interface MessageRequest {
  agent_id: string;
  user_request: string;
}

/**
 * DTO for agent initialization configuration
 */
export class AgentInitializationDTO {
  name: string;
  group: string;
  description: string;
  lore: string[];
  objectives: string[];
  knowledge: string[];
  system_prompt?: string;
  interval: number;
  plugins: string[];
  memory: AgentMemory;
  rag: AgentRag;
  mode: AgentMode;
  max_iterations: number;
}

/**
 * DTO for initializing multiple agents
 */
export class InitializesRequestDTO {
  @IsNotEmpty()
  agents: AgentInitializationDTO[];
}

/**
 * DTO for deleting a single agent
 */
export class AgentDeleteRequestDTO {
  @IsNotEmpty()
  agent_id: string;
}

/**
 * DTO for deleting multiple agents
 */
export class AgentsDeleteRequestDTO {
  @IsNotEmpty()
  agent_id: string[];
}

/**
 * DTO for adding an agent with initialization data
 */
export class AgentAddRequestDTO {
  @IsNotEmpty()
  agent: AgentInitializationDTO;
}

/**
 * DTO for agent requests with user input
 */
export class AgentRequestDTO {
  @IsNotEmpty()
  request: {
    agent_id: string;
    user_request: string;
  };
}

/**
 * DTO for updating model configuration
 */
export class UpdateModelConfigDTO {
  @IsNotEmpty()
  provider: string;
  @IsNotEmpty()
  model_name: string;
  @IsNotEmpty()
  description: string;
}
