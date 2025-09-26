import { AgentType } from '@enums/agent.enum.js';
import { Annotation } from '@langchain/langgraph';
import { ChunkOutput } from './streaming.types.js';

/**
 * Base interface for all agents
 */
/**
 * Base interface for all agents in the system
 */
export interface IAgent {
  /**
   * Unique identifier of the agent
   */
  readonly id: string;

  /**
   * Type of agent
   */
  readonly type: AgentType;
  readonly description?: string;

  /**
   * Initializes the agent
   */
  init(): Promise<void>;

  /**
   * Executes an action with the agent
   * @param input Input to process
   * @param config Optional configuration
   */
  execute(
    input: any,
    isInterrupted?: boolean,

    config?: Record<string, any>
  ): Promise<any> | AsyncGenerator<ChunkOutput>;

  /**
   * Optional method to clean up resources used by the agent.
   */
  dispose?: () => Promise<void>;
}

/**
 * Orchestrator types for different agent operations
 */
export type TASK_MANAGER_ORCHESTRATOR =
  | 'task_manager'
  | 'task_manager_validator'
  | 'evolve_from_history'
  | 'plan_revision';

export type AGENT_EXECUTOR = 'exec_validator' | 'executor';

export type MEMORY_ORCHESTRATOR = 'memory_manager';

/**
 * Interactive configurable annotation for LangGraph
 */
export const InteractiveConfigurableAnnotation = Annotation.Root({
  max_graph_steps: Annotation<number>({
    reducer: (x, y) => y,
    default: () => 15,
  }),
  short_term_memory: Annotation<number>({
    reducer: (x, y) => y,
    default: () => 15,
  }),
  memorySize: Annotation<number>({
    reducer: (x, y) => y,
    default: () => 20,
  }),
});
