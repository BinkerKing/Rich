import type { AIAdapter, AIAdapterName, GenerateArgs, StreamEvent } from "./adapter.js";

interface OpenAICompatibleOptions {
  name: AIAdapterName;
  baseUrl: string;
  apiKey?: string;
  model: string;
  modelEnvPrefixes?: string[];
  headers?: Record<string, string>;
}

export class OpenAICompatibleAdapter implements AIAdapter {
  readonly name: AIAdapterName;

  private availabilityCache: boolean | undefined;

  constructor(private readonly options: OpenAICompatibleOptions) {
    this.name = options.name;
  }

  async available(): Promise<boolean> {
    if (this.availabilityCache !== undefined) return this.availabilityCache;
    if (!this.options.apiKey) {
      this.availabilityCache = false;
      return false;
    }
    try {
      const res = await fetch(`${this.options.baseUrl}/models`, {
        method: "GET",
        headers: this.headers(),
        signal: AbortSignal.timeout(3000),
      });
      this.availabilityCache = res.ok;
    } catch {
      this.availabilityCache = false;
    }
    return this.availabilityCache;
  }

  async *stream(args: GenerateArgs): AsyncIterable<StreamEvent> {
    let fullText = "";
    if (!this.options.apiKey) {
      yield { type: "error", message: `${this.name} API key is not configured` };
      return;
    }

    try {
      const res = await fetch(`${this.options.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          ...this.headers(),
          "content-type": "application/json",
          accept: "text/event-stream",
        },
        body: JSON.stringify({
          model: this.modelForScenario(args.scenario),
          stream: true,
          messages: [
            ...(args.systemPrompt ? [{ role: "system", content: args.systemPrompt }] : []),
            { role: "user", content: args.prompt },
          ],
        }),
        signal: args.signal,
      });

      if (!res.ok || !res.body) {
        const detail = await res.text().catch(() => "");
        yield { type: "error", message: `${this.name} HTTP ${res.status}: ${detail.slice(0, 500)}` };
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buf.indexOf("\n\n")) >= 0) {
          const block = buf.slice(0, idx).trim();
          buf = buf.slice(idx + 2);
          if (!block) continue;
          for (const line of block.split("\n")) {
            if (!line.startsWith("data:")) continue;
            const payload = line.slice(5).trim();
            if (payload === "[DONE]") {
              yield { type: "done", fullText };
              return;
            }
            try {
              const chunk = JSON.parse(payload) as {
                choices?: Array<{ delta?: { content?: string }; finish_reason?: string | null }>;
              };
              const text = chunk.choices?.[0]?.delta?.content;
              if (text) {
                fullText += text;
                yield { type: "delta", text };
              }
            } catch {
              // Ignore provider comments or malformed chunks.
            }
          }
        }
      }

      yield { type: "done", fullText };
    } catch (e) {
      yield { type: "error", message: `${this.name} adapter error: ${e instanceof Error ? e.message : String(e)}` };
    }
  }

  private headers(): Record<string, string> {
    return {
      ...(this.options.apiKey ? { authorization: `Bearer ${this.options.apiKey}` } : {}),
      ...(this.options.headers ?? {}),
    };
  }

  private modelForScenario(scenario?: string): string {
    const normalized = scenario?.trim().replace(/[^a-zA-Z0-9]+/g, "_").toUpperCase();
    if (!normalized) return this.options.model;
    for (const prefix of this.options.modelEnvPrefixes ?? []) {
      const value = process.env[`${prefix}_${normalized}_MODEL`];
      if (value) return value;
    }
    return this.options.model;
  }
}
