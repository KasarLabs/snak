/**
 * Graph-related types and interfaces
 */

/**
 * Graph execution modes
 */
export interface GraphConfig {
  maxSteps?: number;
  timeout?: number;
}

/**
 * Graph node execution result
 */
export interface GraphNodeResult {
  success: boolean;
  data?: any;
  error?: string;
  timestamp: number;
}

/**
 * Graph execution context
 */
export interface GraphExecutionContext {
  currentStep: number;
  maxSteps: number;
  startTime: number;
  metadata?: Record<string, any>;
}