import { Account } from 'starknet';
import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
export declare class ApprovalService {
    private agent;
    constructor(agent: StarknetAgentInterface);
    private safeStringify;
    checkAndApproveToken(account: Account, tokenAddress: string, spenderAddress: string, amount: string): Promise<void>;
}
