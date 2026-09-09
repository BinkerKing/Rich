import { DEFAULT_DARK_MINDMAP_THEME_ID, getDarkMindmapTheme, type DarkMindmapTheme } from "../../components/mindmap/darkMindmapThemes.js";

export interface DeepWorkbenchNode {
  data: { uid: string; text: string; expand?: boolean };
  children: DeepWorkbenchNode[];
}

export interface DeepWorkbenchMap {
  root: DeepWorkbenchNode;
  layout: "logicalStructure" | "mindMap" | "organizationStructure";
  theme: { id?: DarkMindmapTheme["id"]; template: "default"; config: Record<string, unknown> };
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
  const theme = getDarkMindmapTheme(DEFAULT_DARK_MINDMAP_THEME_ID);
  return {
    root: { data: { uid: rootId, text: title, expand: true }, children: [] },
    layout: "logicalStructure",
    theme: { id: theme.id, template: "default", config: theme.config },
  };
}
