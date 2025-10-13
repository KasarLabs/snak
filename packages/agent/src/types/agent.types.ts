import { AgentConfig } from '@snakagent/core';
import { SnakAgent } from '../agents/core/snakAgent.js';
import { BaseAgent } from '@agents/core/baseAgent.js';

/**
 * Function type to resolve agent configurations for a given user
 */
export type AgentConfigResolver = (
  userId: string
) => Promise<AgentConfig.OutputWithId[]>;

/**
 * Function type to build a SnakAgent from a configuration
 */
export type AgentBuilder = (
  agentConfig: AgentConfig.OutputWithId
) => Promise<BaseAgent>;
