/**
 * Main entry point for the Snak Agent package
 * Exports all public APIs and types from the restructured codebase
 */

// Main agent exports
export type { SnakAgentConfig } from './agents/core/snakAgent.js';
export { SnakAgent } from './agents/core/snakAgent.js';

// Core agent utilities
export { initializeToolsList } from './tools/tools.js';
export type {
  ChunkOutput,
  ChunkOutputMetadata,
} from './types/streaming.types.js';

// Graph mode exports
export { createGraph } from './agents/modes/graph/graph.js';

// Agent operators
export { ModelSelector } from './agents/operators/modelSelector.js';
export { AgentSelector } from './agents/operators/agentSelector.js';

// Tool-related exports
export type {
  SnakAgentInterface,
  StarknetTool,
  SignatureTool,
} from './types/tools.types.js';

export { createAllowedTools, registerTools } from './tools/tools.js';
export type { SnakToolRegistry } from './tools/tools.js';

// Consolidated exports from new structure
export * from './types/index.js'; // All types
export * from './enums/index.js'; // All enums
export * from './lib/memory/index.js'; // Memory utilities (if index.ts exists)
export * from './lib/token/index.js'; // Token tracking (if index.ts exists)

// Legacy exports for backward compatibility
export type { IAgent } from './types/agents.types.js';
