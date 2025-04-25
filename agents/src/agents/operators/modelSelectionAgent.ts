// agents/operators/modelSelectionAgent.ts
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { BaseMessage, HumanMessage, AIMessage } from '@langchain/core/messages';
import { logger } from '@snakagent/core';
import { BaseAgent, AgentType, IModelAgent } from '../core/baseAgent.js';
import { loadModelsConfig, ModelsConfig, ApiKeys } from '@snakagent/core';
import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';

/**
 * Critères pour la sélection du modèle
 */
export interface ModelSelectionCriteria {
  complexity: 'high' | 'medium' | 'low';
  urgency: 'high' | 'medium' | 'low';
  creativeRequirement: 'high' | 'medium' | 'low';
  taskType: 'reasoning' | 'generation' | 'classification' | 'general';
}

/**
 * Options pour l'agent de sélection de modèle
 */
export interface ModelSelectionOptions {
  debugMode?: boolean;
  useMetaSelection?: boolean;
  modelsConfigPath: string;
}

/**
 * Représente un agent opérateur responsable de la sélection du modèle approprié pour différentes tâches
 */
export class ModelSelectionAgent extends BaseAgent implements IModelAgent {
  private models: Record<string, BaseChatModel> = {};
  private debugMode: boolean;
  private useMetaSelection: boolean;
  private modelsConfig: ModelsConfig | null = null;
  private apiKeys: ApiKeys = {};
  private modelsConfigPath: string;

  /**
   * Crée un nouvel agent de sélection de modèle
   * @param options Options de configuration
   */
  constructor(options: ModelSelectionOptions) {
    super('model-selector', AgentType.OPERATOR);
    this.debugMode = options.debugMode || false;
    this.useMetaSelection = options.useMetaSelection || false;
    this.modelsConfigPath = options.modelsConfigPath;

    // Logging pour le débogage
    if (this.debugMode) {
      logger.debug(
        `ModelSelectionAgent constructor called with options: ${JSON.stringify({
          debugMode: options.debugMode,
          useMetaSelection: options.useMetaSelection,
        })}`
      );
    }
  }

  /**
   * Initialise l'agent de sélection de modèle
   */
  public async init(): Promise<void> {
    try {
      // Charger la configuration des modèles
      this.modelsConfig = await loadModelsConfig(this.modelsConfigPath);

      // Charger les clés API depuis les variables d'environnement
      this.loadApiKeys();

      // Initialiser les modèles
      await this.initializeModels();

      // Vérifier que les modèles nécessaires sont disponibles
      this.validateModels();

      logger.debug('ModelSelectionAgent initialized successfully');
    } catch (error) {
      logger.error(`ModelSelectionAgent initialization failed: ${error}`);
      throw new Error(`ModelSelectionAgent initialization failed: ${error}`);
    }
  }

  /**
   * Charge les clés API depuis les variables d'environnement
   */
  private loadApiKeys(): void {
    logger.debug('Loading API keys from environment variables...');
    const PROVIDER_ENV_VAR_MAP: Record<string, string> = {
      openai: 'OPENAI_API_KEY',
      anthropic: 'ANTHROPIC_API_KEY',
      gemini: 'GEMINI_API_KEY',
      deepseek: 'DEEPSEEK_API_KEY',
    };

    this.apiKeys = {};
    for (const [provider, envVar] of Object.entries(PROVIDER_ENV_VAR_MAP)) {
      const apiKey = process.env[envVar];
      if (apiKey) {
        this.apiKeys[provider] = apiKey;
        logger.debug(`Loaded API key for provider: ${provider}`);
      } else {
        logger.warn(
          `API key environment variable not found for provider: ${provider} (expected: ${envVar})`
        );
      }
    }
    logger.debug('Finished loading API keys.');
  }

