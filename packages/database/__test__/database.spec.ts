import { Postgres, DatabaseCredentials } from '../src/database.js';
import { DatabaseError } from '../src/error.js';

const db_credentials: DatabaseCredentials = {
  host: process.env.POSTGRES_HOST as string,
  port: parseInt(process.env.POSTGRES_PORT!) as number,
  user: process.env.POSTGRES_USER as string,
  password: process.env.POSTGRES_PASSWORD as string,
  database: process.env.POSTGRES_DB as string,
};

interface Agent {
  id: string;
  name: string;
  group: string;
  description: string;
  lore: string[];
  objectives: string[];
  knowledge: string[];
  system_prompt?: string;
  interval: number;
  plugins: string[];
  memory: {
    enabled: boolean;
    short_term_memory_size: number;
    memory_size: number;
  };
  rag: {
    enabled: boolean;
    embedding_model?: string;
  };
  mode: string;
  max_iterations: number;
  mcpServers: Record<string, any>;
  avatar_image?: Buffer;
  avatar_mime_type?: string;
}

interface Message {
  id: number;
  agent_id: string;
  event: string;
  run_id: string;
  thread_id: string;
  checkpoint_id: string;
  from: string;
  content?: string;
  created_at: Date;
}

interface EpisodicMemory {
  id: number;
  user_id: string;
  run_id: string;
  content: string;
  embedding: number[];
  sources: string[];
  access_count: number;
  created_at: Date;
  updated_at: Date;
}

beforeAll(async () => {
  await Postgres.connect(db_credentials);
  await cleanupTestData();
});

afterAll(async () => {
  await cleanupTestData();
  await Postgres.shutdown();
});

async function cleanupTestData(): Promise<void> {
  const cleanupQueries = [
    'DELETE FROM agent_iterations WHERE 1=1',
    'DELETE FROM thread_id WHERE 1=1',
    'DELETE FROM message WHERE 1=1',
    "DELETE FROM episodic_memories WHERE user_id LIKE 'test_%'",
    "DELETE FROM semantic_memories WHERE user_id LIKE 'test_%'",
    "DELETE FROM agents WHERE name LIKE 'Test_%'",
    'DROP TABLE IF EXISTS users CASCADE',
    'DROP TABLE IF EXISTS job_details CASCADE',
    'DROP TABLE IF EXISTS employees CASCADE',
  ];

  for (const query of cleanupQueries) {
    try {
      await Postgres.query(new Postgres.Query(query));
    } catch (error) {
      // Ignore errors for tables that don't exist
    }
  }
}

describe('Database Connection & Configuration', () => {
  it('should connect to database successfully', async () => {
    interface ConnectionTest {
      state: string;
    }
    const q = new Postgres.Query(
      'SELECT state FROM pg_stat_activity WHERE datname = $1;',
      [process.env.POSTGRES_DB!]
    );
    const result = await Postgres.query<ConnectionTest>(q);
    expect(result).toContainEqual({ state: 'active' });
  });

  it('should handle invalid credentials gracefully', async () => {
    const invalidCredentials: DatabaseCredentials = {
      ...db_credentials,
      password: 'invalid_password',
    };

    await Postgres.shutdown();
    await expect(Postgres.connect(invalidCredentials)).rejects.toThrow();
    await Postgres.connect(db_credentials);
  });

  it('should verify required extensions are installed', async () => {
    interface Extension {
      extname: string;
      extversion: string;
    }
    const q = new Postgres.Query(
      'SELECT extname, extversion FROM pg_extension WHERE extname IN ($1, $2)',
      ['uuid-ossp', 'vector']
    );
    const extensions = await Postgres.query<Extension>(q);

    expect(extensions).toHaveLength(2);
    expect(extensions.find((ext) => ext.extname === 'uuid-ossp')).toBeDefined();
    expect(extensions.find((ext) => ext.extname === 'vector')).toBeDefined();
  });

  it('should verify custom types exist', async () => {
    interface TypeInfo {
      typname: string;
      typtype: string;
    }
    const q = new Postgres.Query(
      'SELECT typname, typtype FROM pg_type WHERE typname IN ($1, $2, $3)',
      ['memory', 'rag', 'model']
    );
    const types = await Postgres.query<TypeInfo>(q);

    expect(types).toHaveLength(3);
    expect(types.every((type) => type.typtype === 'c')).toBe(true);
  });
});

