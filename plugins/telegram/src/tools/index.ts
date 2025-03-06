import {
  StarknetTool,
  StarknetAgentInterface,
} from '@starknet-agent-kit/agents';
import { telegram_get_messages_from_conversation } from '../actions/telegram.js';
import { getTelegramMessageUpdateFromConversationSchema } from '../schema/index.js';

export const registerTools = (
  StarknetToolRegistry: StarknetTool[],
  agent?: StarknetAgentInterface
) => {
  StarknetToolRegistry.push({
    name: 'telegram_get_messages_from_conversation',
    plugins: 'telegram',
    description: 'Get the lates messages of telegram channel',
    schema: getTelegramMessageUpdateFromConversationSchema,
    execute: telegram_get_messages_from_conversation,
  });
};
