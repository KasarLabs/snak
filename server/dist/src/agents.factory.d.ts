import { ConfigurationService } from '../config/configuration';
import { StarknetAgent } from '@starknet-agent-kit/agents';
export declare class AgentFactory {
    private readonly config;
    private json_config;
    private agentInstances;
    constructor(config: ConfigurationService);
    createAgent(signature: string, agentMode?: string): StarknetAgent;
}
