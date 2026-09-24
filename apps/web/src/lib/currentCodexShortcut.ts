import { useEffect } from "react";

declare global {
  interface Window {
    __richOpenCurrentCodex?: () => void;
  }
}

export function requestCurrentCodexOpen() {
  if (typeof window === "undefined") return;
  window.__richOpenCurrentCodex?.();
}

/** Lets the visible resource handle the global "open its Codex Session" shortcut. */
export function useCurrentCodexShortcut(opener?: () => void) {
  useEffect(() => {
    if (!opener) return;
    window.__richOpenCurrentCodex = opener;
    return () => {
      if (window.__richOpenCurrentCodex === opener) delete window.__richOpenCurrentCodex;
    };
  }, [opener]);
}
