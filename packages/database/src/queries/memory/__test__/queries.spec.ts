import { Postgres } from '../../../database.js';
import { memory } from '../queries.js';

const db_credentials = {
  host: process.env.POSTGRES_HOST as string,
  port: parseInt(process.env.POSTGRES_PORT!) as number,
  user: process.env.POSTGRES_USER as string,
  password: process.env.POSTGRES_PASSWORD as string,
  database: process.env.POSTGRES_DB as string,
};

beforeAll(async () => {
  await Postgres.connect(db_credentials);
});

afterAll(async () => {
  await Postgres.shutdown();
});

describe('Memory database initialization', () => {
  it('Should create table', async () => {
    await expect(memory.init()).resolves.toBeUndefined();
  });

  it('Should be indempotent', async () => {
    await expect(memory.init()).resolves.toBeUndefined();
  });

  it('Should create embedding index', async () => {
    await memory.init();
    const indexes = await Postgres.query<{ indexname: string }>(
      new Postgres.Query(
        `SELECT indexname FROM pg_indexes WHERE tablename = 'agent_memories' AND indexname = 'agent_memories_embedding_idx'`
      )
    );
    expect(indexes.length).toBe(1);
  });
});

describe('Memory table', () => {
  it('Should handle insertions', async () => {
    const m: memory.Memory = {
      user_id: 'default_user',
      memories_id: 'default_memories_id',
      query: 'query',
      content: 'content',
      embedding: [...Array(384).keys()],
      metadata: {
        timestamp: 'now',
      },
      history: [
        {
          value: 'value',
          timestamp: 'now',
          action: 'UPDATE',
        },
      ],
    };
    await expect(memory.insert_memory(m)).resolves.toBeUndefined();
  });

  it('Should handle updates', async () => {
    const content = 'content2';
    const embedding = [...Array(384).keys()].map((n) => n - 383);
    await expect(
      memory.update_memory(1, content, embedding)
    ).resolves.toBeUndefined();
  });

  it('Should handle retrievals', async () => {
    const m = {
      user_id: 'default_user',
      content: 'content2',
      embedding: [...Array(384).keys()].map((n) => n - 383),
      metadata: {
        timestamp: 'now',
      },
      history: [
        {
          value: 'value',
          action: 'UPDATE',
        },
        {
          value: 'content',
          action: 'UPDATE',
        },
      ],
    };
    await expect(memory.select_memory(1)).resolves.toMatchObject(m);
  });

  it('Should handle invalid retrievals', async () => {
    await expect(memory.select_memory(2)).resolves.toBeUndefined();
  });

  it('Should handle similar retrievals', async () => {
    const embedding = [...Array(384).keys()].map((n) => n - 383);
    const m = {
      id: 1,
      content: 'content2',
      history: [
        {
          value: 'value',
          action: 'UPDATE',
        },
        {
          value: 'content',
          action: 'UPDATE',
        },
      ],
      similarity: 1,
    };
    await expect(
      memory.similar_memory('default_user', embedding, 4)
    ).resolves.toMatchObject([m]);
  });
});
