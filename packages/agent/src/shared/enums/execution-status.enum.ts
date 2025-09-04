/**
 * Execution status enums
 */

/**
 * Step execution status
 */
export enum StepStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

/**
 * Memory operation status
 */
export enum MemoryStatus {
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  ERROR = 'error',
}
