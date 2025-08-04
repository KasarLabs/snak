export interface AgentConfig {
  name: string;
}

export const logger = {
  warn: (..._args: any[]) => {},
  error: (..._args: any[]) => {},
  debug: (..._args: any[]) => {},
};

export const metrics = {
  metricsAgentToolUseCount: (..._args: any[]) => {},
};