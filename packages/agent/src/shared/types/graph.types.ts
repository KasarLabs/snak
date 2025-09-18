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

export enum GraphErrorTypeEnum {
  TASK_ERROR = 'task_error',
  TOOL_ERROR = 'tool_error',
  EXECUTION_ERROR = 'execution_error',
  VALIDATION_ERROR = 'validation_error',
  BLOCKED_TASK = 'blocked_task',
  WRONG_NUMBER_OF_TOOLS = 'wrong_number_of_tools',
  UNKNOWN_ERROR = 'unknown_error',
}
export interface GraphErrorType {
  type: GraphErrorTypeEnum;
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
