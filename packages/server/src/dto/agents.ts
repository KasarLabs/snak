import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export interface Message {
  agent_id?: string;
  sender_type: string;
  content: string;
  status: string;
}

export class AgentRequestDTO {
  @IsNotEmpty()
  request: Message;
}

export class SupervisorRequest {
  @IsNotEmpty()
  @IsString()
  content: string;

  @IsOptional()
  @IsString()
  agentId?: string; // Optional: specify which agent to use
}

export class SupervisorRequestDTO {
  @IsNotEmpty()
  request: SupervisorRequest;
}

export class getMessagesFromAgentsDTO {
  @IsNotEmpty()
  agent_id: string;
}

interface AgentMemory {
  enabled: boolean;
  short_term_memory_size: number;
  memory_size: number;
}

interface AgentRag {
  enabled: boolean;
  embedding_model: string | null;
}

interface AgentPrompt {
  lore: string[];
  objectives: string[];
  knowledge: string[];
}

export class AgentInitializationDTO {
  name: string;
  group: string;
  description: string;
  prompt: AgentPrompt;
  interval: number;
  plugins: string[];
  memory: AgentMemory;
  rag: AgentRag;
}

export class InitializesRequestDTO {
  @IsNotEmpty()
  agents: AgentInitializationDTO[];
}

export class AgentDeleteRequestDTO {
  @IsNotEmpty()
  agent_id: string;
}

export class AgentDeletesRequestDTO {
  @IsNotEmpty()
  agent_id: string[];
}

export class AgentAddRequestDTO {
  @IsNotEmpty()
  agent: AgentInitializationDTO;
}

export class UpdateModelConfigDTO {
  @IsNotEmpty()
  provider: string;
  @IsNotEmpty()
  model_name: string;
  @IsNotEmpty()
  description: string;
}

export class AgentAvatarResponseDTO {
  @IsNotEmpty()
  agent_id: string;

  @IsNotEmpty()
  avatar_mime_type: string;
}
