import { useEffect } from "react";

export const CURRENT_CODEX_OPEN_EVENT = "rich:open-current-codex";

declare global {
  interface Window {
    __richOpenCurrentCodex?: () => void;
  }
}

export function requestCurrentCodexOpen() {
  if (typeof window === "undefined") return;
  if (window.__richOpenCurrentCodex) {
    window.__richOpenCurrentCodex();
    return;
  }
  window.dispatchEvent(new Event(CURRENT_CODEX_OPEN_EVENT));
}

/** Lets the visible resource handle the global "open its Codex Session" shortcut. */
export function useCurrentCodexShortcut(opener?: () => void) {
  useEffect(() => {
    if (!opener) return;
    const open = () => {
      if (window.__richOpenCurrentCodex === opener) opener();
    };
    window.__richOpenCurrentCodex = opener;
    window.addEventListener(CURRENT_CODEX_OPEN_EVENT, open);
    return () => {
      if (window.__richOpenCurrentCodex === opener) delete window.__richOpenCurrentCodex;
      window.removeEventListener(CURRENT_CODEX_OPEN_EVENT, open);
    };
  }, [opener]);
}
