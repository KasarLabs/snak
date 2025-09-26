import { BaseAgent } from '../core/baseAgent.js';
import { logger } from '@snakagent/core';
import { SnakAgent } from '../core/snakAgent.js';
import { agentSelectorPromptContent } from '../../shared/prompts/core/prompts.js';
import { AgentType } from '@enums/agent-modes.enum.js';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';

export interface AgentInfo {
  name: string;
  description: string;
}

/**
 * AgentSelector analyzes user queries and determines which specialized agent should handle each request.
 * It supports both explicit agent mentions and AI-powered agent selection based on query context.
 */
export class AgentSelector extends BaseAgent {
  private availableAgents: Map<string, SnakAgent> = new Map();
  private agentInfo: Map<string, string> = new Map();
  private model: BaseChatModel;

  constructor(availableAgents: Map<string, SnakAgent>, model: BaseChatModel) {
    super('agent-selector', AgentType.OPERATOR);
    this.availableAgents = availableAgents;
    this.model = model;
  }

  public async init(): Promise<void> {
    logger.debug('AgentSelector: Initializing');
    for (const value of this.availableAgents.values()) {
      const agent_config = value.getAgentConfig();
      this.agentInfo.set(
        agent_config.profile.name,
        agent_config.profile.description || 'No description available'
      );
    }
    logger.debug(
      `AgentSelector: Available agents initialized: ${Array.from(
        this.agentInfo.keys()
      ).join(', ')}`
    );
    if (!this.model) {
      logger.warn(
        'AgentSelector: No ModelSelector provided, selection capabilities will be limited'
      );
    }
  }

  public async removeAgent(agentId: string, userId: string): Promise<void> {
    const compositeKey = `${agentId}|${userId}`;
    logger.debug(
      `AgentSelector: Removing agent ${agentId} for user ${userId} with key ${compositeKey}`
    );

    const agent = this.availableAgents.get(compositeKey);
    if (agent) {
      const agentName = agent.getAgentConfig().profile.name;
      this.availableAgents.delete(compositeKey);
      this.agentInfo.delete(agentName);
      logger.debug(
        `AgentSelector: Agent ${agentName} (${agentId}) removed successfully for user ${userId}`
      );
    } else {
      logger.warn(
        `AgentSelector: Agent ${agentId} not found for user ${userId}`
      );
    }
  }

  public async updateAvailableAgents(
    agent: [string, SnakAgent],
    userId: string
  ): Promise<void> {
    const compositeKey = `${agent[0]}|${userId}`;
    logger.debug(
      `AgentSelector: Updating available agents with ${agent[0]} for user ${userId} with key ${compositeKey}`
    );
    this.availableAgents.set(compositeKey, agent[1]);
    this.agentInfo.set(
      agent[1].getAgentConfig().profile.name,
      agent[1].getAgentConfig().profile.description ||
        'No description available'
    );
  }

  public async execute(
    input: string,
    _isInterrupted?: boolean,
    config?: Record<string, unknown>
  ): Promise<SnakAgent> {
    try {
      if (!config) {
        throw new Error('AgentSelector: config parameter is required');
      }
      if (!config.userId) {
        throw new Error(
          'AgentSelector: userId is required in config parameter'
        );
      }
      const model = this.model;

      const userId = config.userId;
      logger.debug(`AgentSelector: Filtering agents for user ${userId}`);

      const userAgents = new Map<string, SnakAgent>();
      const userAgentInfo = new Map<string, string>();

      for (const [key, agent] of this.availableAgents.entries()) {
        const parts = key.split('|');
        if (parts.length !== 2) {
          logger.warn(`AgentSelector: Invalid composite key format: ${key}`);
          continue;
        }
        const [_agentId, agentUserId] = parts;
        if (agentUserId === userId) {
          userAgents.set(key, agent);
          const cfg = agent.getAgentConfig();
          userAgentInfo.set(
            cfg.profile.name,
            cfg.profile.description || 'No description available'
          );
        }
      }

      logger.debug(
        `AgentSelector: Found ${userAgents.size} agents for user ${userId}`
      );
      if (userAgents.size === 0) {
        throw new Error('No agents found for user ' + userId);
      }
      const result = await model.invoke(
        agentSelectorPromptContent(userAgentInfo, input)
      );
      logger.debug('AgentSelector result:', result);
      if (typeof result.content === 'string') {
        const r_trim = result.content.trim();
        const agent = Array.from(userAgents.values()).find(
          (agent) => agent.getAgentConfig().profile.name === r_trim
        );
        if (agent) {
          logger.debug(`AgentSelector: Selected agent ${r_trim}`);
          return agent;
        } else {
          logger.warn(
            `AgentSelector: No matching agent found for response "${r_trim}"`
          );
          throw new Error('No matching agent found');
        }
      } else {
        throw new Error('AgentSelector did not return a valid string response');
      }
    } catch (error) {
      throw new Error('AgentSelector execution failed: ' + error.message);
    }
  }
}
