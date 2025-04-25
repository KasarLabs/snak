// agents/core/baseAgent.ts
import { BaseMessage } from '@langchain/core/messages';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';

/**
 * Interface de base pour tous les agents du système
 */
export interface IAgent {
  /**
   * Identifiant unique de l'agent
   */
  readonly id: string;

  /**
   * Type de l'agent
   */
  readonly type: AgentType;

  /**
   * Initialise l'agent
   */
  init(): Promise<void>;

  /**
   * Exécute une action avec l'agent
   * @param input Entrée à traiter
   * @param config Configuration optionnelle
   */
  execute(input: any, config?: Record<string, any>): Promise<any>;
}

/**
 * Types d'agents disponibles dans le système
 */
export enum AgentType {
  SUPERVISOR = 'supervisor',
  OPERATOR = 'operator',
  MAIN = 'main',
}

/**
 * Interface pour les messages entre agents
 */
export interface AgentMessage {
  from: string;
  to: string;
  content: any;
  metadata?: Record<string, any>;
}

/**
 * Interface pour les agents opérateurs qui utilisent des modèles LLM
 */
export interface IModelAgent extends IAgent {
  /**
   * Obtient le modèle approprié pour une tâche
   */
  getModelForTask(
    messages: BaseMessage[],
    forceModelType?: string
  ): Promise<BaseChatModel>;

  /**
   * Invoque un modèle avec la sélection appropriée
   */
  invokeModel(messages: BaseMessage[], forceModelType?: string): Promise<any>;
}

/**
 * Classe de base abstraite pour tous les agents
 */
export abstract class BaseAgent implements IAgent {
  readonly id: string;
  readonly type: AgentType;

  constructor(id: string, type: AgentType) {
    this.id = id;
    this.type = type;
  }

  abstract init(): Promise<void>;
  abstract execute(input: any, config?: Record<string, any>): Promise<any>;
}
