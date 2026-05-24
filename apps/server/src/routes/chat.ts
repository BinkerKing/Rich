import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { buildChatSystemPrompt } from "../ai/prompts/chatSystem.js";

/**
 * 把 client 发来的 messages 注入 Rich 的 system prompt：
 *  - 如果 messages[0] 已经是 system，替换内容（保持单一 system）
 *  - 否则在最前面插入
 *
 * 注意：每次请求都重新生成 prompt 串 —— 后续可以扩展成按用户偏好 / 时间段
 * 动态调整（如夜间模式更简洁），现在直接静态返回。
 */
function injectSystemPrompt(messages: Array<{ role: string; content: string }>): Array<{ role: string; content: string }> {
  const sys = { role: "system", content: buildChatSystemPrompt() };
  if (messages.length > 0 && messages[0].role === "system") {
    return [sys, ...messages.slice(1)];
  }
  return [sys, ...messages];
}

/**
 * Chat overlay backend — bridges the Spotlight-style chat UI to Hermes Agent.
 *
 * Wire format (in):
 *   POST /api/chat/stream
 *   { messages: [{ role: "user" | "assistant", content: string }, ...] }
 *
 * Wire format (out, SSE):
 *   event: text       data: { "chunk": "..." }
 *   event: tool       data: { "name": "mcp_rich_xxx", "status": "running" | "completed" }
 *   event: done       data: { "finish_reason": "stop" | ... }
 *   event: error      data: { "message": "..." }
 *
 * Why this bridge exists (instead of the UI hitting Hermes directly):
 *   1. Normalise Hermes's SSE format into our project-standard SSE format
 *   2. Hide the upstream URL/port so the UI only knows /api/*
 *   3. Future hook point for moderation, logging, conversation persistence
 */

const HERMES_BASE_URL = process.env.HERMES_BASE_URL || "http://127.0.0.1:8642";

