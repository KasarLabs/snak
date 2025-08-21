import {
  AIMessage,
  AIMessageChunk,
  BaseMessage,
  HumanMessage,
} from '@langchain/core/messages';
import { Annotation } from '@langchain/langgraph';
import { AgentConfig } from '@snakagent/core';

export interface AgentReturn {
  app: any;
  agent_config: AgentConfig;
}

// ============================================
// TYPES & INTERFACES
// ============================================

// ============================================
// IMPROVED MEMORY INTERFACES
// ============================================

/**
 * Individual memory item with immutable structure
 */
export interface MemoryItem {
  readonly content: string;
  readonly memories_id: string;
  readonly timestamp: number;
  readonly metadata?: Record<string, any>;
}

/**
 * Circular buffer for STM with O(1) operations
 */
export interface STMContext {
  readonly items: readonly (MemoryItem | null)[];
  readonly maxSize: number;
  readonly head: number; // Next insert position
  readonly size: number; // Current number of items
  readonly totalInserted: number; // Total items ever inserted
}

/**
 * Long-term memory context with metadata
 */
export interface LTMContext {
  readonly context: string;
  readonly retrievedAt: number;
  readonly relevanceScore: number;
  readonly memoryIds: readonly string[];
  readonly isStale: boolean;
}

/**
 * Comprehensive memory state - IMMUTABLE
 */
export interface Memories {
  readonly stm: STMContext;
  readonly ltm: LTMContext;
  readonly isProcessing: boolean;
  readonly lastError?: {
    readonly type: string;
    readonly message: string;
    readonly timestamp: number;
  };
}

/**
 * Memory operation result for safe operations
 */
export interface MemoryOperationResult<T> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: string;
  readonly timestamp: number;
}

export interface ToolInfo {
  description: string;
  required: string;
  expected_result: string;
  result: string;
}

export interface StepInfo {
  stepNumber: number;
  stepName: string;
  description: string;
  type: 'tools' | 'message' | 'human_in_the_loop';
  tools?: ToolInfo[];
  result: {
    content: string;
    tokens: number;
  };
  status: 'pending' | 'completed' | 'failed';
}

export interface validatorResponse {
  success: boolean;
  results: string[];
}

export interface ParsedPlan {
  steps: StepInfo[];
  summary: string;
}

interface StepResponse {
  number: number;
  validated: boolean;
}

export interface ValidatorStepResponse {
  steps: StepResponse[];
  nextSteps: number;
  isFinal: boolean;
}

export enum Agent {
  START = 'start',
  PLANNER = 'planner',
  EXEC_VALIDATOR = 'exec_validator',
  PLANNER_VALIDATOR = 'planner_validator',
  MEMORY_MANAGER = 'memory_manager',
  EXECUTOR = 'executor',
  MODEL_SELECTOR = 'model_selector',
  ADAPTIVE_PLANNER = 'adaptive_planner',
  TOOLS = 'tools',
  SUMMARIZE = 'summarize',
  HUMAN = 'human',
}

export type PLANNER_ORCHESTRATOR =
  | 'planner'
  | 'planner_validator'
  | 'evolve_from_history'
  | 'plan_revision';

export type AGENT_EXECUTOR = 'exec_validator' | 'executor';

export type MEMORY_ORCHESTRATOR = 'memory_manager';

export interface AgentKwargs {
  error: boolean;
  from: Agent;
  validated?: boolean;
}

export type TypedBaseMessage<
  T extends Record<string, any> = Record<string, any>,
> = BaseMessage & {
  additional_kwargs: T;
};

export type TypedAiMessage<
  T extends Record<string, any> = Record<string, any>,
> = AIMessage & {
  additional_kwargs: T;
};

export type TypedAiMessageChunk<
  T extends Record<string, any> = Record<string, any>,
> = AIMessageChunk & {
  additional_kwargs: T;
};

export type TypedHumanMessage<
  T extends Record<string, any> = Record<string, any>,
> = HumanMessage & {
  additional_kwargs: T;
};

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

export const InteractiveGraphState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
  last_agent: Annotation<Agent>({
    reducer: (x, y) => y,
    default: () => Agent.PLANNER,
  }),
  memories: Annotation<string>({
    reducer: (x, y) => y,
    default: () => '',
  }),
  rag: Annotation<string>({
    reducer: (x, y) => y,
    default: () => '',
  }),
  plan: Annotation<ParsedPlan>({
    reducer: (x, y) => y,
    default: () => ({
      steps: [],
      summary: '',
    }),
  }),
  currentStepIndex: Annotation<number>({
    reducer: (x, y) => y,
    default: () => 0,
  }),
  retry: Annotation<number>({
    reducer: (x, y) => y,
    default: () => 0,
  }),
  currentGraphStep: Annotation<number>({
    reducer: (x, y) => y,
    default: () => 0,
  }),
});
