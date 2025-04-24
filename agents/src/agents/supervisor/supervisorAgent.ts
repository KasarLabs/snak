// agents/supervisor/supervisorAgent.ts
import { BaseAgent, AgentType, AgentMessage, IAgent } from '../core/baseAgent.js';
import { ModelSelectionAgent } from '../operators/modelSelectionAgent.js';
import { StarknetAgent } from '../core/starknetAgent.js';
import { ToolsOrchestrator } from '../operators/toolOrchestratorAgent.js';
import { MemoryAgent } from '../operators/memoryAgent.js';
import { WorkflowController } from './worflowController.js';
import { logger, metrics } from '@snakagent/core';
import { StateGraph, MemorySaver, END } from '@langchain/langgraph';
import { HumanMessage, AIMessage, SystemMessage, ToolMessage, BaseMessage } from '@langchain/core/messages';
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
      this.modelSelectionAgent = new ModelSelectionAgent({
        debugMode: this.debug,
        useMetaSelection: true,
        modelsConfigPath: this.config.modelsConfigPath
      });
      await this.modelSelectionAgent.init();
      this.operators.set(this.modelSelectionAgent.id, this.modelSelectionAgent);
      logger.debug('SupervisorAgent: ModelSelectionAgent initialized');

      // 2. Initialiser l'agent mémoire si nécessaire
      if (this.config.agentConfig?.memory?.enabled !== false) {
        this.memoryAgent = new MemoryAgent({
          shortTermMemorySize: this.config.agentConfig?.memory?.shortTermMemorySize || 15,
          recursionLimit: this.config.agentConfig?.memory?.recursionLimit,
          embeddingModel: this.config.agentConfig?.memory?.embeddingModel
        });
        await this.memoryAgent.init();
        this.operators.set(this.memoryAgent.id, this.memoryAgent);
        logger.debug('SupervisorAgent: MemoryAgent initialized');
      }

      // 3. Initialiser l'agent principal (Starknet)
      this.starknetAgent = new StarknetAgent({
        ...this.config.starknetConfig,
        modelSelector: this.modelSelectionAgent,
        memory: this.config.agentConfig?.memory
      });
      await this.starknetAgent.init();
      logger.debug('SupervisorAgent: StarknetAgent initialized');

      // 4. Initialiser l'orchestrateur d'outils
      this.toolsOrchestrator = new ToolsOrchestrator({
        starknetAgent: this.starknetAgent,
        agentConfig: this.config.agentConfig
      });
      await this.toolsOrchestrator.init();
      this.operators.set(this.toolsOrchestrator.id, this.toolsOrchestrator);
      logger.debug('SupervisorAgent: ToolsOrchestrator initialized');

      // 5. Initialiser le contrôleur de workflow
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
    try {
      // Rassembler tous les agents dans une structure pour le contrôleur
      const allAgents: Record<string, IAgent> = {
        'supervisor': this,
      };

      // Ajouter tous les agents disponibles
      if (this.starknetAgent) {
        allAgents['starknet'] = this.starknetAgent;
      } else {
        logger.warn('SupervisorAgent: starknetAgent is not initialized');
      }
      
      // Ajouter les opérateurs
      if (this.modelSelectionAgent) {
        allAgents['model-selector'] = this.modelSelectionAgent;
      } else {
        logger.warn('SupervisorAgent: modelSelectionAgent is not initialized');
      }
      
      if (this.memoryAgent) {
        allAgents['memory'] = this.memoryAgent;
      }
      
      if (this.toolsOrchestrator) {
        allAgents['tools'] = this.toolsOrchestrator;
      }

      // Vérifier que nous avons au moins 2 agents (supervisor + starknet)
      if (Object.keys(allAgents).length < 2 || !allAgents['starknet']) {
        throw new Error('Workflow requires at least supervisor and starknet execution agent');
      }

      // Créer et initialiser le contrôleur de workflow avec timeout
      this.workflowController = new WorkflowController({
        agents: allAgents,
        entryPoint: 'supervisor',
        checkpointEnabled: true,
        debug: this.debug,
        maxIterations: this.config.agentConfig?.maxIterations || 10, // Utiliser la config si disponible
        workflowTimeout: this.config.agentConfig?.workflowTimeout || 30000 // 30 secondes par défaut, configurable
      });

      await this.workflowController.init();
      logger.debug('WorkflowController initialized with agents: ' + Object.keys(allAgents).join(', '));
    } catch (error: any) {
      logger.error(`Failed to initialize workflow controller: ${error.message || error}`);
      throw error;
    }
  }

  /**
   * Initialise les métriques
   */
  private initializeMetrics(): void {
    if (!this.starknetAgent) return;

    const agentName = this.config.agentConfig?.name || 'agent';
    metrics.metricsAgentConnect(agentName, this.config.agentMode);
  }

  /**
   * Configure le workflow interne du superviseur
   */
  private async supervisorWorkflow(message: BaseMessage): Promise<{ routeTo: string, message: BaseMessage }> {
    try {
      const content = message.content as string;
      
      // Par défaut, commencer par la sélection du modèle pour les requêtes substantielles
      let routeTo = 'model-selector';
      let modifiedMessage = message;
  
      // Pour les requêtes très simples ou les commandes système, router directement
      if (content.trim().length < 10 || 
          content.startsWith('/') || 
          content.startsWith('!')) {
        routeTo = 'starknet';
      } else {
        // Ajouter des métadonnées pour indiquer le prochain agent après la sélection du modèle
        const additional_kwargs = { ...(message.additional_kwargs || {}) }; // Clone existing kwargs
        additional_kwargs.next_agent_after_selection = 'starknet'; // Add new kwarg
  
        // Try to create a new message of the same type with updated kwargs
        if (message instanceof HumanMessage) {
          modifiedMessage = new HumanMessage({
            content: message.content,
            additional_kwargs: additional_kwargs
          });
        } else if (message instanceof AIMessage) {
            modifiedMessage = new AIMessage({
                content: message.content,
                additional_kwargs: additional_kwargs,
                response_metadata: message.response_metadata, // Preserve existing properties
                tool_calls: message.tool_calls,
                invalid_tool_calls: message.invalid_tool_calls,
                usage_metadata: message.usage_metadata
            });
        } else if (message instanceof SystemMessage) {
            modifiedMessage = new SystemMessage({
                content: message.content,
                additional_kwargs: additional_kwargs
            });
        } else if (message instanceof ToolMessage) {
            modifiedMessage = new ToolMessage({
                content: message.content,
                tool_call_id: message.tool_call_id,
                additional_kwargs: additional_kwargs
            });
        } else {
            // If it's not a known concrete type, log a warning and don't modify the message
            // as we cannot instantiate BaseMessage directly.
            logger.warn(`SupervisorAgent: Cannot add metadata to unknown message type: ${message._getType()}. Original message kept.`);
            // modifiedMessage remains the original message
        }
      }
      
      // Logique spécifique pour certains types de requêtes (overrides model selection route)
      if (content.toLowerCase().includes('remember') || 
          content.toLowerCase().includes('memory') || 
          content.toLowerCase().includes('forget')) {
        routeTo = 'memory';
      } 
      else if (content.toLowerCase().includes('tool') || 
              content.toLowerCase().includes('execute command') ||
              /use (?:the )?tool/i.test(content)) {
        routeTo = 'tools';
      }
      
      // Journaliser la décision de routage
      if (this.debug) {
        logger.debug(`SupervisorAgent routing decision: "${routeTo}"`);
        if (modifiedMessage !== message) {
          logger.debug(`SupervisorAgent: Added metadata: ${JSON.stringify(modifiedMessage.additional_kwargs)}`);
        }
      }
      
      return { 
        routeTo,
        message: modifiedMessage
      };
    } catch (error) {
      logger.error(`SupervisorAgent workflow error: ${error}`);
      return {
        routeTo: 'starknet', // En cas d'erreur, revenir à l'agent principal
        message
      };
    }
  }

  /**
   * Récupère et enrichit le contexte de la mémoire
   */
  private async enrichWithMemoryContext(message: BaseMessage): Promise<BaseMessage> {
    if (!this.memoryAgent) {
      return message;
    }

    try {
      // Récupérer les mémoires pertinentes
      const memories = await this.memoryAgent.retrieveRelevantMemories(
        message, 
        this.config.agentConfig?.userId || 'default_user'
      );

      if (memories.length === 0) {
        return message; // Aucune mémoire pertinente
      }

      // Formater les mémoires pour le contexte
      const memoryContext = this.memoryAgent.formatMemoriesForContext(memories);
      
      // Créer un nouveau message avec le contexte de mémoire
      const originalContent = typeof message.content === 'string' 
        ? message.content 
        : JSON.stringify(message.content);

      const newMessage = new HumanMessage({
        content: originalContent,
        additional_kwargs: {
          ...message.additional_kwargs,
          memory_context: memoryContext
        }
      });

      return newMessage;
    } catch (error) {
      logger.error(`Error enriching with memory context: ${error}`);
      return message; // En cas d'erreur, retourner le message original
    }
  }

  /**
 * Exécute une action avec le supervisor agent
 * @param input Entrée utilisateur ou message
 * @param config Configuration optionnelle
 */
