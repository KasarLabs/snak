// agents/main/starknetAgent.ts
import { BaseAgent, AgentType, IModelAgent } from '../core/baseAgent.js';
import { RpcProvider } from 'starknet';
import { ModelSelectionAgent } from '../operators/modelSelectionAgent.js';
import { logger, metrics } from '@snakagent/core';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import {
  BaseMessage,
  HumanMessage,
  AIMessage,
  SystemMessage,
} from '@langchain/core/messages';
import { createBox } from '../../prompt/formatting.js';
import { addTokenInfoToBox } from '../../token/tokenTracking.js';
import { DatabaseCredentials } from '../../tools/types/database.js';
import { JsonConfig } from '../../config/jsonConfig.js';

/**
 * Configuration de mémoire pour l'agent
 */
export interface MemoryConfig {
  enabled?: boolean;
  shortTermMemorySize?: number;
  recursionLimit?: number;
}

/**
 * Configuration pour StarknetAgent
 */
export interface StarknetAgentConfig {
  provider: RpcProvider;
  accountPublicKey: string;
  accountPrivateKey: string;
  signature: string;
  agentMode: string;
  db_credentials: DatabaseCredentials;
  agentconfig?: JsonConfig;
  memory?: MemoryConfig;
  modelSelector?: ModelSelectionAgent;
}

/**
 * Options de journalisation
 */
export interface LoggingOptions {
  langchainVerbose?: boolean;
  tokenLogging?: boolean;
  disabled?: boolean;
  modelSelectionDebug?: boolean;
}

/**
 * L'agent principal pour interagir avec la blockchain Starknet
 */
export class StarknetAgent extends BaseAgent implements IModelAgent {
  private readonly provider: RpcProvider;
  private readonly accountPrivateKey: string;
  private readonly accountPublicKey: string;
  private readonly signature: string;
  private readonly agentMode: string;
  private readonly agentconfig?: JsonConfig;
  private readonly db_credentials: DatabaseCredentials;
  private memory: MemoryConfig;
  private currentMode: string;
  private agentReactExecutor: any;
  private modelSelector: ModelSelectionAgent | null = null;
  private loggingOptions: LoggingOptions = {
    langchainVerbose: true,
    tokenLogging: true,
    disabled: false,
    modelSelectionDebug: false,
  };
  private originalLoggerFunctions: Record<string, any> = {};

  constructor(config: StarknetAgentConfig) {
    super('starknet', AgentType.MAIN);

    // Configuration de journalisation
    const disableLogging = process.env.DISABLE_LOGGING === 'true';
    const enableDebugLogging =
      process.env.DEBUG_LOGGING === 'true' ||
      process.env.LOG_LEVEL === 'debug' ||
      process.env.NODE_ENV === 'development';

    if (disableLogging) {
      this.disableLogging();
    } else if (enableDebugLogging) {
      this.loggingOptions.disabled = false;
      this.loggingOptions.modelSelectionDebug = true;
    } else {
      this.disableLogging();
    }

    // Initialiser les propriétés
    this.provider = config.provider;
    this.accountPrivateKey = config.accountPrivateKey;
    this.accountPublicKey = config.accountPublicKey;
    this.signature = config.signature;
    this.agentMode = config.agentMode;
    this.db_credentials = config.db_credentials;
    this.currentMode =
      config.agentMode === 'auto' ||
      config.agentconfig?.mode?.autonomous === true
        ? 'auto'
        : config.agentMode || 'agent';
    this.agentconfig = config.agentconfig;
    this.memory = config.memory || {};
    this.modelSelector = config.modelSelector || null;

    // Vérifier la présence d'autres configurations nécessaires
    if (!config.accountPrivateKey) {
      throw new Error('STARKNET_PRIVATE_KEY is required');
    }

    metrics.metricsAgentConnect(
      config.agentconfig?.name ?? 'agent',
      config.agentMode
    );
  }

