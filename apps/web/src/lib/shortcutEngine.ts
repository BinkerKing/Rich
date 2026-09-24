import { useEffect } from "react";

export type ShortcutTarget = { kind: string; id: string };
export type ShortcutRegistration = { id: string; shortcut: string; target: ShortcutTarget };

const SHORTCUT_OPEN_EVENT = "rich.shortcut-open";
const SHORTCUT_OPEN_STORAGE_KEY = "rich:shortcut-pending-target";
const RESERVED_SHORTCUTS = new Set(["mod+escape", "mod+enter", "mod+shift+space", "mod+shift+enter", "mod+shift+0"]);

/** Converts a browser key event into a portable Rich shortcut, for example mod+shift+k. */
export function shortcutFromEvent(event: KeyboardEvent): string | null {
  if (!(event.metaKey || event.ctrlKey) || event.altKey) return null;
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key.toLowerCase();
  if (!key || ["meta", "control", "shift", "alt"].includes(key)) return null;
  const shortcut = `mod${event.shiftKey ? "+shift" : ""}+${key}`;
  if (/^mod\+[0-9]$/.test(shortcut) || RESERVED_SHORTCUTS.has(shortcut)) return null;
  return shortcut;
}

export function formatShortcut(shortcut?: string): string {
  if (!shortcut) return "未设置";
  return shortcut
    .replace(/^mod/, navigator.platform.includes("Mac") ? "⌘" : "Ctrl")
    .replace("+shift", " ⇧")
    .replaceAll("+", " + ")
    .toUpperCase();
}

export function useShortcutEngine(registrations: ShortcutRegistration[], onOpen: (target: ShortcutTarget) => void) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      const shortcut = shortcutFromEvent(event);
      const registration = shortcut && registrations.find(item => item.shortcut === shortcut);
      if (!registration) return;
      event.preventDefault();
      onOpen(registration.target);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onOpen, registrations]);
}

export function requestShortcutOpen(target: ShortcutTarget) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(SHORTCUT_OPEN_STORAGE_KEY, JSON.stringify(target));
  window.dispatchEvent(new CustomEvent<ShortcutTarget>(SHORTCUT_OPEN_EVENT, { detail: target }));
}

export function consumeShortcutOpen(): ShortcutTarget | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(SHORTCUT_OPEN_STORAGE_KEY);
    window.sessionStorage.removeItem(SHORTCUT_OPEN_STORAGE_KEY);
    const target = raw ? JSON.parse(raw) as ShortcutTarget : null;
    return target?.kind && target.id ? target : null;
  } catch {
    return null;
  }
}

export { SHORTCUT_OPEN_EVENT };
