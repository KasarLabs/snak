import { Postgres } from '../../../database.js';
import { memoryQueries, memory } from '../queries.js';
import { DatabaseCredentials } from '../../../utils/database.js';

const databasecredentials: DatabaseCredentials = {
  user: process.env.POSTGRES_USER as string,
  host: process.env.POSTGRES_HOST as string,
  database: process.env.POSTGRES_DB as string,
  password: process.env.POSTGRES_PASSWORD as string,
  port: parseInt(process.env.POSTGRES_PORT || '5454'),
};

let _memory = new memoryQueries(databasecredentials);

beforeAll(async () => {
  await _memory.connect(
    process.env.POSTGRES_USER as string,
    process.env.POSTGRES_HOST as string,
    process.env.POSTGRES_DB as string,
    process.env.POSTGRES_PASSWORD as string,
    parseInt(process.env.POSTGRES_PORT || '5454')
  );
});

afterAll(async () => {
  await _memory.shutdown();
});

describe('Memory database initialization', () => {
  it('Should create table', async () => {
    await expect(_memory.init()).resolves.toBeUndefined();
  });

  it('Should be indempotent', async () => {
    await expect(_memory.init()).resolves.toBeUndefined();
  });
});

describe('Memory table', () => {
  it('Should handle insertions', async () => {
    const m: memory.Memory = {
      user_id: 'default_user',
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
    await expect(_memory.insert_memory(m)).resolves.toBeUndefined();
  });

  it('Should handle updates', async () => {
    const content = 'content2';
    const embedding = [...Array(384).keys()].map((n) => n - 383);
    await expect(
      _memory.update_memory(1, content, embedding)
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
    await expect(_memory.select_memory(1)).resolves.toMatchObject(m);
  });

  it('Should handle invalid retrievals', async () => {
    await expect(_memory.select_memory(2)).resolves.toBeUndefined();
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
      _memory.similar_memory('default_user', embedding)
    ).resolves.toMatchObject([m]);
  });
});
