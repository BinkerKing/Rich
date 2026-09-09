export function isNodeEditShortcut(event: Pick<KeyboardEvent, "key" | "code" | "altKey" | "ctrlKey" | "metaKey">): boolean {
  const isTildeKey = ["~", "～", "`"].includes(event.key) || event.code === "Backquote";
  return isTildeKey && !event.altKey && !event.ctrlKey && !event.metaKey;
}
