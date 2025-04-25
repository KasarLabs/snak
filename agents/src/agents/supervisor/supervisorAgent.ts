// agents/supervisor/supervisorAgent.ts
import {
  BaseAgent,
  AgentType,
  AgentMessage,
  IAgent,
} from '../core/baseAgent.js';
import { ModelSelectionAgent } from '../operators/modelSelectionAgent.js';
import { StarknetAgent } from '../core/starknetAgent.js';
import { ToolsOrchestrator } from '../operators/toolOrchestratorAgent.js';
import { MemoryAgent } from '../operators/memoryAgent.js';
import { WorkflowController } from './worflowController.js';
import { logger, metrics } from '@snakagent/core';
import { StateGraph, MemorySaver, END } from '@langchain/langgraph';
import {
  HumanMessage,
  AIMessage,
  SystemMessage,
  ToolMessage,
  BaseMessage,
} from '@langchain/core/messages';
import { createBox } from '../../prompt/formatting.js';
import { addTokenInfoToBox } from '../../token/tokenTracking.js';
import { Tool } from '@langchain/core/tools';
import { DatabaseCredentials } from '../../tools/types/database.js';

/**
 * Configuration pour l'agent superviseur
 */
export interface SupervisorAgentConfig {
  modelsConfigPath: string;
  starknetConfig: any; // Configuration pour l'agent Starknet
  agentMode: 'interactive' | 'autonomous';
  agentConfig?: any; // Configuration additionnelle
  debug?: boolean;
}

/**
 * Agent superviseur qui gère l'orchestration de tous les agents du système
 */
export class SupervisorAgent extends BaseAgent {
  private modelSelectionAgent: ModelSelectionAgent | null = null;
  private starknetAgent: StarknetAgent | null = null;
  private toolsOrchestrator: ToolsOrchestrator | null = null;
  private memoryAgent: MemoryAgent | null = null;
  private workflowController: WorkflowController | null = null;
  private config: SupervisorAgentConfig;
  private operators: Map<string, IAgent> = new Map();
  private debug: boolean;
  private executionDepth: number = 0; // Track execution depth
  private checkpointEnabled: boolean;

  constructor(config: SupervisorAgentConfig) {
    super('supervisor', AgentType.SUPERVISOR);
    this.config = config;
    this.debug = config.debug || false;
    logger.debug('SupervisorAgent: Initializing');
  }

  /**
   * Initialise le superviseur et tous les agents sous son contrôle
   */
  public async init(): Promise<void> {
    logger.debug('SupervisorAgent: Starting initialization');

    try {
      // 1. Initialiser l'agent de sélection de modèle
      logger.debug('SupervisorAgent: Initializing ModelSelectionAgent...');
      this.modelSelectionAgent = new ModelSelectionAgent({
        debugMode: this.debug,
        useMetaSelection: true,
        modelsConfigPath: this.config.modelsConfigPath,
      });
      await this.modelSelectionAgent.init();
      this.operators.set(this.modelSelectionAgent.id, this.modelSelectionAgent);
      logger.debug('SupervisorAgent: ModelSelectionAgent initialized');

      // 2. Initialiser l'agent mémoire si nécessaire
      if (this.config.agentConfig?.memory?.enabled !== false) {
        logger.debug('SupervisorAgent: Initializing MemoryAgent...');
        this.memoryAgent = new MemoryAgent({
          shortTermMemorySize:
            this.config.agentConfig?.memory?.shortTermMemorySize || 15,
          recursionLimit: this.config.agentConfig?.memory?.recursionLimit,
          embeddingModel: this.config.agentConfig?.memory?.embeddingModel,
        });
        await this.memoryAgent.init();
        this.operators.set(this.memoryAgent.id, this.memoryAgent);
        logger.debug('SupervisorAgent: MemoryAgent initialized');
      } else {
        logger.debug(
          'SupervisorAgent: MemoryAgent initialization skipped (disabled in config)'
        );
      }

      // 3. Initialiser l'agent principal (Starknet)
      logger.debug('SupervisorAgent: Initializing StarknetAgent...');
      this.starknetAgent = new StarknetAgent({
        ...this.config.starknetConfig,
        modelSelector: this.modelSelectionAgent,
        memory: this.config.agentConfig?.memory,
      });
      await this.starknetAgent.init();
      logger.debug('SupervisorAgent: StarknetAgent initialized');

      // 4. Initialiser l'orchestrateur d'outils
      logger.debug('SupervisorAgent: Initializing ToolsOrchestrator...');
      this.toolsOrchestrator = new ToolsOrchestrator({
        starknetAgent: this.starknetAgent,
        agentConfig: this.config.agentConfig,
      });
      await this.toolsOrchestrator.init();
      this.operators.set(this.toolsOrchestrator.id, this.toolsOrchestrator);
      logger.debug('SupervisorAgent: ToolsOrchestrator initialized');

      // 5. Initialiser le contrôleur de workflow
      logger.debug('SupervisorAgent: Initializing WorkflowController...');
      await this.initializeWorkflowController();
      logger.debug('SupervisorAgent: WorkflowController initialized');

      // 6. Activer les métriques
      this.initializeMetrics();

      logger.info('SupervisorAgent: All agents initialized successfully');
    } catch (error) {
      logger.error(`SupervisorAgent: Initialization failed: ${error}`);
      throw new Error(`SupervisorAgent initialization failed: ${error}`);
    }
  }

