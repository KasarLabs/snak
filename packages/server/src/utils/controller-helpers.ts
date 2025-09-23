import { FastifyRequest } from 'fastify';
import { Socket } from 'socket.io';
import { ForbiddenException } from '@nestjs/common';
import { getUserIdFromHeaders } from './index.js';
import { getUserIdFromSocketHeaders } from './headers.js';
import { AgentStorage } from '../agents.storage.js';
import { SnakAgent } from '@snakagent/agents';
import { AgentConfigSQL } from '../interfaces/sql_interfaces.js';

/**
 * Utility class for common controller operations
 */
export class ControllerHelpers {
  /**
   * Extracts user ID from request headers with error handling
   * @param req - Fastify request object
   * @returns User ID string
   */
  static getUserId(req: FastifyRequest): string {
    return getUserIdFromHeaders(req);
  }

  /**
   * Extracts user ID from WebSocket headers with error handling
   * @param client - Socket.io client
   * @returns User ID string
   */
  static getUserIdFromSocket(client: Socket): string {
    return getUserIdFromSocketHeaders(client);
  }

  /**
   * Verifies agent ownership and returns the agent instance
   * @param agentFactory - Agent storage instance
   * @param agentId - Agent ID to verify
   * @param userId - User ID for ownership check
   * @returns Agent instance if owned by user
   * @throws ForbiddenException if agent not found or access denied
   */
  static verifyAgentOwnership(
    agentFactory: AgentStorage,
    agentId: string,
    userId: string
  ): SnakAgent {
    const agent = agentFactory.getAgentInstance(agentId, userId);
    if (!agent) {
      throw new ForbiddenException('Agent not found or access denied');
    }
    return agent;
  }

  /**
   * Verifies agent configuration ownership and returns the config
   * @param agentFactory - Agent storage instance
   * @param agentId - Agent ID to verify
   * @param userId - User ID for ownership check
   * @returns Agent configuration if owned by user
   * @throws ForbiddenException if agent not found or access denied
   */
  static verifyAgentConfigOwnership(
    agentFactory: AgentStorage,
    agentId: string,
    userId: string
  ): AgentConfigSQL {
    const agentConfig = agentFactory.getAgentConfig(agentId, userId);
    if (!agentConfig) {
      throw new ForbiddenException('Agent not found or access denied');
    }
    return agentConfig;
  }

  /**
   * Combined operation: extract user ID and verify agent ownership
   * @param req - Fastify request object
   * @param agentFactory - Agent storage instance
   * @param agentId - Agent ID to verify
   * @returns Object containing userId and agent instance
   */
  static getUserAndVerifyAgentOwnership(
    req: FastifyRequest,
    agentFactory: AgentStorage,
    agentId: string
  ): { userId: string; agent: SnakAgent } {
    const userId = this.getUserId(req);
    const agent = this.verifyAgentOwnership(agentFactory, agentId, userId);
    return { userId, agent };
  }

  /**
   * Combined operation: extract user ID and verify agent config ownership
   * @param req - Fastify request object
   * @param agentFactory - Agent storage instance
   * @param agentId - Agent ID to verify
   * @returns Object containing userId and agent config
   */
  static getUserAndVerifyAgentConfigOwnership(
    req: FastifyRequest,
    agentFactory: AgentStorage,
    agentId: string
  ): { userId: string; agentConfig: AgentConfigSQL } {
    const userId = this.getUserId(req);
    const agentConfig = this.verifyAgentConfigOwnership(
      agentFactory,
      agentId,
      userId
    );
    return { userId, agentConfig };
  }

  /**
   * WebSocket version: extract user ID and verify agent ownership
   * @param client - Socket.io client
   * @param agentFactory - Agent storage instance
   * @param agentId - Agent ID to verify
   * @returns Object containing userId and agent instance
   */
  static getSocketUserAndVerifyAgentOwnership(
    client: Socket,
    agentFactory: AgentStorage,
    agentId: string
  ): { userId: string; agent: SnakAgent } {
    const userId = this.getUserIdFromSocket(client);
    const agent = this.verifyAgentOwnership(agentFactory, agentId, userId);
    return { userId, agent };
  }

  /**
   * WebSocket version: extract user ID and verify agent config ownership
   * @param client - Socket.io client
   * @param agentFactory - Agent storage instance
   * @param agentId - Agent ID to verify
   * @returns Object containing userId and agent config
   */
  static getSocketUserAndVerifyAgentConfigOwnership(
    client: Socket,
    agentFactory: AgentStorage,
    agentId: string
  ): { userId: string; agentConfig: AgentConfigSQL } {
    const userId = this.getUserIdFromSocket(client);
    const agentConfig = this.verifyAgentConfigOwnership(
      agentFactory,
      agentId,
      userId
    );
    return { userId, agentConfig };
  }
}
