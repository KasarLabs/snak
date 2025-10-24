/**
 * Main entry point for the Snak Agent package
 * Exports all public APIs and types from the restructured codebase
 */

// Main agent exports
export { SnakAgent } from './agents/core/snakAgent.js';
export { SupervisorAgent } from './agents/core/supervisorAgent.js';

export { BaseAgent } from './agents/core/baseAgent.js';
// Core agent utilities
export { initializeToolsList } from './tools/tools.js';
export type {
  ChunkOutput,
  ChunkOutputMetadata,
} from './shared/types/streaming.type.js';

// Graph mode exports
export { createGraph } from './agents/graphs/core-graph/agent.graph.js';

// Agent operators
export * from './agents/operators/supervisor/index.js';

// Agent types
export type {
  AgentConfigResolver,
  AgentBuilder,
} from './shared/types/agent.type.js';

// Tool-related exports

// Consolidated exports from new structure
export * from './shared/types/index.js'; // All types
export * from './shared/enums/index.js'; // All enums
export * from './shared/lib/memory/index.js'; // Memory utilities (if index.ts exists)
export * from './shared/lib/token/index.js'; // Token tracking (if index.ts exists)
export * from './shared/prompts/index.js'; // All prompts
// Legacy exports for backward compatibility
