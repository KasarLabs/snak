import { Injectable } from '@nestjs/common';
import { ConfigurationService } from '../config/configuration';
import {
  StarknetAgent,
  JsonConfig,
  load_json_config,
} from '@starknet-agent-kit/agents';

@Injectable()
export class AgentFactory {
  private json_config: JsonConfig;
  private agentInstances: Map<string, StarknetAgent> = new Map();

  constructor(private readonly config: ConfigurationService) {
    const json_config = load_json_config('default.agent.json');
    if (!json_config) {
      throw new Error('Failed to load agent configuration');
    }
    this.json_config = json_config;
  }

  createAgent(signature: string, agentMode: string = 'agent'): StarknetAgent {
    if (this.agentInstances.has(signature)) {
      const agentSignature = this.agentInstances.get(signature);
      if (!agentSignature)
        throw new Error(
          `Agent with signature ${signature} exists in map but returned undefined`
        );
      return agentSignature;
    }

    // Create new agent instance
    const agent = new StarknetAgent({
      provider: this.config.starknet.provider,
      accountPrivateKey: this.config.starknet.privateKey,
      accountPublicKey: this.config.starknet.publicKey,
      aiModel: this.config.ai.model,
      aiProvider: this.config.ai.provider,
      aiProviderApiKey: this.config.ai.apiKey,
      agentconfig: this.json_config,
      signature: signature,
      agentMode: agentMode,
    });
    // Store for later reuse
    this.agentInstances.set(signature, agent);

    return agent;
  }
}
