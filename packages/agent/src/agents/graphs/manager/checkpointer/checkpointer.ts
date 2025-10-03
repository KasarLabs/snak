import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import { LanggraphDatabase } from '@snakagent/database';
import { GraphError } from '../../utils/error.utils.js';

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
        throw new GraphError('E08DB850', 'CheckpointerService.getInstance');
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