describe('Agent Table Operations', () => {
  const testAgent = {
    name: 'Test_Agent_1',
    group: 'test_group',
    description: 'A test agent for unit testing',
    lore: ['Test story 1', 'Test story 2'],
    objectives: ['Test objective 1', 'Test objective 2'],
    knowledge: ['Test knowledge 1', 'Test knowledge 2'],
    system_prompt: 'You are a test agent',
    interval: 10,
    plugins: ['test-plugin-1', 'test-plugin-2'],
    mode: 'interactive',
    max_iterations: 20,
    mcpServers: { testServer: { url: 'test://server' } },
  };

  it('should create agent with default values', async () => {
    const q = new Postgres.Query(
      `INSERT INTO agents (name, description) 
       VALUES ($1, $2) RETURNING id, name, "group", memory, rag, mode, max_iterations`,
      ['Test_Basic_Agent', 'Basic test agent']
    );

    const [agent] = await Postgres.query<Agent>(q);
    expect(agent.name).toBe('Test_Basic_Agent');
    expect(agent.group).toBe('default_group');
    expect(agent.memory.enabled).toBe(false);
    expect(agent.memory.short_term_memory_size).toBe(5);
    expect(agent.memory.memory_size).toBe(20);
    expect(agent.rag.enabled).toBe(false);
    expect(agent.mode).toBe('interactive');
    expect(agent.max_iterations).toBe(15);
  });

  it('should create agent with all fields populated', async () => {
    const q = new Postgres.Query(
      `INSERT INTO agents (
        name, "group", description, lore, objectives, knowledge, 
        system_prompt, interval, plugins, memory, rag, mode, max_iterations, "mcpServers"
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, ROW($10, $11, $12)::memory, 
                 ROW($13, $14)::rag, $15, $16, $17) 
       RETURNING *`,
      [
        testAgent.name,
        testAgent.group,
        testAgent.description,
        testAgent.lore,
        testAgent.objectives,
        testAgent.knowledge,
        testAgent.system_prompt,
        testAgent.interval,
        testAgent.plugins,
        true,
        10,
        50, // memory fields
        true,
        'text-embedding-ada-002', // rag fields
        testAgent.mode,
        testAgent.max_iterations,
        JSON.stringify(testAgent.mcpServers),
      ]
    );

    const [agent] = await Postgres.query<Agent>(q);
    expect(agent.name).toBe(testAgent.name);
    expect(agent.group).toBe(testAgent.group);
    expect(agent.lore).toEqual(testAgent.lore);
    expect(agent.objectives).toEqual(testAgent.objectives);
    expect(agent.knowledge).toEqual(testAgent.knowledge);
    expect(agent.memory.enabled).toBe(true);
    expect(agent.rag.enabled).toBe(true);
  });

  it('should update agent fields', async () => {
    const createQ = new Postgres.Query(
      'INSERT INTO agents (name, description) VALUES ($1, $2) RETURNING id',
      ['Test_Update_Agent', 'Agent to update']
    );
    const [{ id }] = await Postgres.query<{ id: string }>(createQ);

    const updateQ = new Postgres.Query(
      `UPDATE agents SET 
        description = $2,
        memory = ROW($3, $4, $5)::memory,
        rag = ROW($6, $7)::rag
       WHERE id = $1 
       RETURNING description, memory, rag`,
      [id, 'Updated description', true, 15, 100, true, 'custom-embedding-model']
    );

    const [updated] = await Postgres.query<Agent>(updateQ);
    expect(updated.description).toBe('Updated description');
    expect(updated.memory.enabled).toBe(true);
    expect(updated.memory.short_term_memory_size).toBe(15);
    expect(updated.rag.embedding_model).toBe('custom-embedding-model');
  });

  it('should delete agent and cascade to related tables', async () => {
    const createQ = new Postgres.Query(
      'INSERT INTO agents (name, description) VALUES ($1, $2) RETURNING id',
      ['Test_Delete_Agent', 'Agent to delete']
    );
    const [{ id }] = await Postgres.query<{ id: string }>(createQ);

    const createThreadQ = new Postgres.Query(
      'INSERT INTO thread_id (agent_id, name, thread_id) VALUES ($1, $2, $3)',
      [id, 'test_thread', 'thread_123']
    );
    await Postgres.query(createThreadQ);

    const deleteQ = new Postgres.Query('DELETE FROM agents WHERE id = $1', [
      id,
    ]);
    await Postgres.query(deleteQ);

    const checkQ = new Postgres.Query(
      'SELECT COUNT(*) as count FROM agents WHERE id = $1',
      [id]
    );
    const [{ count }] = await Postgres.query<{ count: string }>(checkQ);
    expect(parseInt(count)).toBe(0);

    const checkThreadQ = new Postgres.Query(
      'SELECT COUNT(*) as count FROM thread_id WHERE agent_id = $1',
      [id]
    );
    const [{ count: threadCount }] = await Postgres.query<{ count: string }>(
      checkThreadQ
    );
    expect(parseInt(threadCount)).toBe(0);
  });

  it('should test delete_all_agents function', async () => {
    await Postgres.query(
      new Postgres.Query(
        'INSERT INTO agents (name, description) VALUES ($1, $2), ($3, $4)',
        ['Test_Agent_A', 'Agent A', 'Test_Agent_B', 'Agent B']
      )
    );

    interface DeleteResult {
      deleted_count: number;
      message: string;
    }
    const deleteQ = new Postgres.Query('SELECT * FROM delete_all_agents()');
    const [result] = await Postgres.query<DeleteResult>(deleteQ);

    expect(result.deleted_count).toBeGreaterThanOrEqual(2);
    expect(result.message).toContain('agent(s) supprimé(s) avec succès');
  });
});

