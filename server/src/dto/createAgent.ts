import { IsNotEmpty } from 'class-validator';
import { StarknetAgentInterface } from '@kasarlabs/agents';

export class CreateAgentDTO {
  @IsNotEmpty()
  accountagent: StarknetAgentInterface;
  @IsNotEmpty()
  anthropicApiKey: string;
  @IsNotEmpty()
  agentName: string;
}
