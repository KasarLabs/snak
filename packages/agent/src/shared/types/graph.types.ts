export enum GraphErrorTypeEnum {
  TASK_ERROR = 'task_error',
  TOOL_ERROR = 'tool_error',
  TASK_ABORTED = 'task_aborted',
  EXECUTION_ERROR = 'execution_error',
  VALIDATION_ERROR = 'validation_error',
  MEMORY_ERROR = 'memory_error',
  MANAGER_ERROR = 'manager_error',
  BLOCKED_TASK = 'blocked_task',
  WRONG_NUMBER_OF_TOOLS = 'wrong_number_of_tools',
  TIMEOUT_ERROR = 'timeout_error',
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
  type: 'tools' | 'human'; // only two types for now
  thought: ThoughtsType;
  tool: ToolCallType[];
}

export type TaskCreatedType = {
  analysis: string;
  directive: string;
  success_check: string;
};

export type TaskStatusType =
  | 'pending'
  | 'completed'
  | 'failed'
  | 'in_progress'
  | 'waiting'
  | 'aborted'
  | 'blocked'
  | 'waiting_human'
  | 'waiting_validation';

export type TaskType = {
  id: string;
  thought: ThoughtsType;
  task?: TaskCreatedType;
  human?: string; // human input if ask_human throw
  request: string;
  task_verification?: string;
  steps: StepType[];  
  status: TaskStatusType;
};

export interface TasksType {
  tasks: TaskType[];
}

export interface UserRequest {
  request: string;
  hitl_threshold?: number;
}

export interface userRequestWithHITL extends UserRequest {
  hitl_threshold: number;
}

export interface TaskVerificationToolOutput {
  taskCompleted: boolean;
  confidenceScore: number;
  reasoning: string;
  missingElements: string[];
  nextActions: string[] | undefined;
  toolCallValidated: boolean;
  timestamp: number;
}

export interface skipValidationType {
  skipValidation: boolean;
  goto: string;
}
