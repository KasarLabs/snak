import { BaseAgent } from '../core/baseAgent.js';
import { AgentConfig, logger } from '@snakagent/core';
import { SnakAgent } from '../core/snakAgent.js';
import { agentSelectorPromptContent } from '../../shared/prompts/core/prompts.js';
import { AgentType } from '@enums/agent-modes.enum.js';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { AgentConfigResolver, AgentBuilder } from '../../types/agent.types.js';

export interface AgentInfo {
  name: string;
  description: string;
}

/**
 * AgentSelector analyzes user queries and determines which specialized agent should handle each request.
 * It supports both explicit agent mentions and AI-powered agent selection based on query context.
 */
export class AgentSelector extends BaseAgent {
  private agentConfigResolver: AgentConfigResolver;
  private agentBuilder: AgentBuilder;
  private model: BaseChatModel;

  constructor(
    agentConfigResolver: AgentConfigResolver,
    agentBuilder: AgentBuilder,
    agentConfig: AgentConfig.Runtime
  ) {
    super('agent-selector', AgentType.OPERATOR, agentConfig);
    this.agentConfigResolver = agentConfigResolver;
    this.agentBuilder = agentBuilder;
    this.model = agentConfig.graph.model;
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
      logger.debug(
        `AgentSelector: Fetching agent configs for user ${userId} from Redis`
      );

      // Fetch agent configurations from Redis via the resolver
      const agentConfigs = await this.agentConfigResolver(userId);

      logger.debug(`AgentSelector: Fetching agent configs for user ${userId}`);

      if (agentConfigs.length === 0) {
        throw new Error('No agents found for user ' + userId);
      }

      // Build agent info map for the prompt from configurations
      const userAgentInfo = new Map<string, string>();
      for (const agentConfig of agentConfigs) {
        userAgentInfo.set(
          agentConfig.profile.name,
          agentConfig.profile.description || 'No description available'
        );
      }

      const result = await model.invoke(
        agentSelectorPromptContent(userAgentInfo, input)
      );
      logger.debug('AgentSelector result:', result);

      if (typeof result.content === 'string') {
        const r_trim = result.content.trim();
        const selectedConfig = agentConfigs.find(
          (cfg) => cfg.profile.name.toLowerCase() === r_trim.toLowerCase()
        );
        if (selectedConfig) {
          logger.debug(
            `AgentSelector: Selected agent ${r_trim}, building instance...`
          );
          // Build the agent ONLY for the selected config
          const agent = await this.agentBuilder(selectedConfig);
          logger.debug(`AgentSelector: Successfully built agent ${r_trim}`);
          if (agent instanceof SnakAgent) {
            return agent;
          }
          throw new Error('Built agent is not an instance of SnakAgent');
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
