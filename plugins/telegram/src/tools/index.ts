import {
  StarknetAgentInterface,
  StarknetTool,
} from '@starknet-agent-kit/agents';
import { telegram_get_messages_from_conversation } from '../actions/telegram';
import { getTelegramMessageUpdateFromConversationSchema } from '../schema';

export const registerTools = (StarknetToolRegistry: StarknetTool[]) => {
  StarknetToolRegistry.push({
    name: 'telegram_get_messages_from_conversation',
    plugins: 'telegram',
    description: 'Get the lates messages of telegram channel',
    schema: getTelegramMessageUpdateFromConversationSchema,
    execute: telegram_get_messages_from_conversation,
  });
};
