import {
  AIMessage,
  AIMessageChunk,
  BaseMessage,
  HumanMessage,
} from '@langchain/core/messages';
import { Annotation } from '@langchain/langgraph';
import { AgentConfig } from '@snakagent/core';
import { memory } from '@snakagent/database/queries';
import z from 'zod';

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
  readonly stepinfo: StepInfo;
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
  items: memory.Similarity[];
  episodic_size: number;
  semantic_size: number;
  merge_size: number;
}

export interface MemoryContextBase {
  user_id: string;
  run_id: string;
  created_at: string;
}
export interface SemanticMemoryContext {
  user_id: string;
  run_id: string;
  fact: string;
  category: string;
}

export interface EpisodicMemoryContext {
  user_id: string;
  run_id: string;
  content: string;
  sources: Array<string>;
}

export interface EpisodicMemoryInsertSQL {
  user_id: string;
  run_id: string;
  content: string;
  embedding: Array<number>;
  sources: Array<string>;
}

export interface SemanticMemoryInsertSQL {
  user_id: string;
  run_id: string;
  fact: string;
  embedding: Array<number>;
  category: 'preference' | 'fact' | 'skill' | 'relationship';
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
  metadata?: {
    tool_name: string;
    tool_call_id: string;
    timestamp: string;
  };
}

export interface MessageInfo {
  content: string;
  tokens: number;
}

export interface StepInfo {
  stepNumber: number;
  stepName: string;
  description: string;
  type: 'tools' | 'message' | 'human_in_the_loop';
  tools?: ToolInfo[];
  message: MessageInfo;
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

export const episodicEventSchema = z.object({
  name: z.string().min(1).describe('Event name or identifier'),
  content: z.string().min(1).describe('Detailed description of what happened'),
  source: z
    .array(z.string())
    .optional()
    .default(['conversation'])
    .describe('Source reference or website URL'),
});
// Enhanced semantic fact schema with confidence and source
export const semanticFactSchema = z.object({
  fact: z.string().min(1).describe('The learned information or insight'),
  category: z.string().optional().default('fact').describe('Type of fact'),
});

// Main enhanced LTM schema
export const ltmSchema = z.object({
  // Episodic memory - array of events with confidence
  episodic: z
    .array(episodicEventSchema)
    .default([])
    .describe('Events and experiences with confidence scoring'),

  // Semantic memory - array of facts with confidence
  semantic: z
    .array(semanticFactSchema)
    .default([])
    .describe('Facts and knowledge learned with confidence scoring'),
});

export type ltmSchemaType = z.infer<typeof ltmSchema>;

export const test = z.object({
  asset_type: z.enum(['Asset', 'Contract']).describe(''),
  asset_content: z.string().describe(''),
});

export const getAllowanceSchema = z.object({
  ownerAddress: z
    .string()
    .describe('The starknet address of the account owner of the tokens'),
  spenderAddress: z
    .string()
    .describe(
      'The starknet address of the account allowed to spend the tokens'
    ),
  asset: test.describe('Asset details'),
});
