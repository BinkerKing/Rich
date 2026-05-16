import type { Element, Relation, LearningPath } from "@ke/domain";

export interface GenerateTreeResponse {
  rootId: string;
  elements: Element[];
  relations: Relation[];
  paths: LearningPath[];
}

export type GenerateTreeEvent =
  | { type: "delta"; text: string }
  | { type: "done"; result: GenerateTreeResponse }
  | { type: "error"; message: string };

const base = "/api";

export const api = {
  async *generateTreeStream(
    topic: string,
    model?: "claude-code" | "codex"
  ): AsyncIterable<GenerateTreeEvent> {
    const r = await fetch(`${base}/ai/generate-tree`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ topic, model }),
    });
    if (!r.ok || !r.body) throw new Error(`generate-tree failed: ${r.status}`);
    const reader = r.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) return;
      buf += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buf.indexOf("\n\n")) !== -1) {
        const chunk = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        const dataLine = chunk.split("\n").find(l => l.startsWith("data: "));
        if (!dataLine) continue;
        try {
          const obj = JSON.parse(dataLine.slice(6)) as GenerateTreeEvent;
          yield obj;
        } catch { /* ignore malformed chunk */ }
      }
    }
  },
  async getElement(id: string): Promise<Element | null> {
    const r = await fetch(`${base}/elements/${encodeURIComponent(id)}`);
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(`getElement failed: ${r.status}`);
    return r.json();
  },
};
