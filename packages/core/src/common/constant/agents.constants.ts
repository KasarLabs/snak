import {
  AgentConfig,
  MemoryStrategy,
} from '@common/agent/interfaces/agent.interface.js';
import { Agent } from 'http';

/**
 * Agent Selector Configuration
 * Responsible for selecting the appropriate agent based on user queries
 */
export const agentSelectorConfig: AgentConfig.Input = {
  profile: {
    name: 'Agent Selector',
    group: 'system',
    description:
      'Analyzes user queries and selects the most appropriate specialized agent to handle the request',
    contexts: [
      'query analysis',
      'agent routing',
      'task classification',
      'intent detection',
    ],
  },
  graph: {
    max_steps: 5,
    max_iterations: 3,
    max_retries: 2,
    execution_timeout_ms: 30000,
    max_token_usage: 4000,
    model: {
      model_provider: 'gemini',
      model_name: 'gemini-2.5-flash',
      temperature: 0.7,
      max_tokens: 8192,
    },
  },

  memory: {
    ltm_enabled: false,
    strategy: MemoryStrategy.HOLISTIC,
    size_limits: {
      short_term_memory_size: 10,
      max_insert_episodic_size: 10,
      max_insert_semantic_size: 10,
      max_retrieve_memory_size: 10,
      limit_before_summarization: 5000,
    },
    thresholds: {
      insert_semantic_threshold: 0.8,
      insert_episodic_threshold: 0.75,
      retrieve_memory_threshold: 0.4,
      hitl_threshold: 0.85,
    },
    timeouts: {
      retrieve_memory_timeout_ms: 5000,
      insert_memory_timeout_ms: 3000,
    },
  },

  rag: {
    enabled: false,
  },

  mcp_servers: {},
};

/**
 * Supervisor Agent Configuration
 * Coordinates multiple agents, monitors execution, and handles delegation
 */
export const supervisorAgentConfig: AgentConfig.Input = {
  profile: {
    name: 'Supervisor',
    group: 'snak-system',
    description:
      'Oversees multi-agent workflows, delegates tasks, monitors execution, verifies results, and coordinates between specialized agents',
    contexts: [
      'task coordination',
      'workflow management',
      'agent delegation',
      'result verification',
      'error handling',
      'execution monitoring',
    ],
  },
  graph: {
    max_steps: 20,
    max_iterations: 10,
    max_retries: 3,
    execution_timeout_ms: 120000,
    max_token_usage: 16000,
    model: {
      model_provider: 'gemini',
      model_name: 'gemini-2.5-flash',
      temperature: 0.7,
      max_tokens: 8192,
    },
  },

  memory: {
    ltm_enabled: true,
    strategy: MemoryStrategy.CATEGORIZED,
    size_limits: {
      short_term_memory_size: 10,
      max_insert_episodic_size: 10,
      max_insert_semantic_size: 10,
      max_retrieve_memory_size: 10,
      limit_before_summarization: 5000,
    },
    thresholds: {
      insert_semantic_threshold: 0.8,
      insert_episodic_threshold: 0.75,
      retrieve_memory_threshold: 0.4,
      hitl_threshold: 0.85,
    },
    timeouts: {
      retrieve_memory_timeout_ms: 10000,
      insert_memory_timeout_ms: 5000,
    },
  },

  rag: {
    enabled: true,
    top_k: 5,
  },

  mcp_servers: {},
};

export namespace AgentConfigDefaults {
  export const graph = {
    max_steps: 50,
    max_iterations: 50,
    max_retries: 3,
    execution_timeout_ms: 120000,
    max_token_usage: 16000,
    model: {
      model_provider: 'gemini',
      model_name: 'gemini-2.5-flash',
      temperature: 0.7,
      max_tokens: 8192,
    },
  };

  export const memory = {
    ltm_enabled: true,
    strategy: MemoryStrategy.HOLISTIC,
    size_limits: {
      short_term_memory_size: 10,
      max_insert_episodic_size: 20,
      max_insert_semantic_size: 20,
      max_retrieve_memory_size: 20,
      limit_before_summarization: 10000,
    },
    thresholds: {
      insert_semantic_threshold: 0.8,
      insert_episodic_threshold: 0.75,
      retrieve_memory_threshold: 0.4,
      hitl_threshold: 0.85,
    },
    timeouts: {
      retrieve_memory_timeout_ms: 20000,
      insert_memory_timeout_ms: 10000,
    },
  };

  export const rag = {
    enabled: false,
    top_k: 0,
  };

  export const mcp_servers = {};
}
