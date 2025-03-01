import { SystemMessage } from '@langchain/core/messages';
export interface Token {
    symbol: string;
    amount: number;
}
export interface Transfer_limit {
    token: Token[];
}
export interface JsonConfig {
    name: string;
    prompt: SystemMessage;
    interval: number;
    chat_id: string;
    internal_plugins: string[];
    external_plugins?: string[];
    autonomous?: boolean;
}
export declare const validateConfig: (config: JsonConfig) => void;
export declare const load_json_config: (agent_config_name: string) => JsonConfig | undefined;
