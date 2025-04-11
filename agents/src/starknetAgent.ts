import { AiConfig, IAgent } from '../common/index.js';
import { createAgent } from './agent.js';
import { RpcProvider } from 'starknet';
import { createAutonomousAgent } from './autonomousAgents.js';
import { JsonConfig } from './jsonConfig.js';
import { HumanMessage } from '@langchain/core/messages';
import logger from './logger.js';
import * as metrics from '../metrics.js';

/**
 * @interface StarknetAgentConfig
 * @description Configuration for the StarknetAgent
 * @property {string} aiProviderApiKey - API key for the AI provider
 * @property {string} aiModel - AI model to use
 * @property {string} aiProvider - AI provider name
 * @property {RpcProvider} provider - Starknet RPC provider
 * @property {string} accountPublicKey - Public key for the Starknet account
 * @property {string} accountPrivateKey - Private key for the Starknet account
 * @property {string} signature - Signature for the agent
 * @property {string} agentMode - Mode of the agent ('auto' or 'agent')
 * @property {JsonConfig} agentconfig - JSON configuration for the agent
 */
export interface StarknetAgentConfig {
  aiProviderApiKey: string;
  aiModel: string;
  aiProvider: string;
  provider: RpcProvider;
  accountPublicKey: string;
  accountPrivateKey: string;
  signature: string;
  agentMode: string;
  agentconfig: JsonConfig | undefined;
}

/**
 * @class StarknetAgent
 * @implements {IAgent}
 * @description Agent for interacting with Starknet blockchain with AI capabilities
 */
export class StarknetAgent implements IAgent {
  private readonly provider: RpcProvider;
  private readonly accountPrivateKey: string;
  private readonly accountPublicKey: string;
  private readonly aiModel: string;
  private readonly aiProviderApiKey: string;
  private agentReactExecutor: any;
  private currentMode: string;

  public readonly signature: string;
  public readonly agentMode: string;
  public readonly agentconfig: JsonConfig | undefined;

  /**
   * @constructor
   * @param {StarknetAgentConfig} config - Configuration for the StarknetAgent
   * @throws {Error} Throws an error if required configuration is missing
   */
  constructor(private readonly config: StarknetAgentConfig) {
    this.validateConfig(config);

    this.provider = config.provider;
    this.accountPrivateKey = config.accountPrivateKey;
    this.accountPublicKey = config.accountPublicKey;
    this.aiModel = config.aiModel;
    this.aiProviderApiKey = config.aiProviderApiKey;
    this.signature = config.signature;
    this.agentMode = config.agentMode;
    this.currentMode = config.agentMode;
    this.agentconfig = config.agentconfig;

    metrics.metricsAgentConnect(
      config.agentconfig?.name ?? 'agent',
      config.agentMode
    );
  }

  /**
   * @function createAgentReactExecutor
   * @async
   * @description Creates an agent executor based on the current mode
   * @returns {Promise<void>}
   */
  public async createAgentReactExecutor(): Promise<void> {
    const config: AiConfig = {
      aiModel: this.aiModel,
      aiProviderApiKey: this.aiProviderApiKey,
      aiProvider: this.config.aiProvider,
    };

    if (this.currentMode === 'auto') {
      this.agentReactExecutor = await createAutonomousAgent(this, config);
    } else if (this.currentMode === 'agent') {
      this.agentReactExecutor = await createAgent(this, config);
    }
  }

  /**
   * @function validateConfig
   * @private
   * @description Validates the configuration provided
   * @param {StarknetAgentConfig} config - Configuration to validate
   * @throws {Error} Throws an error if required configuration is missing
   */
  private validateConfig(config: StarknetAgentConfig) {
    if (!config.accountPrivateKey) {
      throw new Error('STARKNET_PRIVATE_KEY is required');
    }
    if (config.aiModel !== 'ollama' && !config.aiProviderApiKey) {
      throw new Error('AAI_PROVIDER_API_KEY is required');
    }
  }

  /**
   * @function switchMode
   * @private
   * @async
   * @description Switches the agent mode between 'auto' and 'agent'
   * @param {string} newMode - New mode to switch to
   * @returns {Promise<string>} Result message
   */
  private async switchMode(newMode: string): Promise<string> {
    if (newMode === 'auto' && !this.agentconfig?.autonomous) {
      return 'Cannot switch to autonomous mode - not enabled in configuration';
    }

    if (this.currentMode === newMode) {
      return `Already in ${newMode} mode`;
    }

    this.currentMode = newMode;
    this.createAgentReactExecutor();
    return `Switched to ${newMode} mode`;
  }

