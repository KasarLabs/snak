import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { BaseMessage, AIMessage, HumanMessage } from '@langchain/core/messages';
import { logger } from '@snakagent/core';
import { getConfigAgentTools } from '../config-agent/configAgentTools.js';
import { Tool } from '@langchain/core/tools';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { configurationAgentSystemPrompt } from 'prompt/configAgentPrompts.js';
import { ModelSelector } from '../modelSelector.js';
import { ExecuteConfig, ModelServiceConfig } from 'agents/types.js';

export interface ConfigurationAgentServiceConfig extends ModelServiceConfig {}

export class ConfigurationAgentService {
  private debug: boolean = false;
  private llm: BaseChatModel;
  private reactAgent: ReturnType<typeof createReactAgent>;
  private tools: Tool[];
  private modelType: string;

  constructor(config: ConfigurationAgentServiceConfig = {}) {
    this.debug = config.debug !== undefined ? config.debug : true;
    this.modelType = config.modelType || 'fast';
    this.tools = getConfigAgentTools() as Tool[];

    if (this.debug) {
      logger.debug(
        `ConfigurationAgent initialized with ${this.tools.length} tools: ${this.tools
          .map((t) => t.name)
          .join(', ')}`
      );
    }
  }

  public async init(): Promise<void> {
    try {
      const modelSelector = ModelSelector.getInstance();
      if (!modelSelector) {
        throw new Error('ModelSelector is not initialized');
      }

      this.llm = modelSelector.getModels()[this.modelType];

      this.reactAgent = createReactAgent({
        llm: this.llm,
        tools: this.tools,
        stateModifier: configurationAgentSystemPrompt(),
      });

      logger.debug('ConfigurationAgent initialized with React agent');
    } catch (error) {
      logger.error(`ConfigurationAgent initialization failed: ${error}`);
      throw new Error(`ConfigurationAgent initialization failed: ${error}`);
    }
  }

  public async execute(
    input: string | BaseMessage | BaseMessage[],
    _isInterrupted?: boolean,
    config?: ExecuteConfig
  ): Promise<AIMessage> {
    try {
      const content = this.extractOriginalUserContent(input, config);

      if (this.debug) {
        logger.debug(`ConfigurationAgent: Processing request: "${content}"`);
        logger.debug(`ConfigurationAgent: Config received:`, {
          originalUserQuery: config?.originalUserQuery,
          hasConfig: !!config,
          configKeys: config ? Object.keys(config) : [],
        });
      }

      if (!this.reactAgent) {
        throw new Error('React agent not initialized. Call init() first.');
      }

      const result = await this.reactAgent.invoke({
        messages: [new HumanMessage(content)],
      });

      const messages = result.messages || [];
      const lastMessage = messages[messages.length - 1];

      let responseContent = '';
      if (lastMessage && lastMessage.content) {
        responseContent =
          typeof lastMessage.content === 'string'
            ? lastMessage.content
            : JSON.stringify(lastMessage.content);
      } else {
        throw new Error(
          'No content found in the last message from the configuration agent.'
        );
      }

      return new AIMessage({
        content: responseContent,
        additional_kwargs: {
          from: 'configuration-agent',
          final: true,
          success: true,
        },
      });
    } catch (error) {
      logger.error(`ConfigurationAgent execution error: ${error}`);

      return new AIMessage({
        content: `Configuration operation failed: ${error instanceof Error ? error.message : String(error)}`,
        additional_kwargs: {
          from: 'configuration-agent',
          final: true,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  private extractOriginalUserContent(
    input: string | BaseMessage | BaseMessage[],
    config?: ExecuteConfig
  ): string {
    if (
      config?.originalUserQuery &&
      typeof config.originalUserQuery === 'string'
    ) {
      if (this.debug) {
        logger.debug(
          `ConfigurationAgent: Using originalUserQuery from config: "${config.originalUserQuery}"`
        );
      }
      return config.originalUserQuery;
    }

    if (Array.isArray(input)) {
      for (const message of input) {
        if (
          message.additional_kwargs?.originalUserQuery &&
          typeof message.additional_kwargs.originalUserQuery === 'string'
        ) {
          if (this.debug) {
            logger.debug(
              `ConfigurationAgent: Using originalUserQuery from message additional_kwargs`
            );
          }
          return message.additional_kwargs.originalUserQuery;
        }
      }

      for (const message of input) {
        if (
          message instanceof HumanMessage &&
          typeof message.content === 'string'
        ) {
          if (this.debug) {
            logger.debug(`ConfigurationAgent: Using first HumanMessage content`);
          }
          return message.content;
        }
      }

      const lastMessage = input[input.length - 1];
      const content =
        typeof lastMessage.content === 'string'
          ? lastMessage.content
          : JSON.stringify(lastMessage.content);

      if (this.debug) {
        logger.debug(`ConfigurationAgent: Fallback to last message content`);
      }
      return content;
    }

    if (input instanceof BaseMessage) {
      if (
        input.additional_kwargs?.originalUserQuery &&
        typeof input.additional_kwargs.originalUserQuery === 'string'
      ) {
        if (this.debug) {
          logger.debug(
            `ConfigurationAgent: Using originalUserQuery from single message additional_kwargs`
          );
        }
        return input.additional_kwargs.originalUserQuery;
      }

      const content =
        typeof input.content === 'string'
          ? input.content
          : JSON.stringify(input.content);

      if (this.debug) {
        logger.debug(`ConfigurationAgent: Using single message content`);
      }
      return content;
    }

    if (typeof input === 'string') {
      if (this.debug) {
        logger.debug(`ConfigurationAgent: Using string input directly`);
      }
      return input;
    }

    if (this.debug) {
      logger.debug(`ConfigurationAgent: Using fallback content extraction`);
    }
    return this.extractContent(input);
  }

  private extractContent(input: string | BaseMessage | BaseMessage[]): string {
    if (Array.isArray(input)) {
      const lastMessage = input[input.length - 1];
      return typeof lastMessage.content === 'string'
        ? lastMessage.content
        : JSON.stringify(lastMessage.content);
    } else if (typeof input === 'string') {
      return input;
    } else {
      return typeof input.content === 'string'
        ? input.content
        : JSON.stringify(input.content);
    }
  }

  public getTools() {
    return this.tools;
  }

  public async dispose(): Promise<void> {
    logger.debug('ConfigurationAgentService disposed');
  }
}