public async execute(input: string | AgentMessage | BaseMessage, config?: Record<string, any>): Promise<any> {
    try {
      // Convertir l'entrée en message si nécessaire
      let message: BaseMessage;
      if (typeof input === 'string') {
        message = new HumanMessage(input);
      } else if ('content' in input) {
        message = input instanceof BaseMessage 
          ? input 
          : new HumanMessage((input as AgentMessage).content);
      } else {
        throw new Error('Invalid input format');
      }
  
      // Si nous avons un agent mémoire, enrichir le message avec le contexte de mémoire
      if (this.memoryAgent) {
        message = await this.enrichWithMemoryContext(message);
      }
  
      // Si nous utilisons le contrôleur de workflow
      if (this.workflowController) {
        const result = await this.workflowController.execute(message, config);
        
        // Vérifier si le résultat contient des messages et retourner le dernier
        if (result && result.messages && result.messages.length > 0) {
          // Si nous retournons simplement le dernier message, s'assurer qu'il est marqué comme final
          // pour éviter les boucles futures
          const lastMessage = result.messages[result.messages.length - 1];
          
          // S'assurer que le dernier message est marqué comme final
          if (lastMessage instanceof BaseMessage) {
            // Vérifier si le message n'est pas déjà marqué comme final
            if (!lastMessage.additional_kwargs || lastMessage.additional_kwargs.final !== true) {
              return new AIMessage({
                content: typeof lastMessage.content === 'string' 
                  ? lastMessage.content 
                  : JSON.stringify(lastMessage.content),
                additional_kwargs: {
                  ...(lastMessage.additional_kwargs || {}),
                  from: 'supervisor', // Assurer que l'origine est bien le superviseur
                  final: true  // Toujours marquer comme final
                }
              });
            }
          }
          
          return lastMessage;
        }
        
        return result;
      }
  
      // Si le contrôleur de workflow n'est pas disponible, utiliser le workflow interne
      logger.warn('SupervisorAgent: WorkflowController not available, using internal fallback logic.');
      const { routeTo, message: routingMessage } = await this.supervisorWorkflow(message);
      
      let result;
      const lastMessage = routingMessage; // Use the potentially modified message from supervisorWorkflow
      
      // Extract modelType from the last message's metadata if available
      const modelType = lastMessage?.additional_kwargs?.modelType 
                        ? lastMessage.additional_kwargs.modelType as string
                        : 'smart'; // Default model
      
      if (this.debug) {
        logger.debug(`SupervisorAgent (fallback): Routing to ${routeTo}, using modelType: ${modelType}`);
      }

      // Prepare config specifically for StarknetAgent call
      const starknetAgentConfig = { 
        ...(config || {}), 
        forceModelType: modelType 
      };

      switch (routeTo) {
        case 'memory':
          if (this.memoryAgent) {
            // Assume memoryAgent.execute takes only one argument
            result = await this.memoryAgent.execute(routingMessage);
          } else {
            throw new Error('Memory agent is not available');
          }
          break;
          
        case 'tools':
          if (this.toolsOrchestrator) {
            // Assume toolsOrchestrator.execute takes only one argument
            result = await this.toolsOrchestrator.execute(routingMessage);
          } else {
            throw new Error('Tools orchestrator is not available');
          }
          break;
          
        case 'model-selector':
          if (this.modelSelectionAgent) {
            // Assume modelSelectionAgent.execute takes only one argument
            result = await this.modelSelectionAgent.execute(routingMessage);
          } else {
            throw new Error('Model selection agent is not available');
          }
          break;
          
        case 'starknet':
        default:
          if (this.starknetAgent) {
            // Pass the specific config with forceModelType to StarknetAgent
            result = await this.starknetAgent.execute(routingMessage, starknetAgentConfig);
          } else {
            throw new Error('Starknet agent is not available');
          }
          break;
      }
  
      // Formater la réponse et marquer comme finale pour éviter les boucles
      if (result instanceof BaseMessage) {
        // Si c'est déjà un BaseMessage, ajouter les métadonnées nécessaires
        const finalMessage = new AIMessage({
          content: result.content,
          additional_kwargs: {
            ...(result.additional_kwargs || {}),
            from: 'supervisor',
            final: true
          }
        });
        
        // Journaliser si nécessaire
        if (this.debug && typeof finalMessage.content === 'string') {
          const formattedContent = this.formatResponse(finalMessage.content);
          const boxContent = createBox('Supervisor Output', formattedContent);
          const boxWithTokens = addTokenInfoToBox(boxContent);
          logger.debug(`Supervisor response: ${boxWithTokens}`);
        }
        
        return finalMessage;
      } else {
        // Pour les autres types de résultats, créer un nouveau AIMessage
        const responseContent = typeof result === 'string' 
          ? result 
          : JSON.stringify(result);
        
        const finalMessage = new AIMessage({
          content: responseContent,
          additional_kwargs: {
            from: 'supervisor',
            final: true
          }
        });
        
        // Journaliser si nécessaire
        if (this.debug && typeof responseContent === 'string') {
          const formattedContent = this.formatResponse(responseContent);
          const boxContent = createBox('Supervisor Output', formattedContent);
          const boxWithTokens = addTokenInfoToBox(boxContent);
          logger.debug(`Supervisor response: ${boxWithTokens}`);
        }
        
        return finalMessage;
      }
    } catch (error) {
      logger.error(`SupervisorAgent: Execution error: ${error}`);
      
      // Créer un message d'erreur qui est également marqué comme final
      const errorMessage = new AIMessage({
        content: `An error occurred: ${error instanceof Error ? error.message : String(error)}`,
        additional_kwargs: {
          from: 'supervisor',
          error: true,
          final: true
        }
      });
      
      return errorMessage;
    }
  }

  /**
   * Formate une réponse pour la journalisation
   */
  private formatResponse(response: string): string {
    return response
      .split('\n')
      .map(line => line.includes('•') ? `  ${line.trim()}` : line)
      .join('\n');
  }

  /**
   * Exécute une demande en mode autonome
   */
  public async executeAutonomous(): Promise<any> {
    if (!this.starknetAgent) {
      throw new Error('Starknet agent is not available');
    }
    
    return this.starknetAgent.execute_autonomous();
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
      tools.push(...this.toolsOrchestrator.getTools());
    }
    
    if (this.memoryAgent) {
      tools.push(...this.memoryAgent.getMemoryTools());
    }
    
    return tools;
  }

  /**
   * Réinitialise le superviseur et ses agents
   */
  public async reset(): Promise<void> {
    if (this.workflowController) {
      await this.workflowController.reset();
    }
  }

  /**
   * Met à jour le mode de fonctionnement du superviseur
   */
  public async updateMode(mode: 'interactive' | 'autonomous'): Promise<void> {
    this.config.agentMode = mode;
    
    // Reconfigurer le workflow
    if (this.workflowController) {
      await this.workflowController.reset();
      await this.initializeWorkflowController();
    }
  }

  /**
   * Libère les ressources
   */
  public async dispose(): Promise<void> {
    logger.debug('SupervisorAgent: Disposing resources');
    
    // Réinitialiser le workflow
    if (this.workflowController) {
      await this.workflowController.reset();
    }
    
    // Autres opérations de nettoyage si nécessaire
    
    logger.debug('SupervisorAgent: Resources disposed');
  }
}