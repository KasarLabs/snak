// Main exports
export * from './src/agent.js';
export * from './src/starknetAgent.js';
export * from './src/autonomousAgents.js';
export { PostgresAdaptater } from './src/databases/postgresql/src/database.js';

// Tool-related exports
export type {
  StarknetAgentInterface,
  StarknetTool,
  StarknetToolRegistry,
} from './src/tools/tools.js';
export { createAllowedTools, registerTools } from './src/tools/tools.js';

export { StarknetAgent } from './src/starknetAgent.js';

export type {
  SignatureTool,
  StarknetSignatureToolRegistry,
} from './src/tools/signatureTools.js';

// Config exports
export {
  load_json_config,
  createContextFromJson,
} from './src/jsonConfig.js';

export type {
  JsonConfig
} from './src/jsonConfig.js';

// Common exports
export type { IAgent, AiConfig } from './common/index.js';

// Logger
export { default as logger } from './src/logger.js';
// External tools
export * from './src/tools/external_tools.js';

import * as metrics from './metrics.js';
export { metrics };
