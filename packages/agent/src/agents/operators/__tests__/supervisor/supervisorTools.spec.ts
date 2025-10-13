import {
  getSupervisorConfigTools,
  getSupervisorToolCategories,
} from '../../supervisor/supervisorTools.js';
import { AgentConfig, MemoryStrategy } from '@snakagent/core';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';

describe('supervisorTools', () => {
  const mockAgentConfig: AgentConfig.Runtime = {
    id: 'test-agent-id',
    user_id: 'test-user-id',
    profile: {
      name: 'test-agent',
      group: 'test-group',
      description: 'test description',
      contexts: [],
    },
    plugins: [],
    mcp_servers: {},
    prompts: {
      task_executor_prompt: 'test executor prompt',
      task_manager_prompt: 'test manager prompt',
      task_verifier_prompt: 'test verifier prompt',
      task_memory_manager_prompt: 'test memory manager prompt',
    },
    graph: {
      max_steps: 10,
      max_iterations: 5,
      max_retries: 3,
      execution_timeout_ms: 30000,
      max_token_usage: 1000,
      model: {} as BaseChatModel,
    },
    memory: {
      ltm_enabled: true,
      strategy: MemoryStrategy.CATEGORIZED,
      size_limits: {
        short_term_memory_size: 100,
        max_insert_episodic_size: 50,
        max_insert_semantic_size: 50,
        max_retrieve_memory_size: 100,
        limit_before_summarization: 200,
      },
      thresholds: {
        insert_semantic_threshold: 0.7,
        insert_episodic_threshold: 0.7,
        retrieve_memory_threshold: 0.7,
        hitl_threshold: 0.8,
      },
      timeouts: {
        retrieve_memory_timeout_ms: 5000,
        insert_memory_timeout_ms: 5000,
      },
    },
    rag: {
      enabled: false,
      top_k: 5,
    },
  };

  it('returns all supervisor configuration tools', () => {
    const tools = getSupervisorConfigTools(mockAgentConfig);

    expect(Array.isArray(tools)).toBe(true);
    expect(tools.map((tool) => tool.name)).toEqual(
      expect.arrayContaining(['create_agent', 'list_agents'])
    );
  });

  it('groups tools by supervisor categories', () => {
    const categories = getSupervisorToolCategories(mockAgentConfig);

    expect(Object.keys(categories)).toEqual(
      expect.arrayContaining(['create', 'read', 'update', 'delete', 'list'])
    );

    expect(categories.create).toHaveLength(1);
    expect(categories.list).toHaveLength(1);
  });
});
