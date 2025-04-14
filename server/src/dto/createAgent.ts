import { IsNotEmpty } from 'class-validator';
import { StarknetAgentInterface } from '@hijox/agents';

export class CreateAgentDTO {
  @IsNotEmpty()
  accountagent: StarknetAgentInterface;
  @IsNotEmpty()
  anthropicApiKey: string;
  @IsNotEmpty()
  agentName: string;
}
