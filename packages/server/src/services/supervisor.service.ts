import { Injectable, BadRequestException } from '@nestjs/common';
import { AgentConfig } from '@snakagent/core';
import { agents } from '@snakagent/database/queries';
import { supervisorAgentConfig } from '@snakagent/core';

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
    const supervisorAgent = supervisorAgentConfig;
    if (
      agentConfig.profile?.group?.trim().toLowerCase() ===
      supervisorAgentConfig.profile.group.trim().toLowerCase()
    ) {
      throw new BadRequestException(
        'Cannot create or modify system agents via this endpoint. Use init_supervisor instead.'
      );
    }

    if (
      agentConfig.profile?.name?.trim().toLowerCase() ===
      supervisorAgent.profile.name.trim().toLowerCase()
    ) {
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
    const agent = await agents.getAgentProfileInfo(agentId, userId);

    if (!agent) {
      return false;
    }

    return (
      (typeof agent.group === 'string' &&
        agent.group.trim().toLowerCase() ===
          supervisorAgentConfig.profile.group.trim().toLowerCase()) ||
      (typeof agent.name === 'string' &&
        agent.name.trim().toLowerCase() ===
          supervisorAgentConfig.profile.name.trim().toLowerCase())
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
