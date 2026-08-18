import { Hono } from "hono";
import { createHash } from "node:crypto";
import type { ChatAttachmentsRepo } from "../repos/ChatAttachmentsRepo.js";
import type { ChatAttachmentKind } from "@ke/domain";

/**
 * 聊天附件 REST 路由 —— 上传图片 / 取元数据 / 取原始字节。
 *
 *   POST /api/chat/attachments
 *        multipart/form-data: file=<image>, [width=<num>], [height=<num>], [messageId=<str>]
 *        → { id, url, mime, sizeBytes, sha256, width?, height? }
 *
 *   POST /api/chat/attachments  (Content-Type: application/json)
 *        { data: <base64 string>, mime, width?, height?, messageId? }
 *        → same shape
 *
 *   GET  /api/chat/attachments/:id           取元数据 JSON
 *   GET  /api/chat/attachments/:id/data      取原始字节（用于 <img src>）
 *   POST /api/chat/attachments/:id/bind      { messageId } 把附件绑定到 message
 *   GET  /api/chat/attachments/by-message/:messageId   列一条 message 的所有附件
 *   DELETE /api/chat/attachments/:id
 */

const MAX_BYTES = 5 * 1024 * 1024; // 5MB 上限
const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
]);

function newId(): string {
  return `att-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function chatAttachmentsRoutes(repo: ChatAttachmentsRepo | null): Hono {
  const r = new Hono();

  if (!repo) {
    r.all("*", c => c.json({ error: "chat_attachments not available (json backend)" }, 503));
    return r;
  }

  // ─── POST /api/chat/attachments ──────────────────────────────
  r.post("/", async c => {
    const contentType = c.req.header("content-type") ?? "";

    let bytes: Uint8Array;
    let mime: string;
    let width: number | undefined;
    let height: number | undefined;
    let messageId = "";

    if (contentType.startsWith("multipart/form-data")) {
      const form = await c.req.formData();
      const file = form.get("file");
      if (!(file instanceof Blob)) {
        return c.json({ error: "missing file field" }, 400);
      }
      mime = file.type || "application/octet-stream";
      bytes = new Uint8Array(await file.arrayBuffer());
      const w = form.get("width");
      const h = form.get("height");
      const mid = form.get("messageId");
      if (typeof w === "string" && /^\d+$/.test(w)) width = parseInt(w, 10);
      if (typeof h === "string" && /^\d+$/.test(h)) height = parseInt(h, 10);
      if (typeof mid === "string") messageId = mid;
    } else if (contentType.startsWith("application/json")) {
      const body = await c.req.json().catch(() => null) as
        | { data?: string; mime?: string; width?: number; height?: number; messageId?: string }
        | null;
      if (!body?.data || !body?.mime) {
        return c.json({ error: "{data, mime} required for json upload" }, 400);
      }
      // 接受 'data:image/jpeg;base64,XXX' 或纯 'XXX' 两种格式
      const m = /^data:[^;]+;base64,(.+)$/.exec(body.data);
      const base64 = m ? m[1] : body.data;
      try {
        bytes = new Uint8Array(Buffer.from(base64, "base64"));
      } catch {
        return c.json({ error: "invalid base64 data" }, 400);
      }
      mime = body.mime;
      width = body.width;
      height = body.height;
      messageId = body.messageId ?? "";
    } else {
      return c.json({ error: "use multipart/form-data or application/json" }, 415);
    }

    if (bytes.byteLength === 0) return c.json({ error: "empty file" }, 400);
    if (bytes.byteLength > MAX_BYTES) {
      return c.json({ error: `file > ${MAX_BYTES} bytes (${bytes.byteLength})` }, 413);
    }
    if (!ALLOWED_MIME.has(mime)) {
      return c.json({ error: `mime ${mime} not allowed (allowed: ${[...ALLOWED_MIME].join(", ")})` }, 415);
    }

    const hash = sha256(bytes);
    const meta = await repo.put({
      id: newId(),
      messageId,
      kind: "image" as ChatAttachmentKind,
      mime,
      sizeBytes: bytes.byteLength,
      width,
      height,
      data: bytes,
      sha256: hash,
      createdAt: new Date().toISOString(),
    });
    return c.json(meta);
  });

  // ─── GET /api/chat/attachments/by-message/:messageId ──────────
  r.get("/by-message/:messageId", async c => {
    const messageId = c.req.param("messageId");
    const list = await repo.byMessage(messageId);
    return c.json({ items: list, count: list.length });
  });

  // ─── POST /api/chat/attachments/:id/bind ──────────────────────
  r.post("/:id/bind", async c => {
    const id = c.req.param("id");
    const body = await c.req.json().catch(() => null) as { messageId?: string } | null;
    if (!body?.messageId) return c.json({ error: "messageId required" }, 400);
    await repo.bindToMessage(id, body.messageId);
    return c.json({ ok: true });
  });

  // ─── DELETE /api/chat/attachments/:id ─────────────────────────
  r.delete("/:id", async c => {
    const id = c.req.param("id");
    await repo.remove(id);
    return c.json({ ok: true });
  });

  // ─── GET /api/chat/attachments/:id/data ───────────────────────
  // 序在 :id 路由前（hono 按声明顺序匹配；data 路径更具体所以放上面）
  r.get("/:id/data", async c => {
    const id = c.req.param("id");
    const got = await repo.getData(id);
    if (!got) return c.notFound();
    // Uint8Array → Buffer 才是合法的 BodyInit（Node fetch undici）
    return new Response(Buffer.from(got.data) as unknown as BodyInit, {
      status: 200,
      headers: {
        "content-type": got.mime,
        "cache-control": "private, max-age=86400",
        "content-length": String(got.data.byteLength),
      },
    });
  });

  // ─── GET /api/chat/attachments/:id ────────────────────────────
  r.get("/:id", async c => {
    const id = c.req.param("id");
    const meta = await repo.get(id);
    if (!meta) return c.notFound();
    return c.json(meta);
  });

  return r;
}
