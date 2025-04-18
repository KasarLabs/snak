import { connect, shutdown } from '../../../database.js';
import { chat } from '../queries.js';

beforeAll(async () => {
  await connect();
});

afterAll(async () => {
  await shutdown();
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
    await expect(chat.select_instructions()).resolves.toEqual([instruction]);
  });
});
