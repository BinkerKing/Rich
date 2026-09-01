import type { AIAdapter, GenerateArgs, StreamEvent } from "./adapter.js";
import type { AgentRuntimeCapabilities } from "../agent-conversations/types.js";

/**
 * Hermes adapter — POSTs to Hermes Agent's OpenAI-compatible HTTP API.
 *
 * Hermes (NousResearch/hermes-agent) exposes a `/v1/chat/completions`
 * endpoint that speaks the OpenAI Chat Completions protocol. It thinks
 * via whatever `provider` is set in ~/.hermes/config.yaml — for our
 * setup that's Bailian Qwen via its API. Hermes ALSO has MCP-client capabilities, so when the prompt
 * tells it "use rich.X tool to do Y", it can call back into Rich's MCP
 * server while still streaming progress to us.
 *
 * Environment:
 *   HERMES_BASE_URL   default http://127.0.0.1:8000
 *   HERMES_API_KEY    optional bearer token if Hermes was configured
 *                     with auth (most local setups have none)
 *   HERMES_MODEL      default "hermes" — Hermes's default model alias
 *                     (which it routes to whatever provider is set)
 *
 * Streaming:
 *   We use SSE (server-sent events) — Hermes streams `data: {...}\n\n`
 *   chunks of `chat.completion.chunk` objects. Each chunk's
 *   `choices[0].delta.content` is the next text fragment.
 */
export class HermesAdapter implements AIAdapter {
  readonly name = "hermes" as const;

  private baseUrl = process.env.HERMES_BASE_URL || "http://127.0.0.1:8642";
  private apiKey = process.env.HERMES_API_KEY;
  private model = process.env.HERMES_MODEL || "hermes";

  private availabilityCache: boolean | undefined;

  agentRuntimeCapabilities(): AgentRuntimeCapabilities {
    return {
      profiles: ["chat_only"],
      enforcesToolSelection: false,
      enforcesWorkspaceRoot: false,
      supportsResumableToolCalls: false,
    };
  }

  async available(): Promise<boolean> {
    if (this.availabilityCache !== undefined) return this.availabilityCache;
    try {
      // Hermes API exposes /v1/models. We just check it returns 200.
      const res = await fetch(`${this.baseUrl}/v1/models`, {
        method: "GET",
        headers: this.authHeaders(),
        // 2-second timeout — Hermes is local; if it's not reachable that
        // fast, it's not running.
        signal: AbortSignal.timeout(2000),
      });
      this.availabilityCache = res.ok;
    } catch {
      this.availabilityCache = false;
    }
    return this.availabilityCache;
  }

  async *stream(args: GenerateArgs): AsyncIterable<StreamEvent> {
    let fullText = "";
    let sessionId: string | undefined = args.sessionId;
    try {
      const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: {
          ...this.authHeaders(),
          "content-type": "application/json",
          accept: "text/event-stream",
        },
        body: JSON.stringify({
          model: this.model,
          stream: true,
          messages: [
            ...(args.systemPrompt ? [{ role: "system", content: args.systemPrompt }] : []),
            { role: "user", content: args.prompt },
          ],
          // Hermes-specific — pass through any session id so it can
          // continue a previous conversation. Hermes ignores unknown
          // fields, so safe to send always.
          session_id: args.sessionId,
        }),
        signal: args.signal,
      });
      if (!res.ok || !res.body) {
        const errText = res.body ? await res.text().catch(() => "") : "";
        yield { type: "error", message: `Hermes HTTP ${res.status}: ${errText.slice(0, 300)}` };
        return;
      }

      // Parse SSE stream. Each event is `data: <json>\n\n`. The
      // terminator is `data: [DONE]\n\n`.
      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        // Process complete events (delimited by blank line).
        let idx;
        while ((idx = buf.indexOf("\n\n")) >= 0) {
          const block = buf.slice(0, idx).trim();
          buf = buf.slice(idx + 2);
          if (!block) continue;
          // Each block has one or more `data: ...` lines.
          for (const line of block.split("\n")) {
            if (!line.startsWith("data:")) continue;
            const payload = line.slice(5).trim();
            if (payload === "[DONE]") {
              yield { type: "done", fullText, sessionId };
              return;
            }
            try {
              const chunk = JSON.parse(payload) as {
                choices?: Array<{ delta?: { content?: string }; finish_reason?: string }>;
                session_id?: string;
              };
              if (chunk.session_id) sessionId = chunk.session_id;
              const delta = chunk.choices?.[0]?.delta?.content;
              if (typeof delta === "string" && delta.length > 0) {
                fullText += delta;
                yield { type: "delta", text: delta };
              }
            } catch {
              // Ignore malformed chunks — Hermes sometimes emits comments.
            }
          }
        }
      }
      // Stream ended without [DONE] — still emit done.
      yield { type: "done", fullText, sessionId };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      yield { type: "error", message: `Hermes adapter error: ${msg}` };
    }
  }

  private authHeaders(): Record<string, string> {
    return this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {};
  }
}
