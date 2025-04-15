// Main exports
export type {
  StarknetAgentConfig,
  LoggingOptions,
} from './agents/core/starknetAgent.js';
export { StarknetAgent } from './agents/core/starknetAgent.js';

// Agent-related exports
// Interactive agent exports
export {
  selectModel,
  createAgent,
  initializeToolsList,
} from './agents/interactive/agent.js';

// Autonomous agent exports
export { createAutonomousAgent } from './agents/autonomous/autonomousAgents.js';

// Tool-related exports
export type {
  StarknetAgentInterface,
  StarknetTool,
  StarknetToolRegistry,
} from './tools/tools.js';

export { createAllowedTools, registerTools } from './tools/tools.js';

export type {
  SignatureTool,
  StarknetSignatureToolRegistry,
} from './tools/signatureTools.js';

// Config exports
export type { JsonConfig } from './config/jsonConfig.js';
export { load_json_config } from './config/jsonConfig.js';

// Common exports
export type { IAgent, AiConfig } from './common/index.js';