  /**
   * Initialise l'agent Starknet
   */
  public async init(): Promise<void> {
    try {
      logger.debug('Initializing StarknetAgent...');

      // Si nous avons déjà un modelSelector, utiliser celui-là
      if (!this.modelSelector) {
        logger.warn(
          'StarknetAgent: No ModelSelectionAgent provided, functionality will be limited'
        );
      }

      // Tester la création de l'exécuteur d'agent React
      try {
        logger.debug(
          'StarknetAgent: Testing agent executor creation during init...'
        );
        await this.createAgentReactExecutor();

        if (!this.agentReactExecutor) {
          logger.warn(
            'StarknetAgent: Agent executor creation succeeded but returned null/undefined'
          );
        } else {
          logger.debug(
            'StarknetAgent: Agent executor created successfully during initialization'
          );
        }
      } catch (executorError) {
        logger.error(
          `StarknetAgent: Failed to create agent executor during init: ${executorError}`
        );
        logger.warn(
          'StarknetAgent: Will attempt to recover during execute() calls'
        );
        // Ne pas faire échouer l'init complètement, nous essaierons à nouveau lors des appels execute()
      }

      logger.debug('StarknetAgent initialized successfully.');
    } catch (error) {
      logger.error(`StarknetAgent initialization failed: ${error}`);
      throw error;
    }
  }

  /**
   * Désactive la journalisation en remplaçant les méthodes du logger par des no-ops
   */
  private disableLogging(): void {
    // Stocker les méthodes originales si ce n'est pas déjà fait
    if (!this.originalLoggerFunctions.info) {
      this.originalLoggerFunctions = {
        info: logger.info,
        debug: logger.debug,
        warn: logger.warn,
        error: logger.error,
      };
    }

    // Remplacer par des fonctions no-op qui respectent la signature des méthodes du logger
    const noop = (message: any, ...meta: any[]): any => logger;
    logger.info = noop;
    logger.debug = noop;
    logger.warn = noop;
    logger.error = noop;

    this.loggingOptions.disabled = true;
    console.log('Logging has been disabled');
  }

  /**
   * Restaure les fonctions de journalisation d'origine
   */
  public enableLogging(): void {
    // Ne restaurer que si nous avons les fonctions d'origine sauvegardées
    if (!this.originalLoggerFunctions.info) {
      console.log('No original logger functions to restore');
      return;
    }

    // Restaurer les fonctions d'origine
    logger.info = this.originalLoggerFunctions.info;
    logger.debug = this.originalLoggerFunctions.debug;
    logger.warn = this.originalLoggerFunctions.warn;
    logger.error = this.originalLoggerFunctions.error;

    this.loggingOptions.disabled = false;
    console.log('Logging has been enabled');
    logger.debug('Logger functions restored');
  }

  /**
   * Définit les options de journalisation pour l'agent
   */
  public setLoggingOptions(options: LoggingOptions): void {
    // Appliquer les options
    this.loggingOptions = { ...this.loggingOptions, ...options };

    if (options.disabled === true && !this.loggingOptions.disabled) {
      this.disableLogging();
      return;
    } else if (options.disabled === false && this.loggingOptions.disabled) {
      this.enableLogging();
    }

    // Mettre à jour le mode de débogage de la sélection de modèle si elle existe et que l'option a changé
    if (this.modelSelector && options.modelSelectionDebug !== undefined) {
      // Préserver le paramètre metaSelection de la configuration de l'agent
      const useMetaSelection = this.agentconfig?.mode?.metaSelection === true;

      // Mettre à jour uniquement le mode debug
      // this.modelSelector.setDebugMode(this.loggingOptions.modelSelectionDebug);

      logger.debug(
        `Updated ModelSelectionAgent: debug mode=${this.loggingOptions.modelSelectionDebug}, meta selection=${useMetaSelection}`
      );
    }

    // Ne mettre à jour les paramètres de verbosité LLM que si nous avons un exécuteur et que la journalisation est activée
    if (!this.loggingOptions.disabled && this.agentReactExecutor) {
      this.applyLoggerVerbosityToExecutor();
    }
  }

