/**
 * Rich 首页动画展示系统 v0.1 —— T15 visual block 提取助手。
 *
 * 从一段已完成的 assistant 消息文本里抽出所有 ```ascii ... ``` 视觉块，
 * 转换成 ChatVisualBlock[] 准备持久化到 chat_visual_blocks 表。
 */

import type { ChatVisualBlock } from "@ke/domain";
import { detectBlockType, type DetectedBlockType } from "./detectBlockType.js";

const VISUAL_FENCE_RE = /```([a-zA-Z]*)\n([\s\S]*?)```/g;

function uid(): string {
  return `cvb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * @param messageId   - 关联的 chat message id
 * @param content     - assistant 消息的完整文本（含围栏）
 * @returns           - 准备持久化的视觉块数组（按出现顺序，orderInMessage 0-based）
 */
export function extractVisualBlocks(messageId: string, content: string): ChatVisualBlock[] {
  const blocks: ChatVisualBlock[] = [];
  VISUAL_FENCE_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  let order = 0;
  const createdAt = new Date().toISOString();
  while ((m = VISUAL_FENCE_RE.exec(content)) !== null) {
    const langHint = m[1].toLowerCase();
    const ascii = m[2];
    // langHint 优先；不是 ascii / 空时尝试当 blockType 用（如 mermaid）；
    // 否则用 detectBlockType
    const detected: DetectedBlockType = detectBlockType(ascii);
    const blockType: ChatVisualBlock["blockType"] = mapBlockType(detected);
    blocks.push({
      id: uid(),
      messageId,
      blockType,
      payload: { ascii, parsed: langHint ? { langHint } : undefined },
      orderInMessage: order++,
      createdAt,
    });
  }
  return blocks;
}

/** detected → ChatVisualBlock["blockType"]（domain 里的枚举） */
function mapBlockType(d: DetectedBlockType): ChatVisualBlock["blockType"] {
  switch (d) {
    case "flowchart":    return "flowchart";
    case "tree":         return "tree";
    case "table":        return "table";
    case "sequence":     return "sequence";
    case "architecture": return "architecture";
    case "concept":      return "concept";
    case "chart":        return "chart";
    case "sketch":       return "sketch";
    case "raw":
    default:             return "raw";
  }
}

/**
 * 调用 API 持久化。失败不抛错（持久化失败不应阻断 chat 流程）。
 */
export async function persistVisualBlocks(
  messageId: string,
  content: string,
): Promise<{ ok: boolean; count: number; error?: string }> {
  const blocks = extractVisualBlocks(messageId, content);
  if (blocks.length === 0) return { ok: true, count: 0 };
  try {
    const r = await fetch("/api/chat-visual-blocks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ blocks }),
    });
    if (!r.ok) {
      const body = await r.json().catch(() => ({})) as { error?: string };
      return { ok: false, count: 0, error: body.error ?? `HTTP ${r.status}` };
    }
    return { ok: true, count: blocks.length };
  } catch (e) {
    return { ok: false, count: 0, error: e instanceof Error ? e.message : String(e) };
  }
}
