import { DatabaseCredentials } from '../../../utils/database.js';
import { Postgres } from '../../../database.js';
import { chatPoolQueries, chatPool } from '../queries.js';

const databasecredentials: DatabaseCredentials = {
  user: process.env.POSTGRES_USER as string,
  host: process.env.POSTGRES_HOST as string,
  database: process.env.POSTGRES_DB as string,
  password: process.env.POSTGRES_PASSWORD as string,
  port: parseInt(process.env.POSTGRES_PORT || '5454'),
};

let _chat = new chatPoolQueries(databasecredentials);
beforeAll(async () => {
  await _chat.connect(
    process.env.POSTGRES_USER as string,
    process.env.POSTGRES_HOST as string,
    process.env.POSTGRES_DB as string,
    process.env.POSTGRES_PASSWORD as string,
    parseInt(process.env.POSTGRES_PORT || '5454')
  );
});

afterAll(async () => {
  await _chat.shutdown();
});

describe('Chat-pool database initialization', () => {
  it('Should create tables', async () => {
    await expect(_chat.init()).resolves.toBeUndefined();
  });

  it('Should be indempotent', async () => {
    await expect(_chat.init()).resolves.toBeUndefined();
  });

  it('Should handle empty retrievals', async () => {
    await expect(_chat.select_instructions()).resolves.toEqual([]);
  });

  it('Should handle insertions', async () => {
    await expect(
      _chat.insert_instruction('Lorem Ipsum dolor si amet')
    ).resolves.toBeUndefined();
  });

  it('Should handle retrievals', async () => {
    const instruction: chatPool.Instruction = {
      instruction: 'Lorem Ipsum dolor si amet',
    };
    await expect(_chat.select_instructions()).resolves.toMatchObject([
      instruction,
    ]);
  });
});
