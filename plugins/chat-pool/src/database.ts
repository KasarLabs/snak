import { Database } from 'sqlite3';
import { promisify } from 'util';

interface ChatInstruction {
  id: number;
  instruction: string;
  created_at: string;
}

class ChatDatabase {
  private db: Database | null = null;
  private dbRun: ((sql: string, params?: any[]) => Promise<any>) | null = null;
  private dbGet: ((sql: string, params?: any[]) => Promise<any>) | null = null;
  private dbAll: ((sql: string, params?: any[]) => Promise<any[]>) | null = null;

  async init(): Promise<void> {
    if (this.db) {
      return;
    }

    this.db = new Database(':memory:');
    this.dbRun = promisify(this.db.run.bind(this.db));
    this.dbGet = promisify(this.db.get.bind(this.db));
    this.dbAll = promisify(this.db.all.bind(this.db));

    await this.dbRun(`
      CREATE TABLE IF NOT EXISTS chat_instructions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        instruction TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('Chat instructions table created/verified');
  }

  async insert_instruction(instruction: string): Promise<void> {
    if (!this.dbRun) {
      throw new Error('Database not initialized');
    }

    await this.dbRun(
      'INSERT INTO chat_instructions (instruction) VALUES (?)',
      [instruction]
    );
  }

  async select_instructions(): Promise<ChatInstruction[]> {
    if (!this.dbAll) {
      throw new Error('Database not initialized');
    }

    const rows = await this.dbAll(
      'SELECT id, instruction, created_at FROM chat_instructions ORDER BY created_at DESC'
    );

    return rows as ChatInstruction[];
  }

  async delete_instruction(id: number): Promise<void> {
    if (!this.dbRun) {
      throw new Error('Database not initialized');
    }

    await this.dbRun(
      'DELETE FROM chat_instructions WHERE id = ?',
      [id]
    );
  }

  async clear_all_instructions(): Promise<void> {
    if (!this.dbRun) {
      throw new Error('Database not initialized');
    }

    await this.dbRun('DELETE FROM chat_instructions');
  }

  async close(): Promise<void> {
    if (this.db) {
      const closeDb = promisify(this.db.close.bind(this.db));
      await closeDb();
      this.db = null;
      this.dbRun = null;
      this.dbGet = null;
      this.dbAll = null;
    }
  }
}

export const chat = new ChatDatabase();
