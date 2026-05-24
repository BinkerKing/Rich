import type Database from "better-sqlite3";
import type { ChatVisualBlock } from "@ke/domain";
import type { ChatVisualBlocksRepo, ChatVisualBlocksQuery } from "./ChatVisualBlocksRepo.js";

interface Row {
  id: string;
  message_id: string;
  block_type: string;
  payload: string;          // JSON string
  order_in_message: number;
  created_at: string;
}

function rowToBlock(r: Row): ChatVisualBlock {
  return {
    id: r.id,
    messageId: r.message_id,
    blockType: r.block_type as ChatVisualBlock["blockType"],
    payload: JSON.parse(r.payload) as ChatVisualBlock["payload"],
    orderInMessage: r.order_in_message,
    createdAt: r.created_at,
  };
}

export class SqliteChatVisualBlocksRepo implements ChatVisualBlocksRepo {
  constructor(private db: Database.Database) {}

  async append(blocks: ChatVisualBlock[]): Promise<void> {
    if (blocks.length === 0) return;
    // upsert：同 id 已存在则 REPLACE，保证 idempotent
    const stmt = this.db.prepare(`
      INSERT INTO chat_visual_blocks (id, message_id, block_type, payload, order_in_message, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        message_id = excluded.message_id,
        block_type = excluded.block_type,
        payload = excluded.payload,
        order_in_message = excluded.order_in_message,
        created_at = excluded.created_at
    `);
    const tx = this.db.transaction((items: ChatVisualBlock[]) => {
      for (const b of items) {
        stmt.run(
          b.id,
          b.messageId ?? "",
          b.blockType,
          JSON.stringify(b.payload),
          b.orderInMessage,
          b.createdAt,
        );
      }
    });
    tx(blocks);
  }

  async byMessage(messageId: string): Promise<ChatVisualBlock[]> {
    const rows = this.db.prepare(`
      SELECT * FROM chat_visual_blocks
      WHERE message_id = ?
      ORDER BY order_in_message ASC
    `).all(messageId) as Row[];
    return rows.map(rowToBlock);
  }

  async removeByMessage(messageId: string): Promise<void> {
    this.db.prepare("DELETE FROM chat_visual_blocks WHERE message_id = ?").run(messageId);
  }

  async list(q: ChatVisualBlocksQuery = {}): Promise<ChatVisualBlock[]> {
    const where: string[] = [];
    const args: unknown[] = [];
    if (q.since)     { where.push("created_at >= ?"); args.push(q.since); }
    if (q.blockType) { where.push("block_type = ?");   args.push(q.blockType); }
    let sql = "SELECT * FROM chat_visual_blocks"
      + (where.length ? ` WHERE ${where.join(" AND ")}` : "")
      + " ORDER BY created_at DESC";
    const limit = Math.min(Math.max(q.limit ?? 100, 1), 1000);
    sql += ` LIMIT ${limit}`;
    const rows = this.db.prepare(sql).all(...args) as Row[];
    return rows.map(rowToBlock);
  }

  async count(): Promise<number> {
    const r = this.db.prepare("SELECT COUNT(*) AS n FROM chat_visual_blocks").get() as { n: number };
    return r.n;
  }
}
