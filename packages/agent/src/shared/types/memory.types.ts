import { memory } from '@snakagent/database/queries';
import z from 'zod';
import { HistoryItem, StepInfo } from './graph.types.js';
import { getGuardValue } from '@snakagent/core';

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
 * Zod schemas for memory operations
 */
export const episodicEventSchema = z.object({
  name: z
    .string()
    .min(getGuardValue('memory.episodic_event.min_name_length'))
    .max(getGuardValue('memory.episodic_event.max_name_length'))
    .describe('Event name or identifier'),
  content: z
    .string()
    .min(getGuardValue('memory.episodic_event.min_content_length'))
    .max(getGuardValue('memory.episodic_event.max_content_length'))
    .describe('Detailed description of what happened'),
  source: z
    .array(z.string())
    .max(getGuardValue('memory.episodic_event.max_source'))
    .optional()
    .default(['conversation'])
    .describe('Source reference or website URL'),
});

export const semanticFactSchema = z.object({
  fact: z
    .string()
    .min(getGuardValue('memory.sementic_fact.fact.min_length'))
    .max(getGuardValue('memory.sementic_fact.fact.max_length'))
    .describe('The learned information or insight'),
  category: z
    .string()
    .max(getGuardValue('memory.sementic_fact.category.max_length'))
    .optional()
    .default('fact')
    .describe('Type of fact'),
});

export const ltmSchema = z.object({
  episodic: z
    .array(episodicEventSchema)
    .max(getGuardValue('memory.ltm.max_episodic_event_size'))
    .default([])
    .describe('Events and experiences with confidence scoring'),
  semantic: z
    .array(semanticFactSchema)
    .max(getGuardValue('memory.ltm.max_semantic_fact_size'))
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
