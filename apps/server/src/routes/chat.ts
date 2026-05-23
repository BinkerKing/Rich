import { Hono } from "hono";
import { streamSSE } from "hono/streaming";

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
    try {
      const upstream = await fetch(`${HERMES_BASE_URL}/v1/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "hermes-agent", stream: false, messages: body.messages }),
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

    // Forward to Hermes with stream:true. Hermes emits two flavours of SSE:
    //   - "data:" lines with OpenAI ChatCompletion chunks (text deltas)
    //   - "event: hermes.tool.progress" + "data:" lines (tool call events)
    // We translate both into our own event names so the client doesn't need
    // to know Hermes-specific protocol details.
    const upstream = await fetch(`${HERMES_BASE_URL}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "hermes-agent",
        stream: true,
        messages: body.messages,
      }),
    }).catch((e) => ({ ok: false, status: 503, statusText: String(e) } as Response));

    if (!upstream.ok || !("body" in upstream) || !upstream.body) {
      return c.json({
        error: `Hermes unavailable (status ${upstream.status})`,
      }, 503);
    }

    return streamSSE(c, async (stream) => {
      const reader = upstream.body!.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let currentEvent: string | null = null;

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
                await stream.writeSSE({ event: "done", data: JSON.stringify({ finish_reason: "stop" }) });
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
                await stream.writeSSE({
                  event: "text",
                  data: JSON.stringify({ chunk: text }),
                });
              }
              if (choice?.finish_reason) {
                await stream.writeSSE({
                  event: "done",
                  data: JSON.stringify({ finish_reason: choice.finish_reason }),
                });
              }
            }
            // Ignore other field types (id:, retry:, comments starting with `:`).
          }
        }
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
