import type { PgPool } from "../db/postgres.js";
import type {
  ChatAttachmentsRepo,
  ChatAttachmentInsert,
  ChatAttachmentMeta,
} from "./ChatAttachmentsRepo.js";

interface MetaRow {
  id: string;
  message_id: string;
  kind: string;
  mime: string;
  size_bytes: number;
  width: number | null;
  height: number | null;
  caption: string | null;
  url: string | null;
  sha256: string;
  created_at: string;
}

function rowToMeta(r: MetaRow): ChatAttachmentMeta {
  return {
    id: r.id,
    messageId: r.message_id,
    kind: r.kind as ChatAttachmentMeta["kind"],
    mime: r.mime,
    sizeBytes: r.size_bytes,
    width: r.width ?? undefined,
    height: r.height ?? undefined,
    caption: r.caption ?? undefined,
    // 路由层会在返回前用 /api/chat/attachments/:id 覆盖，但 V1 切 OSS 后这里
    // 可能直接用 r.url（外部对象存储 URL）
    // 用 /data 后缀返回真实字节流；老的 r.url（V1 OSS 后才填）已经是直链
    url: r.url ?? `/api/chat/attachments/${r.id}/data`,
    sha256: r.sha256,
    createdAt: r.created_at,
  };
}

export class PostgresChatAttachmentsRepo implements ChatAttachmentsRepo {
  constructor(private pool: PgPool) {}

  async put(att: ChatAttachmentInsert): Promise<ChatAttachmentMeta> {
    // 先查 sha256 去重 —— 同图二次上传复用原 id，省存储
    const existing = await this.findBySha(att.sha256);
    if (existing) return existing;

    await this.pool.query(
      `INSERT INTO chat_attachments
         (id, message_id, kind, mime, size_bytes, width, height, caption, data, url, sha256, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        att.id,
        att.messageId ?? "",
        att.kind,
        att.mime,
        att.sizeBytes,
        att.width ?? null,
        att.height ?? null,
        att.caption ?? null,
        Buffer.from(att.data),
        null, // url 仅 V1 OSS 模式才填
        att.sha256,
        att.createdAt,
      ],
    );
    return {
      id: att.id,
      messageId: att.messageId ?? "",
      kind: att.kind,
      mime: att.mime,
      sizeBytes: att.sizeBytes,
      width: att.width,
      height: att.height,
      caption: att.caption,
      url: `/api/chat/attachments/${att.id}/data`,
      sha256: att.sha256,
      createdAt: att.createdAt,
    };
  }

  async get(id: string): Promise<ChatAttachmentMeta | null> {
    const { rows } = await this.pool.query<MetaRow>(
      `SELECT id, message_id, kind, mime, size_bytes, width, height, caption, url, sha256, created_at
         FROM chat_attachments WHERE id = $1`,
      [id],
    );
    return rows[0] ? rowToMeta(rows[0]) : null;
  }

  async getData(id: string): Promise<{ data: Uint8Array; mime: string } | null> {
    const { rows } = await this.pool.query<{ data: Buffer; mime: string }>(
      "SELECT data, mime FROM chat_attachments WHERE id = $1",
      [id],
    );
    const row = rows[0];
    if (!row || !row.data) return null;
    return { data: new Uint8Array(row.data), mime: row.mime };
  }

  async bindToMessage(id: string, messageId: string): Promise<void> {
    await this.pool.query(
      "UPDATE chat_attachments SET message_id = $1 WHERE id = $2",
      [messageId, id],
    );
  }

  async byMessage(messageId: string): Promise<ChatAttachmentMeta[]> {
    const { rows } = await this.pool.query<MetaRow>(
      `SELECT id, message_id, kind, mime, size_bytes, width, height, caption, url, sha256, created_at
         FROM chat_attachments
        WHERE message_id = $1
        ORDER BY created_at ASC`,
      [messageId],
    );
    return rows.map(rowToMeta);
  }

  async remove(id: string): Promise<void> {
    await this.pool.query("DELETE FROM chat_attachments WHERE id = $1", [id]);
  }

  async findBySha(sha256: string): Promise<ChatAttachmentMeta | null> {
    const { rows } = await this.pool.query<MetaRow>(
      `SELECT id, message_id, kind, mime, size_bytes, width, height, caption, url, sha256, created_at
         FROM chat_attachments WHERE sha256 = $1 LIMIT 1`,
      [sha256],
    );
    return rows[0] ? rowToMeta(rows[0]) : null;
  }
}
