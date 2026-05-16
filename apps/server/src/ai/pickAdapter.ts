import type { AIAdapter } from "./adapter.js";

export function pickAdapter(
  adapters: AIAdapter[],
  preference?: "claude-code" | "codex",
): AIAdapter {
  if (preference) {
    const found = adapters.find(a => a.name === preference);
    if (found) return found;
  }
  return adapters[0];
}