  /**
   * Crée un exécuteur d'agent en fonction du mode actuel
   * @returns Promise<void>
   */
  private async createAgentReactExecutor(): Promise<void> {
    try {
      logger.debug(
        'StarknetAgent: Starting createAgentReactExecutor with mode=' +
          this.currentMode
      );

      // Importation dynamique avec gestion d'erreur améliorée
      let createAgentFunc, createAutonomousAgentFunc;

      try {
        const interactiveModule = await import('../modes/interactive.js');
        createAgentFunc = interactiveModule.createAgent;
        logger.debug('StarknetAgent: Successfully imported interactive module');
      } catch (importError) {
        logger.error(
          `StarknetAgent: Failed to import interactive module: ${importError}`
        );
        throw new Error(`Failed to import interactive module: ${importError}`);
      }

      try {
        const autonomousModule = await import('../modes/autonomous.js');
        createAutonomousAgentFunc = autonomousModule.createAutonomousAgent;
        logger.debug('StarknetAgent: Successfully imported autonomous module');
      } catch (importError) {
        logger.error(
          `StarknetAgent: Failed to import autonomous module: ${importError}`
        );
        throw new Error(`Failed to import autonomous module: ${importError}`);
      }

      const tempAiConfig = {
        langchainVerbose: this.loggingOptions.langchainVerbose,
        // AJOUTER CES LIGNES:
        aiProvider: 'anthropic', // Valeur par défaut si non spécifiée
        aiModel: 'claude-3-5-sonnet-latest', // Valeur par défaut si non spécifiée
        aiProviderApiKey: process.env.ANTHROPIC_API_KEY, // Utiliser la clé API correspondante
        // ... autres configurations existantes ...
      };

      logger.debug(`StarknetAgent: Using current mode: ${this.currentMode}`);

      // Création de l'executor avec vérifications
      if (this.currentMode === 'auto') {
        logger.debug('StarknetAgent: Creating autonomous agent executor...');
        if (!createAutonomousAgentFunc) {
          throw new Error(
            'Autonomous agent creation function is not available'
          );
        }
        // Pass 'this' (StarknetAgent instance) and tempAiConfig
        this.agentReactExecutor = await createAutonomousAgentFunc(
          this,
          tempAiConfig
        );
        logger.debug(
          'StarknetAgent: Autonomous agent executor created successfully'
        );
      } else if (
        this.currentMode === 'interactive' ||
        this.currentMode === 'agent'
      ) {
        logger.debug('StarknetAgent: Creating interactive agent executor...');
        if (!createAgentFunc) {
          throw new Error(
            'Interactive agent creation function is not available'
          );
        }
        // Pass 'this' (StarknetAgent instance) and tempAiConfig
        this.agentReactExecutor = await createAgentFunc(this, tempAiConfig);
        logger.debug(
          'StarknetAgent: Interactive agent executor created successfully'
        );
      } else {
        throw new Error(`Invalid mode: ${this.currentMode}`);
      }

      // Vérifier que l'executor a bien été créé
      if (!this.agentReactExecutor) {
        throw new Error(
          `Failed to create agent executor for mode ${this.currentMode}: result is null/undefined`
        );
      }

      this.applyLoggerVerbosityToExecutor();
      logger.debug(
        'StarknetAgent: Agent executor created and configured successfully'
      );
    } catch (error) {
      logger.error(
        `StarknetAgent: Failed to create Agent React Executor: ${error}`
      );
      if (error instanceof Error && error.stack) {
        logger.error(`Stack trace: ${error.stack}`);
      }
      throw error; // Re-throw the error to be caught by the caller (e.g., execute method)
    }
  }

  /**
   * Applique les paramètres de verbosité du logger à l'exécuteur d'agent React
   */
  private applyLoggerVerbosityToExecutor(): void {
    if (!this.agentReactExecutor) return;

    // Mettre à jour le LLM principal s'il est disponible
    if (this.agentReactExecutor.agent?.llm) {
      this.agentReactExecutor.agent.llm.verbose =
        this.loggingOptions.langchainVerbose === true;
    }

    // Mettre à jour le modèle dans les nœuds de graphe s'il est disponible
    if (this.agentReactExecutor.graph?._nodes?.agent?.data?.model) {
      this.agentReactExecutor.graph._nodes.agent.data.model.verbose =
        this.loggingOptions.langchainVerbose === true;
    }
  }

  /**
   * Obtient le modèle approprié pour une tâche en fonction des messages
   */
  public async getModelForTask(
    messages: BaseMessage[],
    forceModelType?: string
  ): Promise<BaseChatModel> {
    if (!this.modelSelector) {
      throw new Error('ModelSelectionAgent not available');
    }

    return this.modelSelector.getModelForTask(messages, forceModelType);
  }

  /**
   * Invoque un modèle avec la logique de sélection appropriée
   */
  public async invokeModel(
    messages: BaseMessage[],
    forceModelType?: string
  ): Promise<any> {
    if (!this.modelSelector) {
      throw new Error('ModelSelectionAgent not available');
    }

    return this.modelSelector.invokeModel(messages, forceModelType);
  }

