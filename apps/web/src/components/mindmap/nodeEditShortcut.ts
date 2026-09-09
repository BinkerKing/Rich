export function isNodeEditShortcut(event: Pick<KeyboardEvent, "key" | "altKey" | "ctrlKey" | "metaKey">): boolean {
  return ["~", "～", "`"].includes(event.key) && !event.altKey && !event.ctrlKey && !event.metaKey;
}
