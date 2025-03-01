import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { getTelegramMessageUpdateFromConversationParams } from '../schema';
export declare const telegram_get_messages_from_conversation: (agent: StarknetAgentInterface, params: getTelegramMessageUpdateFromConversationParams) => Promise<{
    status: string;
    messages: string[];
    error?: undefined;
} | {
    status: string;
    error: any;
    messages?: undefined;
}>;
