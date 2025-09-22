import { DEFAULT_PROMPT_ID } from '@common/constant/default-database.constant.js';

export const DEFAULT_AGENT_MODEL = {
  provider: 'gemini',
  modelName: 'gemini-2.5-flash',
  temperature: 0.7,
  max_tokens: 4096,
};

export const DEFAULT_AGENT_CONFIG = {
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
    merged_profile: null,
  },
  mode: 'autonomous',
  mcp_servers: {},
  plugins: ['core'],
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
    summarization_threshold: 0.8,
    size_limits: {
      short_term_memory_size: 10,
      max_insert_episodic_size: 50,
      max_insert_semantic_size: 50,
      max_retrieve_memory_size: 20,
    },
    thresholds: {
      insert_semantic_threshold: 0.7,
      insert_episodic_threshold: 0.6,
      retrieve_memory_threshold: 0.5,
      summarization_threshold: 0.8,
    },
    timeouts: {
      retrieve_memory_timeout_ms: 5000,
      insert_memory_timeout_ms: 3000,
    },
    strategy: 'holistic',
  },
  rag: {
    enabled: false,
    top_k: 5,
    embedding_model: 'text-embedding-ada-002',
  },
} as const;
