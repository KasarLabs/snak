import { isNull } from 'util';
import { AgentConfig } from '../../agent.js';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  IsArray,
  Length,
  Min,
  Max,
  IsInt,
  Matches,
  ArrayNotEmpty,
  ArrayMinSize,
  ArrayMaxSize,
  isNotEmpty,
  isUUID,
  IsIn,
} from 'class-validator';

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
 * DTO for adding a new agent
 */
export class AddAgentRequestDTO {
  @IsNotEmpty()
  agent: AgentConfig.Input;
}

/**
 * DTO for retrieving messages from a specific agent
 */
export class MessageFromAgentIdDTO {
  @IsNotEmpty()
  @IsString()
  @IsUUID()
  agent_id: string;

  @IsNotEmpty()
  @IsString()
  thread_id: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit_message?: number;
}

/**
 * Interface for message requests to agents
 */
export class MessageRequest {
  @IsNotEmpty()
  @IsString()
  @IsUUID()
  agent_id: string;

  @IsString()
  @Length(1, 10000)
  request: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1)
  hitl_threshold?: number;
}

/**
 * DTO for deleting multiple agents
 */
export class AgentsDeleteRequestDTO {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsUUID(undefined, { each: true })
  agent_id: string[];
}

/**
 * DTO for updating model configuration
 */
export class UpdateModelConfigDTO {
  @IsNotEmpty()
  @IsString()
  @Length(1, 50)
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message:
      'Provider must contain only alphanumeric characters, hyphens, and underscores',
  })
  model_provider: string;

  @IsNotEmpty()
  @IsString()
  @Length(1, 100)
  @Matches(/^[a-zA-Z0-9._:-]+$/, {
    message:
      'Model name must contain only alphanumeric characters, dots, colons, hyphens, and underscores',
  })
  modelName: string;

  @Min(0)
  @Max(2)
  @Matches(/^-?\d+(\.\d+)?$/, { message: 'Temperature must be a number' })
  temperature: number;

  @IsInt()
  @Min(1)
  maxTokens: number;
}

export class Message {
  @IsOptional()
  @IsString()
  @IsUUID()
  agent_id?: string;

  @IsNotEmpty()
  @IsString()
  @Length(1, 50)
  @Matches(/^[a-zA-Z_]+$/, {
    message: 'Sender type must contain only letters and underscores',
  })
  sender_type: string;

  @IsOptional()
  @IsNotEmpty()
  @IsString()
  @Length(1, 10000)
  content?: string;

  @IsNotEmpty()
  @IsString()
  @Length(1, 50)
  @Matches(/^[a-zA-Z_]+$/, {
    message: 'Status must contain only letters and underscores',
  })
  status: string;
}

export class AgentRequestDTO {
  @IsNotEmpty()
  request: Message;
}

export class SupervisorRequest {
  @IsNotEmpty()
  @IsString()
  @Length(1, 10000)
  content: string;

  @IsOptional()
  @IsString()
  @IsUUID()
  agentId?: string; // Optional: specify which agent to use
}

export class SupervisorRequestDTO {
  @IsNotEmpty()
  request: SupervisorRequest;
}

export class getMessagesFromAgentsDTO {
  @IsNotEmpty()
  @IsString()
  @IsUUID()
  agent_id: string;

  @IsNotEmpty()
  @IsString()
  thread_id: string;
}
export class InitializesRequestDTO {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  agents: AgentConfig.Input[];
}

export class AgentDeleteRequestDTO {
  @IsNotEmpty()
  @IsString()
  @IsUUID()
  agent_id: string;
}

export class AgentDeletesRequestDTO {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsUUID(undefined, { each: true })
  agent_id: string[];
}

export class AgentAddRequestDTO {
  @IsNotEmpty()
  agent: AgentConfig.Input;
}

export class AgentAvatarResponseDTO {
  @IsNotEmpty()
  @IsString()
  @IsUUID()
  agent_id: string;

  @IsNotEmpty()
  @IsString()
  @Length(1, 50)
  @Matches(/^image\/(jpeg|png|gif|webp)$/, {
    message: 'MIME type must be a valid image format',
  })
  avatar_mime_type: string;
}

export type AgentResponse<T = unknown> =
  | { status: 'success'; data: T }
  | { status: 'waiting_for_human_input'; data?: T }
  | { status: 'failure'; error: string; data?: T };