  /**
   * Initialise le contrôleur de workflow
   */
  private async initializeWorkflowController(): Promise<void> {
    logger.debug('SupervisorAgent: Entering initializeWorkflowController');
    try {
      // Rassembler tous les agents disponibles
      const allAgents: Record<string, IAgent> = {
        supervisor: this,
      };

      // Ajouter tous les agents avec vérification
      if (this.starknetAgent) {
        allAgents['starknet'] = this.starknetAgent;
        logger.debug(
          `SupervisorAgent: Added starknet agent: ${!!this.starknetAgent}`
        );
      } else {
        logger.warn('SupervisorAgent: starknetAgent is not initialized');
      }

      if (this.modelSelectionAgent) {
        allAgents['model-selector'] = this.modelSelectionAgent;
        logger.debug(
          `SupervisorAgent: Added model-selector agent: ${!!this.modelSelectionAgent}`
        );
      } else {
        logger.warn('SupervisorAgent: modelSelectionAgent is not initialized');
      }

      if (this.memoryAgent) {
        allAgents['memory'] = this.memoryAgent;
        logger.debug('SupervisorAgent: Added memory agent');
      }

      if (this.toolsOrchestrator) {
        allAgents['tools'] = this.toolsOrchestrator;
        logger.debug('SupervisorAgent: Added tools orchestrator');
      }

      // Vérifier que nous avons au moins les agents requis
      if (Object.keys(allAgents).length < 2 || !allAgents['starknet']) {
        throw new Error(
          'Workflow requires at least supervisor and starknet execution agent'
        );
      }

      // Configuration améliorée
      const maxIterations = this.config.agentConfig?.maxIterations || 8;
      const workflowTimeout = this.config.agentConfig?.workflowTimeout || 45000;

      logger.debug(
        `SupervisorAgent: WorkflowController will be configured with maxIterations=${maxIterations}, timeout=${workflowTimeout}ms`
      );

      // Déterminer le point d'entrée idéal en fonction de la configuration
      const entryPoint =
        'model-selector' in allAgents ? 'model-selector' : 'starknet';
      logger.debug(`SupervisorAgent: Using '${entryPoint}' as entry point`);

      // Créer et initialiser le contrôleur
      this.workflowController = new WorkflowController({
        agents: allAgents,
        entryPoint, // Use determined entry point
        useConditionalEntryPoint: true,
        checkpointEnabled: this.checkpointEnabled,
        debug: this.debug,
        maxIterations, // Use configured value
        workflowTimeout, // Use configured value
      });

      await this.workflowController.init();
      logger.debug(
        'WorkflowController initialized with agents: ' +
          Object.keys(allAgents).join(', ')
      );
      logger.debug('SupervisorAgent: Leaving initializeWorkflowController');
    } catch (error: any) {
      logger.error(
        `Failed to initialize workflow controller: ${error.message || error}`
      );
      logger.debug(
        'SupervisorAgent: Leaving initializeWorkflowController with error'
      );
      throw error;
    }
  }

