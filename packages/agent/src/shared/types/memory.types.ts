import { memory } from '@snakagent/database/queries';
import z from 'zod';
import { BaseMessage } from '@langchain/core/messages';
import { getGuardValue } from '@snakagent/core';

/**
 * Individual memory item structure~
 */
export interface MemoryItem {
  message: BaseMessage[];
  readonly taskId: string;
  readonly stepId: string;
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
  task_id: string;
  step_id: string;
  fact: string;
  category: string;
}

/**
 * Episodic memory context
 */
export interface EpisodicMemoryContext {
  user_id: string;
  run_id: string;
  task_id: string;
  step_id: string;
  content: string;
  sources: Array<string>;
}

/**
 * Episodic memory SQL insert structure
 */
export interface EpisodicMemoryInsertSQL {
  user_id: string;
  run_id: string;
  task_id: string;
  step_id: string;
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
  task_id: string;
  step_id: string;
  fact: string;
  embedding: Array<number>;
  category: string; // WOULD BE BETTER AS ENUM
}

/**
 * Comprehensive memory state - IMMUTABLE
 */
export interface Memories {
  stm: STMContext;
  ltm: LTMContext;
  isProcessing: boolean;
  lastError?: {
    type: string;
    message: string;
    timestamp: number;
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
 * Zod schemas for memory operations
 */
export const episodicEventSchema = z
  .object({
    name: z
      .string()
      .min(getGuardValue('memory.episodic_event.name.min_length'))
      .max(getGuardValue('memory.episodic_event.name.max_length'))
      .describe('Event name or identifier'),
    content: z
      .string()
      .min(getGuardValue('memory.episodic_event.min_content_length'))
      .max(getGuardValue('memory.episodic_event.max_content_length'))
      .describe('Detailed description of what happened'),
    source: z
      .array(z.string())
      .min(getGuardValue('memory.episodic_event.min_source'))
      .max(getGuardValue('memory.episodic_event.max_source'))
      .default(['conversation'])
      .describe('Source reference or website URL'),
  })
  .strict();

export const semanticFactSchema = z.object({
  fact: z
    .string()
    .min(getGuardValue('memory.semantic_fact.fact.min_length'))
    .max(getGuardValue('memory.semantic_fact.fact.max_length'))
    .describe('The learned information or insight'),
  category: z
    .string()
    .min(getGuardValue('memory.semantic_fact.category.min_length'))
    .max(getGuardValue('memory.semantic_fact.category.max_length'))
    .default('fact')
    .describe('Type of fact'),
});

export const ltmSchema = z
  .object({
    episodic: z
      .array(episodicEventSchema)
      .default([])
      .describe('Events and experiences with confidence scoring'),
    semantic: z
      .array(semanticFactSchema)
      .default([])
      .describe('Facts and knowledge learned with confidence scoring'),
  })
  .strict();

export function createLtmSchemaMemorySchema(
  maxEpisodic: number,
  maxSemantic: number
) {
  return z
    .object({
      episodic: z
        .array(episodicEventSchema)
        .max(maxEpisodic)
        .default([])
        .describe('Events and experiences with confidence scoring'),
      semantic: z
        .array(semanticFactSchema)
        .max(maxSemantic)
        .default([])
        .describe('Facts and knowledge learned with confidence scoring'),
    })
    .strict();
}

export type ltmSchemaType = z.infer<typeof ltmSchema>;

export const retrieveMemoryFromContentSchema = z
  .object({
    content: z
      .string()
      .min(1)
      .describe('The content to search for relevant memories.'),
    topK: z
      .number()
      .int()
      .min(getGuardValue('memory.retrieve.top_k.min'))
      .max(getGuardValue('memory.retrieve.top_k.max'))
      .default(5)
      .describe('Number of top relevant memories to retrieve.'),
    threshold: z
      .number()
      .max(getGuardValue('memory.retrieve.max_threshold'))
      .default(0.75)
      .describe(
        'Similarity threshold (0 to 1) for filtering relevant memories.'
      ),
  })
  .strict();

export type retrieveMemoryFromContentType = z.infer<
  typeof retrieveMemoryFromContentSchema
>;

export const retrieveMemoryFromStepId = z
  .object({
    step_id: z
      .string()
      .describe(
        'The unique identifier of a step used as an index to retrieve associated memories from the database.'
      ),
    limit: z
      .number()
      .max(getGuardValue('memory.retrieve.max_limit'))
      .default(10)
      .describe('Maximum number of memories to retrieve.'),
  })
  .strict();

export type retrieveMemoryFromStepIdType = z.infer<
  typeof retrieveMemoryFromStepId
>;
export const retrieveMemoryFromTaskId = z
  .object({
    task_id: z
      .string()
      .describe(
        'The unique identifier of a task used as an index to retrieve associated memories from the database.'
      ),
    limit: z
      .number()
      .max(getGuardValue('memory.retrieve.max_limit'))
      .default(10)
      .describe('Maximum number of memories to retrieve.'),
  })
  .strict();

export type retrieveMemoryFromTaskIdType = z.infer<
  typeof retrieveMemoryFromTaskId
>;
