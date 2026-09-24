import { useEffect } from "react";

export const CURRENT_CODEX_OPEN_EVENT = "rich:open-current-codex";

export function requestCurrentCodexOpen() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CURRENT_CODEX_OPEN_EVENT));
}

/** Lets the visible resource handle the global "open its Codex Session" shortcut. */
export function useCurrentCodexShortcut(opener?: () => void) {
  useEffect(() => {
    if (!opener) return;
    const open = () => opener();
    window.addEventListener(CURRENT_CODEX_OPEN_EVENT, open);
    return () => window.removeEventListener(CURRENT_CODEX_OPEN_EVENT, open);
  }, [opener]);
}
