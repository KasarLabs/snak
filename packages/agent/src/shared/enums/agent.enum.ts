/**
 * Available agent types in the system
 */
export enum AgentType {
  SUPERVISOR = 'supervisor',
  OPERATOR = 'operator',
  SNAK = 'snak',
}

/**
 * Graph execution modes
 */
export enum ExecutionMode {
  PLANNING = 'PLANNING',
  REACTIVE = 'REACTIVE',
  AUTOMATIC = 'AUTOMATIC', // Let the system decide based on query complexity
}

/**
 * Graph node types
 */
export enum GraphNode {
  START = 'start',
  INIT_STATE_VALUE = 'init_state_value',
  TASK_MANAGER = 'task_manager',
  AGENT_EXECUTOR = 'agent_executor',
  MEMORY_ORCHESTRATOR = 'memory_orchestrator',
  TASK_VERIFIER = 'task_verifier',
  END_GRAPH = 'end_graph',
}

/**
 * Task Manager node types
 */
export enum TaskManagerNode {
  CREATE_TASK = 'create_task',
  END = 'end',
}

/**
 * Executor node types
 */
export enum TaskExecutorNode {
  REASONING_EXECUTOR = 'reasoning_executor',
  TOOL_EXECUTOR = 'tool_executor',
  HUMAN = 'human',
  END_EXECUTOR_GRAPH = 'end_executor_graph',
  END = 'end',
}

/**
 * Memory node types
 */
export enum TaskMemoryNode {
  LTM_MANAGER = 'ltm_manager',
  RETRIEVE_MEMORY = 'retrieve_memory',
  END_MEMORY_GRAPH = 'end_memory_graph',
  END = 'end',
}

/**
 * Task verifier node types
 */
export enum TaskVerifierNode {
  TASK_VERIFIER = 'task_verifier',
  TASK_SUCCESS_HANDLER = 'task_success_handler',
  TASK_FAILURE_HANDLER = 'task_failure_handler',
  TASK_UPDATER = 'task_updater',
  END_VERIFIER_GRAPH = 'end_verifier_graph',
  END = 'end',
}
