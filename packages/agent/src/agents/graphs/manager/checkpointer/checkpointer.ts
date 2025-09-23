import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import { LanggraphDatabase } from '@snakagent/database';

export class CheckpointerService {
  private static instance: PostgresSaver;

  static async getInstance(): Promise<PostgresSaver> {
    if (!this.instance) {
      const lg_pool = LanggraphDatabase.getInstance().getPool();
      if (!lg_pool) {
        throw new Error('LanggraphDatabase pool is not initialized');
      }
      this.instance = new PostgresSaver(lg_pool);
      await this.instance.setup();
    }

    return this.instance;
  }
}
