import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import { LanggraphDatabase } from '@snakagent/database';

export class CheckpointerService {
  private static instance: PostgresSaver | undefined;
  private static initializing?: Promise<PostgresSaver>;
  static async getInstance(): Promise<PostgresSaver> {
    if (this.instance) {
      return this.instance;
    }
    if (!this.initializing) {
      const pool = LanggraphDatabase.getInstance().getPool();
      if (!pool) {
        throw new Error('LangGraph database pool not initialized');
      }
      this.initializing = (async () => {
        const saver = new PostgresSaver(pool);
        await saver.setup();
        this.instance = saver;
        return saver;
      })().finally(() => {
        this.initializing = undefined;
      });
    }
    return this.initializing!;
  }
}
