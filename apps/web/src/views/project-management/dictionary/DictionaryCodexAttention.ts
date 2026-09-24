export type DictionaryCodexAttention = "idle" | "working" | "unread";

export function dictionaryCodexAttention(input: { running: boolean; latestAssistantCreatedAt?: string; viewedAt?: string }): DictionaryCodexAttention {
  if (input.running) return "working";
  if (input.latestAssistantCreatedAt && (!input.viewedAt || input.latestAssistantCreatedAt > input.viewedAt)) return "unread";
  return "idle";
}
