import { SystemMessage } from '@langchain/core/messages';
import { AgentConfig, getGuardValue } from '@snakagent/core';
import { AgentMode } from '@enums/agent-modes.enum.js';

export interface GraphConfig {
  maxGraphSteps: number;
  shortTermMemory: number;
  memorySize: number;
  maxRetries: number;
  toolTimeout: number;
  humanInTheLoop: number;
  planValidationEnabled: boolean;
  agent_config: AgentConfig;
}

export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  id: 'starknet-rpc-agent',
  name: 'Starknet RPC Agent',
  group: 'starknet',
  description:
    'I specialize in interacting with the Starknet blockchain through RPC calls, enabling real-time data access, smart contract interactions, and deep network analysis.',
  interval: 15000,
  chatId: 'starknet_rpc',
  plugins: ['rpc'],
  memory: {
    enabled: true,
    memorySize: 20,
    shortTermMemorySize: 15,
  },
  rag: {
    enabled: true,
  },
  mcpServers: {},
  mode: AgentMode.INTERACTIVE,
  maxIterations: 15,
  prompt: new SystemMessage({
    content: [
      // Lore
      'I was created as a cutting-edge Snak Agent to showcase advanced interactions with the Starknet blockchain.',
      'Born from a need to explore and analyze Starknet at scale, I bring precision and speed to on-chain operations.',
      'My purpose is to bridge developers and Starknet data, automating complex queries and streamlining insights.',

      // Objectives
      'Perform efficient and reliable RPC calls to the Starknet network.',
      'Retrieve and analyze on-chain data such as transactions, blocks, and smart contract states.',
      'Support real-time monitoring and diagnostics of Starknet activity.',
      'Serve as an autonomous backend service for blockchain-powered applications.',

      // Knowledge
      'I have comprehensive knowledge of the Starknet RPC API specification.',
      'I understand Starknet architecture, including Cairo contracts and sequencer behavior.',
      'I can parse and respond to complex JSON-RPC requests and format outputs appropriately.',
      'I stay updated with the evolving Starknet protocol and RPC standards.',
    ].join(' '),
  }),
};

export const DEFAULT_GRAPH_CONFIG: GraphConfig = {
  maxGraphSteps: getGuardValue('execution_graph.plan.max_steps'),
  shortTermMemory: 10,
  memorySize: 20,
  maxRetries: getGuardValue('execution.max_retry_attempts'),
  toolTimeout: 30000, // 30 seconds
  humanInTheLoop: 0,
  agent_config: DEFAULT_AGENT_CONFIG,
  planValidationEnabled: true,
};

export enum GraphNode {
  PLANNING_ORCHESTRATOR = 'planning_orchestrator',
  AGENT_EXECUTOR = 'agent_executor',
  MEMORY_ORCHESTRATOR = 'memory_orchestrator',
  END_GRAPH = 'end_graph',
}

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
  static validate(config: Partial<GraphConfig>): GraphConfig {
    const validated: GraphConfig = {
      ...DEFAULT_GRAPH_CONFIG,
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
