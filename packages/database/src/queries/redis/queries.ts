import { getRedisClient } from '../../redis.js';
import { AgentConfig, getGuardValue } from '@snakagent/core';
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
 * Uses optimistic locking (WATCH) to ensure atomic check-then-write and prevent duplicates
 *
 * @param dto - Agent configuration to save
 * @throws {AgentDuplicateError} If an agent with the same (agent_id, user_id) pair already exists
 * @throws {Error} If the Redis transaction fails
 */
export async function saveAgent(dto: AgentConfig.OutputWithId): Promise<void> {
  const redis = getRedisClient();
  const agentKey = `agents:${dto.id}`;
  const userSetKey = `agents:by-user:${dto.user_id}`;
  const pairIndexKey = `agents:idx:agent-user:${dto.id}:${dto.user_id}`;
  const maxRetries = getGuardValue('execution.max_retry_attempts');

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // WATCH the pair index key to detect concurrent modifications
      await redis.watch(pairIndexKey);

      // Check if the agent already exists BEFORE writing
      const exists = await redis.exists(pairIndexKey);

      if (exists === 1) {
        await redis.unwatch();
        throw new AgentDuplicateError(dto.id, dto.user_id);
      }

      // Start atomic transaction
      // This will only execute if the watched key hasn't changed
      const multi = redis.multi();

      // SET agents:{id} JSON(dto)
      multi.set(agentKey, JSON.stringify(dto));

      // SADD agents:by-user:{dto.user_id} {id}
      multi.sadd(userSetKey, dto.id);

      // SET agents:idx:agent-user:{id}:{dto.user_id} {id}
      // This creates the uniqueness constraint
      multi.set(pairIndexKey, dto.id);

      // Execute transaction
      const results = await multi.exec();

      // If results is null, the WATCH detected a change (another thread created the same agent)
      if (results === null) {
        logger.warn(
          `Concurrent creation detected for agent ${dto.id}, retrying... (attempt ${attempt + 1}/${maxRetries})`
        );
        continue; // Retry - the exists check will catch the duplicate
      }

      logger.debug(`Agent ${dto.id} saved to Redis for user ${dto.user_id}`);
      return; // Success
    } catch (error) {
      // Clean up WATCH state on error
      await redis.unwatch();
      logger.error('Error saving agent to Redis:', error);
      throw error;
    }
  }

  throw new Error(
    `Failed to save agent ${dto.id} after ${maxRetries} attempts due to concurrent modifications`
  );
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
      logger.warn(`Agent pair (${agentId}, ${userId}) not found in index`);
      return null;
    }

    // Get the agent data
    const agentJson = await redis.get(agentKey);

    if (!agentJson) {
      logger.warn(`Agent ${agentId} found in pair index but not in agents key`);
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
    logger.error(`Error getting agent by pair (${agentId}, ${userId}):`, error);
    throw error;
  }
}