  /**
   * Initialise les métriques
   */
  private initializeMetrics(): void {
    logger.debug('SupervisorAgent: Initializing metrics');
    if (!this.starknetAgent) return;

    const agentName = this.config.agentConfig?.name || 'agent';
    metrics.metricsAgentConnect(agentName, this.config.agentMode);
  }

  /**
   * Exécute la tâche demandée par l'utilisateur
   * @param input L'entrée de l'utilisateur
   * @param config Configuration d'exécution
   * @returns La réponse finale de l'agent
   */
  public async execute(
    input: string | AgentMessage | BaseMessage,
    config?: Record<string, any>
  ): Promise<any> {
    this.executionDepth++;
    const depthIndent = '  '.repeat(this.executionDepth);
    logger.debug(
      `${depthIndent}SupervisorAgent[Depth:${this.executionDepth}]: Entering execute`
    );

    // CORRECTION: Limiter la profondeur d'exécution pour éviter les boucles infinies
    if (this.executionDepth > 3) {
      logger.warn(
        `${depthIndent}SupervisorAgent: Maximum execution depth (${this.executionDepth}) reached, forcing direct execution`
      );

      try {
        // Forcer l'exécution directe avec starknet, en contournant le workflow
        if (this.starknetAgent) {
          logger.debug(
            `${depthIndent}SupervisorAgent: Forcing direct execution with StarknetAgent`
          );
          const result = await this.starknetAgent.execute(
            typeof input === 'string'
              ? input
              : input instanceof BaseMessage
                ? input
                : (input as AgentMessage).content,
            config
          );

          // Emballer le résultat et le marquer comme final
          const finalResult =
            result instanceof BaseMessage
              ? result
              : new AIMessage({
                  content:
                    typeof result === 'string'
                      ? result
                      : JSON.stringify(result),
                  additional_kwargs: {
                    from: 'supervisor',
                    final: true,
                  },
                });

          logger.debug(
            `${depthIndent}SupervisorAgent: Leaving execute with direct execution result`
          );
          this.executionDepth--;
          return finalResult;
        }

        // Si pas de starknetAgent, renvoyer un message d'erreur
        const errorMsg = new AIMessage({
          content:
            'Maximum recursion depth reached. Please try again with a simpler query.',
          additional_kwargs: {
            from: 'supervisor',
            final: true,
            error: 'max_recursion_depth',
          },
        });
        logger.debug(
          `${depthIndent}SupervisorAgent: Leaving execute with error message due to max depth`
        );
        this.executionDepth--;
        return errorMsg;
      } catch (error) {
        logger.error(
          `${depthIndent}SupervisorAgent: Error in direct execution: ${error}`
        );
        const errorMsg = new AIMessage({
          content: `Error occurred during forced direct execution: ${error instanceof Error ? error.message : String(error)}`,
          additional_kwargs: {
            from: 'supervisor',
            final: true,
            error: 'direct_execution_error',
          },
        });
        this.executionDepth--;
        return errorMsg;
      }
    }

    // ---- Start Original Execute Logic ----
    logger.debug(`${depthIndent}SupervisorAgent: Processing input...`);
    let message: BaseMessage;
    if (typeof input === 'string') {
      message = new HumanMessage(input);
    } else if (input instanceof BaseMessage) {
      message = input;
    } else if (input && typeof input === 'object' && input.content) {
      message = new HumanMessage(input.content);
    } else {
      logger.error(
        `${depthIndent}SupervisorAgent: Invalid input type: ${typeof input}`
      );
      this.executionDepth--; // Decrement depth before returning error
      return new AIMessage({
        content: 'Invalid input type provided to supervisor.',
        additional_kwargs: {
          from: 'supervisor',
          final: true,
          error: 'invalid_input_type',
        },
      });
    }

    // Enrichir avec le contexte de la mémoire si activé
    if (
      this.config.agentConfig?.memory?.enabled !== false &&
      this.memoryAgent
    ) {
      logger.debug(
        `${depthIndent}SupervisorAgent: Enriching message with memory context`
      );
      message = await this.enrichWithMemoryContext(message);
    } else {
      logger.debug(
        `${depthIndent}SupervisorAgent: Memory enrichment skipped (disabled or agent unavailable)`
      );
    }

    // Vérifier si workflowController est initialisé
    if (!this.workflowController) {
      logger.error(
        `${depthIndent}SupervisorAgent: Workflow controller not initialized`
      );
      this.executionDepth--; // Decrement depth before returning error
      throw new Error('WorkflowController not initialized');
    }

    // Exécuter le workflow
    logger.debug(
      `${depthIndent}SupervisorAgent: Invoking workflow controller...`
    );
    try {
      const result = await this.workflowController.execute(message, config);
      logger.debug(
        `${depthIndent}SupervisorAgent: Workflow controller execution finished`
      );

      // Formater la réponse finale
      const formattedResponse = this.formatResponse(result);
      logger.debug(
        `${depthIndent}SupervisorAgent: Formatted response: ${JSON.stringify(formattedResponse).substring(0, 100)}...`
      );

      // Retourner la réponse formatée
      logger.debug(`${depthIndent}SupervisorAgent: Leaving execute normally`);
      this.executionDepth--;
      return formattedResponse;
    } catch (error) {
      logger.error(
        `${depthIndent}SupervisorAgent: Error during workflow execution: ${error}`
      );
      this.executionDepth--; // Decrement depth before returning error
      throw error; // Propager l'erreur
    }
    // ---- End Original Execute Logic ----
  }

