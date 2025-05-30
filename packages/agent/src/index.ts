// Main exports
export type { SnakAgentConfig } from './agents/core/snakAgent.js';
export { SnakAgent } from './agents/core/snakAgent.js';

// Agent-related exports
// Interactive agent exports
export { createInteractiveAgent } from './agents/modes/interactive.js';

export { initializeToolsList } from './agents/core/utils.js';

// Autonomous agent exports
export { createAutonomousAgent } from './agents/modes/autonomous.js';

// Tool-related exports
export type {
  SnakAgentInterface,
  StarknetTool,
  StarknetToolRegistry,
} from './tools/tools.js';

export { createAllowedTools, registerTools } from './tools/tools.js';

export type {
  SignatureTool,
  StarknetSignatureToolRegistry,
} from './tools/signatureTools.js';

// Config exports
export {
  load_json_config,
  AgentMode,
  createContextFromJson,
} from './config/agentConfig.js';

// Common exports
export type { IAgent, AiConfig } from './common/index.js';

export type { AgentSystemConfig } from './agents/index.js';
export { AgentSystem } from './agents/index.js';

// Supervisor exports
export { SupervisorAgent } from './agents/supervisor/supervisorAgent.js';
export type { SupervisorAgentConfig } from './agents/supervisor/supervisorAgent.js';
