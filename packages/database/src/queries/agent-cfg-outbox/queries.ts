import { Postgres } from '../../database.js';

export namespace agentCfgOutbox {
  export interface OutboxRow {
    id: number;
    agent_id: string;
    cfg_version: number;
    event: string;
    processed_at: Date | null;
  }

  /**
   * Fetch a batch of unprocessed outbox entries, marking them as processed in the same statement.
   * Uses SKIP LOCKED to safely iterate when multiple workers run concurrently.
   */
  export async function fetchAndMarkBatch(
    batchSize: number
  ): Promise<OutboxRow[]> {
    const query = new Postgres.Query(
      `
      WITH locked AS (
        SELECT id, agent_id, cfg_version, event
        FROM agent_cfg_outbox
        WHERE processed_at IS NULL
        ORDER BY id
        LIMIT $1
        FOR UPDATE SKIP LOCKED
      )
      UPDATE agent_cfg_outbox ao
      SET processed_at = NOW()
      FROM locked
      WHERE ao.id = locked.id
      RETURNING ao.id,
               ao.agent_id,
               ao.cfg_version,
               ao.event,
               ao.processed_at;
    `,
      [batchSize]
    );

    return Postgres.query<OutboxRow>(query);
  }

  /**
   * Requeue an outbox entry for retry by clearing its processed_at timestamp.
   */
  export async function requeue(id: number): Promise<void> {
    const query = new Postgres.Query(
      `
      UPDATE agent_cfg_outbox
      SET processed_at = NULL
      WHERE id = $1
    `,
      [id]
    );
    await Postgres.query(query);
  }
}
