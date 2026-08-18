import type { ChatAttachment } from "@ke/domain";

/**
 * 写入用：data 是原始字节流（Buffer / Uint8Array）。
 * 数据库层会按 backend 选择 bytea / BLOB 存储。
 */
export interface ChatAttachmentInsert
  extends Omit<ChatAttachment, "url"> {
  data: Uint8Array;
}

/**
 * 读取用：data 单独取（getData），元数据接口不带 bytes，避免无谓的字节传输。
 */
export interface ChatAttachmentMeta extends ChatAttachment {
  // url 由路由层在返回时拼上：/api/chat/attachments/:id
}

export interface ChatAttachmentsRepo {
  /** 写入一条附件。已存在（sha256 命中）直接返回原 id，不重复落库。 */
  put(att: ChatAttachmentInsert): Promise<ChatAttachmentMeta>;
  /** 取元数据（不含字节）。 */
  get(id: string): Promise<ChatAttachmentMeta | null>;
  /** 取原始字节流（serving 端使用）。 */
  getData(id: string): Promise<{ data: Uint8Array; mime: string } | null>;
  /** 把附件绑定到 message（上传时 message 还没创建，发送后回填）。 */
  bindToMessage(id: string, messageId: string): Promise<void>;
  /** 按 message id 列附件元数据，按 createdAt 升序。 */
  byMessage(messageId: string): Promise<ChatAttachmentMeta[]>;
  /** 删（CASCADE 用）。 */
  remove(id: string): Promise<void>;
  /** sha256 查重：返回已有的 id，否则 null。 */
  findBySha(sha256: string): Promise<ChatAttachmentMeta | null>;
}
