import type Database from "better-sqlite3";
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
    url: r.url ?? `/api/chat/attachments/${r.id}/data`,
    sha256: r.sha256,
    createdAt: r.created_at,
  };
}

export class SqliteChatAttachmentsRepo implements ChatAttachmentsRepo {
  constructor(private db: Database.Database) {}

  async put(att: ChatAttachmentInsert): Promise<ChatAttachmentMeta> {
    const existing = await this.findBySha(att.sha256);
    if (existing) return existing;

    this.db.prepare(`
      INSERT INTO chat_attachments
        (id, message_id, kind, mime, size_bytes, width, height, caption, data, url, sha256, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      att.id,
      att.messageId ?? "",
      att.kind,
      att.mime,
      att.sizeBytes,
      att.width ?? null,
      att.height ?? null,
      att.caption ?? null,
      Buffer.from(att.data),
      null,
      att.sha256,
      att.createdAt,
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
    const row = this.db.prepare(`
      SELECT id, message_id, kind, mime, size_bytes, width, height, caption, url, sha256, created_at
        FROM chat_attachments WHERE id = ?
    `).get(id) as MetaRow | undefined;
    return row ? rowToMeta(row) : null;
  }

  async getData(id: string): Promise<{ data: Uint8Array; mime: string } | null> {
    const row = this.db.prepare("SELECT data, mime FROM chat_attachments WHERE id = ?").get(id) as
      | { data: Buffer; mime: string } | undefined;
    if (!row?.data) return null;
    return { data: new Uint8Array(row.data), mime: row.mime };
  }

  async bindToMessage(id: string, messageId: string): Promise<void> {
    this.db.prepare("UPDATE chat_attachments SET message_id = ? WHERE id = ?").run(messageId, id);
  }

  async byMessage(messageId: string): Promise<ChatAttachmentMeta[]> {
    const rows = this.db.prepare(`
      SELECT id, message_id, kind, mime, size_bytes, width, height, caption, url, sha256, created_at
        FROM chat_attachments WHERE message_id = ?
        ORDER BY created_at ASC
    `).all(messageId) as MetaRow[];
    return rows.map(rowToMeta);
  }

  async remove(id: string): Promise<void> {
    this.db.prepare("DELETE FROM chat_attachments WHERE id = ?").run(id);
  }

  async findBySha(sha256: string): Promise<ChatAttachmentMeta | null> {
    const row = this.db.prepare(`
      SELECT id, message_id, kind, mime, size_bytes, width, height, caption, url, sha256, created_at
        FROM chat_attachments WHERE sha256 = ? LIMIT 1
    `).get(sha256) as MetaRow | undefined;
    return row ? rowToMeta(row) : null;
  }
}
