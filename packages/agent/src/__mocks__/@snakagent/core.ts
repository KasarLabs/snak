export interface AgentConfig {
  name: string;
  description?: string;
}

export interface ModelLevelConfig {
  provider: string;
  model_name: string;
  description?: string;
  max_input_tokens?: number;
  max_output_tokens?: number;
}

export interface ModelsConfig {
  fast: ModelLevelConfig;
  smart: ModelLevelConfig;
  cheap: ModelLevelConfig;
  [levelName: string]: ModelLevelConfig;
}

export interface ApiKeys {
  openai?: string;
  anthropic?: string;
  gemini?: string;
  deepseek?: string;
  [providerName: string]: string | undefined;
}

export const logger = {
  warn: (..._args: any[]) => {},
  error: (..._args: any[]) => {},
  debug: (..._args: any[]) => {},
};

export const metrics = {
  metricsAgentToolUseCount: (..._args: any[]) => {},
};