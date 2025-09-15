/**
 * Agent operation modes
 */
export enum AgentMode {
  INTERACTIVE = 'interactive',
  AUTONOMOUS = 'autonomous',
  HYBRID = 'hybrid',
}

/**
 * Available agent types in the system
 */
export enum AgentType {
  SUPERVISOR = 'supervisor',
  OPERATOR = 'operator',
  SNAK = 'snak',
}

/**
 * Maps mode enum values to their string representations
 */
export const AGENT_MODES = {
  [AgentMode.AUTONOMOUS]: 'autonomous',
  [AgentMode.HYBRID]: 'hybrid',
  [AgentMode.INTERACTIVE]: 'interactive',
};

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
  PLANNING_ORCHESTRATOR = 'planning_orchestrator',
  AGENT_EXECUTOR = 'agent_executor',
  MEMORY_ORCHESTRATOR = 'memory_orchestrator',
  TASK_VERIFIER = 'task_verifier',
  TASK_UPDATER = 'task_updater',
  END_GRAPH = 'end_graph',
}

/**
 * Planner node types
 */
export enum PlannerNode {
  CREATE_INITIAL_HISTORY = 'create_initial_history',
  CREATE_INITIAL_PLAN = 'create_initial_plan',
  PLAN_REVISION = 'plan_revision',
  EVOLVE_FROM_HISTORY = 'evolve_from_history',
  END_PLANNER_GRAPH = 'end_planner_graph',
  PLANNER_VALIDATOR = 'planner_validator',
  GET_PLANNER_STATUS = 'get_planner_status',
  END = 'end',
}

/**
 * Executor node types
 */
export enum ExecutorNode {
  REASONING_EXECUTOR = 'reasoning_executor',
  TOOL_EXECUTOR = 'tool_executor',
  HUMAN = 'human',
  END_EXECUTOR_GRAPH = 'end_executor_graph',
  END = 'end',
}

/**
 * Memory node types
 */
export enum MemoryNode {
  LTM_MANAGER = 'ltm_manager',
  RETRIEVE_MEMORY = 'retrieve_memory',
  END_MEMORY_GRAPH = 'end_memory_graph',
  END = 'end',
}

/**
 * Task verifier node types
 */
export enum VerifierNode {
  TASK_VERIFIER = 'task_verifier',
  TASK_SUCCESS_HANDLER = 'task_success_handler',
  TASK_FAILURE_HANDLER = 'task_failure_handler',
  END_VERIFIER_GRAPH = 'end_verifier_graph',
  END = 'end',
}
