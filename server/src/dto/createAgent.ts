import { IsNotEmpty } from 'class-validator';
import { StarknetAgentInterface } from '@kasarlabs/core';

export class CreateAgentDTO {
  @IsNotEmpty()
  accountagent: StarknetAgentInterface;
  @IsNotEmpty()
  anthropicApiKey: string;
  @IsNotEmpty()
  agentName: string;
}
