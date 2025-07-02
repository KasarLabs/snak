import { BaseAgent, AgentType } from '../core/baseAgent.js';
import { IAgent } from '../core/baseAgent.types.js';
import { logger } from '@snakagent/core';
import { BaseMessage, AIMessage } from '@langchain/core/messages';
import { ModelSelector } from './modelSelector.js';
import {
  AgentSelectorService
} from './services/agentSelectorService.js';

export interface AgentSelectionConfig {
  availableAgents: Record<string, IAgent>;
  modelSelector: ModelSelector | null;
  debug?: boolean;
}

/**
 * AgentSelector analyzes user queries and determines which specialized agent should handle each request.
 * It supports both explicit agent mentions and AI-powered agent selection based on query context.
 */
export class AgentSelector extends BaseAgent {
  private service: AgentSelectorService;

  constructor(config: AgentSelectionConfig) {
    super('agent-selector', AgentType.OPERATOR);
    this.service = new AgentSelectorService({
      availableAgents: config.availableAgents,
      modelSelector: config.modelSelector,
      debug: config.debug,
    });
  }

  public async init(): Promise<void> {
    logger.debug('AgentSelector: Initializing');
    this.service.init();
  }

  /**
   * Updates the list of available agents and refreshes agent information.
   */
  public setAvailableAgents(agents: Record<string, IAgent>): void {
    this.service.setAvailableAgents(agents);
  }


  /**
   * Executes agent selection based on the input query.
   * First checks for explicit agent mentions, then uses AI model for intelligent selection.
   */
  public async execute(
    input: string | BaseMessage,
    isInterrupted?: boolean,
    _config?: Record<string, unknown>
  ): Promise<AIMessage> {
    const queryString = this.extractQueryString(input);
    return this.service.selectAgent(queryString);
  }

  /**
   * Extracts query string from various input types including BaseMessage objects.
   */
  private extractQueryString(input: string | BaseMessage): string {
    if (typeof input === 'string') {
      return input;
    }

    if (input instanceof BaseMessage) {
      if (typeof input.content === 'string') {
        return input.content;
      }

      if (Array.isArray(input.content)) {
        return input.content
          .map((part) => {
            if (typeof part === 'string') return part;

            switch (part.type) {
              case 'text':
                return part.text || '';
              case 'image_url':
                return '[Image]';
              default:
                return '';
            }
          })
          .join(' ');
      }

      return JSON.stringify(input.content);
    }

    return JSON.stringify(input);
  }
}