  /**
   * @function getAccountCredentials
   * @description Gets the Starknet account credentials
   * @returns {{accountPrivateKey: string, accountPublicKey: string}} Account credentials
   */
  getAccountCredentials() {
    return {
      accountPrivateKey: this.accountPrivateKey,
      accountPublicKey: this.accountPublicKey,
    };
  }

  /**
   * @function getModelCredentials
   * @description Gets the AI model credentials
   * @returns {{aiModel: string, aiProviderApiKey: string}} AI model credentials
   */
  getModelCredentials() {
    return {
      aiModel: this.aiModel,
      aiProviderApiKey: this.aiProviderApiKey,
    };
  }

  /**
   * @function getSignature
   * @description Gets the agent signature
   * @returns {{signature: string}} Agent signature
   */
  getSignature() {
    return {
      signature: this.signature,
    };
  }

  /**
   * @function getAgent
   * @description Gets the agent mode
   * @returns {{agentMode: string}} Agent mode
   */
  getAgent() {
    return {
      agentMode: this.currentMode,
    };
  }

  /**
   * @function getAgentConfig
   * @description Gets the agent configuration
   * @returns {JsonConfig} Agent configuration
   */
  getAgentConfig(): JsonConfig | undefined {
    return this.agentconfig;
  }

  getAgentMode(): string {
    return this.agentMode;
  }

  /**
   * @function getProvider
   * @description Gets the Starknet RPC provider
   * @returns {RpcProvider} RPC provider
   */
  getProvider(): RpcProvider {
    return this.provider;
  }

  /**
   * @function validateRequest
   * @async
   * @description Validates an input request
   * @param {string} request - Request to validate
   * @returns {Promise<boolean>} True if valid, false otherwise
   */
  async validateRequest(request: string): Promise<boolean> {
    return Boolean(request && typeof request === 'string');
  }

  /**
   * @function execute
   * @async
   * @description Executes a request in agent mode
   * @param {string} input - Input to execute
   * @returns {Promise<unknown>} Result of the execution
   * @throws {Error} Throws an error if not in agent mode
   */
  async execute(input: string): Promise<unknown> {
    if (this.currentMode !== 'agent') {
      throw new Error(`Need to be in agent mode to execute`);
    }

    const result = await this.agentReactExecutor.invoke(
      {
        messages: [new HumanMessage(input)],
      },
      {
        recursionLimit: 15,
        configurable: { thread_id: this.agentconfig?.chat_id as string },
      }
    );

    return result.messages[result.messages.length - 1].content;
  }

  /**
   * @function execute_autonomous
   * @async
   * @description Executes in autonomous mode continuously
   * @returns {Promise<unknown>} Result if execution fails
   * @throws {Error} Throws an error if not in auto mode
   */
  async execute_autonomous(): Promise<unknown> {
    try {
      if (this.currentMode !== 'auto') {
        throw new Error(`Need to be in autonomous mode to execute_autonomous`);
      }

      while (true) {
        const result = await this.agentReactExecutor.agent.invoke(
          {
            messages: 'Choose what to do',
          },
          this.agentReactExecutor.agentConfig
        );

        logger.info(result.messages[result.messages.length - 1].content);

        await new Promise((resolve) =>
          setTimeout(resolve, this.agentReactExecutor.json_config.interval)
        );
      }
    } catch (error) {
      if (error instanceof Error) {
        logger.error(error.message);
      }
      return;
    }
  }

  /**
   * @function execute_call_data
   * @async
   * @description Executes a call data (signature mode) request in agent mode
   * @param {string} input - Input to execute
   * @returns {Promise<unknown>} Parsed result or error
   * @throws {Error} Throws an error if not in agent mode
   */
  async execute_call_data(input: string): Promise<unknown> {
    try {
      if (this.currentMode !== 'agent') {
        throw new Error(`Need to be in agent mode to execute_call_data`);
      }
      const aiMessage = await this.agentReactExecutor.invoke({
        messages: input,
      });
      try {
        const parsedResult = JSON.parse(
          aiMessage.messages[aiMessage.messages.length - 2].content
        );
        return parsedResult;
      } catch (parseError) {
        return {
          status: 'failure',
          error: `Failed to parse observation: ${parseError.message}`,
        };
      }
    } catch (error) {
      if (error instanceof Error) {
        logger.error(error.message);
      }
      return;
    }
  }
}
