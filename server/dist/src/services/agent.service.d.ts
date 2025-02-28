import { ConfigurationService } from '../../config/configuration';
import { IAgentService, AgentExecutionResponse } from '../interfaces/agent-service.interface';
import { IAgent } from '../interfaces/agent.interface';
import { AgentRequestDTO } from '../dto/agents';
export declare class AgentService implements IAgentService {
    private readonly config;
    private readonly logger;
    constructor(config: ConfigurationService);
    handleUserRequest(agent: IAgent, userRequest: AgentRequestDTO): Promise<AgentExecutionResponse>;
    getAgentStatus(agent: IAgent): Promise<{
        isReady: boolean;
        walletConnected: boolean;
        apiKeyValid: boolean;
    }>;
}
