import { Postgres } from '../../../database.js';
import { documents } from '../queries.js';

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

describe('Document vectors', () => {
  it('Should search after index creation', async () => {
    await documents.init();
    const insert = new Postgres.Query(
      `INSERT INTO document_vectors (id, document_id, chunk_index, embedding, content, original_name, mime_type)
       VALUES ('1', 'doc1', 0, $1::vector, 'hello', 'orig', 'text/plain')
       ON CONFLICT (id) DO NOTHING`,
      [JSON.stringify([...Array(384).keys()])]
    );
    await Postgres.query(insert);

    const results = await documents.search([...Array(384).keys()]);
    expect(results.length).toBeGreaterThan(0);
  });
});