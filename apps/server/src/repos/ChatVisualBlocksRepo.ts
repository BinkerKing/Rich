import type { ChatVisualBlock } from "@ke/domain";

export interface ChatVisualBlocksQuery {
  /** 限制返回条数；默认 100 */
  limit?: number;
  /** ISO 时间戳，包含上限 */
  since?: string;
  /** 按 blockType 过滤 */
  blockType?: ChatVisualBlock["blockType"];
}

export interface ChatVisualBlocksRepo {
  /** 批量写入。同 id 已存在则 upsert。orderInMessage 由调用方保证。 */
  append(blocks: ChatVisualBlock[]): Promise<void>;
  /** 按 messageId 取这条 message 的所有视觉块（按 orderInMessage 升序）。 */
  byMessage(messageId: string): Promise<ChatVisualBlock[]>;
  /** 删一条 message 下所有视觉块。 */
  removeByMessage(messageId: string): Promise<void>;
  /** 全表列表，默认按 createdAt 降序。 */
  list(q?: ChatVisualBlocksQuery): Promise<ChatVisualBlock[]>;
  /** 总数（admin 看板 + 健康检查用）。 */
  count(): Promise<number>;
}
