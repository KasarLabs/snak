import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
export interface transferPayloads {
    recipient_address: string;
    amount: string;
    symbol: string;
}
export declare const transfer: (agent: StarknetAgentInterface, payloads: transferPayloads) => Promise<string>;
export type TransferPlayloadSchema = {
    symbol: string;
    recipient_address: string;
    amount: string;
};
export declare const transfer_signature: (input: {
    payloads: TransferPlayloadSchema[];
}) => Promise<any>;