  /**
   * Initialise les instances de modèles basées sur la configuration chargée
   */
  private async initializeModels(): Promise<void> {
    logger.debug('Initializing AI models...');
    if (!this.modelsConfig) {
      logger.error(
        'Models configuration is not loaded. Cannot initialize models.'
      );
      throw new Error('Models configuration is not loaded.');
    }

    this.models = {};
    for (const [levelName, levelConfig] of Object.entries(this.modelsConfig)) {
      const { provider, model_name } = levelConfig as any;
      const apiKey = this.apiKeys[provider];

      if (!apiKey) {
        logger.warn(
          `API key for provider '${provider}' not found. Skipping initialization for model level '${levelName}'.`
        );
        continue;
      }

      try {
        let modelInstance: BaseChatModel | null = null;
        const commonConfig = {
          modelName: model_name,
          apiKey: apiKey,
          verbose: this.debugMode,
        };

        switch (provider.toLowerCase()) {
          case 'openai':
            modelInstance = new ChatOpenAI({
              ...commonConfig,
              openAIApiKey: apiKey,
            });
            break;
          case 'anthropic':
            modelInstance = new ChatAnthropic({
              ...commonConfig,
              anthropicApiKey: apiKey,
            });
            break;
          case 'gemini':
            modelInstance = new ChatGoogleGenerativeAI({
              ...commonConfig,
              apiKey: apiKey,
            });
            break;
          default:
            logger.warn(
              `Unsupported AI provider '${provider}' for model level '${levelName}'. Skipping.`
            );
            continue;
        }

        if (modelInstance) {
          this.models[levelName] = modelInstance;
          logger.debug(
            `Initialized model for level '${levelName}': ${provider} - ${model_name}`
          );
        }
      } catch (error) {
        logger.error(
          `Failed to initialize model for level '${levelName}' (${provider} - ${model_name}): ${error}`
        );
      }
    }
    logger.debug('Finished initializing AI models.');
  }

  /**
   * Vérifie que les modèles requis existent
   */
  private validateModels(): void {
    const requiredModels = ['fast', 'smart', 'cheap'];
    const missingModels = requiredModels.filter((model) => !this.models[model]);

    if (missingModels.length > 0) {
      logger.warn(
        `ModelSelectionAgent initialized with missing models: ${missingModels.join(', ')}`
      );
    }

    if (this.debugMode) {
      logger.debug(
        `ModelSelectionAgent initialized with models: ${Object.keys(this.models).join(', ')} (Meta selection: ${this.useMetaSelection ? 'enabled' : 'disabled'})`
      );
    }
  }

