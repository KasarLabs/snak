import { Account, Call } from 'starknet';
import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
export declare class ApprovalService {
    private agent;
    private fibrous;
    constructor(agent: StarknetAgentInterface);
    checkAndGetApproveToken(account: Account, tokenAddress: string, spenderAddress: string, amount: string): Promise<Call | null>;
}
