import { IsNotEmpty } from 'class-validator';

export class AgentRequestDTO {
  @IsNotEmpty()
  agentName: string;
  @IsNotEmpty()
  request: string;
}

export class AgentStatusRequestDTO {
  @IsNotEmpty()
  agentName: string;
}
