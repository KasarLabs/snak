/**
 * Configuration-related types
 */

/**
 * Model timeout configurations in milliseconds
 */
export interface ModelTimeouts {
  DEFAULT_MODEL_TIMEOUT: number;
  EXTENDED_MODEL_TIMEOUT: number;
  VALIDATION_TIMEOUT: number;
}

/**
 * Memory processing thresholds
 */
export interface MemoryThresholds {
  SUMMARIZATION_THRESHOLD: number;
  MAX_MESSAGE_TOKENS: number;
  DEFAULT_STM_SIZE: number;
  MAX_LTM_RETRIEVAL: number;
}

/**
 * Model selection constants
 */
export interface DefaultModels {
  INTERACTIVE_MODEL: string;
  DEFAULT_TEMPERATURE: number;
}

/**
 * Token estimation constants
 */
export interface TokenEstimation {
  CHARS_PER_TOKEN: number;
  WORD_TOKEN_DIVISOR: number;
}

/**
 * Validation and retry constants
 */
export interface ValidationLimits {
  MAX_VALIDATION_RETRIES: number;
  DEFAULT_MAX_GRAPH_STEPS: number;
}

/**
 * String manipulation constants
 */
export interface StringLimits {
  CONTENT_PREVIEW_LENGTH: number;
  MAX_PLAN_DESCRIPTION_LENGTH: number;
  MAX_STEP_DESCRIPTION_LENGTH: number;
}
