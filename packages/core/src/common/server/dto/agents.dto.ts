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
} from 'class-validator';

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
  @IsOptional()
  thread_id?: string;

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
  @IsString()
  @IsUUID()
  thread_id?: string;

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
  @IsString()
  @IsUUID()
  agent_id: string;

  @IsOptional()
  @IsString()
  @IsUUID()
  thread_id?: string;

  @IsOptional()
  @IsNotEmpty()
  @IsString()
  @Length(1, 10000)
  content?: string;
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

  /**
 * Request to get a specific agent’s MCP config
 */
export class GetAgentMcpsRequestDTO {
  @IsNotEmpty()
  @IsUUID()
  agent_id: string;
}

/**
 * Request to get all MCP server of a specific agent
 */
export class AgentMCPRequestDTO {
  @IsNotEmpty()
  @IsUUID()
  agent_id: string;

  @IsNotEmpty()
  @IsString()
  mcp_id: string;
}

/**
 * Request to update the value of one secret in a given MCP server
 */
export class UpdateMcpEnvValueRequestDTO {
  @IsNotEmpty()
  @IsUUID()
  agent_id: string;

  @IsNotEmpty()
  @IsString()
  mcp_id: string;

  @IsNotEmpty()
  @IsString()
  secret_name: string;

  @IsNotEmpty()
  @IsString()
  secret_value: string;
}

/**
 * Request to rename a secret key in an MCP config
 */
export class UpdateMcpEnvNameRequestDTO {
  @IsNotEmpty()
  @IsUUID()
  agent_id: string;

  @IsNotEmpty()
  @IsString()
  mcp_id: string;

  @IsNotEmpty()
  @IsString()
  old_name: string;

  @IsNotEmpty()
  @IsString()
  new_name: string;
}

/**
 * Request to replace --key value or --profile with a new value
 */
export class UpdateMcpValueRequestDTO {
  @IsNotEmpty()
  @IsUUID()
  agent_id: string;

  @IsNotEmpty()
  @IsString()
  mcp_id: string;

  @IsNotEmpty()
  @IsString()
  new_value: string;
}

/**
 * Request to delete multiple MCP servers
 */
export class DeleteMultipleMcpServersRequestDTO {
  @IsNotEmpty()
  @IsUUID()
  agent_id: string;

  @IsArray()
  @ArrayNotEmpty()
  mcp_ids: string[];
}

/**
 * Request to add one or more new MCP servers
 */
export class AddMcpServerRequestDTO {
  @IsNotEmpty()
  @IsUUID()
  agent_id: string;

  @IsNotEmpty()
  mcpServers: Record<
    string,
    {
      command: string;
      args?: string[] | string;
      env?: Record<string, string>;
      [key: string]: any;
    }
  >;
}

/**
 * Request to update an entire agent’s MCP server object
 */
export class UpdateAgentMcpDTO {
  @IsNotEmpty()
  @IsUUID()
  id: string;

  @IsNotEmpty()
  mcp_servers: Record<string, any>; // Replace Record<string, McpServerConfig>
}
