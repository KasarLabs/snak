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
    if (this.availableAgents.has(compositeKey)) {
      this.availableAgents.delete(compositeKey);
      this.agentInfo.delete(compositeKey);
      logger.debug(`AgentSelector: Agent ${agentId} removed successfully`);
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
      const result = await model.invoke(
        agentSelectorPromptContent(this.agentInfo, input)
      );
      logger.debug('AgentSelector result:', result);
      if (typeof result.content === 'string') {
        const r_trim = result.content.trim();
        const agent = Array.from(this.availableAgents.values()).find(
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
