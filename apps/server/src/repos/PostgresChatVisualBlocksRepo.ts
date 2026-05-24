import type { ChatVisualBlock } from "@ke/domain";
import type { PgPool } from "../db/postgres.js";
import type { ChatVisualBlocksRepo, ChatVisualBlocksQuery } from "./ChatVisualBlocksRepo.js";

interface Row {
  id: string;
  message_id: string;
  block_type: string;
  payload: unknown;             // Postgres JSONB 自动反序列化为对象
  order_in_message: number;
  created_at: string;
}

function rowToBlock(r: Row): ChatVisualBlock {
  return {
    id: r.id,
    messageId: r.message_id,
    blockType: r.block_type as ChatVisualBlock["blockType"],
    payload: (r.payload ?? {}) as ChatVisualBlock["payload"],
    orderInMessage: r.order_in_message,
    createdAt: r.created_at,
  };
}

export class PostgresChatVisualBlocksRepo implements ChatVisualBlocksRepo {
  constructor(private pool: PgPool) {}

  async append(blocks: ChatVisualBlock[]): Promise<void> {
    if (blocks.length === 0) return;
    // 用 ON CONFLICT 做 upsert（idempotent）
    for (const b of blocks) {
      await this.pool.query(`
        INSERT INTO chat_visual_blocks (id, message_id, block_type, payload, order_in_message, created_at)
        VALUES ($1, $2, $3, $4::jsonb, $5, $6)
        ON CONFLICT (id) DO UPDATE SET
          message_id = EXCLUDED.message_id,
          block_type = EXCLUDED.block_type,
          payload = EXCLUDED.payload,
          order_in_message = EXCLUDED.order_in_message,
          created_at = EXCLUDED.created_at
      `, [
        b.id,
        b.messageId ?? "",
        b.blockType,
        JSON.stringify(b.payload),
        b.orderInMessage,
        b.createdAt,
      ]);
    }
  }

  async byMessage(messageId: string): Promise<ChatVisualBlock[]> {
    const { rows } = await this.pool.query<Row>(`
      SELECT * FROM chat_visual_blocks
      WHERE message_id = $1
      ORDER BY order_in_message ASC
    `, [messageId]);
    return rows.map(rowToBlock);
  }

  async removeByMessage(messageId: string): Promise<void> {
    await this.pool.query("DELETE FROM chat_visual_blocks WHERE message_id = $1", [messageId]);
  }

  async list(q: ChatVisualBlocksQuery = {}): Promise<ChatVisualBlock[]> {
    const where: string[] = [];
    const args: unknown[] = [];
    const add = (sql: string, value: unknown) => {
      args.push(value);
      where.push(sql.replace("?", `$${args.length}`));
    };
    if (q.since) add("created_at >= ?", q.since);
    if (q.blockType) add("block_type = ?", q.blockType);

    const limit = Math.min(Math.max(q.limit ?? 100, 1), 1000);
    args.push(limit);
    const sql = "SELECT * FROM chat_visual_blocks"
      + (where.length ? ` WHERE ${where.join(" AND ")}` : "")
      + ` ORDER BY created_at DESC LIMIT $${args.length}`;
    const { rows } = await this.pool.query<Row>(sql, args);
    return rows.map(rowToBlock);
  }

  async count(): Promise<number> {
    const { rows } = await this.pool.query<{ n: string }>("SELECT COUNT(*) AS n FROM chat_visual_blocks");
    return Number(rows[0]?.n ?? 0);
  }
}