describe('Message Table Operations', () => {
  let testAgentId: string;

  beforeEach(async () => {
    const q = new Postgres.Query(
      'INSERT INTO agents (name, description) VALUES ($1, $2) RETURNING id',
      ['Test_Message_Agent', 'Agent for message testing']
    );
    const [{ id }] = await Postgres.query<{ id: string }>(q);
    testAgentId = id;
  });

  it('should insert and retrieve messages', async () => {
    const insertQ = new Postgres.Query(
      `INSERT INTO message (agent_id, event, run_id, thread_id, checkpoint_id, "from", content)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        testAgentId,
        'user_input',
        'run_123',
        'thread_456',
        'checkpoint_789',
        'user',
        'Hello, agent!',
      ]
    );

    const [message] = await Postgres.query<Message>(insertQ);
    expect(message.agent_id).toBe(testAgentId);
    expect(message.event).toBe('user_input');
    expect(message.content).toBe('Hello, agent!');
    expect(message.from).toBe('user');
  });

  it('should handle messages without content', async () => {
    const insertQ = new Postgres.Query(
      `INSERT INTO message (agent_id, event, run_id, thread_id, checkpoint_id, "from")
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        testAgentId,
        'state_change',
        'run_124',
        'thread_457',
        'checkpoint_790',
        'system',
      ]
    );

    const [message] = await Postgres.query<Message>(insertQ);
    expect(message.event).toBe('state_change');
    expect(message.content).toBeNull();
    expect(message.from).toBe('system');
  });

  it('should query messages by thread_id', async () => {
    const threadId = 'test_thread_search';
    const insertQueries = [
      new Postgres.Query(
        `INSERT INTO message (agent_id, event, run_id, thread_id, checkpoint_id, "from", content)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          testAgentId,
          'user_input',
          'run_1',
          threadId,
          'cp_1',
          'user',
          'Message 1',
        ]
      ),
      new Postgres.Query(
        `INSERT INTO message (agent_id, event, run_id, thread_id, checkpoint_id, "from", content)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          testAgentId,
          'agent_response',
          'run_1',
          threadId,
          'cp_2',
          'agent',
          'Response 1',
        ]
      ),
    ];

    await Postgres.transaction(insertQueries);

    const searchQ = new Postgres.Query(
      'SELECT * FROM message WHERE thread_id = $1 ORDER BY id',
      [threadId]
    );
    const messages = await Postgres.query<Message>(searchQ);

    expect(messages).toHaveLength(2);
    expect(messages[0].content).toBe('Message 1');
    expect(messages[1].content).toBe('Response 1');
  });
});

