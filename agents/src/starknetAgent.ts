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
import { addTokenInfoToBox, truncateToTokenLimit, estimateTokens } from './tokenTracking.js';

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
 * @interface LoggingOptions
 * @description Options for configuring logging behavior
 * @property {boolean} langchainVerbose - Whether to enable verbose logging for LangChain
 * @property {boolean} tokenLogging - Whether to log token usage
 * @property {boolean} disabled - Whether logging is completely disabled
 */
export interface LoggingOptions {
  langchainVerbose?: boolean;
  tokenLogging?: boolean;
  disabled?: boolean;
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
  private loggingOptions: LoggingOptions = {
    langchainVerbose: true,
    tokenLogging: true,
    disabled: false,
  };
  private originalLoggerInfo: any;
  private originalLoggerDebug: any;
  private originalLoggerWarn: any;
  private originalLoggerError: any;

  public readonly signature: string;
  public readonly agentMode: string;
  public readonly agentconfig: JsonConfig | undefined;

  /**
   * @constructor
   * @param {StarknetAgentConfig} config - Configuration for the StarknetAgent
   * @throws {Error} Throws an error if required configuration is missing
   */
  constructor(private readonly config: StarknetAgentConfig) {
    this.disableLogging();

    try {
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
    } catch (error) {
      throw error;
    }
  }

  /**
   * @function disableLogging
   * @description Disables all logging by replacing logger methods with no-ops
   * @returns {void}
   */
  private disableLogging(): void {
    // Store the original methods in case we want to restore them later
    this.originalLoggerInfo = logger.info;
    this.originalLoggerDebug = logger.debug;
    this.originalLoggerWarn = logger.warn;
    this.originalLoggerError = logger.error;

    // Replace with no-op functions that respect the logger method signature
    const noop = (message: any, ...meta: any[]): any => logger;
    logger.info = noop;
    logger.debug = noop;
    logger.warn = noop;
    logger.error = noop;

    this.loggingOptions.disabled = true;
  }

  /**
   * @function enableLogging
   * @description Restores original logging functions
   * @returns {void}
   */
  public enableLogging(): void {
    if (!this.originalLoggerInfo) return;

    logger.info = this.originalLoggerInfo;
    logger.debug = this.originalLoggerDebug;
    logger.warn = this.originalLoggerWarn;
    logger.error = this.originalLoggerError;

    this.loggingOptions.disabled = false;
  }

  /**
   * @function createAgentReactExecutor
   * @async
   * @description Creates an agent executor based on the current mode
   * @returns {Promise<void>}
   */
  public async createAgentReactExecutor(): Promise<void> {
    try {
      const config: AiConfig = {
        aiModel: this.aiModel,
        aiProviderApiKey: this.aiProviderApiKey,
        aiProvider: this.config.aiProvider,
        langchainVerbose: this.loggingOptions.langchainVerbose,
      };

      if (this.currentMode === 'auto') {
        this.agentReactExecutor = await createAutonomousAgent(this, config);
      } else if (this.currentMode === 'agent') {
        this.agentReactExecutor = await createAgent(this, config);
      }

      // Apply logging settings to the created executor if it exists
      if (this.agentReactExecutor && this.agentReactExecutor.agent?.llm) {
        this.agentReactExecutor.agent.llm.verbose =
          this.loggingOptions.langchainVerbose;
      }
    } catch (error) {
      throw error;
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
    if (!config) {
      throw new Error('Configuration object is required');
    }

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

    try {
      this.currentMode = newMode;
      await this.createAgentReactExecutor();
      return `Switched to ${newMode} mode`;
    } catch (error) {
      this.currentMode = newMode; // Keep the mode switch even if executor creation fails
      return `Switched to ${newMode} mode but failed to create executor: ${error instanceof Error ? error.message : String(error)}`;
    }
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
        await new_database_connection.query(
          'CREATE EXTENSION IF NOT EXISTS vector;'
        );
      } catch (extError) {
        // Vector functionality may not work properly. Make sure pgvector is installed.
      }

      this.database.push(new_database_connection);
      return new_database_connection;
    } catch (error) {
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
    const db = this.database.find((db) => db.getDatabaseName() === name);
    return db;
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
    const isValid = Boolean(request && typeof request === 'string');
    return isValid;
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
      const error = new Error(
        `Need to be in agent mode to execute (current mode: ${this.currentMode})`
      );
      throw error;
    }

