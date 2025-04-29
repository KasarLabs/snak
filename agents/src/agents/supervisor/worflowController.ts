// agents/supervisor/workflowController.ts
import { MemorySaver, StateGraph, END, START } from '@langchain/langgraph';
import {
  BaseMessage,
  AIMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from '@langchain/core/messages';
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
  useConditionalEntryPoint?: boolean;
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
  private executionId: string | null = null; // Track current execution
  private checkpointEnabled: boolean; // Added missing property
  private entryPointSelector: ((state: WorkflowState) => string) | null = null;
  private useConditionalEntryPoint: boolean;
  private iterationCount: number = 0;
  private timeoutId: NodeJS.Timeout | null = null;

  constructor(config: WorkflowControllerConfig) {
    this.agents = config.agents;
    this.entryPoint = config.entryPoint;
    this.checkpointer = new MemorySaver();
    this.debug = config.debug || false;
    this.maxIterations = config.maxIterations || 10; // Par défaut, limiter à 10 itérations
    this.workflowTimeout = config.workflowTimeout || 60000; // 60 secondes par défaut
    this.checkpointEnabled = config.checkpointEnabled ?? false; // Initialize property
    this.useConditionalEntryPoint = config.useConditionalEntryPoint ?? false;

    // Valider que les agents requis existent
    this.validateAgents();

    if (this.debug) {
      logger.debug(
        `WorkflowController: Initialized with agents: ${Object.keys(this.agents).join(', ')}`
      );
      logger.debug(`WorkflowController: Entry point is "${this.entryPoint}"`);
      logger.debug(`WorkflowController: Max iterations: ${this.maxIterations}`);
      logger.debug(
        `WorkflowController: Workflow timeout: ${this.workflowTimeout}ms`
      );
    }
  }

  /**
   * Valide que les agents nécessaires existent
   */
  private validateAgents(): void {
    if (!this.agents[this.entryPoint]) {
      throw new Error(`Entry point agent "${this.entryPoint}" does not exist`);
    }

    if (this.debug) {
      logger.debug(
        `WorkflowController: Initialized with agents: ${Object.keys(this.agents).join(', ')}`
      );
      logger.debug(`WorkflowController: Entry point is "${this.entryPoint}"`);
    }
  }

  /**
   * Initialise le workflow
   */
  public async init(): Promise<void> {
    logger.debug('WorkflowController: Starting initialization');
    try {
      // Créer le graphe d'état
      logger.debug('WorkflowController: Creating StateGraph');
      const workflow = new StateGraph<WorkflowState>({
        channels: {
          messages: {
            value: (x, y) =>
              Array.isArray(y)
                ? [...(x || []), ...y]
                : [...(x || []), ...(y ? [y] : [])],
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
            value: (x, y) =>
              Array.isArray(y)
                ? [...(x || []), ...y]
                : [...(x || []), ...(y ? [y] : [])],
            default: () => [],
          },
          error: {
            value: (_, y) => y,
            default: () => undefined,
          },
          iterationCount: {
            value: (x, _) => (x || 0) + 1, // Incrémenter à chaque passage
            default: () => 0,
          },
        },
      });

      // Ajouter des nœuds pour chaque agent
      for (const [agentId, agent] of Object.entries(this.agents)) {
        const execId = this.executionId || 'unknown';
        workflow.addNode(
          agentId,
          async (state: WorkflowState, runnable_config?: RunnableConfig) => {
            if (this.debug) {
              const lastAgents = (state.metadata.agentHistory || [])
                .slice(-3)
                .join(' → ');
              logger.debug(
                `WorkflowController[Exec:${execId}]: Node[${agentId}] - START (Iteration: ${state.iterationCount})`
              );
              logger.debug(`  - Last agents: ${lastAgents || 'none'}`);
              logger.debug(`  - Messages: ${state.messages.length}`);
              logger.debug(
                `  - Current agent state value: ${state.currentAgent}`
              ); // Log the actual current agent state

              if (state.messages.length > 0) {
                const lastMsg = state.messages[state.messages.length - 1];
                logger.debug(`  - Last message type: ${lastMsg?._getType()}`);
                logger.debug(
                  `  - Last message from agent: ${lastMsg?.additional_kwargs?.from || 'unknown'}`
                );
                logger.debug(
                  `  - Last message is final: ${lastMsg?.additional_kwargs?.final ? 'yes' : 'no'}`
                );
                logger.debug(
                  `  - Last message content snippet: "${String(lastMsg?.content).substring(0, 100)}..."`
                );
              }
            }

            try {
              // Vérifier si le nombre maximum d'itérations est atteint
              if (state.iterationCount >= this.maxIterations) {
                logger.warn(
                  `WorkflowController[Exec:${execId}]: Node[${agentId}] - Maximum iterations (${this.maxIterations}) reached.`
                );
                return {
                  messages: [
                    new AIMessage({
                      content: `Maximum workflow iterations (${this.maxIterations}) reached. Execution stopped to prevent infinite loop.`,
                      additional_kwargs: {
                        from: agentId,
                        final: true,
                        error: 'max_iterations_reached',
                      },
                    }),
                  ],
                  error: 'max_iterations_reached',
                  currentAgent: END,
                };
              }

              // Suivre les exécutions d'agent pour détecter les boucles par agent
              const agentExecutionCount =
                state.metadata.agentExecutionCount || {};
              const currentCount = agentExecutionCount[agentId] || 0;
              const newCount = currentCount + 1;

              // Mettre à jour les métadonnées
              const updatedMetadata: Record<string, any> = {
                ...state.metadata,
                agentExecutionCount: {
                  ...agentExecutionCount,
                  [agentId]: newCount,
                },
              };

              // Si un agent non-outil est appelé trop de fois, forcer la terminaison
              if (newCount > 3 && agentId !== 'tools') {
                logger.warn(
                  `WorkflowController[Exec:${execId}]: Node[${agentId}] - Agent called ${newCount} times, forcing END.`
                );

                return {
                  messages: [
                    new AIMessage({
                      content: `Workflow terminated to prevent infinite loop: agent "${agentId}" called too many times.`,
                      additional_kwargs: {
                        from: agentId,
                        final: true,
                      },
                    }),
                  ],
                  currentAgent: END,
                  metadata: updatedMetadata, // Inclure les métadonnées mises à jour
                };
              }

              // Obtenir le dernier message ou utiliser un message vide si aucun n'existe
              const lastMessage =
                state.messages.length > 0
                  ? state.messages[state.messages.length - 1]
                  : new HumanMessage('Initializing workflow');

              logger.debug(
                `WorkflowController[Exec:${execId}]: Node[${agentId}] - Last message to process: Type=${lastMessage._getType()}, From=${lastMessage.additional_kwargs?.from || 'initial'}`
              );

              // NOUVEAU: Extraire la requête originale et l'ajouter à la configuration
              const originalUserQuery = this.extractOriginalUserQuery(state);
              if (originalUserQuery) {
                updatedMetadata.originalUserQuery = originalUserQuery;
                logger.debug(
                  `WorkflowController[Exec:${execId}]: Node[${agentId}] - Using original user query: "${originalUserQuery}"`
                );
              }

              // Préparer la configuration avec des métadonnées
              const config = {
                ...(runnable_config || {}),
                ...updatedMetadata, // Utiliser les métadonnées mises à jour ici
                toolCalls: state.toolCalls,
              };

              // Exécuter l'agent
              logger.debug(
                `WorkflowController[Exec:${execId}]: Node[${agentId}] - Calling agent.execute()...`
              );
              const result = await agent.execute(lastMessage, config);

              logger.debug(
                `WorkflowController[Exec:${execId}]: Node[${agentId}] - Agent execution finished. Processing result...`
              );

              // Gérer différents formats de résultat
              let response: BaseMessage[];

              if (Array.isArray(result)) {
                response = result.map((item: any) =>
                  item instanceof BaseMessage
                    ? item
                    : new AIMessage({
                        content: String(item),
                        additional_kwargs: { from: agentId },
                      })
                );
              } else if (
                result &&
                typeof result === 'object' &&
                'messages' in result
              ) {
                // Cas où le résultat contient des messages
                response = Array.isArray(result.messages)
                  ? result.messages.map((msg: any) => {
                      if (msg instanceof BaseMessage) {
                        // Ajouter l'information de l'agent source si elle n'existe pas déjà
                        if (
                          !msg.additional_kwargs ||
                          !msg.additional_kwargs.from
                        ) {
                          return new AIMessage({
                            content: msg.content,
                            additional_kwargs: {
                              ...(msg.additional_kwargs || {}),
                              from: agentId,
                            },
                          });
                        }
                        return msg;
                      }
                      return new AIMessage({
                        content: String(msg),
                        additional_kwargs: { from: agentId },
                      });
                    })
                  : [
                      new AIMessage({
                        content: String(result),
                        additional_kwargs: { from: agentId },
                      }),
                    ];
              } else if (result instanceof BaseMessage) {
                // S'assurer que le message contient l'information de l'agent source
                if (
                  !result.additional_kwargs ||
                  !result.additional_kwargs.from
                ) {
                  response = [
                    new AIMessage({
                      content: result.content,
                      additional_kwargs: {
                        ...(result.additional_kwargs || {}),
                        from: agentId,
                      },
                    }),
                  ];
                } else {
                  response = [result];
                }
              } else {
                // Fallback pour les autres types de résultats
                response = [
                  new AIMessage({
                    content: String(result),
                    additional_kwargs: { from: agentId },
                  }),
                ];
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
                    logger.warn(
                      `WorkflowController[Exec:${execId}]: Node[${agentId}] - Agent "${agentId}" trying to route to itself, redirecting to supervisor instead`
                    );
                    nextAgent = 'supervisor';
                  }
                }

                if ('final' in result && result.final === true) {
                  isFinal = true;
                }
              }

              // Vérifier dans les messages si un message est marqué comme final
              const lastResponseMessage = response[response.length - 1];
              if (
                lastResponseMessage &&
                lastResponseMessage.additional_kwargs &&
                lastResponseMessage.additional_kwargs.final === true
              ) {
                isFinal = true;
              }

              // Si l'agent actuel est le superviseur et qu'il n'a pas spécifié d'agent suivant,
              // forcer la fin pour éviter les boucles
              if (agentId === 'supervisor' && !nextAgent && !isFinal) {
                // Vérifier si c'est la deuxième fois consécutive
                const history = state.metadata.agentHistory || [];
                if (
                  history.length >= 2 &&
                  history.slice(-2).every((a: string) => a === 'supervisor')
                ) {
                  isFinal = true;
                  logger.warn(
                    'Supervisor called twice with no clear next agent, marking as final'
                  );
                }
              }

              // Vérifier les appels d'outils
              let toolCalls: any[] = [];
              if (
                lastResponseMessage instanceof AIMessage &&
                'tool_calls' in lastResponseMessage &&
                Array.isArray(lastResponseMessage.tool_calls) &&
                lastResponseMessage.tool_calls.length > 0
              ) {
                toolCalls = lastResponseMessage.tool_calls;

                // Diriger automatiquement vers l'orchestrateur d'outils si des appels d'outils sont détectés
                if (!nextAgent && 'tools' in this.agents) {
                  nextAgent = 'tools';
                }
              }

              // Construire l'état de sortie
              const outputState: Partial<WorkflowState> = {
                messages: response,
                metadata: updatedMetadata, // Assurer que les métadonnées sont incluses
              };

              // Si c'est la réponse finale, forcer la fin du workflow
              if (isFinal) {
                if (this.debug) {
                  logger.debug(
                    `WorkflowController[Exec:${execId}]: Node[${agentId}] - Final response detected from "${agentId}", ending workflow`
                  );
                }
                outputState.currentAgent = END;
              }
              // Sinon, ajouter l'agent suivant si spécifié
              else if (nextAgent) {
                logger.debug(
                  `WorkflowController[Exec:${execId}]: Node[${agentId}] - Setting next agent to "${nextAgent}" based on result.`
                );
                outputState.currentAgent = nextAgent;
              }

              // Ajouter les appels d'outils si présents
              if (toolCalls.length > 0) {
                logger.debug(
                  `WorkflowController[Exec:${execId}]: Node[${agentId}] - Adding ${toolCalls.length} tool calls to state.`
                );
                outputState.toolCalls = toolCalls;
              }

              if (this.debug) {
                logger.debug(
                  `WorkflowController[Exec:${execId}]: Node[${agentId}] - END`
                );
                logger.debug(
                  `  - Returning next agent: ${outputState.currentAgent || 'router_decision'}`
                );
                logger.debug(`  - Is final: ${isFinal ? 'yes' : 'no'}`);
                logger.debug(
                  `  - New messages: ${outputState.messages?.length || 0}`
                );
                if (outputState.messages && outputState.messages.length > 0) {
                  const newLastMsg =
                    outputState.messages[outputState.messages.length - 1];
                  logger.debug(
                    `  - Last new message type: ${newLastMsg._getType()}, from: ${newLastMsg.additional_kwargs?.from || agentId}, final: ${newLastMsg.additional_kwargs?.final ? 'yes' : 'no'}`
                  );
                }
              }

              return outputState;
            } catch (error) {
              logger.error(
                `WorkflowController[Exec:${execId}]: Node[${agentId}] - ERROR executing agent: ${error}`
              );

              // Créer un message d'erreur
              const errorMessage = new AIMessage({
                content: `Error executing agent "${agentId}": ${error instanceof Error ? error.message : String(error)}`,
                additional_kwargs: {
                  from: agentId,
                  error: true,
                },
              });

              // Si c'est le superviseur qui génère une erreur, il faut éviter la boucle
              // en terminant le workflow
              if (agentId === 'supervisor') {
                logger.debug(
                  `WorkflowController[Exec:${execId}]: Node[${agentId}] - Error in supervisor, forcing END.`
                );
                return {
                  messages: [errorMessage],
                  error: String(error),
                  currentAgent: END, // Forcer la fin pour éviter une boucle
                };
              }

              // Pour les autres agents, revenir au superviseur
              logger.debug(
                `WorkflowController[Exec:${execId}]: Node[${agentId}] - Error in agent, returning to supervisor.`
              );
              return {
                messages: [errorMessage],
                currentAgent: 'supervisor', // Revenir au superviseur en cas d'erreur
                error: String(error),
              };
            }
          }
        );
      }

      // Définir le point d'entrée
      logger.debug(
        `WorkflowController: Setting entry point to ${this.entryPoint}`
      );
      workflow.addEdge(START as any, this.entryPoint as any);

      // Router les transitions en fonction de l'agent actuel
      for (const agentId of Object.keys(this.agents)) {
        // Création du mapping de routage pour cet agent
        const routingMap: Record<string, string | typeof END> = {};

        // Ajouter chaque agent comme destination possible
        for (const targetId of Object.keys(this.agents)) {
          routingMap[targetId] = targetId;
        }

        // Ajouter END comme destination possible
        routingMap[END] = END; // Utiliser la constante END

        // Ajouter les transitions conditionnelles
        logger.debug(
          `WorkflowController: Adding conditional edges from "${agentId}" with router function`
        );
        workflow.addConditionalEdges(
          agentId, // Le nœud source est l'agent actuel
          (state: WorkflowState) => this.router(state), // La fonction qui décide
          routingMap // Le mapping des décisions aux nœuds cibles
        );
      }

      // Compiler le workflow
      logger.debug('WorkflowController: Compiling workflow');
      this.workflow = workflow.compile({
        checkpointer: this.checkpointEnabled ? this.checkpointer : undefined,
      });
      logger.debug('WorkflowController: Workflow compiled successfully');

      this.initialized = true;
      logger.debug('WorkflowController: Initialization complete');
    } catch (error) {
      logger.error(
        `WorkflowController: Failed to initialize workflow: ${error}`
      );
      logger.debug('WorkflowController: Leaving initialization with error');
      throw error;
    }
  }

  /**
   * Route vers le prochain agent ou termine le workflow
   */
  private router(state: WorkflowState): string | typeof END {
    const execId = this.executionId || 'unknown';
    logger.debug(`WorkflowController[Exec:${execId}]: Router - START`);
    logger.debug(`  - Current state agent: ${state.currentAgent}`);
    logger.debug(`  - Iteration count: ${state.iterationCount}`);

    // Maintain agent history
    if (!state.metadata.agentHistory) {
      state.metadata.agentHistory = [];
    }

    // Add current agent to history if not already at END
    if (state.currentAgent && state.currentAgent !== END) {
      state.metadata.agentHistory.push(state.currentAgent);
      logger.debug(
        `  - Updated agent history: ${(state.metadata.agentHistory || []).join(' → ')}`
      );
    }

    // Check max iterations
    if (state.iterationCount >= this.maxIterations) {
      logger.warn(
        `WorkflowController[Exec:${execId}]: Router - Max iterations (${this.maxIterations}) reached, forcing END`
      );
      return END;
    }

    // Ensure we have messages
    if (!state.messages || state.messages.length === 0) {
      logger.warn(
        `WorkflowController[Exec:${execId}]: Router - No messages in state, forcing END`
      );
      return END;
    }

    const lastMessage = state.messages[state.messages.length - 1];
    const history = state.metadata.agentHistory || [];

    // CRITICAL FIX: Check for cycles involving supervisor
    if (state.currentAgent === 'supervisor') {
      const supervisorCount = history.filter(
        (agent: string) => agent === 'supervisor'
      ).length;
      if (supervisorCount > 1) {
        logger.warn(
          `WorkflowController[Exec:${execId}]: Router - Supervisor called multiple times, routing directly to starknet`
        );
        if ('starknet' in this.agents) return 'starknet';
        logger.warn(
          `WorkflowController[Exec:${execId}]: Router - Starknet agent not found after supervisor loop detection, ending.`
        );
        return END;
      }
    }

    // CRITICAL FIX: Direct routing from model-selector to starknet
    if (lastMessage.additional_kwargs?.from === 'model-selector') {
      logger.debug(
        `WorkflowController[Exec:${execId}]: Router - Message from model-selector, routing directly to starknet`
      );

      // NEW: Preserve the original user query in the state
      if (lastMessage.additional_kwargs?.originalUserQuery) {
        // Preserve the original query in the metadata
        state.metadata.originalUserQuery =
          lastMessage.additional_kwargs.originalUserQuery;
        logger.debug(
          `WorkflowController[Exec:${execId}]: Router - Preserved original user query: "${state.metadata.originalUserQuery}"`
        );
      }

      if ('starknet' in this.agents) {
        return 'starknet';
      }
      logger.warn(
        `WorkflowController[Exec:${execId}]: Router - Starknet agent not found after model-selector, ending.`
      );
      return END;
    }

    // Handle tool calls
    if (
      lastMessage instanceof AIMessage &&
      lastMessage.tool_calls &&
      lastMessage.tool_calls.length > 0
    ) {
      if ('tools' in this.agents) {
        logger.debug(
          `WorkflowController[Exec:${execId}]: Router - Routing to tools agent.`
        );
        return 'tools';
      }
    }

    // For simple human messages, go directly to starknet
    if (lastMessage instanceof HumanMessage) {
      const content =
        typeof lastMessage.content === 'string' ? lastMessage.content : '';
      if (
        content.trim().length < 30 ||
        content.startsWith('/') ||
        content.startsWith('!') ||
        content.endsWith('?')
      ) {
        logger.debug(
          `WorkflowController[Exec:${execId}]: Router - Direct routing to starknet for simple query`
        );
        if ('starknet' in this.agents) return 'starknet';
        logger.warn(
          `WorkflowController[Exec:${execId}]: Router - Starknet agent not found for simple query, ending.`
        );
        return END;
      }
    }

    // If already at starknet, end workflow
    if (state.currentAgent === 'starknet') {
      logger.debug(
        `WorkflowController[Exec:${execId}]: Router - Current agent is starknet, ending workflow.`
      );
      return END;
    }

    // Only route to supervisor for complex coordination needs
    if (state.currentAgent !== 'supervisor' && 'supervisor' in this.agents) {
      logger.debug(
        `WorkflowController[Exec:${execId}]: Router - Routing to supervisor for coordination.`
      );
      return 'supervisor';
    }

    // If can't determine next agent, end workflow
    logger.warn(
      `WorkflowController[Exec:${execId}]: Router - Could not determine next agent, forcing END.`
    );
    return END;
  }

  /**
   * Exécute le workflow avec l'entrée donnée
   */
  public async execute(
    input: string | BaseMessage,
    config?: Record<string, any>
  ): Promise<any> {
    this.executionId = crypto.randomUUID().substring(0, 8);
    logger.debug(
      `WorkflowController[Exec:${this.executionId}]: Starting execution`
    );

    // Si un timeout précédent est encore actif, l'effacer
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
      logger.debug(
        `WorkflowController[Exec:${this.executionId}]: Cleared previous timeout`
      );
    }

    try {
      if (!this.initialized) {
        logger.warn(
          'WorkflowController: Workflow not initialized. Call init() first.'
        );
        throw new Error('WorkflowController is not initialized');
      }
      logger.debug(
        `WorkflowController[Exec:${this.executionId}]: Workflow initialized, proceeding...`
      );

      // Convertir l'entrée en BaseMessage si c'est une chaîne
      const message =
        typeof input === 'string' ? new HumanMessage(input) : input;
      logger.debug(
        `WorkflowController[Exec:${this.executionId}]: Input message type: ${message._getType()}`
      );

      // Configurer l'ID de thread si disponible
      const threadId = config?.threadId || this.executionId;
      const runConfig: RunnableConfig = {
        configurable: {
          thread_id: threadId,
        },
        recursionLimit: this.maxIterations * 2, // Limite de récursion plus généreuse
        ...(config || {}), // Fusionner avec la configuration fournie
      };
      logger.debug(
        `WorkflowController[Exec:${this.executionId}]: Using thread ID: ${threadId}`
      );

      // Déterminer l'agent initial
      const initialAgent =
        this.useConditionalEntryPoint && this.entryPointSelector
          ? this.entryPointSelector({
              messages: [message],
              currentAgent: '',
              metadata: { threadId },
              toolCalls: [],
              error: undefined,
              iterationCount: 0,
            })
          : this.entryPoint;
      logger.debug(
        `WorkflowController[Exec:${this.executionId}]: Determined initial agent: ${initialAgent}`
      );

      // Ajouter un timeout amélioré avec nettoyage approprié
      const timeoutPromise = new Promise((_, reject) => {
        this.timeoutId = setTimeout(() => {
          logger.warn(
            `WorkflowController[Exec:${this.executionId}]: Workflow execution TIMED OUT after ${this.workflowTimeout}ms`
          );
          this.timeoutId = null; // Clear timeout ID *before* rejecting
          reject(
            new Error(
              `Workflow execution timed out after ${this.workflowTimeout}ms`
            )
          );
        }, this.workflowTimeout);
      });

      // Exécuter le workflow avec timeout
      logger.debug(
        `WorkflowController[Exec:${this.executionId}]: Invoking workflow with initial state`
      );
      const workflowPromise = this.workflow.invoke(
        {
          messages: [message],
          currentAgent: initialAgent,
          metadata: { threadId }, // Inclure threadId dans les métadonnées initiales
          toolCalls: [],
          error: undefined,
          iterationCount: 0,
        },
        runConfig
      );

      // Attendre le résultat ou le timeout
      const result = await Promise.race([workflowPromise, timeoutPromise]);

      // Nettoyer le timeout si le workflow se termine avant
      if (this.timeoutId) {
        clearTimeout(this.timeoutId);
        this.timeoutId = null;
        logger.debug(
          `WorkflowController[Exec:${this.executionId}]: Workflow finished before timeout, cleared timeout.`
        );
      }

      logger.debug(
        `WorkflowController[Exec:${this.executionId}]: Workflow invocation completed. Result keys: ${Object.keys(result || {}).join(', ')}`
      );

      // Extraire les messages finaux
      const finalMessages = result?.messages || [];
      const lastMessage =
        finalMessages.length > 0
          ? finalMessages[finalMessages.length - 1]
          : null;

      logger.debug(
        `WorkflowController[Exec:${this.executionId}]: Final message type: ${lastMessage?._getType()}, From: ${lastMessage?.additional_kwargs?.from}, Final: ${lastMessage?.additional_kwargs?.final}`
      );

      // Si le dernier message est un message d'erreur système, le lancer
      if (
        lastMessage instanceof AIMessage &&
        lastMessage.additional_kwargs?.error
      ) {
        logger.error(
          `WorkflowController[Exec:${this.executionId}]: Workflow finished with error state: ${lastMessage.additional_kwargs.error}`
        );
        // Tenter de renvoyer un message plus utile que juste l'erreur
        if (
          lastMessage.content &&
          typeof lastMessage.content === 'string' &&
          lastMessage.content.includes('Maximum workflow iterations')
        ) {
          return lastMessage; // Renvoyer le message d'erreur spécifique
        }
        throw new Error(
          `Workflow error: ${lastMessage.additional_kwargs.error} - ${lastMessage.content}`
        );
      }

      // Retourner le dernier message si disponible, sinon le résultat brut
      return lastMessage || result;
    } catch (error: any) {
      logger.error(
        `WorkflowController[Exec:${this.executionId}]: Execution failed: ${error.message || error}`
      );
      if (error.stack) {
        logger.error(`Stack trace: ${error.stack}`);
      }
      // S'assurer que le timeout est nettoyé même en cas d'erreur
      if (this.timeoutId) {
        clearTimeout(this.timeoutId);
        this.timeoutId = null;
        logger.debug(
          `WorkflowController[Exec:${this.executionId}]: Cleared timeout due to error.`
        );
      }
      throw error; // Propager l'erreur
    } finally {
      logger.debug(
        `WorkflowController[Exec:${this.executionId}]: Execution finished`
      );
      this.executionId = null; // Clear execution ID
    }
  }

  /**
   * Réinitialise le workflow
   */
  public async reset(): Promise<void> {
    logger.debug('WorkflowController: Starting reset');
    try {
      if (this.checkpointer) {
        // Réinitialiser le checkpointer
        logger.debug(
          'WorkflowController: Resetting in-memory checkpointer by creating a new instance.'
        );
        // await this.checkpointer.clear(); // Method might not exist
        this.checkpointer = new MemorySaver(); // Re-instantiate instead of clear
      }

      if (this.debug) {
        logger.debug('WorkflowController: Workflow state reset');
      }
      logger.debug('WorkflowController: Reset finished');
    } catch (error) {
      logger.error(`WorkflowController: Error resetting workflow: ${error}`);
      logger.debug('WorkflowController: Reset finished with error');
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
    logger.debug('WorkflowController: Getting state');
    if (!this.checkpointer) {
      logger.debug('WorkflowController: No checkpointer, returning null state');
      return null;
    }

    try {
      // Récupérer l'état depuis le checkpointer
      logger.debug('WorkflowController: Retrieving state from checkpointer');
      // const state = await this.checkpointer.get({}); // Original call
      // const state = await this.checkpointer.get({ configurable: {} }); // Previous attempt
      const state = await this.checkpointer.get({
        configurable: { thread_id: 'dummy_thread_for_get_state' },
      }); // Pass configurable with dummy thread_id
      logger.debug('WorkflowController: State retrieved successfully');
      return state;
    } catch (error) {
      logger.error(
        `WorkflowController: Error getting workflow state: ${error}`
      );
      logger.debug('WorkflowController: Error retrieving state');
      return null;
    }
  }

  /**
   * Définit le nombre maximum d'itérations
   */
  public setMaxIterations(maxIterations: number): void {
    logger.debug(
      `WorkflowController: Setting maxIterations to ${maxIterations}`
    );
    if (maxIterations < 1) {
      logger.warn(
        `Invalid maxIterations value: ${maxIterations}. Must be at least 1.`
      );
      return;
    }
    this.maxIterations = maxIterations;
    if (this.debug) {
      logger.debug(`WorkflowController: maxIterations set to ${maxIterations}`);
    }
  }

  /**
   * Définit un point d'entrée conditionnel pour le workflow
   * @param entryPointSelector Fonction qui détermine le point d'entrée en fonction de l'état
   */
  public setConditionalEntryPoint(
    entryPointSelector: (state: WorkflowState) => string
  ): void {
    logger.debug('WorkflowController: Setting up conditional entry point');
    this.entryPointSelector = entryPointSelector;
  }

  /**
   * Extrait la requête utilisateur originale à partir de l'état du workflow ou des messages
   */
  private extractOriginalUserQuery(state: WorkflowState): string | null {
    // Essayer d'abord d'extraire depuis les métadonnées
    if (state.metadata && state.metadata.originalUserQuery) {
      return state.metadata.originalUserQuery;
    }

    // Sinon, chercher dans les messages
    if (state.messages && state.messages.length > 0) {
      // Chercher d'abord dans les métadonnées des messages
      for (const msg of state.messages) {
        if (msg.additional_kwargs?.originalUserQuery) {
          return msg.additional_kwargs.originalUserQuery;
        }
      }

      // Si pas trouvé, chercher un message utilisateur (HumanMessage)
      for (const msg of state.messages) {
        if (msg instanceof HumanMessage && typeof msg.content === 'string') {
          return msg.content;
        }
      }
    }

    return null;
  }
}