describe('Memory Table Operations', () => {
  const testUserId = 'test_user_123';
  const testRunId = '550e8400-e29b-41d4-a716-446655440000';

  it('should insert episodic memory with embedding', async () => {
    const embedding = Array.from({ length: 384 }, () => Math.random());
    const insertQ = new Postgres.Query(
      `INSERT INTO episodic_memories (user_id, run_id, content, embedding, sources)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [
        testUserId,
        testRunId,
        'User asked about weather',
        JSON.stringify(embedding),
        ['conversation_log'],
      ]
    );

    const [memory] = await Postgres.query<EpisodicMemory>(insertQ);
    expect(memory.user_id).toBe(testUserId);
    expect(memory.content).toBe('User asked about weather');
    expect(memory.sources).toEqual(['conversation_log']);
    expect(memory.access_count).toBe(0);
  });

  it('should update access_count when memory is retrieved', async () => {
    const embedding = Array.from({ length: 384 }, () => Math.random());
    const insertQ = new Postgres.Query(
      `INSERT INTO episodic_memories (user_id, run_id, content, embedding)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [testUserId, testRunId, 'Memory to access', JSON.stringify(embedding)]
    );

    const [{ id }] = await Postgres.query<{ id: number }>(insertQ);

    const updateQ = new Postgres.Query(
      'UPDATE episodic_memories SET access_count = access_count + 1 WHERE id = $1 RETURNING access_count',
      [id]
    );
    const [{ access_count }] = await Postgres.query<{ access_count: number }>(
      updateQ
    );
    expect(access_count).toBe(1);
  });

  it('should query memories by similarity (mock test)', async () => {
    const searchEmbedding = Array.from({ length: 384 }, () => Math.random());
    const insertQ = new Postgres.Query(
      `INSERT INTO episodic_memories (user_id, run_id, content, embedding) VALUES 
       ($1, $2, $3, $4), ($1, $2, $5, $6)`,
      [
        testUserId,
        testRunId,
        'Memory about cats',
        JSON.stringify(searchEmbedding),
        'Memory about dogs',
        JSON.stringify(Array.from({ length: 384 }, () => Math.random())),
      ]
    );
    await Postgres.query(insertQ);

    const searchQ = new Postgres.Query(
      `SELECT id, content, embedding <=> $2::vector as distance 
       FROM episodic_memories 
       WHERE user_id = $1 
       ORDER BY embedding <=> $2::vector 
       LIMIT 5`,
      [testUserId, JSON.stringify(searchEmbedding)]
    );

    const memories = await Postgres.query<{
      id: number;
      content: string;
      distance: number;
    }>(searchQ);
    expect(memories.length).toBeGreaterThan(0);
    expect(memories[0].distance).toBeDefined();
  });
});

