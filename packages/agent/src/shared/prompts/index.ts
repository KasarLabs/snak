/**
 * Re-export all prompts from the prompts directory
 */

// Core prompts
export * from './core/prompts.js';
export * from './core/mcpAgentPrompts.js';

// Agent prompts (prefer these over core versions to avoid conflicts)
export * from './agents/selector.prompts.js';

// Task Manager prompts
export * from './agents/task-manager.prompts.js';
export * from './agents/task-executor.prompt.js';
export * from './agents/task-verifier.prompts.js';
export * from './agents/task-memory-manager.prompt.js';