/**
 * Delete an agent from Redis
 * Cleans up all related indexes atomically
 * Uses optimistic locking (WATCH) to prevent TOCTOU race conditions
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
  const maxRetries = getGuardValue('execution.max_retry_attempts');

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // WATCH the agent key to detect concurrent modifications
      await redis.watch(agentKey);

      // Get the agent to verify it exists and belongs to the user
      // This read is protected by WATCH - if the key changes before EXEC,
      // the transaction will fail
      const agentJson = await redis.get(agentKey);

      if (!agentJson) {
        await redis.unwatch();
        throw new Error(`Agent ${agentId} not found`);
      }

      const agent = JSON.parse(agentJson) as AgentConfig.OutputWithId;

      if (agent.user_id !== userId) {
        await redis.unwatch();
        throw new Error(`Agent ${agentId} does not belong to user ${userId}`);
      }

      const userSetKey = `agents:by-user:${userId}`;
      const pairIndexKey = `agents:idx:agent-user:${agentId}:${userId}`;

      // Start atomic transaction
      // This will only execute if the watched key hasn't changed
      const multi = redis.multi();

      // DEL agents:{agentId}
      multi.del(agentKey);

      // SREM agents:by-user:{user_id} {agentId}
      multi.srem(userSetKey, agentId);

      // DEL agents:idx:agent-user:{agentId}:{user_id}
      multi.del(pairIndexKey);

      // Execute transaction
      const results = await multi.exec();

      // If results is null, the WATCH detected a change and aborted the transaction
      if (results === null) {
        logger.warn(
          `Concurrent modification detected for agent ${agentId}, retrying... (attempt ${attempt + 1}/${maxRetries})`
        );
        continue; // Retry
      }

      logger.debug(`Agent ${agentId} deleted from Redis for user ${userId}`);
      return; // Success
    } catch (error) {
      // Clean up WATCH state on error
      await redis.unwatch();
      logger.error(`Error deleting agent ${agentId}:`, error);
      throw error;
    }
  }

  // If we exhausted all retries
  throw new Error(
    `Failed to delete agent ${agentId} after ${maxRetries} attempts due to concurrent modifications`
  );
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
    throw error;
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
    throw error;
  }
}

/**
 * Update an existing agent configuration
 * Uses optimistic locking (WATCH) to prevent TOCTOU race conditions
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
  const maxRetries = getGuardValue('execution.max_retry_attempts');

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // WATCH both the agent key and pair index to detect concurrent modifications
      await redis.watch(agentKey, pairIndexKey);

      // Check if the agent exists and get current data
      const [pairExists, currentAgentJson] = await Promise.all([
        redis.exists(pairIndexKey),
        redis.get(agentKey),
      ]);

      if (pairExists === 0) {
        await redis.unwatch();
        throw new Error(
          `Cannot update: Agent ${dto.id} does not exist for user ${dto.user_id}`
        );
      }

      // Verify the agent still belongs to the same user
      if (currentAgentJson) {
        const currentAgent = JSON.parse(
          currentAgentJson
        ) as AgentConfig.OutputWithId;
        if (currentAgent.user_id !== dto.user_id) {
          await redis.unwatch();
          throw new Error(
            `Cannot update: Agent ${dto.id} belongs to a different user`
          );
        }
      }

      // Start atomic transaction
      const multi = redis.multi();

      // Update the agent data
      multi.set(agentKey, JSON.stringify(dto));

      // Execute transaction
      const results = await multi.exec();

      // If results is null, the WATCH detected a change and aborted the transaction
      if (results === null) {
        logger.warn(
          `Concurrent modification detected for agent ${dto.id}, retrying... (attempt ${attempt + 1}/${maxRetries})`
        );
        continue; // Retry
      }

      logger.debug(`Agent ${dto.id} updated in Redis for user ${dto.user_id}`);
      return; // Success
    } catch (error) {
      // Clean up WATCH state on error
      await redis.unwatch();
      logger.error(`Error updating agent ${dto.id}:`, error);
      throw error;
    }
  }

  // If we exhausted all retries
  throw new Error(
    `Failed to update agent ${dto.id} after ${maxRetries} attempts due to concurrent modifications`
  );
}

/**
 * Clear all agents for a specific user (useful for testing)
 * Uses optimistic locking (WATCH) to prevent TOCTOU race conditions
 *
 * @param userId - User ID
 */
export async function clearUserAgents(userId: string): Promise<void> {
  const redis = getRedisClient();
  const userSetKey = `agents:by-user:${userId}`;
  const maxRetries = getGuardValue('execution.max_retry_attempts');

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // WATCH the user set to detect concurrent modifications
      await redis.watch(userSetKey);

      // Get all agent IDs for this user
      const agentIds = await redis.smembers(userSetKey);

      if (agentIds.length === 0) {
        await redis.unwatch();
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
      const results = await multi.exec();

      // If results is null, the WATCH detected a change and aborted the transaction
      if (results === null) {
        logger.warn(
          `Concurrent modification detected while clearing agents for user ${userId}, retrying... (attempt ${attempt + 1}/${maxRetries})`
        );
        continue; // Retry
      }

      logger.debug(`Cleared ${agentIds.length} agents for user ${userId}`);
      return; // Success
    } catch (error) {
      // Clean up WATCH state on error
      await redis.unwatch();
      logger.error(`Error clearing agents for user ${userId}:`, error);
      throw error;
    }
  }

  // If we exhausted all retries
  throw new Error(
    `Failed to clear agents for user ${userId} after ${maxRetries} attempts due to concurrent modifications`
  );
}
