import { getRedisClient } from '../../../redis.js';
import { logger } from '@snakagent/core';

/**
 * Token usage tracking interface
 */
export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  last_updated: number;
}

/**
 * Execution-specific token tracking interface
 */
export interface ExecutionTokens {
  execution_id: string;
  agent_id: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  timestamp: number;
  cost?: number;
}

/**
 * Get token usage for a specific agent
 * @param agentId - Agent ID
 * @returns TokenUsage or null if no data exists
 */
export async function getTokensByAgentId(
  agentId: string
): Promise<TokenUsage | null> {
  try {
    const redis = getRedisClient();
    const key = `metrics:${agentId}:tokens`;

    const data = await redis.hgetall(key);

    if (!data || Object.keys(data).length === 0) {
      logger.debug(`No token data found for agent ${agentId}`);
      return null;
    }

    return {
      input_tokens: parseInt(data.input_tokens || '0', 10),
      output_tokens: parseInt(data.output_tokens || '0', 10),
      total_tokens: parseInt(data.total_tokens || '0', 10),
      last_updated: parseInt(data.last_updated || '0', 10),
    };
  } catch (error) {
    logger.error(`Error getting tokens for agent ${agentId}:`, error);
    throw error;
  }
}

/**
 * Get aggregated token usage for all agents belonging to a user
 * @param userId - User ID
 * @returns TokenUsage with aggregated totals
 */
export async function getTokensByUserId(userId: string): Promise<TokenUsage> {
  try {
    const redis = getRedisClient();
    const userSetKey = `agents:by-user:${userId}`;

    // Get all agent IDs for this user
    const agentIds = await redis.smembers(userSetKey);

    if (agentIds.length === 0) {
      logger.debug(`No agents found for user ${userId}`);
      return {
        input_tokens: 0,
        output_tokens: 0,
        total_tokens: 0,
        last_updated: Date.now(),
      };
    }

    // Aggregate tokens from all agents
    let totalInput = 0;
    let totalOutput = 0;
    let latestUpdate = 0;

    for (const agentId of agentIds) {
      const agentTokens = await getTokensByAgentId(agentId);
      if (agentTokens) {
        totalInput += agentTokens.input_tokens;
        totalOutput += agentTokens.output_tokens;
        latestUpdate = Math.max(latestUpdate, agentTokens.last_updated);
      }
    }

    return {
      input_tokens: totalInput,
      output_tokens: totalOutput,
      total_tokens: totalInput + totalOutput,
      last_updated: latestUpdate || Date.now(),
    };
  } catch (error) {
    logger.error(`Error getting tokens for user ${userId}:`, error);
    throw error;
  }
}

/**
 * Add token usage to an agent's total
 * Uses atomic Redis operations (HINCRBY) to prevent race conditions
 * @param agentId - Agent ID
 * @param inputTokens - Number of input tokens to add
 * @param outputTokens - Number of output tokens to add
 */
export async function addTokensToAgent(
  agentId: string,
  inputTokens: number,
  outputTokens: number
): Promise<void> {
  try {
    const redis = getRedisClient();
    const key = `metrics:${agentId}:tokens`;

    // Use pipeline for atomic multi-field update
    const pipeline = redis.pipeline();

    pipeline.hincrby(key, 'input_tokens', inputTokens);
    pipeline.hincrby(key, 'output_tokens', outputTokens);
    pipeline.hincrby(key, 'total_tokens', inputTokens + outputTokens);
    pipeline.hset(key, 'last_updated', Date.now());

    await pipeline.exec();

    logger.debug(
      `Added ${inputTokens} input and ${outputTokens} output tokens to agent ${agentId}`
    );
  } catch (error) {
    logger.error(`Error adding tokens to agent ${agentId}:`, error);
    throw error;
  }
}

/**
 * Record detailed token usage for a specific execution
 * Stores execution details and updates agent totals atomically
 * @param executionTokens - Execution token details
 */
export async function recordExecution(
  executionTokens: ExecutionTokens
): Promise<void> {
  try {
    const redis = getRedisClient();
    const executionKey = `metrics:${executionTokens.agent_id}:execution:${executionTokens.execution_id}`;
    const executionsSetKey = `metrics:${executionTokens.agent_id}:executions`;

    // Use pipeline for atomic operations
    const pipeline = redis.pipeline();

    // Store execution details as hash
    pipeline.hset(executionKey, {
      execution_id: executionTokens.execution_id,
      agent_id: executionTokens.agent_id,
      input_tokens: executionTokens.input_tokens,
      output_tokens: executionTokens.output_tokens,
      total_tokens: executionTokens.total_tokens,
      timestamp: executionTokens.timestamp,
      cost: executionTokens.cost?.toString() || '0',
    });

    // Add execution to sorted set (sorted by timestamp)
    pipeline.zadd(
      executionsSetKey,
      executionTokens.timestamp,
      executionTokens.execution_id
    );

    // Set expiry for execution details (30 days)
    pipeline.expire(executionKey, 30 * 24 * 60 * 60);

    await pipeline.exec();

    // Update agent totals
    await addTokensToAgent(
      executionTokens.agent_id,
      executionTokens.input_tokens,
      executionTokens.output_tokens
    );

    logger.debug(
      `Recorded execution ${executionTokens.execution_id} for agent ${executionTokens.agent_id}`
    );
  } catch (error) {
    logger.error(
      `Error recording execution ${executionTokens.execution_id}:`,
      error
    );
    throw error;
  }
}