  /**
   * Obtient les informations d'identification du compte Starknet
   */
  public getAccountCredentials() {
    return {
      accountPrivateKey: this.accountPrivateKey,
      accountPublicKey: this.accountPublicKey,
    };
  }

  /**
   * Obtient les informations d'identification de la base de données
   */
  public getDatabaseCredentials() {
    return this.db_credentials;
  }

  /**
   * Obtient la signature de l'agent
   */
  public getSignature() {
    return {
      signature: this.signature,
    };
  }

  /**
   * Obtient le mode d'agent actuel
   */
  public getAgent() {
    return {
      agentMode: this.currentMode,
    };
  }

  /**
   * Obtient la configuration de l'agent
   */
  public getAgentConfig(): JsonConfig | undefined {
    return this.agentconfig;
  }

  /**
   * Obtient le mode d'agent d'origine de l'initialisation
   */
  public getAgentMode(): string {
    return this.agentMode;
  }

  /**
   * Obtient le fournisseur RPC Starknet
   */
  public getProvider(): RpcProvider {
    return this.provider;
  }

  /**
   * @param config Configuration optionnelle pour l'exécution, peut inclure `agentMode` pour changer temporairement le mode.
   * @returns La réponse de l'agent.
   */
  public async execute(
    input: string | BaseMessage | any,
    config?: Record<string, any>
  ): Promise<unknown> {
    let responseContent: string | any;
    let iteration = 0;
    let errorCount = 0;
    const maxIterations = this.memory?.recursionLimit ?? 5;
    const maxErrors = 3; // Nombre max de tentatives d'initialisation
    let fallbackAttempted = false;
    let originalMode = this.currentMode;

    try {
      logger.debug(`StarknetAgent executing with mode: ${this.currentMode}`);

      // Vérifier si nous devons ajuster temporairement le mode pour cette exécution
      const requestedMode = config?.agentMode;

      // Changer temporairement de mode si nécessaire pour cette exécution
      if (requestedMode && requestedMode !== this.currentMode) {
        logger.debug(
          `Temporarily switching mode from ${this.currentMode} to ${requestedMode} for this execution`
        );
        this.currentMode = requestedMode;
      }

      // S'assurer que l'exécuteur est créé pour le mode actuel
      if (!this.agentReactExecutor) {
        logger.debug(
          'StarknetAgent: No executor exists, attempting to create one...'
        );
        try {
          await this.createAgentReactExecutor();
        } catch (initError) {
          logger.error(
            `StarknetAgent: Initial attempt to initialize executor failed: ${initError}`
          );
          errorCount++;
          // Return formatted error message on initial failure
          const errorMessage = new AIMessage({
            content: `Je ne peux pas traiter votre requête actuellement car l'agent n'a pas pu s'initialiser correctement. Erreur: ${initError}`,
            additional_kwargs: {
              from: 'starknet',
              final: true,
              error: 'initialization_failed',
            },
          });

          // Check if we should retry or fallback
          if (errorCount >= maxErrors) {
            logger.warn(
              'StarknetAgent: Maximum initialization attempts reached, using fallback mode'
            );
            fallbackAttempted = true;
            return this.executeSimpleFallback(input);
          } else {
            // If not max errors, return the init error message but allow retry on next call
            return errorMessage;
          }
        }
      }

      // Retry logic within execute if executor is still null after initial attempt or becomes null later
      while (!this.agentReactExecutor && errorCount < maxErrors) {
        errorCount++;
        logger.warn(
          `StarknetAgent: Attempt ${errorCount} to initialize executor failed, trying again...`
        );
        try {
          await this.createAgentReactExecutor();
        } catch (retryError) {
          logger.error(
            `StarknetAgent: Retry attempt ${errorCount} failed: ${retryError}`
          );
        }
        if (this.agentReactExecutor) {
          logger.debug(
            `StarknetAgent: Executor successfully created on attempt ${errorCount}`
          );
          break; // Exit loop if successful
        }
      }

      // If still no executor after retries, use fallback
      if (
        !this.agentReactExecutor &&
        errorCount >= maxErrors &&
        !fallbackAttempted
      ) {
        logger.warn(
          'StarknetAgent: Maximum initialization attempts reached after retries, using fallback mode'
        );
        fallbackAttempted = true;
        return this.executeSimpleFallback(input);
      }

      // Ensure we have a valid executor now before proceeding
      if (!this.agentReactExecutor) {
        logger.error(
          'StarknetAgent: Failed to create a valid executor after attempts'
        );
        return new AIMessage({
          content:
            "Impossible d'initialiser l'agent d'exécution après plusieurs tentatives. Veuillez réessayer ou contacter l'administrateur.",
          additional_kwargs: {
            from: 'starknet',
            final: true,
            error: 'executor_creation_failed_retries',
          },
        });
      }

      // Check if we need to recreate the executor for a different mode
      else if (originalMode !== this.currentMode) {
        logger.debug(`Re-creating executor for mode: ${this.currentMode}`);
        try {
          await this.createAgentReactExecutor();
          if (!this.agentReactExecutor) {
            // This case should theoretically be handled by the creation logic itself, but double-check
            throw new Error(
              `Failed to initialize Agent React Executor for mode: ${this.currentMode}`
            );
          }
          logger.debug(
            `Executor successfully re-created for mode: ${this.currentMode}`
          );
        } catch (modeChangeError) {
          logger.error(
            `StarknetAgent: Failed to recreate executor for mode ${this.currentMode}: ${modeChangeError}`
          );

          // Restore original mode on failure
          this.currentMode = originalMode;

          return new AIMessage({
            content: `Impossible de changer le mode de l'agent à "${requestedMode}". Erreur: ${modeChangeError}`,
            additional_kwargs: {
              from: 'starknet',
              final: true,
              error: 'mode_change_failed',
            },
          });
        }
      }

      // ----- Main execution logic starts here -----
      // Ensure input is a BaseMessage for LangChain compatibility
      let currentMessages: BaseMessage[];
      if (input instanceof BaseMessage) {
        currentMessages = [input];
      } else if (typeof input === 'string') {
        currentMessages = [new HumanMessage({ content: input })];
      } else {
        // Handle other potential input types or throw error
        logger.error(`StarknetAgent: Unsupported input type: ${typeof input}`);
        return new AIMessage({
          content: "Type d'entrée non supporté.",
          additional_kwargs: {
            from: 'starknet',
            final: true,
            error: 'unsupported_input_type',
          },
        });
      }

      // Exécution de la logique de l'agent
      logger.debug(
        `StarknetAgent: Invoking agent executor with input: ${JSON.stringify(currentMessages)}`
      );
      let result: any;
      try {
        result = await this.agentReactExecutor.invoke(
          { messages: currentMessages },
          { configurable: { thread_id: 'default' } } // Assuming a default thread ID or manage dynamically
        );
        // Assuming result contains the final AIMessage or similar structure
        responseContent = result.messages[result.messages.length - 1].content;
      } catch (agentExecError: any) {
        logger.error(
          `StarknetAgent: Agent execution failed: ${agentExecError}`
        );
        // Check for specific error types if needed
        if (this.isTokenRelatedError(agentExecError)) {
          logger.warn('Token related error detected during execution.');
          responseContent = 'Error: Token validation or processing failed.';
        } else {
          responseContent = `Error during agent execution: ${agentExecError.message}`;
        }
        // Decide if we should fallback even on execution error
        logger.error(
          `StarknetAgent: Catastrophic error in execute, using fallback: ${agentExecError}`
        );
        return this.executeSimpleFallback(input); // Using fallback for execution errors too
      }

      logger.debug(
        `StarknetAgent raw response: ${JSON.stringify(responseContent)}`
      );

      // Format response if needed (e.g., removing backticks)
      const finalResponse = this.formatResponseForDisplay(responseContent);
      logger.debug(
        `StarknetAgent final response: ${JSON.stringify(finalResponse)}`
      );

      // Return structured AIMessage with metadata
      // This should be the final return within the try block if successful
      responseContent = new AIMessage({
        content: finalResponse,
        additional_kwargs: {
          from: 'starknet',
          final: true,
          agent_mode: this.currentMode, // Report the mode used for this response
        },
      });
    } catch (error: any) {
      logger.error(`StarknetAgent main execution failed: ${error}`);
      responseContent = `Error: ${error.message}`;
      // In case of catastrophic error outside agent invocation, use fallback
      if (!fallbackAttempted) {
        logger.error(
          `StarknetAgent: Catastrophic error in execute, using fallback: ${error}`
        );
        // Ensure fallback returns directly
        return this.executeSimpleFallback(input);
      }
      // If fallback was attempted or error happened after fallback check, create error AIMessage
      responseContent = new AIMessage({
        content: `Error: ${error.message}`,
        additional_kwargs: {
          from: 'starknet',
          final: true,
          error: 'execution_error',
        },
      });
    } finally {
      // Restaurer le mode original si changé temporairement
      if (config?.agentMode && this.currentMode !== originalMode) {
        logger.debug(`Restoring original agent mode: ${originalMode}`);
        this.currentMode = originalMode;
        // Recréer l'executor pour le mode original si nécessaire
        // await this.createAgentReactExecutor();
        // ^-- Optionnel: dépend si on veut que l'agent soit prêt pour le prochain appel
      }
    }

    logger.debug('StarknetAgent: Execution finished, returning response');
    // Return the final responseContent (either AIMessage or error string from initial failures)
    return responseContent;
  }

