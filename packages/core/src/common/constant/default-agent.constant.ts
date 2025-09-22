import { AgentConfig, AgentMode, MemoryStrategy } from '@common/agent.js';
import { DEFAULT_PROMPT_ID } from '@common/constant/default-database.constant.js';

export const DEFAULT_AGENT_MODEL = {
  provider: 'gemini',
  modelName: 'gemini-2.5-flash',
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
  mode: AgentMode.AUTONOMOUS,
  mcpServers: {},
  plugins: [],
  prompts: {
    id: DEFAULT_PROMPT_ID,
  },
  graph: {
    maxSteps: 100,
    maxIterations: 10,
    maxRetries: 3,
    executionTimeoutMs: 300000,
    maxTokenUsage: 100000,
    model: DEFAULT_AGENT_MODEL,
  },
  memory: {
    ltmEnabled: true,
    summarizationThreshold: 0.8,
    sizeLimits: {
      maxInsertEpisodicSize: 10,
      maxInsertSemanticSize: 10,
      maxRetrieveMemorySize: 10,
      shortTermMemorySize: 5,
    },
    thresholds: {
      summarizationThreshold: 0.8,
      insertEpisodicThreshold: 0.7,
      insertSemanticThreshold: 0.7,
      retrieveMemoryThreshold: 0.7,
    },
    timeouts: {
      insertMemoryTimeoutMs: 5000,
      retrieveMemoryTimeoutMs: 5000,
    },
    strategy: MemoryStrategy.CATEGORIZED,
  },
  rag: {
    enabled: false,
    topK: 5,
    embeddingModel: 'text-embedding-ada-002',
  },
};
