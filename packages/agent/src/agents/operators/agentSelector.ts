import { BaseAgent, AgentType } from '../core/baseAgent.js';
import { logger } from '@snakagent/core';
import { ModelSelector } from './modelSelector.js';
import { SnakAgent } from 'agents/core/snakAgent.js';
import { agentSelectorPromptContent } from '../../prompt/prompts.js';

export interface AgentInfo {
  name: string;
  description: string;
}

export interface AgentSelectionConfig {
  availableAgents: Map<string, SnakAgent>;
  modelSelector: ModelSelector;
  debug?: boolean;
}

/**
 * AgentSelector analyzes user queries and determines which specialized agent should handle each request.
 * It supports both explicit agent mentions and AI-powered agent selection based on query context.
 */
export class AgentSelector extends BaseAgent {
  private availableAgents: Map<string, SnakAgent> = new Map();
  private agentInfo: Map<string, string> = new Map();
  private modelSelector: ModelSelector;

  constructor(config: AgentSelectionConfig) {
    super('agent-selector', AgentType.OPERATOR);
    this.availableAgents = config.availableAgents;
    this.modelSelector = config.modelSelector;
  }

  public async init(): Promise<void> {
    logger.debug('AgentSelector: Initializing');
    for (const value of this.availableAgents.values()) {
      const agent_config = value.getAgentConfig();
      this.agentInfo.set(
        agent_config.name,
        agent_config.description || 'No description available'
      );
    }
    logger.debug(
      `AgentSelector: Available agents initialized: ${Array.from(
        this.agentInfo.keys()
      ).join(', ')}`
    );
    if (!this.modelSelector) {
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
      const agentName = agent.getAgentConfig().name;
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
      agent[1].getAgentConfig().name,
      agent[1].getAgentConfig().description || 'No description available'
    );
  }

  public async execute(
    input: string,
    _isInterrupted?: boolean,
    config?: Record<string, any>
  ): Promise<SnakAgent> {
    try {
      const model = this.modelSelector.getModels()['fast'];
      logger.info('AgentSelector model:', this.modelSelector.getModels());

      if (!config?.userId) {
        throw new Error(
          'AgentSelector: userId is required in config parameter'
        );
      }

      const userId = config.userId;
      logger.debug(`AgentSelector: Filtering agents for user ${userId}`);

      const userAgents = new Map<string, SnakAgent>();
      const userAgentInfo = new Map<string, string>();

      for (const [key, agent] of this.availableAgents.entries()) {
        const [agentId, agentUserId] = key.split('|');
        if (agentUserId === userId) {
          userAgents.set(key, agent);
          const agentName = agent.getAgentConfig().name;
          const description = this.agentInfo.get(agentName);
          if (description) {
            userAgentInfo.set(agentName, description);
          }
        }
      }

      const availableAgentsForUser = userAgents;
      const agentInfoForUser = userAgentInfo;

      logger.debug(
        `AgentSelector: Found ${userAgents.size} agents for user ${userId}`
      );

      const result = await model.invoke(
        agentSelectorPromptContent(agentInfoForUser, input)
      );
      logger.debug('AgentSelector result:', result);
      if (typeof result.content === 'string') {
        const r_trim = result.content.trim();
        const agent = Array.from(availableAgentsForUser.values()).find(
          (agent) => agent.getAgentConfig().name === r_trim
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
