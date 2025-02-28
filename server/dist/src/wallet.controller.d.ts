import { OnModuleInit } from '@nestjs/common';
import { WalletService } from './services/wallet.service';
import { AgentRequestDTO } from './dto/agents';
import { FastifyRequest } from 'fastify';
import { AgentFactory } from './agents.factory';
export declare class WalletController implements OnModuleInit {
    private readonly walletService;
    private readonly agentFactory;
    private agent;
    constructor(walletService: WalletService, agentFactory: AgentFactory);
    onModuleInit(): Promise<void>;
    handleUserCalldataRequest(userRequest: AgentRequestDTO): Promise<any>;
    HandleOutputIAParsing(userRequest: AgentRequestDTO): Promise<any>;
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
