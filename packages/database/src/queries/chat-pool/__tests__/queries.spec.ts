import { Postgres } from '../../../database.js';
import { chat } from '../queries.js';

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

describe('Chat-pool database initialization', () => {
  it('Should create tables', async () => {
    await expect(chat.init()).resolves.toBeUndefined();
  });

  it('Should be indempotent', async () => {
    await expect(chat.init()).resolves.toBeUndefined();
  });

  it('Should handle empty retrievals', async () => {
    await expect(chat.select_instructions()).resolves.toEqual([]);
  });

  it('Should handle insertions', async () => {
    await expect(
      chat.insert_instruction('Lorem Ipsum dolor si amet')
    ).resolves.toBeUndefined();
  });

  it('Should handle retrievals', async () => {
    const instruction: chat.Instruction = {
      instruction: 'Lorem Ipsum dolor si amet',
    };
    await expect(chat.select_instructions()).resolves.toMatchObject([
      instruction,
    ]);
  });
});
