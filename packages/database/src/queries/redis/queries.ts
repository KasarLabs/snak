import { getRedisClient } from '../../redis.js';
import { AgentConfig } from '@snakagent/core';
import { logger } from '@snakagent/core';

/**
 * Error thrown when attempting to create a duplicate agent
 */
export class AgentDuplicateError extends Error {
  constructor(agentId: string, userId: string) {
    super(`Agent with id ${agentId} and user_id ${userId} already exists`);
    this.name = 'AgentDuplicateError';
  }
}

/**
 * Save an agent configuration to Redis
 * Uses atomic operations to ensure consistency across all indexes
 * 
 * @param dto - Agent configuration to save
 * @throws {AgentDuplicateError} If an agent with the same (agent_id, user_id) pair already exists
 * @throws {Error} If the Redis transaction fails
 */
export async function saveAgent(
  dto: AgentConfig.OutputWithId
): Promise<void> {
  const redis = getRedisClient();
  const agentKey = `agents:${dto.id}`;
  const userSetKey = `agents:by-user:${dto.user_id}`;
  const pairIndexKey = `agents:idx:agent-user:${dto.id}:${dto.user_id}`;

  try {
    // Start a transaction
    const multi = redis.multi();

    // SET agents:{id} JSON(dto)
    multi.set(agentKey, JSON.stringify(dto));

    // SADD agents:by-user:{dto.user_id} {id}
    multi.sadd(userSetKey, dto.id);

    // SET NX agents:idx:agent-user:{id}:{dto.user_id} {id}
    // This ensures uniqueness of (agent_id, user_id) pairs
    multi.setnx(pairIndexKey, dto.id);

    // Execute transaction
    const results = await multi.exec();

    if (!results) {
      throw new Error('Redis transaction failed: no results returned');
    }

    // Check if the pair index was successfully set (setnx returns 1 if set, 0 if already exists)
    const setnxResult = results[2]; // Third command is SETNX
    if (setnxResult[1] === 0) {
      // The key already existed, so we have a duplicate
      // Roll back by removing what we just added
      await redis.del(agentKey);
      await redis.srem(userSetKey, dto.id);
      throw new AgentDuplicateError(dto.id, dto.user_id);
    }

    logger.debug(
      `Agent ${dto.id} saved to Redis for user ${dto.user_id}`
    );
  } catch (error) {
    logger.error('Error saving agent to Redis:', error);
    throw error;
  }
}

/**
 * List all agents for a specific user
 * 
 * @param userId - User ID to fetch agents for
 * @returns Array of agent configurations
 */
export async function listAgentsByUser(
  userId: string
): Promise<AgentConfig.OutputWithId[]> {
  const redis = getRedisClient();
  const userSetKey = `agents:by-user:${userId}`;

  try {
    // Get all agent IDs for this user
    const agentIds = await redis.smembers(userSetKey);

    if (agentIds.length === 0) {
      return [];
    }

    // Build keys for MGET
    const agentKeys = agentIds.map((id) => `agents:${id}`);

    // Get all agents in a single call
    const agentJsons = await redis.mget(...agentKeys);

    // Parse and filter out any null values
    const agents: AgentConfig.OutputWithId[] = [];
    for (let i = 0; i < agentJsons.length; i++) {
      const json = agentJsons[i];
      if (json) {
        try {
          const agent = JSON.parse(json) as AgentConfig.OutputWithId;
          agents.push(agent);
        } catch (error) {
          logger.error(
            `Failed to parse agent JSON for ID ${agentIds[i]}:`,
            error
          );
        }
      } else {
        logger.warn(
          `Agent ${agentIds[i]} is in user set but not found in agents key`
        );
      }
    }

    logger.debug(`Retrieved ${agents.length} agents for user ${userId}`);
    return agents;
  } catch (error) {
    logger.error(`Error listing agents for user ${userId}:`, error);
    throw error;
  }
}

/**
 * Get an agent by the pair (agent_id, user_id)
 * 
 * @param agentId - Agent ID
 * @param userId - User ID
 * @returns Agent configuration or null if not found or user_id doesn't match
 */
export async function getAgentByPair(
  agentId: string,
  userId: string
): Promise<AgentConfig.OutputWithId | null> {
  const redis = getRedisClient();
  const pairIndexKey = `agents:idx:agent-user:${agentId}:${userId}`;
  const agentKey = `agents:${agentId}`;

  try {
    // Check if the pair index exists
    const indexExists = await redis.get(pairIndexKey);

    if (!indexExists) {
      logger.debug(
        `Agent pair (${agentId}, ${userId}) not found in index`
      );
      return null;
    }

    // Get the agent data
    const agentJson = await redis.get(agentKey);

    if (!agentJson) {
      logger.warn(
        `Agent ${agentId} found in pair index but not in agents key`
      );
      return null;
    }

    // Parse and verify user_id
    const agent = JSON.parse(agentJson) as AgentConfig.OutputWithId;

    if (agent.user_id !== userId) {
      logger.warn(
        `Agent ${agentId} user_id mismatch: expected ${userId}, got ${agent.user_id}`
      );
      return null;
    }

    logger.debug(`Retrieved agent ${agentId} for user ${userId}`);
    return agent;
  } catch (error) {
    logger.error(
      `Error getting agent by pair (${agentId}, ${userId}):`,
      error
    );
    throw error;
  }
}

