// Main exports
export * from './src/agent.js';
export * from './src/starknetAgent.js';
export * from './src/autonomousAgents.js';

// Tool-related exports
export {
  StarknetAgentInterface,
  StarknetTool,
  StarknetToolRegistry,
  createAllowedTools,
  registerTools,
} from './src/tools/tools.js';

export { StarknetAgent } from './src/starknetAgent.js';

export {
  SignatureTool,
  StarknetSignatureToolRegistry,
} from './src/tools/signatureTools.js';

// Config exports
export { JsonConfig, load_json_config } from './src/jsonConfig.js';

// Common exports
export { IAgent, AiConfig } from './common/index.js';

// Logger
export { default as logger } from './src/logger.js';

import * as metrics from './metrics.js';
export { metrics };
