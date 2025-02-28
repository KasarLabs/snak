import { OnModuleInit } from '@nestjs/common';
import { AgentRequestDTO } from './dto/agents';
import { AgentService } from './services/agent.service';
import { FastifyRequest } from 'fastify';
import { AgentFactory } from './agents.factory';
export declare class AgentsController implements OnModuleInit {
    private readonly agentService;
    private readonly agentFactory;
    private agent;
    constructor(agentService: AgentService, agentFactory: AgentFactory);
    onModuleInit(): Promise<void>;
    handleUserRequest(userRequest: AgentRequestDTO): Promise<import("./interfaces/agent-service.interface").AgentExecutionResponse>;
    getAgentStatus(): Promise<{
        isReady: boolean;
        walletConnected: boolean;
        apiKeyValid: boolean;
    }>;
    uploadFile(req: FastifyRequest): Promise<{
        status: string;
        data: string;
    }>;
    deleteUploadFile(filename: {
        filename: string;
    }): Promise<{
        status: string;
        data: string;
    }>;
}
