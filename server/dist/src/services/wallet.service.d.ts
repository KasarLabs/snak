import { ConfigurationService } from '../../config/configuration';
import { IAgent } from '../interfaces/agent.interface';
import { AgentRequestDTO } from '../dto/agents';
import { IWalletService } from '../interfaces/wallet-service.inferface';
export declare class WalletService implements IWalletService {
    private readonly config;
    private readonly logger;
    constructor(config: ConfigurationService);
    handleUserCalldataRequest(agent: IAgent, userRequest: AgentRequestDTO): Promise<any>;
    HandleOutputIAParsing(userRequest: AgentRequestDTO): Promise<any>;
    getAgentStatus(agent: IAgent): Promise<{
        isReady: boolean;
        walletConnected: boolean;
        apiKeyValid: boolean;
    }>;
}