describe('Custom Types Operations', () => {
  it('should work with memory composite type', async () => {
    const q = new Postgres.Query(
      `SELECT ROW(true, 10, 100)::memory as memory_config,
       (ROW(true, 10, 100)::memory).enabled as memory_enabled,
       (ROW(true, 10, 100)::memory).short_term_memory_size as short_term_size`
    );

    interface MemoryTest {
      memory_config: {
        enabled: boolean;
        short_term_memory_size: number;
        memory_size: number;
      };
      memory_enabled: boolean;
      short_term_size: number;
    }

    const [result] = await Postgres.query<MemoryTest>(q);
    expect(result.memory_enabled).toBe(true);
    expect(result.short_term_size).toBe(10);
  });

  it('should work with rag composite type', async () => {
    const q = new Postgres.Query(
      `SELECT ROW(true, 'text-embedding-ada-002')::rag as rag_config,
       (ROW(true, 'text-embedding-ada-002')::rag).enabled as rag_enabled,
       (ROW(true, 'text-embedding-ada-002')::rag).embedding_model as model_name`
    );

    interface RagTest {
      rag_config: { enabled: boolean; embedding_model: string };
      rag_enabled: boolean;
      model_name: string;
    }

    const [result] = await Postgres.query<RagTest>(q);
    expect(result.rag_enabled).toBe(true);
    expect(result.model_name).toBe('text-embedding-ada-002');
  });

  it('should work with model composite type', async () => {
    const q = new Postgres.Query(
      `SELECT ROW('openai', 'gpt-4', 'Advanced AI model')::model as model_config,
       (ROW('openai', 'gpt-4', 'Advanced AI model')::model).provider as provider_name`
    );

    interface ModelTest {
      model_config: {
        provider: string;
        model_name: string;
        description: string;
      };
      provider_name: string;
    }

    const [result] = await Postgres.query<ModelTest>(q);
    expect(result.provider_name).toBe('openai');
  });
});

describe('Transaction Handling & Error Scenarios', () => {
  it('should handle successful transactions', async () => {
    const t = [
      new Postgres.Query(
        `CREATE TABLE test_transaction_1(
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL
        );`
      ),
      new Postgres.Query(
        `INSERT INTO test_transaction_1(name) VALUES ('test1'), ('test2');`
      ),
      new Postgres.Query(
        `CREATE TABLE test_transaction_2(
          id SERIAL PRIMARY KEY,
          ref_id INT REFERENCES test_transaction_1(id),
          value INT
        );`
      ),
    ];

    const result = await Postgres.transaction(t);
    expect(result).toEqual([]);

    const checkQ = new Postgres.Query(
      'SELECT COUNT(*) as count FROM test_transaction_1'
    );
    const [{ count }] = await Postgres.query<{ count: string }>(checkQ);
    expect(parseInt(count)).toBe(2);
  });

  it('should rollback failed transactions', async () => {
    const t = [
      new Postgres.Query(
        'CREATE TABLE test_rollback(id SERIAL PRIMARY KEY, name VARCHAR(10));'
      ),
      new Postgres.Query('INSERT INTO test_rollback(name) VALUES ($1);', [
        'valid',
      ]),
      new Postgres.Query('INSERT INTO test_rollback(name) VALUES ($1);', [
        'this_name_is_way_too_long_and_will_fail',
      ]),
    ];

    await expect(Postgres.transaction(t)).rejects.toThrow();

    const checkQ = new Postgres.Query(
      `SELECT COUNT(*) as count FROM information_schema.tables 
       WHERE table_name = 'test_rollback' AND table_schema = 'public'`
    );
    const [{ count }] = await Postgres.query<{ count: string }>(checkQ);
    expect(parseInt(count)).toBe(0);
  });

  it('should handle database connection errors', async () => {
    await Postgres.shutdown();

    const q = new Postgres.Query('SELECT 1');
    await expect(Postgres.query(q)).rejects.toThrow(
      'Connection pool not initialized'
    );

    await Postgres.connect(db_credentials);
  });

  it('should handle SQL syntax errors', async () => {
    const q = new Postgres.Query('INVALID SQL SYNTAX HERE');
    await expect(Postgres.query(q)).rejects.toBeInstanceOf(DatabaseError);
  });

  it('should handle constraint violations', async () => {
    await Postgres.query(
      new Postgres.Query(
        'CREATE TABLE test_constraints(id SERIAL PRIMARY KEY, unique_field VARCHAR(50) UNIQUE)'
      )
    );

    await Postgres.query(
      new Postgres.Query(
        'INSERT INTO test_constraints(unique_field) VALUES ($1)',
        ['unique_value']
      )
    );

    const duplicateQ = new Postgres.Query(
      'INSERT INTO test_constraints(unique_field) VALUES ($1)',
      ['unique_value']
    );
    await expect(Postgres.query(duplicateQ)).rejects.toThrow();
  });
});