export function chatRoutes(): Hono {
  const r = new Hono();

  // Non-streaming endpoint for GreatMe HQ conversations and any other caller
  // that just wants a single completed reply. Forwards to Hermes with
  // stream:false and returns the OpenAI-style JSON wrapped in
  // { message: { role, content } }.
  r.post("/", async (c) => {
    const body = await c.req.json().catch(() => null) as
      | { messages?: Array<{ role: string; content: string }> }
      | null;
    if (!body || !Array.isArray(body.messages) || body.messages.length === 0) {
      return c.json({ error: "messages[] required" }, 400);
    }
    const messages = body.messages;
    try {
      const upstream = await fetch(`${HERMES_BASE_URL}/v1/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "hermes-agent",
          stream: false,
          messages: injectSystemPrompt(body.messages),
        }),
      });
      if (!upstream.ok) {
        return c.json({ error: `Hermes ${upstream.status}` }, 502);
      }
      const json = await upstream.json() as { choices?: { message?: { role: string; content: string } }[] };
      const msg = json.choices?.[0]?.message;
      if (!msg) return c.json({ error: "no message in response" }, 502);
      return c.json({ message: msg });
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : String(e) }, 503);
    }
  });

  r.post("/stream", async (c) => {
    const body = await c.req.json().catch(() => null) as
      | { messages?: Array<{ role: string; content: string }> }
      | null;
    if (!body || !Array.isArray(body.messages) || body.messages.length === 0) {
      return c.json({ error: "messages[] required" }, 400);
    }
    const messages = body.messages;

    // T02 — 首字 SLO 基础设施。
    // (1) 反代关 buffering：Nginx / Cloudflare 见到这个 header 不会攒 chunk
    // (2) 立即开启 SSE 流（不等 Hermes 连接成功）→ 第一帧就推一个 mascot:thinking
    //     事件，给前端 100ms 内就有 UI 反应（即便后端 Hermes 还没开始返回）
    // (3) Hermes 连接放在 stream callback 内，连不上时通过 'error' 事件推回去
    //     而不是 503 JSON（保持流式协议一致）
    c.header("X-Accel-Buffering", "no");
    c.header("Cache-Control", "no-cache, no-transform");

    return streamSSE(c, async (stream) => {
      // ① 先推一个 mascot 事件 —— 让前端立刻把 Mascot 切到 thinking 表情
      //    （这是首字 SLO L1 兜底：用户感知 < 100ms，AI 真实首字独立测）
      await stream.writeSSE({
        event: "mascot",
        data: JSON.stringify({ state: "thinking", ts: Date.now() }),
      });

      // ② 现在才开始连 Hermes（连接耗时已经从首字延迟里抠出去了）
      let upstream: Response;
      try {
        upstream = await fetch(`${HERMES_BASE_URL}/v1/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "hermes-agent",
            stream: true,
            messages: injectSystemPrompt(messages),
          }),
        });
      } catch (e) {
        await stream.writeSSE({
          event: "error",
          data: JSON.stringify({ message: `Hermes unreachable: ${e instanceof Error ? e.message : String(e)}` }),
        });
        return;
      }
      if (!upstream.ok || !upstream.body) {
        await stream.writeSSE({
          event: "error",
          data: JSON.stringify({ message: `Hermes ${upstream.status} ${upstream.statusText}` }),
        });
        return;
      }

      const reader = upstream.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let currentEvent: string | null = null;
      let sawText = false;
      let finishReason = "stop";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });

          // SSE frames are separated by blank lines. Each frame is a sequence
          // of "field: value" lines; an "event:" line sets the event type
          // for the next "data:" payload.
          let nl;
          while ((nl = buf.indexOf("\n")) !== -1) {
            const line = buf.slice(0, nl).replace(/\r$/, "");
            buf = buf.slice(nl + 1);

            if (line === "") {
              // Frame boundary — reset the per-frame event name. (We process
              // events line-by-line above, so this is mostly bookkeeping.)
              currentEvent = null;
              continue;
            }
            if (line.startsWith("event:")) {
              currentEvent = line.slice(6).trim();
              continue;
            }
            if (line.startsWith("data:")) {
              const data = line.slice(5).trim();
              if (data === "[DONE]") {
                finishReason = "stop";
                continue;
              }
              let parsed: unknown;
              try { parsed = JSON.parse(data); } catch { continue; }

              if (currentEvent === "hermes.tool.progress") {
                // Hermes tool event — forward minimal shape to the client.
                const p = parsed as { tool?: string; status?: string };
                if (p.tool && p.status) {
                  await stream.writeSSE({
                    event: "tool",
                    data: JSON.stringify({ name: p.tool, status: p.status }),
                  });
                }
                continue;
              }

              // OpenAI ChatCompletion chunk — pull out delta.content.
              const chunk = parsed as {
                choices?: Array<{
                  delta?: { content?: string };
                  finish_reason?: string | null;
                }>;
              };
              const choice = chunk.choices?.[0];
              const text = choice?.delta?.content;
              if (typeof text === "string" && text.length > 0) {
                sawText = true;
                await stream.writeSSE({
                  event: "text",
                  data: JSON.stringify({ chunk: text }),
                });
              }
              if (choice?.finish_reason) {
                finishReason = choice.finish_reason;
              }
            }
            // Ignore other field types (id:, retry:, comments starting with `:`).
          }
        }
        if (!sawText) {
          const fallback = await fetch(`${HERMES_BASE_URL}/v1/chat/completions`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "hermes-agent",
              stream: false,
              messages: injectSystemPrompt(messages),
            }),
          });
          if (fallback.ok) {
            const json = await fallback.json() as {
              choices?: Array<{ message?: { content?: string } }>;
            };
            const text = json.choices?.[0]?.message?.content;
            if (typeof text === "string" && text.length > 0) {
              await stream.writeSSE({
                event: "text",
                data: JSON.stringify({ chunk: text }),
              });
            }
          }
        }
        await stream.writeSSE({
          event: "done",
          data: JSON.stringify({ finish_reason: finishReason }),
        });
      } catch (err) {
        await stream.writeSSE({
          event: "error",
          data: JSON.stringify({ message: err instanceof Error ? err.message : String(err) }),
        });
      }
    });
  });

  return r;
}
