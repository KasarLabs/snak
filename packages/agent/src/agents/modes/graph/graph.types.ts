/**
 * Graph-specific types (local to graph mode)
 */

/**
 * Graph configuration interface
 */
export interface GraphConfig {
  maxGraphSteps: number;
  shortTermMemory: number;
  memorySize: number;
  maxRetries: number;
  toolTimeout: number;
  humanInTheLoop: number;
  planValidationEnabled: boolean;
  agent_config: any; // AgentConfig from core
}

/**
 * Configuration validator type
 */
export interface ConfigValidator {
  validate(config: GraphConfig): boolean;
  getDefaults(): GraphConfig;
}