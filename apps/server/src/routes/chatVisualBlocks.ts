import { Hono } from "hono";
import type { ChatVisualBlocksRepo } from "../repos/ChatVisualBlocksRepo.js";
import { ChatVisualBlockSchema, type ChatVisualBlockType } from "@ke/domain";
import { z } from "zod";

/**
 * 视觉块持久化 REST 路由。
 *   GET    /api/chat-visual-blocks              列全表（支持 limit/since/blockType）
 *   GET    /api/chat-visual-blocks/by-message/:messageId   反查一条 message 的所有块
 *   POST   /api/chat-visual-blocks              批量写入（upsert）
 *   DELETE /api/chat-visual-blocks/by-message/:messageId   清掉一条 message 的视觉块
 *   GET    /api/chat-visual-blocks/count        统计总数（admin 看板用）
 */
export function chatVisualBlocksRoutes(repo: ChatVisualBlocksRepo | null): Hono {
  const r = new Hono();

  if (!repo) {
    // JSON 后端不支持；返回 503 提示而不是 crash
    r.all("*", c => c.json({ error: "chat_visual_blocks not available (json backend)" }, 503));
    return r;
  }

  r.get("/", async c => {
    const url = new URL(c.req.url);
    const limit = parseInt(url.searchParams.get("limit") ?? "100", 10);
    const since = url.searchParams.get("since") ?? undefined;
    const blockType = (url.searchParams.get("blockType") ?? undefined) as ChatVisualBlockType | undefined;
    const items = await repo.list({ limit, since, blockType });
    return c.json({ items, count: items.length });
  });

  r.get("/count", async c => {
    const n = await repo.count();
    return c.json({ count: n });
  });

  r.get("/by-message/:messageId", async c => {
    const messageId = c.req.param("messageId");
    const items = await repo.byMessage(messageId);
    return c.json({ items });
  });

  const PostBodySchema = z.object({
    blocks: z.array(ChatVisualBlockSchema).min(1).max(50),
  });
  r.post("/", async c => {
    const raw = await c.req.json().catch(() => null);
    const parsed = PostBodySchema.safeParse(raw);
    if (!parsed.success) {
      return c.json({ error: "schema validation failed", issues: parsed.error.issues }, 400);
    }
    await repo.append(parsed.data.blocks);
    return c.json({ ok: true, count: parsed.data.blocks.length });
  });

  r.delete("/by-message/:messageId", async c => {
    const messageId = c.req.param("messageId");
    await repo.removeByMessage(messageId);
    return c.json({ ok: true });
  });

  return r;
}
