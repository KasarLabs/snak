import { Postgres } from '../../database.js';
import { Id } from '../common.js';

export namespace message {
  /**
   * Initializes the message table.
   *
   * @throws { DatabaseError } If a database operation fails.
   */
  export async function init(): Promise<void> {
    // Table creation is handled by migrations/schema
    // This init function is a placeholder for consistency
  }

  interface MessageBase {
    // TODO make fields wit hthe real correct types instead of any
    event: string;
    run_id: string;
    thread_id: string;
    checkpoint_id: string;
    task_id: string | null;
    step_id: string | null;
    from: string;
    tools: any[] | null;
    message: string | null;
    metadata: any;
    timestamp?: string;
  }

  interface MessageWithId extends MessageBase {
    id: number;
  }

  /**
   * A message stored in the database.
   *
   * @field { number } [id] - Message id in db (optional).
   * @field { string } event - Event type (e.g., ON_CHAT_MODEL_END, ON_CHAIN_END).
   * @field { string } [run_id] - Run identifier.
   * @field { string } [thread_id] - Thread identifier.
   * @field { string } [checkpoint_id] - Checkpoint identifier.
   * @field { string } [task_id] - Task UUID.
   * @field { string } [step_id] - Step UUID.
   * @field { string } from - Source of the message.
   * @field { string } agent_id - Agent identifier.
   * @field { string } user_id - User identifier.
   * @field { string } [message] - Message content.
   * @field { any } [tools] - Tools data (stored as JSONB).
   * @field { any } [metadata] - Metadata (stored as JSONB).
   * @field { Date } [timestamp] - Message timestamp.
   */
  export type Message<HasId extends Id = Id.NoId> = HasId extends Id.Id
    ? MessageWithId
    : MessageBase;

  /**
   * Inserts a new message into the database.
   *
   * @param { Message } msg - Message to insert.
   *
   * @returns { number } The id of the inserted message.
   *
   * @throws { DatabaseError } If a database operation fails.
   */
  export async function insert_message(
    agentId: string,
    userId: string,
    msg: Message
  ): Promise<number> {
    const q = new Postgres.Query(
      `
      INSERT INTO message (
        event, run_id, thread_id, checkpoint_id, task_id, step_id, "from", agent_id, user_id,
        message, tools, metadata, "timestamp"
      )
      VALUES ($1, $2, $3, $4, $5::UUID, $6::UUID, $7, $8, $9, $10, $11, $12, $13)
      RETURNING id;
    `,
      [
        msg.event,
        msg.run_id ?? null,
        msg.thread_id ?? null,
        msg.checkpoint_id ?? null,
        msg.task_id ?? null,
        msg.step_id ?? null,
        msg.from,
        agentId,
        userId,
        msg.message ?? null,
        msg.tools ? JSON.stringify(msg.tools) : null,
        JSON.stringify(msg.metadata || {}),
        msg.timestamp || new Date(),
      ]
    );

    const result = await Postgres.query<{ id: number }>(q);
    return result[0].id;
  }

  /**
   * Selects messages by agent_id using SQL function.
   * The SQL function get_messages_by_agent handles the limit parameter:
   * - If limit is null, returns all messages for the agent
   * - If limit is a number, returns that many messages
   *
   * @param { string } agentId - Agent identifier.
   * @param { number | null } limit - Limit on number of messages (null for all messages).
   *
   * @returns { Message<Id.Id>[] } Array of messages ordered by timestamp DESC.
   *
   * @throws { DatabaseError } If a database operation fails.
   */
  export async function select_messages_by_agent(
    agentId: string,
    limit: number | null = null
  ): Promise<Message<Id.Id>[]> {
    const q = new Postgres.Query(
      `SELECT * FROM get_messages_by_agent($1::UUID, $2)`,
      [agentId, limit]
    );
    return await Postgres.query<Message<Id.Id>>(q);
  }

  /**
   * Deletes messages for a specific agent and user.
   *
   * @param { string } agentId - Agent identifier.
   * @param { string } userId - User identifier.
   *
   * @throws { DatabaseError } If a database operation fails.
   */
  export async function delete_messages_by_agent(
    agentId: string,
    userId: string
  ): Promise<void> {
    const q = new Postgres.Query(
      `DELETE FROM message m
       USING agents a
       WHERE m.agent_id = a.id
       AND m.agent_id = $1
       AND a.user_id = $2`,
      [agentId, userId]
    );
    await Postgres.query(q);
  }
}
