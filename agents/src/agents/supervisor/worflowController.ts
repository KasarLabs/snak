// agents/supervisor/workflowController.ts
import { MemorySaver, StateGraph, END } from '@langchain/langgraph';
import { BaseMessage, AIMessage, HumanMessage, SystemMessage, ToolMessage } from '@langchain/core/messages';
import { logger } from '@snakagent/core';
import { IAgent } from '../core/baseAgent.js';
import { RunnableConfig } from '@langchain/core/runnables';
import crypto from 'crypto';

/**
 * Représente l'état du workflow multi-agent
 */
interface WorkflowState {
  messages: BaseMessage[];
  currentAgent: string;
  metadata: Record<string, any>;
  toolCalls: any[];
  error?: string;
  iterationCount: number; // Compteur d'itérations pour éviter les boucles infinies
}

/**
 * Configuration pour le contrôleur de workflow
 */
export interface WorkflowControllerConfig {
  agents: Record<string, IAgent>;
  entryPoint: string;
  checkpointEnabled?: boolean;
  debug?: boolean;
  maxIterations?: number; // Nombre maximum d'itérations avant de forcer la fin
  workflowTimeout?: number; // Nouveau paramètre en millisecondes
}

/**
 * Contrôleur qui gère le flux de travail entre différents agents
 */
export class WorkflowController {
  private agents: Record<string, IAgent>;
  private workflow: any;
  private checkpointer: MemorySaver;
  private entryPoint: string;
  private debug: boolean;
  private maxIterations: number; // Nombre maximum d'itérations pour éviter les boucles
  private initialized: boolean = false;
  private workflowTimeout: number; // En millisecondes

  constructor(config: WorkflowControllerConfig) {
    this.agents = config.agents;
    this.entryPoint = config.entryPoint;
    this.checkpointer = new MemorySaver();
    this.debug = config.debug || false;
    this.maxIterations = config.maxIterations || 10; // Par défaut, limiter à 10 itérations
    this.workflowTimeout = config.workflowTimeout || 60000; // 60 secondes par défaut
    
    // Valider que les agents requis existent
    this.validateAgents();
  }

  /**
   * Valide que les agents nécessaires existent
   */
  private validateAgents(): void {
    if (!this.agents[this.entryPoint]) {
      throw new Error(`Entry point agent "${this.entryPoint}" does not exist`);
    }
    
    if (this.debug) {
      logger.debug(`WorkflowController: Initialized with agents: ${Object.keys(this.agents).join(', ')}`);
      logger.debug(`WorkflowController: Entry point is "${this.entryPoint}"`);
    }
  }

