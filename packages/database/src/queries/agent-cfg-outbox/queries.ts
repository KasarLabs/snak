import { AGENT_CFG_OUTBOX_CLAIM_RETRY_WINDOW_SECONDS } from '@snakagent/core';
import { Postgres } from '../../database.js';

export namespace agentCfgOutbox {
  export interface OutboxRow {
    id: number;
    agent_id: string;
    cfg_version: number;
    event: string;
    claimed_at: Date | null;
    processed_at: Date | null;
  }

  type TimestampLike = Date | string | null;

  function normalizeTimestamp(value: TimestampLike): Date | null {
    if (value == null) {
      return null;
    }
    if (value instanceof Date) {
      return value;
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  /**
   * Claim a batch of unprocessed outbox entries, returning them for processing.
   * Rows that were claimed but never completed become eligible again after CLAIM_RETRY_WINDOW_SECONDS.
   */
  export async function fetchAndMarkBatch(
    batchSize: number
  ): Promise<OutboxRow[]> {
    const query = new Postgres.Query(
      `
      WITH candidates AS (
        SELECT id
        FROM agent_cfg_outbox
        WHERE processed_at IS NULL
          AND (
            claimed_at IS NULL
            OR claimed_at < NOW() - make_interval(secs => $2)
          )
        ORDER BY id
        LIMIT $1
        FOR UPDATE SKIP LOCKED
      ),
      claimed AS (
        UPDATE agent_cfg_outbox ao
        SET claimed_at = NOW()
        FROM candidates
        WHERE ao.id = candidates.id
        RETURNING ao.id,
                 ao.agent_id,
                 ao.cfg_version,
                 ao.event,
                 ao.claimed_at,
                 ao.processed_at
      )
      SELECT *
      FROM claimed
      ORDER BY id;
    `,
      [batchSize, AGENT_CFG_OUTBOX_CLAIM_RETRY_WINDOW_SECONDS]
    );

    const rows = await Postgres.query<
      Omit<OutboxRow, 'claimed_at' | 'processed_at'> & {
        claimed_at: TimestampLike;
        processed_at: TimestampLike;
      }
    >(query);

    return rows.map((row) => ({
      ...row,
      claimed_at: normalizeTimestamp(row.claimed_at),
      processed_at: normalizeTimestamp(row.processed_at),
    }));
  }

  /**
   * Requeue an outbox entry for retry by clearing its processed_at timestamp.
   */
  export async function requeue(id: number): Promise<void> {
    const query = new Postgres.Query(
      `
      UPDATE agent_cfg_outbox
      SET processed_at = NULL,
          claimed_at = NULL
      WHERE id = $1
    `,
      [id]
    );
    await Postgres.query(query);
  }

  /**
   * Mark a list of outbox entry IDs as successfully processed.
   */
  export async function markProcessed(ids: number[]): Promise<void> {
    if (ids.length === 0) {
      return;
    }

    const query = new Postgres.Query(
      `
      UPDATE agent_cfg_outbox
      SET processed_at = NOW(),
          claimed_at = NULL
      WHERE id = ANY($1)
    `,
      [ids]
    );
    await Postgres.query(query);
  }
}
