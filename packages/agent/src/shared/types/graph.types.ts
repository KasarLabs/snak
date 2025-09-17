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

export type ReturnTypeCheckPlanorHistory =
  | { type: 'step'; item: StepInfo }
  | { type: 'history'; item: HistoryItem | null };

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