describe('Performance & Stress Testing', () => {
  it('should handle large batch inserts efficiently', async () => {
    await Postgres.query(
      new Postgres.Query(
        'CREATE TABLE test_performance(id SERIAL PRIMARY KEY, data TEXT, created_at TIMESTAMP DEFAULT NOW())'
      )
    );

    const batchSize = 1000;
    const values = Array.from(
      { length: batchSize },
      (_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`
    ).join(',');
    const params = Array.from({ length: batchSize }, (_, i) => [
      `data_${i}`,
      new Date(),
    ]).flat();

    const startTime = Date.now();
    await Postgres.query(
      new Postgres.Query(
        `INSERT INTO test_performance(data, created_at) VALUES ${values}`,
        params
      )
    );
    const endTime = Date.now();

    expect(endTime - startTime).toBeLessThan(5000);

    const countQ = new Postgres.Query(
      'SELECT COUNT(*) as count FROM test_performance'
    );
    const [{ count }] = await Postgres.query<{ count: string }>(countQ);
    expect(parseInt(count)).toBe(batchSize);
  });

  it('should handle concurrent transactions', async () => {
    await Postgres.query(
      new Postgres.Query(
        'CREATE TABLE test_concurrent(id SERIAL PRIMARY KEY, counter INT DEFAULT 0)'
      )
    );

    await Postgres.query(
      new Postgres.Query('INSERT INTO test_concurrent(id) VALUES (1)')
    );

    const concurrentTransactions = Array.from({ length: 10 }, () =>
      Postgres.transaction([
        new Postgres.Query(
          'UPDATE test_concurrent SET counter = counter + 1 WHERE id = 1'
        ),
      ])
    );

    await Promise.all(concurrentTransactions);

    const resultQ = new Postgres.Query(
      'SELECT counter FROM test_concurrent WHERE id = 1'
    );
    const [{ counter }] = await Postgres.query<{ counter: number }>(resultQ);
    expect(counter).toBe(10);
  });
});

describe('Integration Tests - Complex Multi-table Operations', () => {
  it('should create complete agent workflow', async () => {
    const agentData = {
      name: 'Test_Integration_Agent',
      description: 'Full integration test agent',
      objectives: ['Complete integration test'],
      memory: true,
      rag: true,
    };

    const createAgentQ = new Postgres.Query(
      `INSERT INTO agents (name, description, objectives, memory, rag)
       VALUES ($1, $2, $3, ROW($4, 5, 20)::memory, ROW($5, 'test-embedding')::rag)
       RETURNING id`,
      [
        agentData.name,
        agentData.description,
        agentData.objectives,
        agentData.memory,
        agentData.rag,
      ]
    );
    const [{ id: agentId }] = await Postgres.query<{ id: string }>(
      createAgentQ
    );

    const createThreadQ = new Postgres.Query(
      'INSERT INTO thread_id (agent_id, name, thread_id) VALUES ($1, $2, $3) RETURNING id',
      [agentId, 'integration_thread', 'thread_integration_123']
    );
    await Postgres.query<{ id: string }>(createThreadQ);

    const createMessagesQ = new Postgres.Query(
      `INSERT INTO message (agent_id, event, run_id, thread_id, checkpoint_id, "from", content) VALUES
       ($1, 'user_input', 'run_integration', 'thread_integration_123', 'cp_1', 'user', 'Hello'),
       ($1, 'agent_response', 'run_integration', 'thread_integration_123', 'cp_2', 'agent', 'Hi there!')`,
      [agentId]
    );
    await Postgres.query(createMessagesQ);

    const embedding = Array.from({ length: 384 }, () => Math.random());
    const createMemoryQ = new Postgres.Query(
      `INSERT INTO episodic_memories (user_id, run_id, content, embedding)
       VALUES ($1, $2, $3, $4)`,
      [
        'integration_user',
        agentId,
        'Integration test conversation',
        JSON.stringify(embedding),
      ]
    );
    await Postgres.query(createMemoryQ);

    const verifyQ = new Postgres.Query(
      `
      SELECT 
        a.name as agent_name,
        COUNT(DISTINCT t.id) as thread_count,
        COUNT(DISTINCT m.id) as message_count,
        COUNT(DISTINCT em.id) as memory_count
      FROM agents a
      LEFT JOIN thread_id t ON a.id = t.agent_id
      LEFT JOIN message m ON a.id = m.agent_id
      LEFT JOIN episodic_memories em ON a.id::text = em.run_id
      WHERE a.id = $1
      GROUP BY a.id, a.name
    `,
      [agentId]
    );

    interface IntegrationResult {
      agent_name: string;
      thread_count: string;
      message_count: string;
      memory_count: string;
    }

    const [result] = await Postgres.query<IntegrationResult>(verifyQ);
    expect(result.agent_name).toBe(agentData.name);
    expect(parseInt(result.thread_count)).toBe(1);
    expect(parseInt(result.message_count)).toBe(2);
    expect(parseInt(result.memory_count)).toBe(1);
  });

  it('should handle agent deletion with full cascade', async () => {
    const createAgentQ = new Postgres.Query(
      'INSERT INTO agents (name, description) VALUES ($1, $2) RETURNING id',
      ['Test_Cascade_Agent', 'Agent for cascade testing']
    );
    const [{ id: agentId }] = await Postgres.query<{ id: string }>(
      createAgentQ
    );

    await Postgres.transaction([
      new Postgres.Query(
        'INSERT INTO thread_id (agent_id, name, thread_id) VALUES ($1, $2, $3)',
        [agentId, 'cascade_thread', 'thread_cascade_123']
      ),
      new Postgres.Query(
        'INSERT INTO message (agent_id, event, run_id, thread_id, checkpoint_id, "from") VALUES ($1, $2, $3, $4, $5, $6)',
        [
          agentId,
          'test_event',
          'run_cascade',
          'thread_cascade_123',
          'cp_cascade',
          'system',
        ]
      ),
      new Postgres.Query('INSERT INTO agent_iterations (data) VALUES ($1)', [
        JSON.stringify({ agent_id: agentId, test_data: 'cascade_test' }),
      ]),
    ]);

    const deleteAgentQ = new Postgres.Query(
      'DELETE FROM agents WHERE id = $1',
      [agentId]
    );
    await Postgres.query(deleteAgentQ);

    const verifyDeletionQueries = [
      new Postgres.Query('SELECT COUNT(*) as count FROM agents WHERE id = $1', [
        agentId,
      ]),
      new Postgres.Query(
        'SELECT COUNT(*) as count FROM thread_id WHERE agent_id = $1',
        [agentId]
      ),
      new Postgres.Query(
        'SELECT COUNT(*) as count FROM message WHERE agent_id = $1',
        [agentId]
      ),
    ];

    for (const query of verifyDeletionQueries) {
      const [{ count }] = await Postgres.query<{ count: string }>(query);
      expect(parseInt(count)).toBe(0);
    }
  });
});
