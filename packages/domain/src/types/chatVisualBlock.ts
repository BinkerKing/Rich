/**
 * ChatVisualBlock —— Rich 回答里嵌入的 ASCII 视觉块（流程图 / 表格 / 时序图 etc.）
 *
 * Rich 的回答是「visual + text」双通道：text 落在 messages 流里，visual 块
 * 独立持久化到 chat_visual_blocks 表，可以按 messageId 反查、按 createdAt 列表。
 *
 * blockType 跟前端 VisualBlockRenderer 的渲染分支对齐：
 *   flowchart  — 场景 5 流程图
 *   table      — 场景 3 对比表
 *   sequence   — 场景 7 时序图
 *   architecture — 场景 8 架构图
 *   tree       — 场景 2 任务拆解
 *   concept    — 场景 1 概念解释（方框+连线）
 *   chart      — 场景 6 数据可视化（柱/饼/趋势）
 *   sketch     — 场景 10 手绘草图
 *   raw        — 未分类 / AI 没标的兜底
 */
export type ChatVisualBlockType =
  | "flowchart"
  | "table"
  | "sequence"
  | "architecture"
  | "tree"
  | "concept"
  | "chart"
  | "sketch"
  | "raw";

export interface ChatVisualBlock {
  /** 全局唯一 id（cvb-<时间戳>-<随机>） */
  id: string;
  /** 关联的 chat message id；如果 visual 不属于任何 message（少见）就置空字符串 */
  messageId: string;
  /** 视觉块类型，决定前端用哪个 renderer */
  blockType: ChatVisualBlockType;
  /** 原始 ASCII 字符串 + 可选的结构化解析结果 */
  payload: {
    /** ```ascii 围栏内的原文 */
    ascii: string;
    /** AI 给的可选标题 */
    caption?: string;
    /** 已解析的结构化数据（如 flowchart 节点 / table 行列）—— 渲染器可缓存 */
    parsed?: Record<string, unknown>;
  };
  /** 同一 message 内多个 visual 块的顺序（0-based） */
  orderInMessage: number;
  /** ISO 8601 创建时间 */
  createdAt: string;
}
