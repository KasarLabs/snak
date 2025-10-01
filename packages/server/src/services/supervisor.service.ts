import { Injectable, BadRequestException } from '@nestjs/common';
import { Postgres } from '@snakagent/database';
import { AgentConfig } from '@snakagent/core';

/**
 * Service for managing supervisor agents and their validation
 */
@Injectable()
export class SupervisorService {
  /**
   * Validate that an agent configuration is not a supervisor agent
   * @param agentConfig - Agent configuration to validate
   * @throws BadRequestException if the agent is a supervisor
   */
  validateNotSupervisorAgent(
    agentConfig: AgentConfig.Input | AgentConfig.InputWithOptionalParam
  ): void {
    if (agentConfig.profile?.group === 'system') {
      throw new BadRequestException(
        'Cannot create or modify system agents via this endpoint. Use init_supervisor instead.'
      );
    }

    if (agentConfig.profile?.name?.toLowerCase().includes('supervisor agent')) {
      throw new BadRequestException(
        'Cannot create or modify Supervisor Agent via this endpoint. Use init_supervisor instead.'
      );
    }
  }

  /**
   * Check if an agent is a supervisor agent
   * @param agentId - Agent ID to check
   * @param userId - User ID for ownership verification
   * @returns Promise<boolean> - True if the agent is a supervisor
   */
  async isSupervisorAgent(agentId: string, userId: string): Promise<boolean> {
    const query = new Postgres.Query(
      `SELECT (profile)."group", (profile).name FROM agents 
       WHERE id = $1 AND user_id = $2`,
      [agentId, userId]
    );

    const result = await Postgres.query(query);

    if (result.length === 0) {
      return false;
    }

    const agent = result[0];
    return (
      agent.group === 'system' ||
      (typeof agent.name === 'string' &&
        agent.name.toLowerCase().includes('supervisor agent'))
    );
  }

  /**
   * Validate that an agent is not a supervisor agent before deletion
   * @param agentId - Agent ID to check
   * @param userId - User ID for ownership verification
   * @throws BadRequestException if the agent is a supervisor
   */
  async validateNotSupervisorForDeletion(
    agentId: string,
    userId: string
  ): Promise<void> {
    const isSupervisor = await this.isSupervisorAgent(agentId, userId);
    if (isSupervisor) {
      throw new BadRequestException(
        'Cannot delete supervisor agents. Supervisor agents are managed by the system.'
      );
    }
  }

  /**
   * Validate that an agent is not a supervisor agent before modification
   * @param agentId - Agent ID to check
   * @param userId - User ID for ownership verification
   * @throws BadRequestException if the agent is a supervisor
   */
  async validateNotSupervisorForModification(
    agentId: string,
    userId: string
  ): Promise<void> {
    const isSupervisor = await this.isSupervisorAgent(agentId, userId);
    if (isSupervisor) {
      throw new BadRequestException(
        'Cannot modify supervisor agents. Supervisor agents are managed by the system.'
      );
    }
  }

  /**
   * Validate that an agent is not a supervisor agent before stopping
   * @param agentId - Agent ID to check
   * @param userId - User ID for ownership verification
   * @throws BadRequestException if the agent is a supervisor
   */
  async validateNotSupervisorForStopping(
    agentId: string,
    userId: string
  ): Promise<void> {
    const isSupervisor = await this.isSupervisorAgent(agentId, userId);
    if (isSupervisor) {
      throw new BadRequestException(
        'Cannot stop supervisor agents. Supervisor agents are managed by the system.'
      );
    }
  }
}
