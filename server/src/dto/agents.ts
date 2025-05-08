import { IsNotEmpty } from 'class-validator';

export class AgentRequestDTO {
  @IsNotEmpty()
  request: string;
  @IsNotEmpty()
  agent: string;
}

class AgentMemory {
  enabled: boolean;
  short_term_memory_size: number;
}

class AgentPrompt {
  bio: string;
  lore: string[];
  objectives: string[];
  knowledge: string[];
}

export class AgentInitializationDTO {
  name: string;
  prompt: AgentPrompt;
  interval: number;
  plugins: string[];
  memory: AgentMemory;
}

export class InitializesRequestDTO {
  @IsNotEmpty()
  agents: AgentInitializationDTO[];
}

export class AgentDeleteRequestDTO {
  @IsNotEmpty()
  agent: string;
}

export class AgentAddRequestDTO {
  @IsNotEmpty()
  agent: AgentInitializationDTO;
}
