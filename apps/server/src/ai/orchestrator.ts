import type { Element, Relation, LearningPath, RichnessLevel } from "@ke/domain";
import type { AIAdapter } from "./adapter.js";
import { buildGenerateTreePrompt } from "./prompts/generateTree.js";
import { extractJson } from "./extractJson.js";

export interface GenerateTreeResult {
  rootId: string;
  elements: Element[];
  relations: Relation[];
  paths: LearningPath[];
}

export type GenerateTreeEvent =
  | { type: "delta"; text: string }
  | { type: "done"; result: GenerateTreeResult }
  | { type: "error"; message: string };

export async function* generateTree(
  adapter: AIAdapter,
  args: { topic: string; richness?: RichnessLevel }
): AsyncIterable<GenerateTreeEvent> {
  const prompt = buildGenerateTreePrompt({ topic: args.topic, richness: args.richness ?? 2 });
  let buf = "";
  for await (const ev of adapter.stream({ prompt })) {
    if (ev.type === "delta") {
      buf += ev.text;
      yield { type: "delta", text: ev.text };
    } else if (ev.type === "error") {
      yield { type: "error", message: ev.message };
      return;
    } else if (ev.type === "done") {
      try {
        const parsed = extractJson(ev.fullText || buf) as GenerateTreeResult;
        if (!parsed.rootId || !Array.isArray(parsed.elements)) {
          throw new Error("Missing rootId or elements in AI output");
        }
        yield { type: "done", result: parsed };
        return;
      } catch (e) {
        yield { type: "error", message: `JSON parse failed: ${e instanceof Error ? e.message : e}` };
        return;
      }
    }
  }
}

export function pickAdapter(adapters: AIAdapter[], preference?: "claude-code" | "codex"): AIAdapter {
  if (preference) {
    const found = adapters.find(a => a.name === preference);
    if (found) return found;
  }
  return adapters[0];
}