/**
 * Get recent executions for an agent
 * @param agentId - Agent ID
 * @param limit - Maximum number of executions to return (default: 10)
 * @returns Array of ExecutionTokens
 */
export async function getRecentExecutions(
  agentId: string,
  limit: number = 10
): Promise<ExecutionTokens[]> {
  try {
    const redis = getRedisClient();
    const executionsSetKey = `metrics:${agentId}:executions`;

    // Get most recent execution IDs (sorted by timestamp descending)
    const executionIds = await redis.zrange(
      executionsSetKey,
      -limit,
      -1,
      'REV'
    );

    if (executionIds.length === 0) {
      return [];
    }

    // Fetch details for each execution
    const executions: ExecutionTokens[] = [];

    for (const executionId of executionIds) {
      const executionKey = `metrics:${agentId}:execution:${executionId}`;
      const data = await redis.hgetall(executionKey);

      if (data && Object.keys(data).length > 0) {
        executions.push({
          execution_id: data.execution_id,
          agent_id: data.agent_id,
          input_tokens: parseInt(data.input_tokens || '0', 10),
          output_tokens: parseInt(data.output_tokens || '0', 10),
          total_tokens: parseInt(data.total_tokens || '0', 10),
          timestamp: parseInt(data.timestamp || '0', 10),
          cost: data.cost ? parseFloat(data.cost) : undefined,
        });
      }
    }

    return executions;
  } catch (error) {
    logger.error(
      `Error getting recent executions for agent ${agentId}:`,
      error
    );
    throw error;
  }
}

/**
 * Get total number of executions for an agent
 * @param agentId - Agent ID
 * @returns Number of executions
 */
export async function getExecutionCount(agentId: string): Promise<number> {
  try {
    const redis = getRedisClient();
    const executionsSetKey = `metrics:${agentId}:executions`;

    const count = await redis.zcard(executionsSetKey);
    return count;
  } catch (error) {
    logger.error(`Error getting execution count for agent ${agentId}:`, error);
    throw error;
  }
}

/**
 * Clear all token data for an agent
 * @param agentId - Agent ID
 */
export async function clearAgentTokens(agentId: string): Promise<void> {
  try {
    const redis = getRedisClient();
    const tokensKey = `metrics:${agentId}:tokens`;
    const executionsSetKey = `metrics:${agentId}:executions`;

    // Get all execution IDs
    const executionIds = await redis.zrange(executionsSetKey, 0, -1);

    // Delete all keys in a pipeline
    const pipeline = redis.pipeline();

    pipeline.del(tokensKey);
    pipeline.del(executionsSetKey);

    // Delete each execution detail
    for (const executionId of executionIds) {
      const executionKey = `metrics:${agentId}:execution:${executionId}`;
      pipeline.del(executionKey);
    }

    await pipeline.exec();

    logger.debug(`Cleared all token data for agent ${agentId}`);
  } catch (error) {
    logger.error(`Error clearing tokens for agent ${agentId}:`, error);
    throw error;
  }
}

/**
 * Reset token counts for an agent (keeps execution history)
 * @param agentId - Agent ID
 */
export async function resetAgentTokens(agentId: string): Promise<void> {
  try {
    const redis = getRedisClient();
    const key = `metrics:${agentId}:tokens`;

    await redis.hset(key, {
      input_tokens: 0,
      output_tokens: 0,
      total_tokens: 0,
      last_updated: Date.now(),
    });

    logger.debug(`Reset token counts for agent ${agentId}`);
  } catch (error) {
    logger.error(`Error resetting tokens for agent ${agentId}:`, error);
    throw error;
  }
}

/**
 * Get token usage statistics for a time range
 * @param agentId - Agent ID
 * @param startTime - Start timestamp (ms)
 * @param endTime - End timestamp (ms)
 * @returns Aggregated token usage for the time range
 */
export async function getTokensByTimeRange(
  agentId: string,
  startTime: number,
  endTime: number
): Promise<TokenUsage> {
  try {
    const redis = getRedisClient();
    const executionsSetKey = `metrics:${agentId}:executions`;

    // Get executions within time range
    const executionIds = await redis.zrangebyscore(
      executionsSetKey,
      startTime,
      endTime
    );

    let totalInput = 0;
    let totalOutput = 0;
    let latestUpdate = 0;

    for (const executionId of executionIds) {
      const executionKey = `metrics:${agentId}:execution:${executionId}`;
      const data = await redis.hgetall(executionKey);

      if (data && Object.keys(data).length > 0) {
        totalInput += parseInt(data.input_tokens || '0', 10);
        totalOutput += parseInt(data.output_tokens || '0', 10);
        const timestamp = parseInt(data.timestamp || '0', 10);
        latestUpdate = Math.max(latestUpdate, timestamp);
      }
    }

    return {
      input_tokens: totalInput,
      output_tokens: totalOutput,
      total_tokens: totalInput + totalOutput,
      last_updated: latestUpdate || Date.now(),
    };
  } catch (error) {
    logger.error(
      `Error getting tokens by time range for agent ${agentId}:`,
      error
    );
    throw error;
  }
}