  /**
   * Analyse les messages fournis et détermine quel modèle utiliser
   * @param messages Les messages à analyser
   * @returns Le type de modèle sélectionné
   */
  public async selectModelForMessages(
    messages: BaseMessage[]
  ): Promise<string> {
    // Si la méta-sélection est désactivée, toujours utiliser le modèle intelligent
    if (!this.useMetaSelection) {
      if (this.debugMode) {
        logger.debug('Meta-selection disabled, using smart model');
      }
      return 'smart';
    }

    if (!messages || messages.length === 0) {
      if (this.debugMode) {
        logger.debug(
          'No messages provided for model selection, defaulting to "smart"'
        );
      }
      return 'smart';
    }

    // Utiliser le modèle rapide pour déterminer quel modèle utiliser pour la tâche
    try {
      if (this.debugMode) {
        logger.debug(
          'Meta-selection enabled, analyzing message with fast model'
        );
      }

      // Vérification CRITIQUE : S'assurer que le modèle rapide existe
      if (!this.models.fast) {
        logger.error(
          'Meta-selection is enabled but fast model is not available'
        );
        return 'smart'; // Repli sur "smart" si le modèle rapide n'est pas disponible
      }

      const lastMessage = messages[messages.length - 1];
      if (!lastMessage) {
        logger.warn(
          'ModelSelectionAgent: Could not get last message, defaulting to smart.'
        );
        return 'smart';
      }

      const content =
        lastMessage.content != null
          ? typeof lastMessage.content === 'string'
            ? lastMessage.content
            : JSON.stringify(lastMessage.content)
          : '';

      // Vérifier si la section NEXT STEPS est présente dans le contenu du message
      let analysisContent = content;
      let nextStepsSection = '';

      // Pour les réponses d'agent autonome, extraire la section NEXT STEPS
      const nextStepsMatch = content.match(/NEXT STEPS:(.*?)($|(?=\n\n))/s);
      if (nextStepsMatch && nextStepsMatch[1]) {
        nextStepsSection = nextStepsMatch[1].trim();
        if (this.debugMode) {
          logger.debug(`Found NEXT STEPS section: "${nextStepsSection}"`);
        }

        // Si nous avons NEXT STEPS, l'utiliser comme contenu principal pour l'analyse
        // mais aussi garder une version raccourcie du contenu d'origine pour le contexte
        const truncatedContent = content.substring(0, 300) + '...';
        analysisContent = `Next planned actions: ${nextStepsSection}\n\nContext: ${truncatedContent}`;
      }

      // Utiliser le modèle rapide pour analyser quel modèle devrait gérer cette demande
      const prompt = new HumanMessage(
        `Analyze this content and determine which AI model should handle it.
${nextStepsSection ? "Focus primarily on the 'Next planned actions' which represents upcoming tasks." : ''}
Select 'fast' for simple, focused tasks that involve a single action or basic operations.
Select 'smart' for complex reasoning, creativity, or tasks that might take multiple steps to complete.
Select 'cheap' for non-urgent, simple tasks that don't require sophisticated reasoning.

Priority is on simplicity - if the task appears to be trying to do too much at once, select 'smart'.
If the task is properly broken down into one simple step, prefer 'fast' or 'cheap'.

Respond with only one word: 'fast', 'smart', or 'cheap'.

${analysisContent}`
      );

      if (this.debugMode) {
        logger.debug(`Invoking fast model for meta-selection analysis`);
        logger.debug(
          `Using ${nextStepsSection ? 'NEXT STEPS-focused' : 'regular'} analysis`
        );
      }

      const response = await this.models.fast.invoke([prompt]);
      const modelChoice = response.content.toString().toLowerCase().trim();

      // Valider la réponse
      if (['fast', 'smart', 'cheap'].includes(modelChoice)) {
        if (this.debugMode) {
          logger.debug(`Meta-selection chose model: ${modelChoice}`);
        }
        return modelChoice;
      } else {
        // Repli si la réponse est invalide
        logger.warn(
          `Invalid model selection response: ${modelChoice}, defaulting to smart`
        );
        return 'smart';
      }
    } catch (error) {
      logger.warn(
        `Error in meta-selection: ${error}, falling back to heuristics`
      );
      // Repli sur la sélection heuristique
      return this.selectModelUsingHeuristics(messages);
    }
  }

  /**
   * Sélectionne le modèle en utilisant des heuristiques simples comme mécanisme de secours
   * @param messages Les messages à analyser
   * @returns Le type de modèle sélectionné
   */
  private selectModelUsingHeuristics(messages: BaseMessage[]): string {
    if (!messages || messages.length === 0) {
      logger.warn(
        'Heuristic selection called with no messages, defaulting to smart.'
      );
      return 'smart';
    }

    const lastMessage = messages[messages.length - 1];
    if (!lastMessage) {
      logger.warn(
        'Heuristic selection: Could not get last message, defaulting to smart.'
      );
      return 'smart';
    }

    const content =
      lastMessage.content != null
        ? typeof lastMessage.content === 'string'
          ? lastMessage.content
          : JSON.stringify(lastMessage.content)
        : '';

    // Extraire la section NEXT STEPS si présente
    let analysisContent = content;
    let nextStepsContent = '';

    const nextStepsMatch = content.match(/NEXT STEPS:(.*?)($|(?=\n\n))/s);
    if (nextStepsMatch && nextStepsMatch[1]) {
      nextStepsContent = nextStepsMatch[1].trim();
      if (this.debugMode) {
        logger.debug(
          `Heuristic analysis found NEXT STEPS: "${nextStepsContent}"`
        );
      }
      // Si nous avons next steps, prioriser leur analyse
      analysisContent = nextStepsContent;
    }

    // Heuristiques rapides basées sur le contenu du message
    const criteria = this.analyzeMessageContent(analysisContent);
    const modelType = this.selectModelBasedOnCriteria(criteria);

    if (this.debugMode) {
      logger.debug(
        `Heuristic model selection for task: ${modelType} (complexity: ${criteria.complexity}, urgency: ${criteria.urgency}, creativity: ${criteria.creativeRequirement}, type: ${criteria.taskType})`
      );
      if (nextStepsContent) {
        logger.debug(`Selection was based on NEXT STEPS content`);
      }
    }

    return modelType;
  }

