import { BaseAgent, AgentType, IAgent } from '../core/baseAgent.js';
import { logger } from '@snakagent/core';
import {
  BaseMessage,
  AIMessage,
  HumanMessage,
  SystemMessage,
} from '@langchain/core/messages';
import { ModelSelector } from './modelSelector.js';
import {
  agentSelectionPrompt,
  agentSelectionSystemPrompt,
  noMatchingAgentMessage,
  defaultClarificationMessage,
  errorFallbackMessage,
  noValidAgentMessage,
} from '../../prompt/agentSelectorPrompts.js';
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

  public async removeAgent(agentName: string): Promise<void> {
    logger.debug(`AgentSelector: Removing agent ${agentName}`);
    if (this.availableAgents.has(agentName)) {
      this.availableAgents.delete(agentName);
      this.agentInfo.delete(agentName);
      logger.debug(`AgentSelector: Agent ${agentName} removed successfully`);
    } else {
      logger.warn(`AgentSelector: Agent ${agentName} not found`);
    }
  }

  public async updateAvailableAgents(
    agent: [string, SnakAgent]
  ): Promise<void> {
    logger.debug(`AgentSelector: Updating available agents with ${agent[0]}`);
    this.availableAgents.set(agent[0], agent[1]);
    this.agentInfo.set(
      agent[0],
      agent[1].getAgentConfig().description || 'No description available'
    );
  }

  public async execute(input: string): Promise<any> {
    try {
      const model = this.modelSelector.getModels()['fast'];
      const result = model.invoke(
        agentSelectorPromptContent(this.agentInfo, input)
      );
      console.log('AgentSelector result:', result);
    } catch (error) {
      throw new Error('AgentSelector execution failed: ' + error.message);
    }
  }
}