  /**
   * Initialise le workflow
   */
  public async init(): Promise<void> {
    try {
      // Créer le graphe d'état
      const workflow = new StateGraph<WorkflowState>({
        channels: {
          messages: {
            value: (x, y) => Array.isArray(y) ? [...(x || []), ...y] : [...(x || []), ...(y ? [y] : [])],
            default: () => [],
          },
          currentAgent: {
            value: (_, y) => y,
            default: () => this.entryPoint,
          },
          metadata: {
            value: (x, y) => ({ ...(x || {}), ...(y || {}) }),
            default: () => ({}),
          },
          toolCalls: {
            value: (x, y) => Array.isArray(y) ? [...(x || []), ...y] : [...(x || []), ...(y ? [y] : [])],
            default: () => [],
          },
          error: {
            value: (_, y) => y,
            default: () => undefined,
          },
          iterationCount: {
            value: (x, _) => (x || 0) + 1, // Incrémenter à chaque passage
            default: () => 0,
          }
        }
      });

      // Ajouter des nœuds pour chaque agent
      for (const [agentId, agent] of Object.entries(this.agents)) {
        workflow.addNode(agentId, async (state: WorkflowState, runnable_config?: RunnableConfig) => {
          if (this.debug) {
            const lastAgents = (state.metadata.agentHistory || []).slice(-3).join(' → ');
            logger.debug(`WorkflowController: Executing agent "${agentId}" (iteration ${state.iterationCount})`);
            logger.debug(`  - Last agents: ${lastAgents || 'none'}`);
            logger.debug(`  - Messages: ${state.messages.length}`);
            logger.debug(`  - Current agent: ${state.currentAgent}`);
            
            if (state.messages.length > 0) {
              const lastMsg = state.messages[state.messages.length - 1];
              logger.debug(`  - Last message from: ${lastMsg?.additional_kwargs?.from || 'unknown'}`);
              logger.debug(`  - Last message is final: ${lastMsg?.additional_kwargs?.final ? 'yes' : 'no'}`);
            }
          }
          
          try {
            // Vérifier si le nombre maximum d'itérations est atteint
            if (state.iterationCount >= this.maxIterations) {
              logger.warn(`WorkflowController: Maximum iterations (${this.maxIterations}) reached for agent "${agentId}"`);
              return { 
                messages: [new AIMessage({ 
                  content: `Maximum workflow iterations (${this.maxIterations}) reached. Execution stopped to prevent infinite loop.`,
                  additional_kwargs: { 
                    from: agentId,
                    final: true,
                    error: 'max_iterations_reached'
                  }
                })],
                error: 'max_iterations_reached',
                currentAgent: END
              };
            }
            
            // Suivre les exécutions d'agent pour détecter les boucles par agent
            const agentExecutionCount = state.metadata.agentExecutionCount || {};
            const currentCount = agentExecutionCount[agentId] || 0;
            const newCount = currentCount + 1;
            
            // Mettre à jour les métadonnées
            const updatedMetadata = {
              ...state.metadata,
              agentExecutionCount: {
                ...agentExecutionCount,
                [agentId]: newCount
              }
            };
            
            // Si un agent non-outil est appelé trop de fois, forcer la terminaison
            if (newCount > 3 && agentId !== 'tools') {
              logger.warn(`Agent "${agentId}" has been called ${newCount} times, forcing end of workflow`);
              
              return { 
                messages: [new AIMessage({ 
                  content: `Workflow terminated to prevent infinite loop: agent "${agentId}" called too many times.`,
                  additional_kwargs: { 
                    from: agentId,
                    final: true
                  }
                })],
                currentAgent: END,
                metadata: updatedMetadata // Inclure les métadonnées mises à jour
              };
            }
            
            // Obtenir le dernier message ou utiliser un message vide si aucun n'existe
            const lastMessage = state.messages.length > 0 
              ? state.messages[state.messages.length - 1] 
              : new HumanMessage("Initializing workflow");
            
            // Préparer la configuration avec des métadonnées
            const config = {
              ...(runnable_config || {}),
              ...updatedMetadata, // Utiliser les métadonnées mises à jour ici
              toolCalls: state.toolCalls,
            };
            
            // Exécuter l'agent
            const result = await agent.execute(lastMessage, config);
            
            // Gérer différents formats de résultat
            let response: BaseMessage[];
            
            if (Array.isArray(result)) {
              response = result.map((item: any) => 
                item instanceof BaseMessage 
                  ? item 
                  : new AIMessage({ 
                      content: String(item),
                      additional_kwargs: { from: agentId }
                    })
              );
            } else if (result && typeof result === 'object' && 'messages' in result) {
              // Cas où le résultat contient des messages
              response = Array.isArray(result.messages) 
                ? result.messages.map((msg: any) => {
                    if (msg instanceof BaseMessage) {
                      // Ajouter l'information de l'agent source si elle n'existe pas déjà
                      if (!msg.additional_kwargs || !msg.additional_kwargs.from) {
                        return new AIMessage({
                          content: msg.content,
                          additional_kwargs: {
                            ...(msg.additional_kwargs || {}),
                            from: agentId
                          }
                        });
                      }
                      return msg;
                    }
                    return new AIMessage({ 
                      content: String(msg),
                      additional_kwargs: { from: agentId }
                    });
                  })
                : [new AIMessage({ 
                    content: String(result),
                    additional_kwargs: { from: agentId }
                  })];
            } else if (result instanceof BaseMessage) {
              // S'assurer que le message contient l'information de l'agent source
              if (!result.additional_kwargs || !result.additional_kwargs.from) {
                response = [new AIMessage({
                  content: result.content,
                  additional_kwargs: {
                    ...(result.additional_kwargs || {}),
                    from: agentId
                  }
                })];
              } else {
                response = [result];
              }
            } else {
              // Fallback pour les autres types de résultats
              response = [new AIMessage({ 
                content: String(result),
                additional_kwargs: { from: agentId }
              })];
            }
            
            // Déterminer le prochain agent en fonction du résultat
            let nextAgent: string | undefined = undefined;
            let isFinal: boolean = false;

            // Vérifier si un agent spécifique est demandé dans le résultat
            if (result && typeof result === 'object') {
              if ('nextAgent' in result) {
                nextAgent = result.nextAgent as string;
                
                // Vérifier qu'on n'envoie pas à l'agent en cours (sauf pour tools)
                if (nextAgent === agentId && agentId !== 'tools') {
                  logger.warn(`Agent "${agentId}" trying to route to itself, redirecting to supervisor instead`);
                  nextAgent = 'supervisor';
                }
              }
              
              if ('final' in result && result.final === true) {
                isFinal = true;
              }
            }

            // Vérifier dans les messages si un message est marqué comme final
            const lastResponseMessage = response[response.length - 1];
            if (lastResponseMessage && 
                lastResponseMessage.additional_kwargs && 
                lastResponseMessage.additional_kwargs.final === true) {
              isFinal = true;
            }

            // Si l'agent actuel est le superviseur et qu'il n'a pas spécifié d'agent suivant, 
            // forcer la fin pour éviter les boucles
            if (agentId === 'supervisor' && !nextAgent && !isFinal) {
              // Vérifier si c'est la deuxième fois consécutive
              const history = state.metadata.agentHistory || [];
              if (history.length >= 2 && history.slice(-2).every((a: string) => a === 'supervisor')) {
                isFinal = true;
                logger.warn('Supervisor called twice with no clear next agent, marking as final');
              }
            }
            
            // Vérifier les appels d'outils
            let toolCalls: any[] = [];
            if (lastResponseMessage instanceof AIMessage && 
                'tool_calls' in lastResponseMessage && 
                Array.isArray(lastResponseMessage.tool_calls) && 
                lastResponseMessage.tool_calls.length > 0) {
              
              toolCalls = lastResponseMessage.tool_calls;
              
              // Diriger automatiquement vers l'orchestrateur d'outils si des appels d'outils sont détectés
              if (!nextAgent && 'tools' in this.agents) {
                nextAgent = 'tools';
              }
            }
            
            // Construire l'état de sortie
            const outputState: Partial<WorkflowState> = {
              messages: response,
              metadata: updatedMetadata // Assurer que les métadonnées sont incluses
            };
            
            // Si c'est la réponse finale, forcer la fin du workflow
            if (isFinal) {
              if (this.debug) {
                logger.debug(`WorkflowController: Final response detected from "${agentId}", ending workflow`);
              }
              outputState.currentAgent = END;
            } 
            // Sinon, ajouter l'agent suivant si spécifié
            else if (nextAgent) {
              outputState.currentAgent = nextAgent;
            }
            
            // Ajouter les appels d'outils si présents
            if (toolCalls.length > 0) {
              outputState.toolCalls = toolCalls;
            }
            
            if (this.debug) {
              logger.debug(`WorkflowController: Agent "${agentId}" execution completed`);
              logger.debug(`  - Next agent: ${outputState.currentAgent || 'none (default)'}`);
              logger.debug(`  - Is final: ${isFinal ? 'yes' : 'no'}`);
              logger.debug(`  - New messages: ${outputState.messages?.length || 0}`);
            }

            return outputState;
          } catch (error) {
            logger.error(`WorkflowController: Error executing agent "${agentId}": ${error}`);
            
            // Créer un message d'erreur
            const errorMessage = new AIMessage({ 
              content: `Error executing agent "${agentId}": ${error instanceof Error ? error.message : String(error)}`,
              additional_kwargs: {
                from: agentId,
                error: true
              }
            });
            
            // Si c'est le superviseur qui génère une erreur, il faut éviter la boucle
            // en terminant le workflow
            if (agentId === 'supervisor') {
              return { 
                messages: [errorMessage],
                error: String(error),
                currentAgent: END // Forcer la fin pour éviter une boucle
              };
            }
            
            // Pour les autres agents, revenir au superviseur
            return { 
              messages: [errorMessage],
              currentAgent: 'supervisor', // Revenir au superviseur en cas d'erreur
              error: String(error)
            };
          }
        });
      }

      // Définir le point d'entrée
      workflow.setEntryPoint(this.entryPoint);

      // Router les transitions en fonction de l'agent actuel
      for (const agentId of Object.keys(this.agents)) {
        // Création du mapping de routage pour cet agent
        const routingMap: Record<string, string> = {};
        
        // Ajouter chaque agent comme destination possible
        for (const targetId of Object.keys(this.agents)) {
          routingMap[targetId] = targetId;
        }
        
        // Ajouter END comme destination possible
        routingMap[END] = END;
        
        // Ajouter les transitions conditionnelles
        workflow.addConditionalEdges(
          agentId,
          (state: WorkflowState) => this.router(state),
          routingMap
        );
      }

      // Compiler le workflow
      this.workflow = workflow.compile({
        checkpointer: this.checkpointEnabled ? this.checkpointer : undefined
      });
      
      this.initialized = true;
      
      if (this.debug) {
        logger.debug('WorkflowController: Workflow initialized and compiled successfully');
      }
    } catch (error) {
      logger.error(`WorkflowController: Failed to initialize workflow: ${error}`);
      throw error;
    }
  }

