import { IsNotEmpty } from 'class-validator';
import { StarknetAgentInterface } from '@snakagent/core';

export class CreateAgentDTO {
  @IsNotEmpty()
  accountagent: StarknetAgentInterface;
  @IsNotEmpty()
  anthropicApiKey: string;
  @IsNotEmpty()
  agentName: string;
}
