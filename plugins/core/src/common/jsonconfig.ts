import { SystemMessage } from '@langchain/core/messages';

export interface JsonConfig {
    name: string;
    prompt?: SystemMessage;
    interval: number;
    chat_id: string;
    internal_plugins: string[];
    external_plugins?: string[];
    mcp?: boolean;
    autonomous?: boolean;
  }