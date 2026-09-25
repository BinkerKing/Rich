import type { DeepWorkbenchItem } from "./deepWorkbenchModel.js";

const endpoint = "/api/deep-mindmaps";

async function request<T>(path = "", init?: RequestInit): Promise<T> {
  const response = await fetch(`${endpoint}${path}`, init);
  const data = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(data.error ?? `DeepMindMap request failed (${response.status})`);
  return data;
}

export function mergeLegacyMaps(server: DeepWorkbenchItem[], legacy: DeepWorkbenchItem[]): DeepWorkbenchItem[] {
  const ids = new Set(server.map(item => item.id));
  return legacy.filter(item => item.source !== "knowledge-tree" && !ids.has(item.id));
}

export const deepMindMapsApi = {
  list: () => request<DeepWorkbenchItem[]>(),
  create: (item: DeepWorkbenchItem, importOnly = false) => request<DeepWorkbenchItem>("/", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...item, importOnly }) }),
  update: (item: DeepWorkbenchItem, expectedUpdatedAt: string) => request<DeepWorkbenchItem>(`/${encodeURIComponent(item.id)}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: item.title, map: item.map, expectedUpdatedAt }) }),
  remove: (id: string) => request<void>(`/${encodeURIComponent(id)}`, { method: "DELETE" }),
};