  /**
   * Fonction de routage qui détermine le prochain agent à appeler
   */
  private router(state: WorkflowState): string {
    // Mettre à jour l'historique des agents
    if (!state.metadata.agentHistory) {
      state.metadata.agentHistory = [];
    }
    
    // Ajouter l'agent actuel à l'historique
    if (state.currentAgent && state.currentAgent !== END) {
      state.metadata.agentHistory.push(state.currentAgent);
    }
    
    // Compteur d'itérations pour éviter les boucles infinies
    if (state.iterationCount >= this.maxIterations) {
      logger.warn(`Maximum iterations (${this.maxIterations}) reached, forcing END`);
      return END;
    }
    
    if (!state.messages || state.messages.length === 0) {
      return END;
    }
    
    const lastMessage = state.messages[state.messages.length - 1];
    const history = state.metadata.agentHistory || [];
    
    // Détecter les cycles dans l'historique des agents
    if (history.length >= 3) {
      const lastThree = history.slice(-3);
      if (lastThree.every((agent: string) => agent === 'supervisor')) {
        logger.warn(`Supervisor called 3 times in succession, redirecting to starknet to break the loop`);
        return 'starknet';
      }
    }
    
    // Gestion des erreurs
    if (state.error) {
      const lastAgent = history.length > 0 ? history[history.length - 1] : null;
      if (lastAgent === 'supervisor') {
        logger.warn('Error occurred in supervisor, redirecting to starknet to prevent loop');
        return 'starknet';
      } else if ('supervisor' in this.agents) {
        return 'supervisor';
      }
    }
    
    // Vérifier si le message est marqué comme final
    if (lastMessage.additional_kwargs?.final === true) {
      return END;
    }
    
    // Vérifier les appels d'outils
    if (lastMessage instanceof AIMessage && 
        lastMessage.tool_calls && 
        Array.isArray(lastMessage.tool_calls) && 
        lastMessage.tool_calls.length > 0) {
      
      if ('tools' in this.agents) {
        return 'tools';
      }
    }
    
    // Si un agent suivant est spécifié dans les métadonnées
    if (lastMessage.additional_kwargs?.nextAgent) {
      const nextAgent = lastMessage.additional_kwargs.nextAgent;
      if (nextAgent in this.agents) {
        return nextAgent;
      }
    }
    
    // Si le message vient du ModelSelectionAgent, il devrait indiquer l'agent suivant
    if (lastMessage.additional_kwargs?.from === 'model-selector') {
      // Vérifier si un agent suivant est spécifié
      if (lastMessage.additional_kwargs?.nextAgent && 
          lastMessage.additional_kwargs.nextAgent in this.agents) {
        return lastMessage.additional_kwargs.nextAgent;
      }
      // Par défaut, aller à Starknet après la sélection du modèle
      return 'starknet';
    }
    
    // Si le message vient du superviseur, router vers l'agent principal (starknet)
    if (lastMessage.additional_kwargs?.from === 'supervisor') {
      if ('starknet' in this.agents) {
        return 'starknet';
      }
      return END;
    }
    
    // Par défaut, retourner au superviseur
    if (state.currentAgent !== 'supervisor' && 'supervisor' in this.agents) {
      return 'supervisor';
    }
    
    // Si on ne peut pas déterminer l'agent suivant, terminer le workflow
    return END;
  }