    try {
      const humanMessage = new HumanMessage(input);

      if (!this.agentReactExecutor) {
        throw new Error('Agent executor is not initialized');
      }

      const result = await this.agentReactExecutor.invoke(
        {
          messages: [humanMessage],
        },
        {
          recursionLimit: 15,
          configurable: { thread_id: this.agentconfig?.chat_id as string },
        }
      );

      if (!result.messages || result.messages.length === 0) {
        return '';
      }

      const content = result.messages[result.messages.length - 1].content;
      return content;
    } catch (error) {
      throw error;
    }
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
        throw new Error(
          `Need to be in autonomous mode to execute_autonomous (current mode: ${this.currentMode})`
        );
      }

      if (!this.agentReactExecutor) {
        throw new Error(
          'Agent executor is not initialized for autonomous execution'
        );
      }

      let iterationCount = 0;
      let consecutiveErrorCount = 0;
      let tokensErrorCount = 0;
      
      // Utiliser une file de messages d'erreur pour éviter de répéter le même message d'erreur
      const lastErrors = new Set<string>();
      const addError = (error: string) => {
        lastErrors.add(error);
        if (lastErrors.size > 3) {
          // Garder seulement les 3 dernières erreurs uniques
          const iterator = lastErrors.values();
          lastErrors.delete(iterator.next().value);
        }
      };
      
      while (true) {
        iterationCount++;

        try {
          // Réinitialiser le compteur d'erreurs consécutives en cas de succès
          consecutiveErrorCount = 0;
          
          // Réduction progressive du nombre d'erreurs de tokens
          if (tokensErrorCount > 0) {
            tokensErrorCount--;
          }

          // Recréer l'agent périodiquement pour éviter l'accumulation de contexte
          // Plus fréquent s'il y a eu des erreurs de tokens récentes
          const refreshInterval = tokensErrorCount > 0 ? 3 : 5;
          if (iterationCount > 1 && iterationCount % refreshInterval === 0) {
            logger.info(`Rafraîchissement périodique de l'agent (itération ${iterationCount})`);
            await this.createAgentReactExecutor();
          }

          if (!this.agentReactExecutor.agent) {
            throw new Error('Agent property is missing from executor');
          }

          // Ajuster le message en fonction du contexte des erreurs récentes
          let promptMessage = 'Based on my objectives, You should take action now without seeking permission. Choose what to do.';
          
          if (tokensErrorCount > 0) {
            // Si des erreurs de tokens récentes, demander spécifiquement des actions plus simples
            promptMessage = 'Due to recent token limit issues, choose a very simple action now. Prefer actions that require minimal context and processing.';
          }

          const result = await this.agentReactExecutor.agent.invoke(
            { messages: promptMessage },
            this.agentReactExecutor.agentConfig
          );

          if (!result.messages || result.messages.length === 0) {
            logger.warn("L'agent a retourné une réponse vide, continuons à la prochaine itération");
            continue;
          }

          // Récupérer et vérifier le contenu du dernier message
          const lastMessage = result.messages[result.messages.length - 1];
          const agentResponse = lastMessage.content;
          
          // Si le message contient des outils et des résultats volumineux, il peut être nécessaire de le tronquer
          // Limite de 20 000 tokens pour éviter des requêtes trop coûteuses lors de l'itération suivante
          const MAX_RESPONSE_TOKENS = 20000;
          const estimatedTokens = estimateTokens(typeof agentResponse === 'string' ? agentResponse : JSON.stringify(agentResponse));
          
          let formattedAgentResponse;
          if (estimatedTokens > MAX_RESPONSE_TOKENS) {
            // Tronquer la réponse pour respecter la limite de tokens
            logger.warn(`Response exceeds token limit: ${estimatedTokens} > ${MAX_RESPONSE_TOKENS}. Truncating...`);
            if (typeof agentResponse === 'string') {
              formattedAgentResponse = truncateToTokenLimit(agentResponse, MAX_RESPONSE_TOKENS);
            } else {
              // Pour les réponses non-string (objets, etc.), on les stringifie puis on tronque
              formattedAgentResponse = truncateToTokenLimit(
                JSON.stringify(agentResponse), 
                MAX_RESPONSE_TOKENS
              );
            }
          } else {
            formattedAgentResponse = agentResponse;
          }

          const formatAgentResponse = (response: string | any) => {
            if (typeof response !== 'string') {
              return response;
            }

            return response.split('\n').map((line) => {
              if (line.includes('•')) {
                return `  ${line.trim()}`;
              }
              return line;
            });
          };

          // Afficher la réponse même avec les logs désactivés
          const boxContent = createBox(
            'Agent Response',
            formatAgentResponse(formattedAgentResponse)
          );
          // Ajouter les informations de tokens à la boîte
          const boxWithTokens = addTokenInfoToBox(boxContent);
          process.stdout.write(boxWithTokens);

          // Attendre un intervalle adaptatif basé sur la complexité de la dernière réponse
          // Si la réponse était volumineuse, attendre plus longtemps pour donner le temps aux ressources de se libérer
          const baseInterval = this.agentReactExecutor.json_config?.interval || 5000;
          let interval = baseInterval;
          
          // Augmenter l'intervalle si la réponse était volumineuse pour éviter la surcharge
          if (estimatedTokens > MAX_RESPONSE_TOKENS / 2) {
            interval = baseInterval * 1.5;
          }
          
          await new Promise((resolve) => setTimeout(resolve, interval));
        } catch (loopError) {
          // Incrémenter le compteur d'erreurs consécutives
          consecutiveErrorCount++;
          
          // Créer une clé d'erreur unique pour éviter de répéter les mêmes messages d'erreur
          const errorMessage = loopError instanceof Error ? loopError.message : String(loopError);
          addError(errorMessage);
          
          // Message d'erreur détaillé pour aider au débogage
          logger.error(`Error in autonomous agent (iteration ${iterationCount}): ${errorMessage}`);
          
          // Gérer l'erreur de limite de tokens ou de contexte trop long
          const isTokenError = (loopError instanceof Error &&
            (errorMessage.includes('token limit') ||
             errorMessage.includes('tokens exceed') ||
             errorMessage.includes('context length') ||
             errorMessage.includes('prompt is too long') ||
             errorMessage.includes('maximum context length')));
             
          if (isTokenError) {
            // Incrémenter le compteur d'erreurs de tokens
            tokensErrorCount += 2; // Augmenter davantage pour les erreurs de tokens
            
            try {
              // Au lieu de recréer complètement l'agent, nous allons simplement
              // abandonner l'action actuelle et continuer avec le même contexte
              logger.warn("Limite de tokens atteinte - abandon de l'action actuelle sans perte de contexte");
              
              // Afficher un message indiquant l'abandon de l'action
              const warningMessage = createBox(
                'Action Abandonnée',
                "L'action en cours a été abandonnée en raison d'une limite de tokens. L'agent va tenter une action différente."
              );
              process.stdout.write(warningMessage);
              
              // Attendre avant de reprendre pour éviter les boucles d'erreur
              // L'attente augmente avec le nombre d'erreurs consécutives
              const pauseDuration = Math.min(5000 + (consecutiveErrorCount * 1000), 15000);
              await new Promise((resolve) => setTimeout(resolve, pauseDuration));
              
              // Réinitialisation forcée si plusieurs erreurs liées aux tokens
              if (consecutiveErrorCount >= 2 || tokensErrorCount >= 3) {
                logger.warn("Trop d'erreurs liées aux tokens, réinitialisation complète de l'agent...");
                
                // Forcer l'agent à oublier son contexte pour éviter d'accumuler des tokens
                await this.createAgentReactExecutor();
                
                const resetMessage = createBox(
                  'Agent Reset',
                  "En raison de problèmes persistants de tokens, l'agent a été réinitialisé. Cela peut effacer certaines informations de contexte mais permettra de poursuivre l'exécution."
                );
                process.stdout.write(resetMessage);
                
                // Attendre plus longtemps après une réinitialisation
                await new Promise((resolve) => setTimeout(resolve, 8000));
                
                // Réinitialiser le compteur d'erreurs consécutives mais pas tokensErrorCount
                consecutiveErrorCount = 0;
              }
            } catch (recreateError) {
              logger.error(`Failed to handle token limit gracefully: ${recreateError}`);
              // Attente progressive en cas d'erreur
              const waitTime = consecutiveErrorCount >= 3 ? 15000 : 5000;
              await new Promise((resolve) => setTimeout(resolve, waitTime));
              
              // Si vraiment rien ne fonctionne, tenter une réinitialisation d'urgence
              if (consecutiveErrorCount >= 5) {
                try {
                  // Forcer une réinitialisation complète avec un nouvel exécuteur
                  await this.createAgentReactExecutor();
                  logger.warn("Réinitialisation d'urgence effectuée après échecs multiples");
                } catch (e) {
                  // Juste continuer - nous avons tout essayé
                }
              }
            }
          } else {
            // Pour les autres types d'erreurs, attente progressive
            let waitTime = 3000; // Temps d'attente de base
            
            // Augmenter le temps d'attente avec le nombre d'erreurs consécutives
            if (consecutiveErrorCount >= 5) {
              waitTime = 30000; // 30 secondes pour 5+ erreurs
              logger.warn(`${consecutiveErrorCount} errors in a row, waiting much longer before retry...`);
            } else if (consecutiveErrorCount >= 3) {
              waitTime = 10000; // 10 secondes pour 3-4 erreurs
              logger.warn(`${consecutiveErrorCount} errors in a row, waiting longer before retry...`);
            }
            
            // Appliquer une pause pour éviter les boucles d'erreur rapides
            await new Promise((resolve) => setTimeout(resolve, waitTime));
            
            // Si trop d'erreurs s'accumulent (non liées aux tokens), réinitialiser l'agent
            if (consecutiveErrorCount >= 7) {
              try {
                logger.warn("Trop d'erreurs consécutives, tentative de réinitialisation complète...");
                await this.createAgentReactExecutor();
                await new Promise((resolve) => setTimeout(resolve, 5000));
              } catch (e) {
                // Continue even if reset fails
              }
            }
          }
        }
      }
    } catch (error) {
      return error;
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
        throw new Error(
          `Need to be in agent mode to execute_call_data (current mode: ${this.currentMode})`
        );
      }

      if (!this.agentReactExecutor) {
        throw new Error('Agent executor is not initialized');
      }

      const aiMessage = await this.agentReactExecutor.invoke({
        messages: input,
      });

      try {
        if (!aiMessage.messages || aiMessage.messages.length < 2) {
          throw new Error(
            'Insufficient messages returned from call data execution'
          );
        }

        const messageContent =
          aiMessage.messages[aiMessage.messages.length - 2].content;
        const parsedResult = JSON.parse(messageContent);
        return parsedResult;
      } catch (parseError) {
        return {
          status: 'failure',
          error: `Failed to parse observation: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
        };
      }
    } catch (error) {
      return {
        status: 'failure',
        error: `Execution error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * @function setLoggingOptions
   * @description Sets logging options for the agent
   * @param {LoggingOptions} options - Logging options to set
   */
  public setLoggingOptions(options: LoggingOptions): void {
    this.loggingOptions = { ...this.loggingOptions, ...options };

    if (options.disabled === true && !this.loggingOptions.disabled) {
      this.disableLogging();
      return;
    } else if (options.disabled === false && this.loggingOptions.disabled) {
      this.enableLogging();
    }

    if (!this.loggingOptions.disabled && this.agentReactExecutor) {
      if (this.agentReactExecutor.agent?.llm) {
        const llm = this.agentReactExecutor.agent.llm;
        llm.verbose = this.loggingOptions.langchainVerbose === true;
      }

      if (this.agentReactExecutor.graph?._nodes?.agent?.data?.model) {
        this.agentReactExecutor.graph._nodes.agent.data.model.verbose =
          this.loggingOptions.langchainVerbose === true;
      }

      const applyToAllModels = (obj: any) => {
        if (!obj) return;
        if (obj.verbose !== undefined && typeof obj.verbose === 'boolean') {
          obj.verbose = this.loggingOptions.langchainVerbose === true;
        }
        if (typeof obj === 'object') {
          Object.values(obj).forEach((val) => {
            if (val && typeof val === 'object') {
              applyToAllModels(val);
            }
          });
        }
      };

      applyToAllModels(this.agentReactExecutor);
    }
  }
}
