// ---------------------
// Agent exports
// ---------------------
export type { SnakAgentConfig } from './agents/core/snakAgent.js';
export { SnakAgent } from './agents/core/snakAgent.js';
export { createInteractiveAgent } from './agents/modes/interactive.js';
export { createAutonomousAgent } from './agents/modes/autonomous.js';
export { initializeToolsList } from './agents/core/utils.js';
export type { AgentSystemConfig } from './agents/index.js';
export { AgentSystem } from './agents/index.js';
export { SupervisorAgent } from './agents/supervisor/supervisorAgent.js';
export type { SupervisorAgentConfig } from './agents/supervisor/supervisorAgent.js';
export type { IAgent, IExtendedAgent, AiConfig } from './common/index.js';

// ---------------------
// Tool exports
// ---------------------
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

// ---------------------
// Config exports
// ---------------------
export {
  load_json_config,
  AgentMode,
  createContextFromJson,
} from './config/agentConfig.js';