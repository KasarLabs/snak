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

export interface GraphErrorType {
  type:
    | 'task_error'
    | 'tool_error'
    | 'execution_error'
    | 'validation_error'
    | 'blocked_task';
  hasError: boolean;
  message: string;
  source: string;
  timestamp: number;
}

export interface ThoughtsType {
  text: string;
  reasoning: string;
  criticism: string;
  speak: string;
}

export interface ToolCallType {
  tool_call_id: string;
  name: string;
  args: Record<string, any>;
  result?: string;
  status: 'pending' | 'completed' | 'failed' | 'in_progress' | 'waiting';
}

export interface StepType {
  id: string;
  thought: ThoughtsType;
  tool: ToolCallType[];
}

export interface TaskType {
  id: string;
  thought: ThoughtsType;
  task: {
    analysis: string;
    directive: string;
    success_check: string;
  };
  task_verification?: string;
  steps: StepType[];
  status:
    | 'pending'
    | 'completed'
    | 'failed'
    | 'in_progress'
    | 'waiting'
    | 'waiting_validation';
}

export interface TasksType {
  tasks: TaskType[];
}
