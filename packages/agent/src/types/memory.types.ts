import { memory } from '@snakagent/database/queries';
import z from 'zod';

/**
 * Individual memory item with immutable structure
 */
export interface MemoryItem {
  readonly step_or_history: StepInfo | HistoryItem;
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

/**
 * Base memory context
 */
export interface MemoryContextBase {
  user_id: string;
  run_id: string;
  created_at: string;
}

/**
 * Semantic memory context
 */
export interface SemanticMemoryContext {
  user_id: string;
  run_id: string;
  fact: string;
  category: string;
}

/**
 * Episodic memory context
 */
export interface EpisodicMemoryContext {
  user_id: string;
  run_id: string;
  content: string;
  sources: Array<string>;
}

/**
 * Episodic memory SQL insert structure
 */
export interface EpisodicMemoryInsertSQL {
  user_id: string;
  run_id: string;
  content: string;
  embedding: Array<number>;
  sources: Array<string>;
}

/**
 * Semantic memory SQL insert structure
 */
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

/**
 * Step information structure
 */
export interface StepInfo {
  stepNumber: number;
  stepName: string;
  description: string;
  type: 'tools' | 'message' | 'human_in_the_loop';
  tools?: StepToolsInfo[];
  message?: MessageInfo;
  status: 'pending' | 'completed' | 'failed';
}

/**
 * History item structure
 */
export interface HistoryItem {
  tools?: HistoryToolsInfo[];
  message?: MessageInfo;
  userquery?: string;
  type: 'tools' | 'message' | 'human_in_the_loop';
  timestamp: number;
}

/**
 * Step tools information
 */
export interface StepToolsInfo {
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

/**
 * History tools information
 */
export interface HistoryToolsInfo {
  result: string;
  metadata?: {
    tool_name: string;
    tool_call_id: string;
    timestamp: string;
  };
}

/**
 * Message information structure
 */
export interface MessageInfo {
  content: string;
  tokens: number;
}

/**
 * Parsed plan structure
 */
export interface ParsedPlan {
  type: 'plan';
  id: string;
  steps: StepInfo[];
  summary: string;
}

/**
 * History structure
 */
export interface History {
  type: 'history';
  id: string;
  items: HistoryItem[];
}

/**
 * Validator response structure
 */
export interface validatorResponse {
  success: boolean;
  results: string[];
}

/**
 * Step response structure
 */
interface StepResponse {
  number: number;
  validated: boolean;
}

/**
 * Validator step response structure
 */
export interface ValidatorStepResponse {
  steps: StepResponse[];
  nextSteps: number;
  isFinal: boolean;
}

/**
 * Zod schemas for memory operations
 */
export const episodicEventSchema = z.object({
  name: z.string().min(1).describe('Event name or identifier'),
  content: z.string().min(1).describe('Detailed description of what happened'),
  source: z
    .array(z.string())
    .optional()
    .default(['conversation'])
    .describe('Source reference or website URL'),
});

export const semanticFactSchema = z.object({
  fact: z.string().min(1).describe('The learned information or insight'),
  category: z.string().optional().default('fact').describe('Type of fact'),
});

export const ltmSchema = z.object({
  episodic: z
    .array(episodicEventSchema)
    .default([])
    .describe('Events and experiences with confidence scoring'),
  semantic: z
    .array(semanticFactSchema)
    .default([])
    .describe('Facts and knowledge learned with confidence scoring'),
});

export type ltmSchemaType = z.infer<typeof ltmSchema>;

export const isPlannerActivateSchema = z.object({
  planner_actived: z
    .boolean()
    .describe('You need to set the state of the planner in a boolean.'),
});

export type isPlannerActivateType = z.infer<typeof isPlannerActivateSchema>;