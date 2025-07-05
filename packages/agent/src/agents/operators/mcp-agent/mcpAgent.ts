import { BaseAgent, AgentType } from '../../core/baseAgent.js';
import { BaseMessage, AIMessage } from '@langchain/core/messages';
import {
  MCPAgentService,
  MCPAgentServiceConfig,
} from '../services/mcpAgentService.js';
import { OperatorRegistry } from '../operatorRegistry.js';
import { ExecuteConfig } from '../../types.js';

/**
 * Interface defining the configuration options for the MCPAgent
 */
export interface MCPAgentConfig extends MCPAgentServiceConfig {}

/**
 * Enhanced MCP Agent using LangChain Tools for intelligent MCP server and tool management
 */
export class MCPAgent extends BaseAgent {
  private service: MCPAgentService;

  constructor(config: MCPAgentConfig = {}) {
    super(
      'mcp-agent',
      AgentType.OPERATOR,
      'I specialize in managing MCP (Model Context Protocol) servers and their tools. I can add, remove, update, and list MCP servers and their available tools.'
    );

    this.service = new MCPAgentService(config);
  }

  /**
   * Initializes the MCPAgent by setting up the React agent and registering with the operator registry
   * @throws {Error} If initialization fails
   * @returns {Promise<void>}
   */
  public async init(): Promise<void> {
    await this.service.init();
    OperatorRegistry.getInstance().register(this.id, this);
  }

  /**
   * Executes MCP management operations using the React agent and tools
   * @param {string | BaseMessage | BaseMessage[]} input - The input message(s) to process
   * @param {ExecuteConfig} config - Additional configuration options
   * @returns {Promise<AIMessage>} The agent's response as an AIMessage
   * @throws {Error} If execution fails or the agent is not initialized
   */
  public async execute(
    input: string | BaseMessage | BaseMessage[],
    isInterrupted: boolean = false,
    config?: ExecuteConfig
  ): Promise<AIMessage> {
    return this.service.execute(input, isInterrupted, config);
  }

  /**
   * Returns the list of available tools for the MCP agent
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
