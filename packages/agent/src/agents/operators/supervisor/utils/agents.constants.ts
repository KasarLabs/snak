import { supervisorAgentConfig } from '@snakagent/core';

/**
 * Reserved group name for system agents
 */
export const RESERVED_GROUP = supervisorAgentConfig.profile.group
  .trim()
  .toLowerCase();

/**
 * Reserved name for supervisor agent
 */
export const RESERVED_NAME = supervisorAgentConfig.profile.name
  .trim()
  .toLowerCase();
