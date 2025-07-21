import { BaseAgent, AgentType } from '../core/baseAgent.js';
import { logger } from '@snakagent/core';
import { ModelSelector } from './modelSelector.js';
import { SnakAgent } from '../core/snakAgent.js';
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

  public async removeAgent(agentId: string): Promise<void> {
    logger.debug(`AgentSelector: Removing agent ${agentId}`);
    if (this.availableAgents.has(agentId)) {
      this.availableAgents.delete(agentId);
      this.agentInfo.delete(agentId);
      logger.debug(`AgentSelector: Agent ${agentId} removed successfully`);
    } else {
      logger.warn(`AgentSelector: Agent ${agentId} not found`);
    }
  }

  public async updateAvailableAgents(
    agent: [string, SnakAgent]
  ): Promise<void> {
    logger.debug(`AgentSelector: Updating available agents with ${agent[0]}`);
    this.availableAgents.set(agent[0], agent[1]);
    this.agentInfo.set(
      agent[1].getAgentConfig().name,
      agent[1].getAgentConfig().description || 'No description available'
    );
  }

  public async execute(input: string): Promise<SnakAgent> {
    try {
      const model = this.modelSelector.getModels()['fast'];
      console.log('AgentSelector model:', this.modelSelector.getModels());
      const result = await model.invoke(
        agentSelectorPromptContent(this.agentInfo, input)
      );
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
      logger.error('AgentSelector execution failed:', error);
      throw new Error(
        `AgentSelector execution failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
