import { Postgres } from '../../database.js';

// Global lock to prevent concurrent initialization
export namespace notify {
  export interface NotifyData {
    id: string;
    user_id: string;
    agent_id: string;
    message: string;
    created_at: string;
    read: boolean;
  }

  export interface NotifyDataWithoutUserId
    extends Omit<NotifyData, 'user_id'> {}

  export async function insertNotify(
    user_id: string,
    agent_id: string,
    message: string
  ) {
    const query = new Postgres.Query(
      `INSERT INTO notify (user_id, agent_id, message) VALUES ($1, $2, $3) RETURNING "id", "agent_id", "message", "read", "created_at"`,
      [user_id, agent_id, message]
    );
    const result = await Postgres.query(query);
    return result;
  }

  export async function markAsRead(
    notifyId: string,
    userId: string
  ): Promise<string | null> {
    const query = new Postgres.Query(
      `UPDATE notify SET "read" = true WHERE id = $1 AND user_id = $2 RETURNING "id"`,
      [notifyId, userId]
    );

    const result = await Postgres.query<{ id: string }>(query);
    if (result.length === 0) {
      return null;
    }
    return result[0].id;
  }

  export async function getUserNotifications(
    userId: string
  ): Promise<NotifyDataWithoutUserId[]> {
    const query = new Postgres.Query(
      `SELECT "id", "agent_id", "message", "read", "created_at" FROM notify WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );

    const result = await Postgres.query<NotifyDataWithoutUserId[]>(query);
    return result[0];
  }

  export async function deleteNotification(
    notifyId: string,
    userId: string
  ): Promise<string | null> {
    const query = new Postgres.Query(
      `DELETE FROM notify WHERE id = $1 AND user_id = $2 RETURNING "id"`,
      [notifyId, userId]
    );
    const result = await Postgres.query<{ id: string }>(query);
    if (result.length === 0) {
      return null;
    }
    return result[0].id;
  }
}
