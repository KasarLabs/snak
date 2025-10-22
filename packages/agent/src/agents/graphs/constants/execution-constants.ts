/**
 * Execution constants for agent modes
 * Centralizes magic numbers and configuration values for better maintainability
 */

import { getGuardValue } from '@snakagent/core';

/**
 * Model timeout configurations in milliseconds
 */
export const MODEL_TIMEOUTS = {
  /** Standard timeout for model inference operations */
  DEFAULT_MODEL_TIMEOUT: 45000, // 45 seconds
  /** Extended timeout for complex reasoning tasks */
  EXTENDED_MODEL_TIMEOUT: 120000, // 2 minutes
  /** Quick timeout for validation operations */
  VALIDATION_TIMEOUT: 15000, // 15 seconds
} as const;

/**
 * Memory processing thresholds
 */
export const MEMORY_THRESHOLDS = {
  /** Token count threshold for content summarization */
  SUMMARIZATION_THRESHOLD: 2000,
  /** Maximum token count for message content */
  MAX_MESSAGE_TOKENS: getGuardValue('execution.max_message_tokens'),
  /** Default STM capacity */
  DEFAULT_STM_SIZE: 5,
  /** Maximum LTM retrieval count */
  MAX_LTM_RETRIEVAL: 20,
} as const;

/**
 * Model selection constants
 */
export const DEFAULT_MODELS = {
  /** Default model for interactive ReAct execution */
  INTERACTIVE_MODEL: 'gpt-4o-mini',
  /** Temperature setting for controlled generation */
  DEFAULT_TEMPERATURE: 0.1,
} as const;

/**
 * Token estimation constants
 */
export const TOKEN_ESTIMATION = {
  /** Average characters per token (rough estimate) */
  CHARS_PER_TOKEN: 4,
  /** Divisor for word-based token calculation */
  WORD_TOKEN_DIVISOR: 2,
} as const;

/**
 * Validation and retry constants
 */
export const VALIDATION_LIMITS = {
  /** Maximum retry attempts for failed validations */
  MAX_VALIDATION_RETRIES: getGuardValue('execution.max_retry_attempts'),
  /** Default graph execution step limit */
  DEFAULT_MAX_GRAPH_STEPS: 100,
} as const;

/**
 * String manipulation constants
 */
export const STRING_LIMITS = {
  /** Maximum length for content preview in logs */
  CONTENT_PREVIEW_LENGTH: getGuardValue('execution.max_content_preview_length'),
  /** Maximum length for plan descriptions */
  MAX_PLAN_DESCRIPTION_LENGTH: getGuardValue('execution.max_summary_length'),
  /** Maximum length for step descriptions */
  MAX_STEP_DESCRIPTION_LENGTH: getGuardValue(
    'execution.max_description_length'
  ),
} as const;

export const MAX_SUPERVISOR_MESSAGE = 30;
