import { AgentConfig } from '../../../agent/interfaces/agent.interface.js';
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
} from 'class-validator';

/**
 * DTO for adding a new agent
 */
export class AddAgentRequestDTO {
  @IsNotEmpty()
  agent: AgentConfig.Input;
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
  agent: AgentConfig.InputWithPartialConfig;
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