/**
 * Delete an agent from Redis
 * Cleans up all related indexes atomically
 * 
 * @param agentId - Agent ID to delete
 * @param userId - User ID to verify ownership
 * @throws {Error} If the agent doesn't exist or doesn't belong to the user
 */
export async function deleteAgent(
  agentId: string,
  userId: string
): Promise<void> {
  const redis = getRedisClient();
  const agentKey = `agents:${agentId}`;

  try {
    // First, get the agent to verify it exists and belongs to the user
    const agentJson = await redis.get(agentKey);

    if (!agentJson) {
      throw new Error(`Agent ${agentId} not found`);
    }

    const agent = JSON.parse(agentJson) as AgentConfig.OutputWithId;

    if (agent.user_id !== userId) {
      throw new Error(
        `Agent ${agentId} does not belong to user ${userId}`
      );
    }

    const userSetKey = `agents:by-user:${userId}`;
    const pairIndexKey = `agents:idx:agent-user:${agentId}:${userId}`;

    // Start atomic transaction
    const multi = redis.multi();

    // DEL agents:{agentId}
    multi.del(agentKey);

    // SREM agents:by-user:{user_id} {agentId}
    multi.srem(userSetKey, agentId);

    // DEL agents:idx:agent-user:{agentId}:{user_id}
    multi.del(pairIndexKey);

    // Execute transaction
    const results = await multi.exec();

    if (!results) {
      throw new Error('Redis transaction failed during agent deletion');
    }

    logger.debug(`Agent ${agentId} deleted from Redis for user ${userId}`);
  } catch (error) {
    logger.error(`Error deleting agent ${agentId}:`, error);
    throw error;
  }
}

/**
 * Check if an agent exists for a given user
 * 
 * @param agentId - Agent ID
 * @param userId - User ID
 * @returns true if the agent exists and belongs to the user, false otherwise
 */
export async function agentExists(
  agentId: string,
  userId: string
): Promise<boolean> {
  const redis = getRedisClient();
  const pairIndexKey = `agents:idx:agent-user:${agentId}:${userId}`;

  try {
    const exists = await redis.exists(pairIndexKey);
    return exists === 1;
  } catch (error) {
    logger.error(
      `Error checking if agent ${agentId} exists for user ${userId}:`,
      error
    );
    return false;
  }
}

/**
 * Get the total number of agents for a user
 * 
 * @param userId - User ID
 * @returns Number of agents
 */
export async function getAgentCount(userId: string): Promise<number> {
  const redis = getRedisClient();
  const userSetKey = `agents:by-user:${userId}`;

  try {
    const count = await redis.scard(userSetKey);
    return count;
  } catch (error) {
    logger.error(`Error getting agent count for user ${userId}:`, error);
    return 0;
  }
}

/**
 * Update an existing agent configuration
 * 
 * @param dto - Updated agent configuration
 * @throws {Error} If the agent doesn't exist
 */
export async function updateAgent(
  dto: AgentConfig.OutputWithId
): Promise<void> {
  const redis = getRedisClient();
  const agentKey = `agents:${dto.id}`;
  const pairIndexKey = `agents:idx:agent-user:${dto.id}:${dto.user_id}`;

  try {
    // Check if the agent exists
    const exists = await redis.exists(pairIndexKey);
    if (exists === 0) {
      throw new Error(
        `Cannot update: Agent ${dto.id} does not exist for user ${dto.user_id}`
      );
    }

    // Update the agent data
    await redis.set(agentKey, JSON.stringify(dto));

    logger.debug(`Agent ${dto.id} updated in Redis for user ${dto.user_id}`);
  } catch (error) {
    logger.error(`Error updating agent ${dto.id}:`, error);
    throw error;
  }
}

/**
 * Clear all agents for a specific user (useful for testing)
 * 
 * @param userId - User ID
 */
export async function clearUserAgents(userId: string): Promise<void> {
  const redis = getRedisClient();
  const userSetKey = `agents:by-user:${userId}`;

  try {
    // Get all agent IDs for this user
    const agentIds = await redis.smembers(userSetKey);

    if (agentIds.length === 0) {
      return;
    }

    // Start transaction
    const multi = redis.multi();

    // Delete each agent and its pair index
    for (const agentId of agentIds) {
      const agentKey = `agents:${agentId}`;
      const pairIndexKey = `agents:idx:agent-user:${agentId}:${userId}`;

      multi.del(agentKey);
      multi.del(pairIndexKey);
    }

    // Delete the user set
    multi.del(userSetKey);

    // Execute transaction
    await multi.exec();

    logger.debug(`Cleared ${agentIds.length} agents for user ${userId}`);
  } catch (error) {
    logger.error(`Error clearing agents for user ${userId}:`, error);
    throw error;
  }
}

