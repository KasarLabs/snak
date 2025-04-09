import { AiConfig, IAgent } from '../common/index.js';
import { createAgent } from './agent.js';
import { RpcProvider } from 'starknet';
import { createAutonomousAgent } from './autonomousAgents.js';
import { JsonConfig } from './jsonConfig.js';
import { HumanMessage } from '@langchain/core/messages';
import { PostgresAdaptater } from './databases/postgresql/src/database.js';
import { PostgresDatabasePoolInterface } from './databases/postgresql/src/interfaces/interfaces.js';
import logger from './logger.js';
import * as metrics from '../metrics.js';
import { createBox } from './formatting.js';

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
  private database: PostgresAdaptater[] = [];

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
   * @function connectDatabase
   * @async
   * @description Connects to an existing PostgreSQL database
   * @param {string} database_name - Name of the database to connect to
   * @returns {Promise<void>}
   */
  public async connectDatabase(database_name: string): Promise<void> {
    try {
      const params: PostgresDatabasePoolInterface = {
        user: process.env.POSTGRES_USER as string,
        password: process.env.POSTGRES_PASSWORD as string,
        database: database_name,
        host: process.env.POSTGRES_HOST as string,
        port: parseInt(process.env.POSTGRES_PORT as string, 10),
      };
      const database = await new PostgresAdaptater(params).connectDatabase();
      if (!database) {
        throw new Error(
          'Error when trying to initialize your Postgres database'
        );
      }
      this.database.push(database);
    } catch (error) {
      if (error instanceof Error) {
        logger.error(error.message);
      }
      return;
    }
  }

  /**
   * @function createDatabase
   * @async
   * @description Creates a new PostgreSQL database and connects to it
   * @param {string} database_name - Name of the database to create
   * @returns {Promise<PostgresAdaptater | undefined>} The connected database or undefined if failed
   */
  public async createDatabase(
    database_name: string
  ): Promise<PostgresAdaptater | undefined> {
    try {
      const params: PostgresDatabasePoolInterface = {
        user: process.env.POSTGRES_USER as string,
        password: process.env.POSTGRES_PASSWORD as string,
        database: process.env.POSTGRES_ROOT_DB as string,
        host: process.env.POSTGRES_HOST as string,
        port: parseInt(process.env.POSTGRES_PORT as string, 10),
      };
      const database = await new PostgresAdaptater(params).connectDatabase();
      if (!database) {
        throw new Error(
          'Error when trying to initialize your Postgres database'
        );
      }
      const new_database = await database.createDatabase(database_name);
      if (!new_database) {
        throw new Error('Error when trying to create your Postgres database');
      }
      const new_params: PostgresDatabasePoolInterface = {
        user: process.env.POSTGRES_USER as string,
        password: process.env.POSTGRES_PASSWORD as string,
        database: database_name,
        host: process.env.POSTGRES_HOST as string,
        port: parseInt(process.env.POSTGRES_PORT as string, 10),
      };
      const new_database_connection = await new PostgresAdaptater(
        new_params
      ).connectDatabase();
      if (!new_database_connection) {
        throw new Error('Error when trying to connect to your database');
      }
      try {
        // Assuming there's a public method like query() or execute() in PostgresAdaptater
        await new_database_connection.query(
          'CREATE EXTENSION IF NOT EXISTS vector;'
        );
      } catch (extError) {
        console.error(
          `Failed to create vector extension in database ${database_name}:`,
          extError
        );
        console.warn(
          'Vector functionality may not work properly. Make sure pgvector is installed.'
        );
      }
      this.database.push(new_database_connection);
      return new_database_connection;
    } catch (error) {
      if (error instanceof Error) {
        logger.error(error.message);
      }
      return undefined;
    }
  }

  /**
   * @function deleteDatabase
   * @async
   * @description Deletes a database connection
   * @param {string} database_name - Name of the database to delete
   * @returns {Promise<void>}
   */
  public async deleteDatabase(database_name: string): Promise<void> {
    try {
      const database = this.getDatabaseByName(database_name);
      if (!database) {
        throw new Error(`Postgres Database : ${database_name} not found`);
      }
      await database.closeDatabase();
      this.deleteDatabaseByName(database_name);
    } catch (error) {
      logger.log(error);
      return;
    }
  }

  /**
   * @function getDatabase
   * @description Gets the array of database adapters instance
   * @returns {PostgresAdaptater[]} Array of database adapters
   */
  getDatabase(): PostgresAdaptater[] {
    return this.database;
  }

  /**
   * @function getDatabaseByName
   * @description Gets a database adapters instance by name
   * @param {string} name - Name of the database to get
   * @returns {PostgresAdaptater|undefined} Database adapter or undefined if not found
   */
  getDatabaseByName(name: string): PostgresAdaptater | undefined {
    return this.database.find((db) => db.getDatabaseName() === name);
  }

  /**
   * @function deleteDatabaseByName
   * @description Removes a database from the array of database adapters
   * @param {string} name - Name of the database to remove
   * @returns {void}
   */
  deleteDatabaseByName(name: string): void {
    if (!this.database) {
      return;
    }
    const database = this.database.filter(
      (db) => db.getDatabaseName() !== name
    );
    this.database = database;
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
  console.log = logger.info.bind(logger);  // Force tous les console.log à passer par logger.info
  console.error = logger.error.bind(logger)
  try {
    if (this.currentMode !== 'auto') {
      throw new Error(`Need to be in autonomous mode to execute_autonomous`);
    }

    logger.debug('Starting autonomous execution loop');
    
    let iterationCount = 0;
    // Run autonomously with memory management
    while (true) {
      iterationCount++;
      logger.info(`--- Autonomous iteration #${iterationCount} starting ---`);
      
      try {
        // Create a fresh agent executor every 5 iterations to prevent context growth
        if (iterationCount > 1 && iterationCount % 5 === 0) {
          logger.info('Recreating agent executor to manage context size');
          await this.createAgentReactExecutor();
        }
        
        // Use a simpler prompt that encourages concrete action
        const result = await this.agentReactExecutor.agent.invoke(
          {
            messages: 'Based on my objectives, I should take action now without seeking permission. What specific action should I take?'
          },
          this.agentReactExecutor.agentConfig
        );

        const agentResponse = result.messages[result.messages.length - 1].content;
        
        // Format the response similar to interactive mode
        const formatAgentResponse = (response: string) => {
          if (typeof response !== 'string') return response;

          return response.split('\n').map((line) => {
            if (line.includes('•')) {
              return `  ${line.trim()}`;
            }
            return line;
          });
        };

        // Log formatted response - this will also ensure visibility in production
        console.log(createBox('Agent Response', formatAgentResponse(agentResponse)));
        
        // Wait for the configured interval before next iteration
        await new Promise((resolve) =>
          setTimeout(resolve, this.agentReactExecutor.json_config.interval)
        );
      } catch (loopError) {
        logger.error(`Error in autonomous iteration #${iterationCount}:`);
        logger.error(loopError instanceof Error ? loopError.message : String(loopError));
        
        // If we hit a token limit, recreate the agent immediately
        if (loopError.message && loopError.message.includes('prompt is too long')) {
          logger.info('Token limit exceeded, recreating agent executor');
          await this.createAgentReactExecutor();
        }
        
        // Wait a bit before trying again
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
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
