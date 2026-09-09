export function isNodeEditShortcut(event: Pick<KeyboardEvent, "key" | "altKey" | "ctrlKey" | "metaKey">): boolean {
  return event.key === "~" && !event.altKey && !event.ctrlKey && !event.metaKey;
}