  /**
   * Analyse le contenu du message pour déterminer les caractéristiques de la tâche
   * @param content Le contenu du message à analyser
   * @returns Les critères d'analyse
   */
  private analyzeMessageContent(content: string): ModelSelectionCriteria {
    if (content == null) {
      logger.warn(
        'analyzeMessageContent received null/undefined content, returning default criteria.'
      );
      content = '';
    }

    // Critères par défaut
    const criteria: ModelSelectionCriteria = {
      complexity: 'medium',
      urgency: 'medium',
      creativeRequirement: 'medium',
      taskType: 'general',
    };

    // Vérifier la longueur du contenu comme indicateur de complexité de base
    if (content.length > 1500) {
      criteria.complexity = 'high';
    } else if (content.length < 300) {
      criteria.complexity = 'low';
    }

    // Rechercher des mots-clés indiquant des tâches de raisonnement
    if (
      content.match(
        /reason|analyze|explain why|consider|determine|evaluate|assess/i
      )
    ) {
      criteria.taskType = 'reasoning';
      criteria.complexity = 'high';
    }

    // Rechercher des mots-clés indiquant des tâches de génération
    if (
      content.match(/generate|create|write|draft|compose|design|develop|build/i)
    ) {
      criteria.taskType = 'generation';
      criteria.creativeRequirement = 'high';
    }

    // Rechercher des mots-clés indiquant des tâches de classification
    if (
      content.match(
        /categorize|classify|identify|determine if|is this|should I|yes or no/i
      )
    ) {
      criteria.taskType = 'classification';
      criteria.complexity = 'low';
    }

    // Rechercher des indicateurs d'urgence
    if (content.match(/urgent|quickly|immediate|asap|now|fast/i)) {
      criteria.urgency = 'high';
    }

    // Mots-clés spéciaux pour la complexité de la prochaine étape
    if (
      content.match(
        /complicated|complex|difficult|challenging|advanced|multiple steps|in-depth/i
      )
    ) {
      criteria.complexity = 'high';
    }

    // Vérifier les actions multiples dans une seule étape (indique trop de complexité)
    if (
      content.match(
        /and then|after that|followed by|next,|subsequently|finally,/i
      ) ||
      content.match(/\d+\.\s.*\d+\.\s/s) // Recherche des listes numérotées avec plusieurs éléments
    ) {
      if (this.debugMode) {
        logger.debug(
          'Detected multiple actions in a single step - marking as high complexity'
        );
      }
      criteria.complexity = 'high';
    }

    // Vérifier les indicateurs de tâches plus simples et plus ciblées
    if (
      content.match(
        /simple|straightforward|basic|single|focused|one step|easy/i
      )
    ) {
      // Ne pas dégrader les tâches de haute complexité, mais marquer les moyennes comme faibles
      if (criteria.complexity !== 'high') {
        criteria.complexity = 'low';
      }
    }

    return criteria;
  }

