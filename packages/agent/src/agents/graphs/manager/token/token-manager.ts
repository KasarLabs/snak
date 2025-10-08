import { redisTokens } from '@snakagent/database/queries';

// Re-export types from database queries

/**
 * Static class for managing token tracking
 * Delegates to Redis token queries in the database package
 *
 * @example
 * // Get tokens for an agent
 * const tokens = await TokenManager.getTokensFromAgentId('agent-123');
 *
 * // Add tokens to an agent
 * await TokenManager.addTokensToAgentId('agent-123', 100, 50);
 *
 * // Get total tokens for a user
 * const userTokens = await TokenManager.getTokensFromUserId('user-456');
 */
export class TokenManager {
  /**
   * Get token usage for a specific agent
   * @param agentId - Agent ID
   * @returns TokenUsage or null if no data exists
   */
  static async getTokensFromAgentId(agentId: string) {
    return redisTokens.getTokensByAgentId(agentId);
  }

  /**
   * Get aggregated token usage for all agents belonging to a user
   * @param userId - User ID
   * @returns TokenUsage with aggregated totals
   */
  static async getTokensFromUserId(userId: string) {
    return redisTokens.getTokensByUserId(userId);
  }

  /**
   * Add token usage to an agent's total
   * Uses atomic Redis operations to prevent race conditions
   * @param agentId - Agent ID
   * @param inputTokens - Number of input tokens to add
   * @param outputTokens - Number of output tokens to add
   */
  static async addTokensToAgentId(
    agentId: string,
    inputTokens: number,
    outputTokens: number
  ) {
    return redisTokens.addTokensToAgent(agentId, inputTokens, outputTokens);
  }

  /**
   * Record detailed token usage for a specific execution
   * Stores execution details and updates agent totals atomically
   * @param executionTokens - Execution token details
   */
  static async recordExecution(executionTokens: redisTokens.ExecutionTokens) {
    return redisTokens.recordExecution(executionTokens);
  }

  /**
   * Get recent executions for an agent
   * @param agentId - Agent ID
   * @param limit - Maximum number of executions to return (default: 10)
   * @returns Array of ExecutionTokens
   */
  static async getRecentExecutions(agentId: string, limit: number = 10) {
    return redisTokens.getRecentExecutions(agentId, limit);
  }

  /**
   * Get total number of executions for an agent
   * @param agentId - Agent ID
   * @returns Number of executions
   */
  static async getExecutionCount(agentId: string) {
    return redisTokens.getExecutionCount(agentId);
  }

  /**
   * Clear all token data for an agent
   * @param agentId - Agent ID
   */
  static async clearAgentTokens(agentId: string) {
    return redisTokens.clearAgentTokens(agentId);
  }

  /**
   * Reset token counts for an agent (keeps execution history)
   * @param agentId - Agent ID
   */
  static async resetAgentTokens(agentId: string) {
    return redisTokens.resetAgentTokens(agentId);
  }

  /**
   * Get token usage statistics for a time range
   * @param agentId - Agent ID
   * @param startTime - Start timestamp (ms)
   * @param endTime - End timestamp (ms)
   * @returns Aggregated token usage for the time range
   */
  static async getTokensByTimeRange(
    agentId: string,
    startTime: number,
    endTime: number
  ) {
    return redisTokens.getTokensByTimeRange(agentId, startTime, endTime);
  }
}

export default TokenManager;