  /**
   * Exécute le workflow avec une entrée
   * @param input Entrée à traiter
   * @param config Configuration optionnelle
   */
  public async execute(input: string | BaseMessage, config?: Record<string, any>): Promise<any> {
    try {
      if (!this.initialized || !this.workflow) {
        throw new Error('WorkflowController: Workflow has not been initialized');
      }
      
      // Convertir l'entrée en message si nécessaire
      const message = typeof input === 'string' 
        ? new HumanMessage(input) 
        : input;
      
      // Générer un ID de thread unique si non fourni
      const threadId = config?.thread_id || crypto.randomUUID();
      
      // Préparer la configuration
      const runConfig: RunnableConfig = { 
        configurable: { 
          thread_id: threadId,
          ...config 
        }
      };
      
      if (this.debug) {
        logger.debug(`WorkflowController: Executing workflow with input: ${message.content}`);
        logger.debug(`WorkflowController: Timeout set to ${this.workflowTimeout}ms`);
      }
      
      // Ajouter un timeout au workflow pour éviter les exécutions infinies
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Workflow execution timed out after ${this.workflowTimeout}ms`));
        }, this.workflowTimeout);
      });

      // Exécuter le workflow avec timeout
      const workflowPromise = this.workflow.invoke({
        messages: [message],
        currentAgent: this.entryPoint,
        metadata: { threadId },
        toolCalls: [],
        error: undefined,
        iterationCount: 0 // Réinitialiser le compteur d'itérations
      }, runConfig);

      const result = await Promise.race([workflowPromise, timeoutPromise]);

      if (this.debug) {
        logger.debug(`WorkflowController: Workflow execution completed`);
        if (result && result.messages) {
          logger.debug(`WorkflowController: Final message count: ${result.messages.length}`);
        }
      }
      
      return result;
    } catch (error: any) {
      // Si c'est une erreur de timeout, créer un message spécial
      if (error.message && error.message.includes('timed out')) {
        logger.error(`WorkflowController: ${error.message}`);
        return {
          messages: [new AIMessage({
            content: `Le workflow a été interrompu en raison d'un délai d'attente dépassé. Cela peut indiquer une boucle infinie ou une requête très complexe.`,
            additional_kwargs: {
              error: 'workflow_timeout',
              final: true
            }
          })],
          iterationCount: -1, // Valeur spéciale pour indiquer un timeout
          currentAgent: END
        };
      }

      logger.error(`WorkflowController: Execution error: ${error}`);
      // Renvoyer une erreur formatée pour l'utilisateur
      return {
        messages: [new AIMessage({
          content: `Une erreur inattendue s'est produite lors de l'exécution du workflow: ${error.message}`,
          additional_kwargs: {
            error: 'execution_error',
            final: true
          }
        })],
        iterationCount: -1,
        currentAgent: END
      };
    }
  }

  /**
   * Réinitialise le workflow
   */
  public async reset(): Promise<void> {
    try {
      if (this.checkpointer) {
        // Réinitialiser le checkpointer
        await this.checkpointer.clear();
      }
      
      if (this.debug) {
        logger.debug('WorkflowController: Workflow state reset');
      }
    } catch (error) {
      logger.error(`WorkflowController: Error resetting workflow: ${error}`);
      throw error;
    }
  }

  /**
   * Vérifie si le workflow est initialisé
   */
  public isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Obtient l'état actuel du workflow
   */
  public async getState(): Promise<any> {
    if (!this.checkpointer) {
      return null;
    }
    
    try {
      // Récupérer l'état depuis le checkpointer
      const state = await this.checkpointer.get({});
      return state;
    } catch (error) {
      logger.error(`WorkflowController: Error getting workflow state: ${error}`);
      return null;
    }
  }

  /**
   * Définit le nombre maximum d'itérations
   */
  public setMaxIterations(maxIterations: number): void {
    if (maxIterations < 1) {
      logger.warn(`Invalid maxIterations value: ${maxIterations}. Must be at least 1.`);
      return;
    }
    this.maxIterations = maxIterations;
    if (this.debug) {
      logger.debug(`WorkflowController: maxIterations set to ${maxIterations}`);
    }
  }
}