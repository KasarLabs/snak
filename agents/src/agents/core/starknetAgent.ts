// agents/main/starknetAgent.ts
import { BaseAgent, AgentType, IModelAgent } from '../core/baseAgent.js';
import { RpcProvider } from 'starknet';
import { ModelSelectionAgent } from '../operators/modelSelectionAgent.js';
import { logger, metrics } from '@snakagent/core';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { BaseMessage, HumanMessage, AIMessage } from '@langchain/core/messages';
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
    this.currentMode = config.agentMode === 'auto' || config.agentconfig?.mode?.autonomous === true
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
        logger.warn('StarknetAgent: No ModelSelectionAgent provided, functionality will be limited');
      }
      
      // Créer l'exécuteur d'agent React
      await this.createAgentReactExecutor();
      
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
   */
  private async createAgentReactExecutor(): Promise<void> {
    try {
      // Importer les fonctions de création d'agents dynamiquement
      const { createAgent } = await import('../modes/interactive.js');
      const { createAutonomousAgent } = await import('../modes/autonomous.js');

      // Créer la configuration temporaire de l'IA pour la compatibilité
      const tempAiConfig = {
        langchainVerbose: this.loggingOptions.langchainVerbose,
        modelSelector: this.modelSelector,
      };

      if (this.currentMode === 'auto') {
        this.agentReactExecutor = await createAutonomousAgent(this, tempAiConfig);
      } else if (this.currentMode === 'agent') {
        this.agentReactExecutor = await createAgent(this, tempAiConfig);
      }

      this.applyLoggerVerbosityToExecutor();
    } catch (error) {
      logger.error(`Failed to create Agent React Executor: ${error}`);
      throw error;
    }
  }

  /**
   * Applique le paramètre de verbosité de la journalisation à l'exécuteur s'il existe
   */
  private applyLoggerVerbosityToExecutor(): void {
    if (!this.agentReactExecutor) return;

    // Mettre à jour le LLM principal s'il est disponible
    if (this.agentReactExecutor.agent?.llm) {
      this.agentReactExecutor.agent.llm.verbose = this.loggingOptions.langchainVerbose === true;
    }

    // Mettre à jour le modèle dans les nœuds de graphe s'il est disponible
    if (this.agentReactExecutor.graph?._nodes?.agent?.data?.model) {
      this.agentReactExecutor.graph._nodes.agent.data.model.verbose = this.loggingOptions.langchainVerbose === true;
    }
  }

  /**
   * Obtient le modèle approprié pour une tâche en fonction des messages
   */
  public async getModelForTask(messages: BaseMessage[], forceModelType?: string): Promise<BaseChatModel> {
    if (!this.modelSelector) {
      throw new Error('ModelSelectionAgent not available');
    }

    return this.modelSelector.getModelForTask(messages, forceModelType);
  }

  /**
   * Invoque un modèle avec la logique de sélection appropriée
   */
  public async invokeModel(messages: BaseMessage[], forceModelType?: string): Promise<any> {
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
   * Execute the agent with the given input
   */
  public async execute(input: string | BaseMessage, config?: Record<string, any>): Promise<unknown> {
    let responseContent: string | any;
    let iteration = 0;
    let errorCount = 0;
    const maxIterations = this.memory?.recursionLimit ?? 5;
    const maxErrors = 3;

    try {
      logger.debug(`StarknetAgent executing with mode: ${this.currentMode}`);
      
      // Ensure the executor is created for the current mode
      if (!this.agentReactExecutor) {
        await this.createAgentReactExecutor();
        if (!this.agentReactExecutor) {
            throw new Error("Failed to initialize Agent React Executor for the current mode.");
        }
      }

      const initialInput = typeof input === 'string' ? input : input.content;

      // Determine the model type to use
      const forceModelType = config?.forceModelType;
      let model;
      if (forceModelType) {
          model = await this.getModelForTask([typeof input === 'string' ? new HumanMessage(input) : input], forceModelType);
          logger.debug(`Forcing model type: ${forceModelType}`);
      }

      // Start the execution loop
      while (iteration < maxIterations && errorCount < maxErrors) {
        iteration++;
        logger.debug(`StarknetAgent iteration ${iteration}/${maxIterations}`);
        
        try {
          const result = await this.agentReactExecutor.invoke(
            { input: initialInput },
            { 
              ...config,
              recursionLimit: maxIterations,
              // Pass the pre-selected model if available
              ...(model && { model: model }) 
            }
          );
          
          responseContent = result.output || result.response;
          logger.debug(`StarknetAgent execution successful. Output: ${JSON.stringify(responseContent)}`);
          break; // Exit loop on success

        } catch (error: any) {
          errorCount++;
          logger.error(`StarknetAgent execution error (Attempt ${errorCount}/${maxErrors}): ${error.message}`);
          responseContent = `Error during execution: ${error.message}`;

          if (this.isTokenRelatedError(error)) {
            logger.error('Token related error detected, stopping execution.');
            responseContent = `Error: Token validation failed. Please check your credentials.`;
            break;
          }
          
          if (errorCount >= maxErrors) {
            logger.error('Maximum error retries reached.');
            responseContent = `Error: Maximum error retries reached. Last error: ${error.message}`;
            break;
          }
          
          // Optionally add delay or modify input for retry
          await new Promise(resolve => setTimeout(resolve, 1000 * errorCount)); // Exponential backoff
        }
      }

      if (iteration >= maxIterations) {
        logger.warn(`Maximum iterations (${maxIterations}) reached. Returning current response.`);
        responseContent = responseContent || `Error: Maximum iterations reached.`;
      }

    } catch (error: any) {
      logger.error(`StarknetAgent main execution failed: ${error}`);
      responseContent = `Error: ${error.message}`;
    } finally {
      // Ensure logging is re-enabled if it was temporarily disabled for verbosity
      if (this.loggingOptions.disabled) {
        // This assumes enableLogging handles the state correctly
        // this.enableLogging(); 
      }
    }

    // Format response if needed (e.g., removing backticks)
    const finalResponse = this.formatResponseForDisplay(responseContent);
    logger.debug(`StarknetAgent final response: ${JSON.stringify(finalResponse)}`);

    // Return structured AIMessage
    return new AIMessage({
      content: finalResponse,
      additional_kwargs: {
        from: 'starknet',
        final: false // Let the supervisor decide if it's final
      }
    });
  }

  /**
   * Formate la réponse de l'agent pour l'affichage
   */
  private formatResponseForDisplay(response: string | any): string | any {
    if (typeof response !== 'string') {
      return response;
    }

    // Formater uniquement les points à puces, supprimer le formatage spécifique NEXT STEPS car il est géré par la division
    const lines = response.split('\n');
    const formattedLines = lines.map((line: string) => {
      // Formater les points à puces
      if (line.includes('•')) {
        return `  ${line.trim()}`;
      }
      return line;
    });

    // Joindre les lignes, en assurant des sauts de ligne cohérents
    return formattedLines.join('\n');
  }

  /**
   * Exécute une demande de données d'appel (mode signature) en mode agent
   */
  public async execute_call_data(input: string): Promise<unknown> {
    try {
      if (this.currentMode !== 'agent') {
        throw new Error(`Need to be in agent mode to execute_call_data (current mode: ${this.currentMode})`);
      }

      if (!this.agentReactExecutor) {
        throw new Error('Agent executor is not initialized');
      }

      // Préparer les options d'invocation avec élagage des messages
      const invokeOptions: any = {};

      // Ajouter l'élagage des messages si la mémoire est activée
      if (this.memory.enabled !== false) {
        // Utiliser mode.recursionLimit si disponible, sinon revenir à la configuration de la mémoire
        const recursionLimit = this.agentconfig?.mode?.recursionLimit !== undefined
          ? this.agentconfig.mode.recursionLimit
          : this.memory.recursionLimit !== undefined
            ? this.memory.recursionLimit
            : this.memory.shortTermMemorySize || 15;

        // N'appliquer la limite de récursion que si elle n'est pas nulle (0 signifie pas de limite)
        if (recursionLimit !== 0) {
          invokeOptions.recursionLimit = recursionLimit;
          invokeOptions.messageHandler = (messages: any[]) => {
            if (messages.length > recursionLimit) {
              logger.debug(`Call data - message pruning: ${messages.length} messages exceeds limit ${recursionLimit}`);
              const prunedMessages = [
                messages[0],
                ...messages.slice(-(recursionLimit - 1)),
              ];
              logger.debug(`Call data - pruned from ${messages.length} to ${prunedMessages.length} messages`);
              return prunedMessages;
            }
            return messages;
          };
          logger.debug(`Execute call data: configured with recursionLimit=${recursionLimit}`);
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
          throw new Error('Insufficient messages returned from call data execution');
        }

        const messageContent = aiMessage.messages[aiMessage.messages.length - 2].content;
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
   */
  public async execute_autonomous(): Promise<unknown> {
    // Rediriger vers la fonction appropriée dans starknetAgent.ts
    try {
      // Valider que nous sommes en mode autonome
      if (this.currentMode !== 'auto') {
        if (this.agentconfig?.mode?.autonomous) {
          logger.info(`Overriding mode to 'auto' based on config settings (autonomous=${this.agentconfig?.mode?.autonomous})`);
          this.currentMode = 'auto';
        } else {
          throw new Error(`Need to be in autonomous mode to execute_autonomous (current mode: ${this.currentMode})`);
        }
      }

      if (!this.agentReactExecutor) {
        throw new Error('Agent executor is not initialized for autonomous execution');
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
   */
  private async _executeAutonomous(): Promise<any> {
    // Implémentation simplifiée - la vraie implémentation serait plus complexe
    try {
      let iterationCount = 0;
      let consecutiveErrorCount = 0;
      let tokensErrorCount = 0;
      let lastNextSteps: string | null = null;
      const MAX_ITERATIONS = 50;

      // Conserver un historique de conversation complet pour invoquer le graphe
      let conversationHistory: BaseMessage[] = [];

      // Ajouter le prompt système initial si disponible dans la configuration
      const systemPrompt = this.agentconfig?.prompt;
      if (systemPrompt) {
        conversationHistory.push(systemPrompt);
      }

      // Boucle principale autonome
      while (iterationCount < MAX_ITERATIONS) {
        iterationCount++;
        
        try {
          // Déterminer le message d'entrée pour CETTE itération
          let currentTurnInput: BaseMessage;
          
          if (lastNextSteps) {
            logger.debug(`Using previous NEXT STEPS as prompt: "${lastNextSteps}"`);
            // Utiliser les NEXT STEPS comme entrée utilisateur pour ce tour
            currentTurnInput = new HumanMessage({
              content: `Execute the following planned action based on the previous turn: "${lastNextSteps}". Ensure it's a single, simple action.`,
              name: 'Planner',
            });
          } else {
            logger.debug('No previous NEXT STEPS found, generating adaptive prompt.');
            // Repli sur le prompt adaptatif général
            const promptMessage = 'Based on your objectives and the recent conversation history, determine the next best action to take.';
            currentTurnInput = new HumanMessage(promptMessage);
          }

          // Ajouter l'entrée pour ce tour à l'historique
          conversationHistory.push(currentTurnInput);

          // Préparer les options d'invocation
          const agentConfig = { ...this.agentReactExecutor.agentConfig };

          logger.debug(
            `Autonomous iteration ${iterationCount}: invoking graph with ${conversationHistory.length} messages`
          );
          
          // Invoquer le graphe avec l'historique actuel complet
          const result = await this.agentReactExecutor.agent.invoke(
            { messages: conversationHistory },
            agentConfig
          );
          
          logger.debug(`Autonomous iteration ${iterationCount}: graph invocation complete`);

          // Traiter le résultat du graphe
          if (!result || !result.messages || result.messages.length === 0) {
            logger.warn('Graph returned empty or invalid state, stopping loop.');
            break;
          }

          // Le result.messages contient l'état *après* que le graphe ait terminé.
          // Le(s) dernier(s) message(s) devrai(en)t être la réponse de l'agent ou les résultats de l'outil.
          conversationHistory = result.messages;

          // Trouver le tout dernier message ajouté par l'exécution du graphe (devrait être AIMessage ou ToolMessage)
          const lastMessageFromGraph = conversationHistory[conversationHistory.length - 1];

          if (lastMessageFromGraph instanceof AIMessage) {
            // Traiter et afficher la réponse de l'IA
            lastNextSteps = this.extractNextSteps(lastMessageFromGraph.content);

            // Vérifier si l'agent a signalé une réponse finale
            if (
              typeof lastMessageFromGraph.content === 'string' &&
              lastMessageFromGraph.content.toUpperCase().includes('FINAL ANSWER')
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
          logger.error(`Error in autonomous iteration ${iterationCount}: ${loopError}`);
          
          consecutiveErrorCount++;
          if (this.isTokenRelatedError(loopError)) {
            tokensErrorCount += 2;
          }

          if (consecutiveErrorCount > 3) {
            logger.error('Too many consecutive errors. Stopping autonomous execution.');
            break;
          }

          // Attendre avant la prochaine tentative
          const waitTime = Math.min(2000 + consecutiveErrorCount * 1000, 10000);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }

      logger.info('Autonomous session finished.');
      return { status: 'success', iterations: iterationCount };
    } catch (error) {
      logger.error(`Fatal error in autonomous execution: ${error}`);
      return { status: 'failure', error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Extrait la section "NEXT STEPS" du contenu
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