  /**
   * Mode d'exécution de secours simple lorsque l'exécuteur principal échoue.
   * @param input L'entrée originale reçue par la méthode execute.
   * @returns Un simple AIMessage indiquant le mode de secours.
   */
  private async executeSimpleFallback(
    input: string | BaseMessage
  ): Promise<AIMessage> {
    logger.warn('StarknetAgent: Executing in simple fallback mode');

    // Extraire le contenu de la requête de manière sécurisée
    let queryContent = 'Indisponible';
    try {
      if (typeof input === 'string') {
        queryContent = input;
      } else if (
        input instanceof BaseMessage &&
        typeof input.content === 'string'
      ) {
        queryContent = input.content;
      } else if (input && typeof input.toString === 'function') {
        queryContent = input.toString(); // Fallback vers toString()
      }
    } catch (e) {
      logger.error(`Erreur d'extraction du contenu en mode de secours: ${e}`);
    }

    // Réponse simplifiée
    const truncatedQuery =
      queryContent.substring(0, 100) + (queryContent.length > 100 ? '...' : '');
    const responseMessage = `Je ne peux pas traiter votre requête complètement car je suis en mode de secours. Votre requête était: "${truncatedQuery}"`;

    return new AIMessage({
      content: responseMessage,
      additional_kwargs: {
        from: 'starknet',
        final: true,
        error: 'fallback_mode_activated',
      },
    });
  }

