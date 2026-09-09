export interface DarkMindmapTheme {
  id: "neon-violet" | "cyan-amber" | "emerald-gold" | "deep-sea" | "wine-rose" | "graphite-spectrum";
  name: string;
  accent: string;
  config: Record<string, unknown>;
}

type Palette = {
  background: string;
  panel: string;
  root: string;
  second: string;
  node: string;
  text: string;
  muted: string;
};

function squareBorderTheme(palette: Palette): Record<string, unknown> {
  return {
    backgroundColor: palette.background,
    lineColor: palette.second,
    lineWidth: 1.5,
    lineStyle: "curve",
    root: {
      shape: "rectangle", fillColor: palette.panel, color: palette.text, fontSize: 18,
      fontWeight: "bold", borderColor: palette.root, borderWidth: 2, borderRadius: 4,
      hoverRectColor: palette.root,
    },
    second: {
      shape: "rectangle", fillColor: palette.panel, color: palette.text, fontSize: 15,
      borderColor: palette.second, borderWidth: 1.5, borderRadius: 4, marginX: 70, marginY: 28,
      hoverRectColor: palette.second,
    },
    node: {
      shape: "rectangle", fillColor: palette.background, color: palette.muted, fontSize: 14,
      borderColor: palette.node, borderWidth: 1.5, borderRadius: 4, marginX: 42, marginY: 16,
      hoverRectColor: palette.node,
    },
  };
}

export const DARK_MINDMAP_THEMES: readonly DarkMindmapTheme[] = [
  { id: "neon-violet", name: "霓虹蓝紫", accent: "#8B5CF6", config: squareBorderTheme({ background: "#080A12", panel: "#11142A", root: "#8B5CF6", second: "#38BDF8", node: "#6366F1", text: "#F4F1FF", muted: "#C4C8E8" }) },
  { id: "cyan-amber", name: "赛博青橙", accent: "#22D3EE", config: squareBorderTheme({ background: "#071013", panel: "#0C1A1D", root: "#22D3EE", second: "#F59E0B", node: "#14B8A6", text: "#ECFEFF", muted: "#B8D9DA" }) },
  { id: "emerald-gold", name: "翡翠金", accent: "#34D399", config: squareBorderTheme({ background: "#09100D", panel: "#102018", root: "#34D399", second: "#FBBF24", node: "#10B981", text: "#F0FDF4", muted: "#BED6C5" }) },
  { id: "deep-sea", name: "深海青", accent: "#0EA5E9", config: squareBorderTheme({ background: "#061016", panel: "#0B1B25", root: "#0EA5E9", second: "#2DD4BF", node: "#06B6D4", text: "#ECFEFF", muted: "#B7D7E6" }) },
  { id: "wine-rose", name: "酒红玫紫", accent: "#F43F5E", config: squareBorderTheme({ background: "#0F090E", panel: "#24101C", root: "#F43F5E", second: "#D946EF", node: "#FB7185", text: "#FFF1F2", muted: "#E6C2CC" }) },
  { id: "graphite-spectrum", name: "石墨多彩", accent: "#A78BFA", config: squareBorderTheme({ background: "#0A0B0D", panel: "#17181C", root: "#A78BFA", second: "#60A5FA", node: "#F97316", text: "#F5F5F5", muted: "#C5C7CC" }) },
];

export const DEFAULT_DARK_MINDMAP_THEME_ID = DARK_MINDMAP_THEMES[0].id;

export function getDarkMindmapTheme(id: string): DarkMindmapTheme {
  return DARK_MINDMAP_THEMES.find(theme => theme.id === id) ?? DARK_MINDMAP_THEMES[0];
}
