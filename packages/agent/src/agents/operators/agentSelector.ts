import { BaseAgent } from '../core/baseAgent.js';
import { logger, AgentConfig } from '@snakagent/core';
import { SnakAgent } from '../core/snakAgent.js';
import { agentSelectorPromptContent } from '../../shared/prompts/core/prompts.js';
import { AgentType } from '@enums/agent-modes.enum.js';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';

export interface AgentInfo {
  name: string;
  description: string;
}

/**
 * Function type to resolve agent configurations for a given user
 */
export type AgentConfigResolver = (
  userId: string
) => Promise<AgentConfig.OutputWithId[]>;

/**
 * Function type to build a SnakAgent from a configuration
 */
export type AgentBuilder = (
  agentConfig: AgentConfig.OutputWithId
) => Promise<SnakAgent>;

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
    model: BaseChatModel
  ) {
    super('agent-selector', AgentType.OPERATOR);
    this.agentConfigResolver = agentConfigResolver;
    this.agentBuilder = agentBuilder;
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
      logger.debug(
        `AgentSelector: Fetching agent configs for user ${userId} from Redis`
      );

      // Fetch agent configurations (not instances) from Redis via the resolver
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
