import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
  Max,
  IsInt,
} from 'class-validator';

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
  content: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1)
  hitl_threshold?: number;
}

export class Message {
  @IsString()
  @IsUUID()
  agent_id: string;

  @IsNotEmpty()
  @IsString()
  @Length(1, 10000)
  content: string;
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
