import type { AppView } from "../state/store.js";

export const RICH_NAV_EVENT = "rich.navigate";
export const RICH_NAV_STORAGE_KEY = "rich:navigate";

export type RichNavigationTarget =
  | { kind: "view"; view: AppView }
  | { kind: "element"; elementId: string };

export type RichNavigationPayload = RichNavigationTarget & {
  ts: number;
};

export function createRichNavigationPayload(target: RichNavigationTarget): RichNavigationPayload {
  return { ...target, ts: Date.now() };
}

export function emitRichNavigation(target: RichNavigationTarget) {
  if (typeof window === "undefined") return;
  const payload = createRichNavigationPayload(target);
  window.localStorage.setItem(RICH_NAV_STORAGE_KEY, JSON.stringify(payload));
  window.dispatchEvent(new CustomEvent(RICH_NAV_EVENT, { detail: payload }));
}

export function requestRichNavigation(target: RichNavigationTarget) {
  if (typeof window === "undefined") return;
  const payload = createRichNavigationPayload(target);
  window.localStorage.setItem(RICH_NAV_STORAGE_KEY, JSON.stringify(payload));
  window.dispatchEvent(new CustomEvent(RICH_NAV_EVENT, { detail: payload }));
  window.open(`rich://navigate?payload=${encodeURIComponent(JSON.stringify(payload))}`, "_blank", "noopener,noreferrer");
}
