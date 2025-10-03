/**
 * Main entry point for the Snak Agent package
 * Exports all public APIs and types from the restructured codebase
 */

// Main agent exports
export { SnakAgent } from './agents/core/snakAgent.js';

// Core agent utilities
export { initializeToolsList } from './tools/tools.js';
export type {
  ChunkOutput,
  ChunkOutputMetadata,
} from './shared/types/streaming.types.js';

// Graph mode exports
export { createGraph } from './agents/graphs/graph.js';

// Agent operators
export { AgentSelector } from './agents/operators/agentSelector.js';

// Agent types
export type { AgentConfigResolver, AgentBuilder } from './types/agent.types.js';

// Tool-related exports
export type {
  SnakAgentInterface,
  StarknetTool,
} from './shared/types/tools.types.js';

export { createAllowedTools, registerTools } from './tools/tools.js';
export type { SnakToolRegistry } from './tools/tools.js';

// Consolidated exports from new structure
export * from './shared/types/index.js'; // All types
export * from './shared/enums/index.js'; // All enums
export * from './shared/lib/memory/index.js'; // Memory utilities (if index.ts exists)
export * from './shared/lib/token/index.js'; // Token tracking (if index.ts exists)
export * from './shared/prompts/index.js'; // All prompts
// Legacy exports for backward compatibility
export type { IAgent } from './shared/types/agents.types.js';
