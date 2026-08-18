/**
 * ChatAttachment —— 用户在聊天里附加的媒体（V0.1 只支持 image）。
 *
 * 跟 ChatVisualBlock 并列：
 *   - ChatVisualBlock = AI 输出的 ASCII 视觉块
 *   - ChatAttachment  = 用户上传给 AI 看的图片
 *
 * 持久化在 chat_attachments 表。MVP 把原始字节存 bytea（postgres）/ BLOB
 * （sqlite），≤ 2MB；V1 会切到对象存储 + url。
 */

export type ChatAttachmentKind = "image"; // future: "audio" | "pdf" | "video"

export interface ChatAttachment {
  /** 全局唯一 id（att-<时间戳>-<随机>） */
  id: string;
  /** 关联的 chat message id；附件先上传后绑定，因此可能短暂为空 */
  messageId: string;
  kind: ChatAttachmentKind;
  /** 真实 mime，由服务端校验后写入 */
  mime: string;
  sizeBytes: number;
  /** 图片像素宽高（客户端预处理后量出来，可选） */
  width?: number;
  height?: number;
  /** AI 自动生成的简短描述，用于历史搜索和回看（V0.1 可空） */
  caption?: string;
  /** 服务端可访问 URL —— 一般是 /api/chat/attachments/:id */
  url: string;
  /** 内容 sha256，用于同图去重 */
  sha256: string;
  /** ISO 8601 上传时间 */
  createdAt: string;
}

/**
 * 客户端发送 chat 时引用附件的最小集合 —— 只带 id，服务端按 id 拉数据。
 */
export interface ChatAttachmentRef {
  id: string;
  /** 冗余字段，方便前端缓存渲染（缩略图 / 文件名提示） */
  mime?: string;
  url?: string;
  width?: number;
  height?: number;
}
