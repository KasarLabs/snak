import { IsNotEmpty } from 'class-validator';
import { StarknetAgentInterface } from '@hijox/core';

export class CreateAgentDTO {
  @IsNotEmpty()
  accountagent: StarknetAgentInterface;
  @IsNotEmpty()
  anthropicApiKey: string;
  @IsNotEmpty()
  agentName: string;
}
