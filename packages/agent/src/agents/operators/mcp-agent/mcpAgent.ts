import { BaseAgent } from '../../core/baseAgent.js';
import { BaseMessage, AIMessage, HumanMessage } from '@langchain/core/messages';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { logger } from '@snakagent/core';
import { OperatorRegistry } from '../operatorRegistry.js';
import { getMcpAgentTools } from './mcpAgentTools.js';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { mcpAgentSystemPrompt } from '../../../prompts/core/mcpAgentPrompts.js';
import { ModelSelector } from '../modelSelector.js';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { AgentType } from '@enums/agent-modes.enum.js';

/**
 * Interface defining the configuration options for the MCPAgent
 */
export interface MCPAgentConfig {
  debug?: boolean;
  modelType?: 'fast' | 'smart' | 'cheap';
}

/**
 * Enhanced MCP Agent using LangChain Tools for intelligent MCP server and tool management
 */
export class MCPAgent extends BaseAgent {
  private debug: boolean = false;
  private llm: BaseChatModel;
  private reactAgent: ReturnType<typeof createReactAgent>;
  private tools: DynamicStructuredTool[];
  private modelType: string;

  constructor(config: MCPAgentConfig = {}) {
    super(
      'mcp-agent',
      AgentType.OPERATOR,
      'I specialize in managing MCP (Model Context Protocol) servers and their tools. I can add, remove, update, and list MCP servers and their available tools.'
    );

    this.debug = config.debug !== undefined ? config.debug : true;
    this.modelType = config.modelType || 'smart';
    this.tools = getMcpAgentTools();

    if (this.debug) {
      logger.debug(
        `MCPAgent initialized with ${this.tools.length} tools: ${this.tools.map((t) => t.name).join(', ')}`
      );
    }
  }

  /**
   * Initializes the MCPAgent by setting up the React agent and registering with the operator registry
   * @throws {Error} If initialization fails
   * @returns {Promise<void>}
   */
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
        stateModifier: mcpAgentSystemPrompt(),
      });

      const registry = OperatorRegistry.getInstance();
      registry.register(this.id, this);

      logger.debug(
        'MCPAgent initialized with React agent and registered successfully'
      );
    } catch (error) {
      logger.error(`MCPAgent initialization failed: ${error}`);
      throw new Error(`MCPAgent initialization failed: ${error}`);
    }
  }

  /**
   * Executes MCP management operations using the React agent and tools
   * @param {string | BaseMessage | BaseMessage[]} input - The input message(s) to process
   * @param {Record<string, any>} config - Additional configuration options
   * @returns {Promise<AIMessage>} The agent's response as an AIMessage
   * @throws {Error} If execution fails or the agent is not initialized
   */
  public async execute(
    input: string | BaseMessage | BaseMessage[],
    isInterrupted: boolean = false,
    config?: Record<string, any>
  ): Promise<AIMessage> {
    try {
      const content = this.extractOriginalUserContent(input, config);

      if (this.debug) {
        logger.debug(`MCPAgent: Processing request: "${content}"`);
        logger.debug(`MCPAgent: Config received:`, {
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
        responseContent = 'MCP operation completed.';
      }

      return new AIMessage({
        content: responseContent,
        additional_kwargs: {
          from: 'mcp-agent',
          final: true,
          success: true,
        },
      });
    } catch (error) {
      logger.error(`MCPAgent execution error: ${error}`);

      return new AIMessage({
        content: `MCP operation failed: ${error instanceof Error ? error.message : String(error)}`,
        additional_kwargs: {
          from: 'mcp-agent',
          final: true,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  /**
   * Extracts the original user content from various input sources
   * @private
   * @param {string | BaseMessage | BaseMessage[]} input - The input to extract content from
   * @param {Record<string, any>} config - Additional configuration containing potential original user query
   * @returns {string} The extracted user content
   */
  private extractOriginalUserContent(
    input: string | BaseMessage | BaseMessage[],
    config?: Record<string, any>
  ): string {
    if (
      config?.originalUserQuery &&
      typeof config.originalUserQuery === 'string'
    ) {
      if (this.debug) {
        logger.debug(
          `MCPAgent: Using originalUserQuery from config: "${config.originalUserQuery}"`
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
              `MCPAgent: Using originalUserQuery from message additional_kwargs`
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
            logger.debug(`MCPAgent: Using first HumanMessage content`);
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
        logger.debug(`MCPAgent: Fallback to last message content`);
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
            `MCPAgent: Using originalUserQuery from single message additional_kwargs`
          );
        }
        return input.additional_kwargs.originalUserQuery;
      }

      const content =
        typeof input.content === 'string'
          ? input.content
          : JSON.stringify(input.content);

      if (this.debug) {
        logger.debug(`MCPAgent: Using single message content`);
      }
      return content;
    }

    if (typeof input === 'string') {
      if (this.debug) {
        logger.debug(`MCPAgent: Using string input directly`);
      }
      return input;
    }

    if (this.debug) {
      logger.debug(`MCPAgent: Using fallback content extraction`);
    }
    return this.extractContent(input);
  }

  /**
   * Extracts content from various input types (fallback method)
   * @private
   * @param {string | BaseMessage | BaseMessage[]} input - The input to extract content from
   * @returns {string} The extracted content
   */
  private extractContent(input: string | BaseMessage | BaseMessage[]): string {
    if (typeof input === 'string') {
      return input;
    }
    if (Array.isArray(input)) {
      const lastMessage = input[input.length - 1];
      return typeof lastMessage.content === 'string'
        ? lastMessage.content
        : JSON.stringify(lastMessage.content);
    }
    return typeof input.content === 'string'
      ? input.content
      : JSON.stringify(input.content);
  }

  /**
   * Returns the list of available tools for the MCP agent
   * @returns {any[]} Array of available tools
   */
  public getTools() {
    return this.tools;
  }

  /**
   * Cleans up resources and unregisters the agent from the operator registry
   * @returns {Promise<void>}
   */
  public async dispose(): Promise<void> {
    try {
      const registry = OperatorRegistry.getInstance();
      registry.unregister(this.id);
      logger.debug('MCPAgent disposed and unregistered');
    } catch (error) {
      logger.error(`Error disposing MCPAgent: ${error}`);
    }
  }
}
