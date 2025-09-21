import { IsNotEmpty } from 'class-validator';
import { MessageRequest } from './agents.js';
import { AgentConfig, Id } from '@common/agent.js';
export class WebsocketAgentAddRequestDTO {
  @IsNotEmpty()
  agent: AgentConfig<Id.NoId>;
  @IsNotEmpty()
  socket_id: string;
}

export class WebsocketAgentRequestDTO {
  @IsNotEmpty()
  request: MessageRequest;
  @IsNotEmpty()
  socket_id: string;
}

export class WebsocketAgentDeleteRequestDTO {
  @IsNotEmpty()
  agent_id: string;
  @IsNotEmpty()
  socket_id: string;
}

export class WebsocketGetAgentsConfigRequestDTO {
  @IsNotEmpty()
  socket_id: string;
}

export class WebsocketSupervisorRequestDTO {
  @IsNotEmpty()
  request: {
    content: string;
    agentId?: string;
  };
  @IsNotEmpty()
  socket_id: string;
}

export class WebsocketGetMessagesRequestDTO {
  @IsNotEmpty()
  agent_id: string;
  thread_id: string;
  @IsNotEmpty()
  socket_id: string;
  limit_message: number | undefined;
}