  /**
   * Formate la réponse de l'agent pour l'affichage
   */
  private formatResponseForDisplay(response: string | any): string | any {
    if (typeof response !== 'string') {
      // If it's already an AIMessage or object, return as is
      if (
        response instanceof AIMessage ||
        (typeof response === 'object' && response !== null)
      ) {
        return response;
      }
      // Otherwise, try to stringify
      try {
        return JSON.stringify(response);
      } catch {
        return String(response); // Fallback to basic string conversion
      }
    }

    // If it's a string, format bullet points
    const lines = response.split('\n');
    const formattedLines = lines.map((line: string) => {
      if (line.trim().startsWith('•')) {
        // Check for trimmed line start
        return `  ${line.trim()}`;
      }
      return line;
    });
    return formattedLines.join('\n');
  }

  /**
   * Vérifie si une erreur est liée aux tokens
   */
  private isTokenRelatedError(error: any): boolean {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return (
      errorMessage.includes('token limit') ||
      errorMessage.includes('tokens exceed') ||
      errorMessage.includes('context length') ||
      errorMessage.includes('prompt is too long') ||
      errorMessage.includes('maximum context length')
    );
  }

  /**
   * Exécute une demande de données d'appel (mode signature) en mode agent
   */
  public async execute_call_data(input: string): Promise<unknown> {
    try {
      if (this.currentMode !== 'agent') {
        throw new Error(
          `Need to be in agent mode to execute_call_data (current mode: ${this.currentMode})`
        );
      }

      if (!this.agentReactExecutor) {
        throw new Error('Agent executor is not initialized');
      }

      // Préparer les options d'invocation avec élagage des messages
      const invokeOptions: any = {};

      // Ajouter l'élagage des messages si la mémoire est activée
      if (this.memory.enabled !== false) {
        // Utiliser mode.recursionLimit si disponible, sinon revenir à la configuration de la mémoire
        const recursionLimit =
          this.agentconfig?.mode?.recursionLimit !== undefined
            ? this.agentconfig.mode.recursionLimit
            : this.memory.recursionLimit !== undefined
              ? this.memory.recursionLimit
              : this.memory.shortTermMemorySize || 15;

        // N'appliquer la limite de récursion que si elle n'est pas nulle (0 signifie pas de limite)
        if (recursionLimit !== 0) {
          invokeOptions.recursionLimit = recursionLimit;
          invokeOptions.messageHandler = (messages: any[]) => {
            if (messages.length > recursionLimit) {
              logger.debug(
                `Call data - message pruning: ${messages.length} messages exceeds limit ${recursionLimit}`
              );
              const prunedMessages = [
                messages[0],
                ...messages.slice(-(recursionLimit - 1)),
              ];
              logger.debug(
                `Call data - pruned from ${messages.length} to ${prunedMessages.length} messages`
              );
              return prunedMessages;
            }
            return messages;
          };
          logger.debug(
            `Execute call data: configured with recursionLimit=${recursionLimit}`
          );
        } else {
          logger.debug(`Execute call data: running without recursion limit`);
        }
      }

      logger.debug('Execute call data: invoking agent');
      const aiMessage = await this.agentReactExecutor.invoke(
        {
          messages: input,
        },
        invokeOptions
      );
      logger.debug('Execute call data: agent invocation complete');

      try {
        if (!aiMessage.messages || aiMessage.messages.length < 2) {
          throw new Error(
            'Insufficient messages returned from call data execution'
          );
        }

        const messageContent =
          aiMessage.messages[aiMessage.messages.length - 2].content;
        return JSON.parse(messageContent);
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
   * Exécute en mode autonome en continu
   * @returns Promise<unknown>
   */
  public async execute_autonomous(): Promise<unknown> {
    // Rediriger vers la fonction appropriée dans starknetAgent.ts
    try {
      // Valider que nous sommes en mode autonome
      if (this.currentMode !== 'auto') {
        if (this.agentconfig?.mode?.autonomous) {
          logger.info(
            `Overriding mode to 'auto' based on config settings (autonomous=${this.agentconfig?.mode?.autonomous})`
          );
          this.currentMode = 'auto';
        } else {
          throw new Error(
            `Need to be in autonomous mode to execute_autonomous (current mode: ${this.currentMode})`
          );
        }
      }

      if (!this.agentReactExecutor) {
        await this.createAgentReactExecutor();
        if (!this.agentReactExecutor) {
          throw new Error(
            'Agent executor is not initialized for autonomous execution'
          );
        }
      }

      // Utiliser l'implémentation autonome du fichier original
      const result = await this._executeAutonomous();
      return result;
    } catch (error) {
      return {
        status: 'failure',
        error: `Autonomous execution error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Implémentation interne de l'exécution autonome
   * @returns Promise<any>
   */
  private async _executeAutonomous(): Promise<any> {
    // Implémentation de l'exécution autonome
    try {
      let iterationCount = 0;
      let consecutiveErrorCount = 0;
      let tokensErrorCount = 0;
      let lastNextSteps: string | null = null;
      // Utiliser directement la valeur par défaut, car this.agentconfig.mode.maxIterations n'est pas défini
      const MAX_ITERATIONS = 50; // this.agentconfig?.mode?.maxIterations || 50;

      // Conserver un historique de conversation complet pour invoquer le graphe
      let conversationHistory: BaseMessage[] = [];

      // Ajouter le prompt système initial si disponible dans la configuration
      if (
        this.agentReactExecutor &&
        this.agentReactExecutor.agent &&
        this.agentconfig?.prompt?.content
      ) {
        // S'assurer que le contenu est une chaîne de caractères
        const systemPromptContent =
          typeof this.agentconfig.prompt.content === 'string'
            ? this.agentconfig.prompt.content
            : JSON.stringify(this.agentconfig.prompt.content);
        const systemPrompt = new SystemMessage(systemPromptContent);
        conversationHistory.push(systemPrompt);
      }

      // Boucle principale autonome
      while (iterationCount < MAX_ITERATIONS) {
        iterationCount++;

        try {
          // Déterminer le message d'entrée pour CETTE itération
          let currentTurnInput: BaseMessage;

          if (lastNextSteps) {
            logger.debug(
              `Using previous NEXT STEPS as prompt: "${lastNextSteps}"`
            );
            // Utiliser les NEXT STEPS comme entrée utilisateur pour ce tour
            currentTurnInput = new HumanMessage({
              content: `Execute the following planned action based on the previous turn: "${lastNextSteps}". Ensure it's a single, simple action.`,
              name: 'Planner',
            });
          } else {
            logger.debug(
              'No previous NEXT STEPS found, generating adaptive prompt.'
            );
            // Repli sur le prompt adaptatif général
            const promptMessage =
              'Based on your objectives and the recent conversation history, determine the next best action to take.';
            currentTurnInput = new HumanMessage(promptMessage);
          }

          // Ajouter l'entrée pour ce tour à l'historique
          conversationHistory.push(currentTurnInput);

          // Préparer les options d'invocation
          const agentConfig = this.agentReactExecutor.agentConfig || {
            configurable: { thread_id: 'autonomous_session' },
          };

          logger.debug(
            `Autonomous iteration ${iterationCount}: invoking graph with ${conversationHistory.length} messages`
          );

          // Invoquer le graphe avec l'historique actuel complet
          const result = await this.agentReactExecutor.agent.invoke(
            { messages: conversationHistory },
            agentConfig
          );

          logger.debug(
            `Autonomous iteration ${iterationCount}: graph invocation complete`
          );

          // Traiter le résultat du graphe
          if (!result || !result.messages || result.messages.length === 0) {
            logger.warn(
              'Graph returned empty or invalid state, stopping loop.'
            );
            break;
          }

          // Le result.messages contient l'état *après* que le graphe ait terminé.
          // Le(s) dernier(s) message(s) devrai(en)t être la réponse de l'agent ou les résultats de l'outil.
          conversationHistory = result.messages;

          // Trouver le tout dernier message ajouté par l'exécution du graphe (devrait être AIMessage ou ToolMessage)
          const lastMessageFromGraph =
            conversationHistory[conversationHistory.length - 1];

          if (lastMessageFromGraph instanceof AIMessage) {
            // Traiter et afficher la réponse de l'IA
            lastNextSteps = this.extractNextSteps(lastMessageFromGraph.content);

            // Vérifier si l'agent a signalé une réponse finale
            if (
              typeof lastMessageFromGraph.content === 'string' &&
              lastMessageFromGraph.content
                .toUpperCase()
                .includes('FINAL ANSWER')
            ) {
              logger.info('Detected FINAL ANSWER. Ending autonomous session.');
              break;
            }
          } else {
            // Gérer d'autres types de messages inattendus
            logger.warn(
              `Graph ended with unexpected message type: ${lastMessageFromGraph.constructor.name}`
            );
            lastNextSteps = null;
            break;
          }
        } catch (loopError) {
          // Gérer les erreurs dans l'exécution autonome
          logger.error(
            `Error in autonomous iteration ${iterationCount}: ${loopError}`
          );

          consecutiveErrorCount++;
          if (this.isTokenRelatedError(loopError)) {
            tokensErrorCount += 2;
          }

          if (consecutiveErrorCount > 3) {
            logger.error(
              'Too many consecutive errors. Stopping autonomous execution.'
            );
            break;
          }

          // Attendre avant la prochaine tentative
          const waitTime = Math.min(2000 + consecutiveErrorCount * 1000, 10000);
          await new Promise((resolve) => setTimeout(resolve, waitTime));
        }
      }

      logger.info('Autonomous session finished.');
      return { status: 'success', iterations: iterationCount };
    } catch (error) {
      logger.error(`Fatal error in autonomous execution: ${error}`);
      return {
        status: 'failure',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Extrait la section "NEXT STEPS" du contenu
   * @param content Le contenu du message
   * @returns La section NEXT STEPS ou null
   */
  private extractNextSteps(content: string | any): string | null {
    if (typeof content !== 'string') {
      return null;
    }

    const nextStepsMatch = content.match(/NEXT STEPS:(.*?)($|(?=\n\n))/s);
    if (nextStepsMatch && nextStepsMatch[1]) {
      return nextStepsMatch[1].trim();
    }
    return null;
  }

  /**
   * Obtient la configuration de mémoire
   */
  public getMemoryConfig(): MemoryConfig {
    return this.memory;
  }

  /**
   * Définit la configuration de mémoire
   */
  public setMemoryConfig(config: MemoryConfig): void {
    this.memory = { ...this.memory, ...config };
  }

  /**
   * Validates the user request before execution
   * @param request The user's request string
   * @returns Promise<boolean> indicating if request is valid
   * @throws AgentValidationError if validation fails
   */
  public async validateRequest(request: string): Promise<boolean> {
    // TODO: Implement actual validation logic
    logger.debug(`Validating request (currently always true): ${request}`);
    return true;
  }
}