  /**
   * Sélectionne le modèle approprié en fonction des critères de tâche
   * @param criteria Les critères de tâche
   * @returns Le type de modèle sélectionné
   */
  private selectModelBasedOnCriteria(criteria: ModelSelectionCriteria): string {
    // Tâches de raisonnement de haute complexité vers le modèle intelligent
    if (criteria.complexity === 'high' && criteria.taskType === 'reasoning') {
      return 'smart';
    }

    // Tâches de génération à haute créativité vers le modèle intelligent
    if (
      criteria.creativeRequirement === 'high' &&
      criteria.taskType === 'generation'
    ) {
      return 'smart';
    }

    // Tâches de faible complexité, haute urgence vers le modèle rapide
    if (criteria.complexity === 'low' && criteria.urgency === 'high') {
      return 'fast';
    }

    // Tâches de classification typiquement vers le modèle rapide
    if (criteria.taskType === 'classification') {
      return 'fast';
    }

    // Si le budget est une préoccupation et la tâche n'est pas complexe, utiliser le modèle économique
    if (criteria.complexity === 'low') {
      return 'cheap';
    }

    // Par défaut vers le modèle intelligent pour les tâches de complexité moyenne
    if (criteria.complexity === 'medium') {
      return 'smart';
    }

    // Repli par défaut
    return 'smart';
  }

  /**
   * Obtient le modèle approprié pour une tâche donnée en fonction des messages
   * @param messages Les messages à analyser
   * @returns L'instance du modèle sélectionné
   */
  public async getModelForTask(
    messages: BaseMessage[],
    forceModelType?: string
  ): Promise<BaseChatModel> {
    const modelType =
      forceModelType || (await this.selectModelForMessages(messages));

    // S'assurer que le modèle sélectionné existe
    if (!this.models[modelType]) {
      logger.warn(
        `Selected model "${modelType}" not available, falling back to "smart"`
      );
      return this.models['smart'] || Object.values(this.models)[0];
    }

    return this.models[modelType];
  }

  /**
   * Invoque directement un modèle avec la logique de sélection
   * @param messages Les messages à traiter
   * @param forceModelType Paramètre optionnel pour forcer l'utilisation d'un type de modèle spécifique
   * @returns La réponse du modèle
   */
  public async invokeModel(
    messages: BaseMessage[],
    forceModelType?: string
  ): Promise<any> {
    // Utiliser le type forcé si fourni, sinon sélectionner le modèle
    const modelType =
      forceModelType || (await this.selectModelForMessages(messages));

    if (!this.models[modelType]) {
      logger.warn(
        `Selected model "${modelType}" not available, falling back to "smart"`
      );
      return this.models['smart'].invoke(messages);
    }

    if (this.debugMode) {
      logger.debug(`Invoking model: ${modelType}`);
    }

    return this.models[modelType].invoke(messages);
  }

  /**
   * Point d'entrée principal pour l'exécution de l'agent
   */
  public async execute(input: any): Promise<AIMessage> {
    // Convert input to messages if not already
    const messages: BaseMessage[] = Array.isArray(input)
      ? input
      : [typeof input === 'string' ? new HumanMessage(input) : input];

    // Check if there are messages
    if (messages.length === 0) {
      logger.warn(
        'ModelSelectionAgent received empty message array. Returning default model.'
      );
      return new AIMessage({
        content: 'Selected model type: smart (default due to empty input)',
        additional_kwargs: {
          modelType: 'smart',
          nextAgent: 'starknet', // Always route to starknet
          from: 'model-selector',
          final: false,
        },
      });
    }

    // Select model
    const modelType = await this.selectModelForMessages(messages);

    // CRITICAL FIX: Always set nextAgent to starknet to avoid loops
    const nextAgent = 'starknet';

    // Log decision
    if (this.debugMode) {
      logger.debug(
        `ModelSelectionAgent selected model: ${modelType}, routing to: ${nextAgent}`
      );
    }

    // Return formatted AIMessage with necessary metadata
    return new AIMessage({
      content: `Selected model type: ${modelType}`,
      additional_kwargs: {
        modelType,
        nextAgent, // Use value defined above
        from: 'model-selector',
        final: false, // Model selection itself is not final
      },
    });
  }

  /**
   * Obtient les modèles disponibles
   */
  public getModels(): Record<string, BaseChatModel> {
    return this.models;
  }
}