  /**
   * Formate une réponse pour la journalisation
   */
  private formatResponse(response: string): string {
    return response
      .split('\n')
      .map((line) => (line.includes('•') ? `  ${line.trim()}` : line))
      .join('\n');
  }

  /**
   * Exécute une demande en mode autonome
   */
  public async executeAutonomous(): Promise<any> {
    logger.debug('SupervisorAgent: Entering executeAutonomous');
    if (!this.starknetAgent) {
      logger.error(
        'SupervisorAgent: Starknet agent is not available for autonomous execution.'
      );
      throw new Error('Starknet agent is not available');
    }
    logger.debug('SupervisorAgent: Calling starknetAgent.execute_autonomous()');
    const result = await this.starknetAgent.execute_autonomous();
    logger.debug('SupervisorAgent: Leaving executeAutonomous');
    return result;
  }

  /**
   * Obtient un opérateur par son ID
   */
  public getOperator(id: string): IAgent | undefined {
    return this.operators.get(id);
  }

  /**
   * Obtient l'agent Starknet
   */
  public getStarknetAgent(): StarknetAgent | null {
    return this.starknetAgent;
  }

  /**
   * Obtient l'orchestrateur d'outils
   */
  public getToolsOrchestrator(): ToolsOrchestrator | null {
    return this.toolsOrchestrator;
  }

  /**
   * Obtient l'agent de mémoire
   */
  public getMemoryAgent(): MemoryAgent | null {
    return this.memoryAgent;
  }

  /**
   * Obtient l'agent de sélection de modèle
   */
  public getModelSelectionAgent(): ModelSelectionAgent | null {
    return this.modelSelectionAgent;
  }

  /**
   * Obtient tous les outils disponibles
   */
  public getAllTools(): Tool[] {
    const tools: Tool[] = [];

    if (this.toolsOrchestrator) {
      tools.push(...(this.toolsOrchestrator.getTools() as Tool[]));
    }

    if (this.memoryAgent) {
      tools.push(...(this.memoryAgent.getMemoryTools() as Tool[]));
    }

    return tools;
  }

  /**
   * Réinitialise le superviseur et ses agents
   */
  public async reset(): Promise<void> {
    logger.debug('SupervisorAgent: Entering reset');
    if (this.workflowController) {
      logger.debug('SupervisorAgent: Resetting workflow controller...');
      await this.workflowController.reset();
      logger.debug('SupervisorAgent: Workflow controller reset complete.');
    } else {
      logger.debug('SupervisorAgent: No workflow controller to reset.');
    }
    this.executionDepth = 0; // Reset execution depth
    logger.debug('SupervisorAgent: Leaving reset');
  }

