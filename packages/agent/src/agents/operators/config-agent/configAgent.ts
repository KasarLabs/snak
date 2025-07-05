import { BaseAgent, AgentType } from '../../core/baseAgent.js';
import { BaseMessage, AIMessage } from '@langchain/core/messages';
import {
  ConfigurationAgentService,
  ConfigurationAgentServiceConfig,
} from '../services/configAgentService.js';
import { OperatorRegistry } from '../operatorRegistry.js';
import { ExecuteConfig } from '../../types.js';

/**
 * Interface defining the configuration options for the ConfigurationAgent
 */
export interface ConfigurationAgentConfig
  extends ConfigurationAgentServiceConfig {}

/**
 * Enhanced Configuration Agent using LangChain Tools for intelligent operation selection
 */
export class ConfigurationAgent extends BaseAgent {
  private service: ConfigurationAgentService;

  constructor(config: ConfigurationAgentConfig = {}) {
    super(
      'configuration-agent',
      AgentType.OPERATOR,
      'I specialize in managing agent configurations in the database. I can create, read, update, delete, and list agent configurations using intelligent tool selection based on your natural language requests.'
    );

    this.service = new ConfigurationAgentService(config);
  }

  /**
   * Initializes the ConfigurationAgent by setting up the React agent and registering with the operator registry
   * @throws {Error} If initialization fails
   * @returns {Promise<void>}
   */
  public async init(): Promise<void> {
    await this.service.init();
    OperatorRegistry.getInstance().register(this.id, this);
  }

  /**
   * Executes configuration operations using the React agent and tools
   * @param {string | BaseMessage | BaseMessage[]} input - The input message(s) to process
   * @param {ExecuteConfig} config - Additional configuration options
   * @returns {Promise<AIMessage>} The agent's response as an AIMessage
   * @throws {Error} If execution fails or the agent is not initialized
   */
  public async execute(
    input: string | BaseMessage | BaseMessage[],
    isInterrupted?: boolean,
    config?: ExecuteConfig
  ): Promise<AIMessage> {
    return this.service.execute(input, isInterrupted, config);
  }

  /**
   * Returns the list of available tools for the configuration agent
   * @returns {any[]} Array of available tools
   */
  public getTools() {
    return this.service.getTools();
  }

  /**
   * Cleans up resources and unregisters the agent from the operator registry
   * @returns {Promise<void>}
   */
  public async dispose(): Promise<void> {
    await this.service.dispose();
    OperatorRegistry.getInstance().unregister(this.id);
  }
}
