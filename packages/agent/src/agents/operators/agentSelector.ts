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
 * Function type to resolve agents for a given user
 */
export type AgentResolver = (userId: string) => Promise<SnakAgent[]>;

/**
 * AgentSelector analyzes user queries and determines which specialized agent should handle each request.
 * It supports both explicit agent mentions and AI-powered agent selection based on query context.
 */
export class AgentSelector extends BaseAgent {
  private agentResolver: AgentResolver;
  private model: BaseChatModel;

  constructor(agentResolver: AgentResolver, model: BaseChatModel) {
    super('agent-selector', AgentType.OPERATOR);
    this.agentResolver = agentResolver;
    this.model = model;
    
    if (!this.model) {
      logger.warn(
        'AgentSelector: No model provided, selection capabilities will be limited'
      );
    }
  }

  public async init(): Promise<void> {
    logger.debug('AgentSelector: Initialized');
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

      const userId = config.userId as string;
      logger.debug(`AgentSelector: Fetching agents for user ${userId} from Redis`);

      // Fetch agents on-demand from Redis via the resolver
      const userAgentsArray = await this.agentResolver(userId);

      logger.debug(
        `AgentSelector: Found ${userAgentsArray.length} agents for user ${userId}`
      );
      
      if (userAgentsArray.length === 0) {
        throw new Error('No agents found for user ' + userId);
      }

      // Build agent info map for the prompt
      const userAgentInfo = new Map<string, string>();
      for (const agent of userAgentsArray) {
        const cfg = agent.getAgentConfig();
        userAgentInfo.set(
          cfg.profile.name,
          cfg.profile.description || 'No description available'
        );
      }

      const result = await model.invoke(
        agentSelectorPromptContent(userAgentInfo, input)
      );
      logger.debug('AgentSelector result:', result);
      
      if (typeof result.content === 'string') {
        const r_trim = result.content.trim();
        const agent = userAgentsArray.find(
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