  /**
   * Met à jour le mode de fonctionnement du superviseur
   */
  public async updateMode(mode: 'interactive' | 'autonomous'): Promise<void> {
    logger.debug(`SupervisorAgent: Entering updateMode with mode: ${mode}`);
    this.config.agentMode = mode;
    logger.debug(`SupervisorAgent: Set agentMode to ${this.config.agentMode}`);

    // Reconfigurer le workflow
    if (this.workflowController) {
      logger.debug(
        'SupervisorAgent: Resetting and re-initializing workflow controller due to mode change...'
      );
      await this.workflowController.reset();
      await this.initializeWorkflowController();
      logger.debug('SupervisorAgent: Workflow controller re-initialized.');
    } else {
      logger.debug('SupervisorAgent: No workflow controller to reconfigure.');
    }
    logger.debug('SupervisorAgent: Leaving updateMode');
  }

  /**
   * Libère les ressources
   */
  public async dispose(): Promise<void> {
    logger.debug('SupervisorAgent: Entering dispose');

    // Réinitialiser le workflow
    if (this.workflowController) {
      logger.debug(
        'SupervisorAgent: Resetting workflow controller during dispose...'
      );
      await this.workflowController.reset();
      logger.debug('SupervisorAgent: Workflow controller reset complete.');
    } else {
      logger.debug(
        'SupervisorAgent: No workflow controller to reset during dispose.'
      );
    }

    // Autres opérations de nettoyage si nécessaire
    this.modelSelectionAgent = null;
    this.starknetAgent = null;
    this.toolsOrchestrator = null;
    this.memoryAgent = null;
    this.workflowController = null;
    this.operators.clear();
    logger.debug(
      'SupervisorAgent: Cleared agent references and operators map.'
    );

    logger.debug('SupervisorAgent: Leaving dispose');
  }

  /**
   * Récupère et enrichit le contexte de la mémoire
   */
  private async enrichWithMemoryContext(
    message: BaseMessage
  ): Promise<BaseMessage> {
    logger.debug('SupervisorAgent: Entering enrichWithMemoryContext');
    if (!this.memoryAgent) {
      logger.debug(
        'SupervisorAgent: Memory agent not available, skipping enrichment.'
      );
      logger.debug('SupervisorAgent: Leaving enrichWithMemoryContext');
      return message;
    }

    try {
      // Récupérer les mémoires pertinentes
      logger.debug('SupervisorAgent: Retrieving relevant memories...');
      const memories = await this.memoryAgent.retrieveRelevantMemories(
        message,
        this.config.agentConfig?.userId || 'default_user'
      );
      logger.debug(`SupervisorAgent: Retrieved ${memories.length} memories.`);

      if (memories.length === 0) {
        logger.debug('SupervisorAgent: No relevant memories found.');
        logger.debug('SupervisorAgent: Leaving enrichWithMemoryContext');
        return message; // Aucune mémoire pertinente
      }

      // Formater les mémoires pour le contexte
      const memoryContext = this.memoryAgent.formatMemoriesForContext(memories);
      logger.debug(
        `SupervisorAgent: Formatted memory context: "${memoryContext.substring(0, 100)}..."`
      );

      // Créer un nouveau message avec le contexte de mémoire
      const originalContent =
        typeof message.content === 'string'
          ? message.content
          : JSON.stringify(message.content);

      const newMessage = new HumanMessage({
        content: originalContent,
        additional_kwargs: {
          ...message.additional_kwargs,
          memory_context: memoryContext,
        },
      });
      logger.debug('SupervisorAgent: Created new message with memory context.');
      logger.debug('SupervisorAgent: Leaving enrichWithMemoryContext');
      return newMessage;
    } catch (error) {
      logger.error(`Error enriching with memory context: ${error}`);
      logger.debug(
        'SupervisorAgent: Leaving enrichWithMemoryContext with error'
      );
      return message; // En cas d'erreur, retourner le message original
    }
  }
}
