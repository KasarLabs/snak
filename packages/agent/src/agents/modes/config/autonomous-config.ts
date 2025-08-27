export interface AutonomousConfig {
  maxGraphSteps: number;
  shortTermMemory: number;
  memorySize: number;
  maxRetries: number;
  toolTimeout: number;
  humanInTheLoop: boolean;
  planValidationEnabled: boolean;
}

export const DEFAULT_AUTONOMOUS_CONFIG: AutonomousConfig = {
  maxGraphSteps: 100,
  shortTermMemory: 7,
  memorySize: 20,
  maxRetries: 3,
  toolTimeout: 30000, // 30 seconds
  humanInTheLoop: false,
  planValidationEnabled: true,
};

export enum GraphNode {
  PLANNING_ORCHESTRATOR = 'planning_orchestrator',
  AGENT_EXECUTOR = 'agent_executor',
  MEMORY_ORCHESTRATOR = 'memory_orchestrator',
  END_GRAPH = 'end_graph',
}

export enum PlannerNode {
  CREATE_INITIAL_PLAN = 'create_initial_plan',
  PLAN_REVISION = 'plan_revision',
  EVOLVE_FROM_HISTORY = 'evolve_from_history',
  END_PLANNER_GRAPH = 'end_planner_graph',
  PLANNER_VALIDATOR = 'planner_validator',
  END = 'end',
}

export enum ExecutorNode {
  REASONING_EXECUTOR = 'reasoning_executor',
  TOOL_EXECUTOR = 'tool_executor',
  EXECUTOR_VALIDATOR = 'executor_validator',
  HUMAN = 'human',
  END_EXECUTOR_GRAPH = 'end_executor_graph',
  END = 'end',
}

export enum MemoryNode {
  STM_MANAGER = 'stm_manager',
  LTM_MANAGER = 'ltm_manager',
  RETRIEVE_MEMORY = 'retrieve_memory',
  END_MEMORY_GRAPH = 'end_memory_graph',
  END = 'end',
}

export class ConfigValidator {
  static validate(config: Partial<AutonomousConfig>): AutonomousConfig {
    const validated: AutonomousConfig = {
      ...DEFAULT_AUTONOMOUS_CONFIG,
      ...config,
    };

    if (validated.maxGraphSteps <= 0) {
      throw new Error('maxGraphSteps must be greater than 0');
    }
    if (validated.shortTermMemory <= 0) {
      throw new Error('shortTermMemory must be greater than 0');
    }
    if (validated.memorySize <= 0) {
      throw new Error('memorySize must be greater than 0');
    }
    if (validated.maxRetries < 0) {
      throw new Error('maxRetries must be non-negative');
    }
    if (validated.toolTimeout <= 0) {
      throw new Error('toolTimeout must be greater than 0');
    }

    return validated;
  }
}
