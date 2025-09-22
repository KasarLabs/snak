import {
  AgentConfig,
  MemoryStrategy,
  ModelConfig,
} from '@common/agent.js';
import { DEFAULT_PROMPT_ID } from '@common/constant/default-database.constant.js';

export const DEFAULT_AGENT_MODEL: ModelConfig = {
  provider: 'gemini',
  model_name: 'gemini-2.5-flash',
  temperature: 0.7,
  max_tokens: 4096,
};

export const DEFAULT_AGENT_CONFIG: AgentConfig.Input = {
  name: 'Default System Agent',
  group: 'system',
  profile: {
    description: 'Default system agent for basic operations',
    group: 'system',
    lore: ['System agent', 'Default configuration'],
    objectives: [
      'Provide basic agent functionality',
      'Serve as fallback agent',
    ],
    knowledge: ['System operations', 'Basic agent capabilities'],
  },
  mcp_servers: {},
  plugins: [],
  prompts: {
    id: DEFAULT_PROMPT_ID,
  },
  graph: {
    max_steps: 100,
    max_iterations: 10,
    max_retries: 3,
    execution_timeout_ms: 300000,
    max_token_usage: 100000,
    model: DEFAULT_AGENT_MODEL,
  },
  memory: {
    ltm_enabled: true,
    size_limits: {
      max_insert_episodic_size: 10,
      max_insert_semantic_size: 10,
      max_retrieve_memory_size: 10,
      short_term_memory_size: 5,
      limit_before_summarization: 100,
    },
    thresholds: {
      hitl_threshold: 0.8,
      insert_episodic_threshold: 0.7,
      insert_semantic_threshold: 0.7,
      retrieve_memory_threshold: 0.7,
    },
    timeouts: {
      insert_memory_timeout_ms: 5000,
      retrieve_memory_timeout_ms: 5000,
    },
    strategy: MemoryStrategy.CATEGORIZED,
  },
  rag: {
    enabled: false,
    top_k: 5,
    embedding_model: 'text-embedding-ada-002',
  },
};
