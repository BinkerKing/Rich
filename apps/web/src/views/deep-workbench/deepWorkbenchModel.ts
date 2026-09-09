export interface DeepWorkbenchNode {
  data: { uid: string; text: string; expand?: boolean };
  children: DeepWorkbenchNode[];
}

export interface DeepWorkbenchMap {
  root: DeepWorkbenchNode;
  layout: "logicalStructure" | "mindMap" | "organizationStructure";
  theme: { template: "default"; config: Record<string, unknown> };
  view?: Record<string, unknown>;
}

export interface DeepWorkbenchItem {
  id: string;
  title: string;
  map: DeepWorkbenchMap;
  createdAt: string;
  updatedAt: string;
}

export function createDeepWorkbenchMap(title: string, rootId: string): DeepWorkbenchMap {
  return {
    root: { data: { uid: rootId, text: title, expand: true }, children: [] },
    layout: "logicalStructure",
    theme: { template: "default", config: linearMindmapTheme },
  };
}

export const linearMindmapTheme: Record<string, unknown> = {
  backgroundColor: "#0a0a0b",
  lineColor: "rgba(94, 106, 210, .72)",
  lineWidth: 1,
  lineStyle: "curve",
  root: {
    shape: "roundedRectangle", fillColor: "#17171a", color: "#ffffff", fontSize: 18,
    fontWeight: "bold", borderColor: "#5e6ad2", borderWidth: 1, borderRadius: 8,
    hoverRectColor: "rgba(94, 106, 210, .55)",
  },
  second: {
    shape: "roundedRectangle", fillColor: "#141416", color: "#ffffff", fontSize: 15,
    borderColor: "rgba(255,255,255,.16)", borderWidth: 1, borderRadius: 8,
    marginX: 70, marginY: 28, hoverRectColor: "rgba(94, 106, 210, .55)",
  },
  node: {
    shape: "roundedRectangle", fillColor: "#111114", color: "#a1a1aa", fontSize: 14,
    borderColor: "rgba(255,255,255,.10)", borderWidth: 1, borderRadius: 6,
    marginX: 42, marginY: 16, hoverRectColor: "rgba(94, 106, 210, .55)",
  },
};
