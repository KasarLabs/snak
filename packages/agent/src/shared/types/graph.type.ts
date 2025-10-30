export enum GraphErrorTypeEnum {
  TASK_ERROR = 'task_error',
  TOOL_ERROR = 'tool_error',
  TASK_ABORTED = 'task_aborted',
  EXECUTION_ERROR = 'execution_error',
  VALIDATION_ERROR = 'validation_error',
  MEMORY_ERROR = 'memory_error',
  MANAGER_ERROR = 'manager_error',
  BLOCK_TASK = 'block_task',
  WRONG_NUMBER_OF_TOOLS = 'wrong_number_of_tools',
  TIMEOUT_ERROR = 'timeout_error',
  UNKNOWN_ERROR = 'unknown_error',
  STRUCTURED_OUTPUT_ERROR = 'structured_output_error',
  PARSING_ERROR = 'parsing_error',
  INVALID_TOOL_CALL = 'invalid_tool_call',
  MAX_RETRY_REACHED = 'max_retry_reached',
  MODEL_ERROR = 'model_error',
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
  id: string;
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
  isSavedInMemory: boolean;
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
  isHumanTask: boolean;
  status: TaskStatusType;
};

export interface TasksType {
  tasks: TaskType[];
}

export interface UserRequest {
  request: string;
  thread_id?: string;
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

export type StateErrorHandlerType = {
  currentGraphStep: number;
  additionalUpdates?: Record<string, any>;
};
