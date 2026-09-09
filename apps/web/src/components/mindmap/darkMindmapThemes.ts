export interface DarkMindmapTheme {
  id: "neon-violet" | "cyan-amber" | "emerald-gold" | "deep-sea" | "wine-rose" | "graphite-spectrum";
  name: string;
  accent: string;
  config: Record<string, unknown>;
}

export const MINDMAP_LINE_STYLES = [
  { id: "curve", name: "曲线" },
  { id: "straight", name: "直线" },
  { id: "direct", name: "直连" },
] as const;

export type MindmapLineStyle = typeof MINDMAP_LINE_STYLES[number]["id"];

type Palette = {
  background: string;
  root: string;
  second: string;
  node: string;
  rootFill: string;
  secondFill: string;
  nodeFill: string;
  rootText: string;
  secondText: string;
  nodeText: string;
};

function squareBorderTheme(palette: Palette): Record<string, unknown> {
  return {
    backgroundColor: palette.background,
    lineColor: palette.second,
    lineWidth: 1.5,
    lineStyle: "curve",
    root: {
      shape: "rectangle", fillColor: palette.rootFill, color: palette.rootText, fontSize: 18,
      fontWeight: "bold", borderColor: palette.root, borderWidth: 2, borderRadius: 4,
      hoverRectColor: palette.root,
    },
    second: {
      shape: "rectangle", fillColor: palette.secondFill, color: palette.secondText, fontSize: 15,
      borderColor: palette.second, borderWidth: 1.5, borderRadius: 4, marginX: 70, marginY: 28,
      hoverRectColor: palette.second,
    },
    node: {
      shape: "rectangle", fillColor: palette.nodeFill, color: palette.nodeText, fontSize: 14,
      borderColor: palette.node, borderWidth: 1.5, borderRadius: 4, marginX: 42, marginY: 16,
      hoverRectColor: palette.node,
    },
  };
}

export const DARK_MINDMAP_THEMES: readonly DarkMindmapTheme[] = [
  { id: "neon-violet", name: "霓虹蓝紫", accent: "#8B5CF6", config: squareBorderTheme({ background: "#080A12", root: "#A78BFA", second: "#38BDF8", node: "#818CF8", rootFill: "#39206F", secondFill: "#123253", nodeFill: "#1A214B", rootText: "#FFFFFF", secondText: "#E0F2FE", nodeText: "#E0E7FF" }) },
  { id: "cyan-amber", name: "赛博青橙", accent: "#22D3EE", config: squareBorderTheme({ background: "#071013", root: "#22D3EE", second: "#FBBF24", node: "#2DD4BF", rootFill: "#124357", secondFill: "#493414", nodeFill: "#103C3A", rootText: "#ECFEFF", secondText: "#FFF7D6", nodeText: "#CCFBF1" }) },
  { id: "emerald-gold", name: "翡翠金", accent: "#34D399", config: squareBorderTheme({ background: "#09100D", root: "#34D399", second: "#FBBF24", node: "#5EEAD4", rootFill: "#124B3B", secondFill: "#4A3914", nodeFill: "#123C38", rootText: "#ECFDF5", secondText: "#FFFBEB", nodeText: "#CCFBF1" }) },
  { id: "deep-sea", name: "深海青", accent: "#0EA5E9", config: squareBorderTheme({ background: "#061016", root: "#38BDF8", second: "#2DD4BF", node: "#22D3EE", rootFill: "#123C5A", secondFill: "#0F4A45", nodeFill: "#10354A", rootText: "#F0F9FF", secondText: "#CCFBF1", nodeText: "#CFFAFE" }) },
  { id: "wine-rose", name: "酒红玫紫", accent: "#F43F5E", config: squareBorderTheme({ background: "#0F090E", root: "#FB7185", second: "#E879F9", node: "#FDA4AF", rootFill: "#5A1E32", secondFill: "#512040", nodeFill: "#48202F", rootText: "#FFF1F2", secondText: "#FDF4FF", nodeText: "#FFE4E6" }) },
  { id: "graphite-spectrum", name: "石墨多彩", accent: "#A78BFA", config: squareBorderTheme({ background: "#0A0B0D", root: "#A78BFA", second: "#60A5FA", node: "#FB923C", rootFill: "#34235A", secondFill: "#183557", nodeFill: "#4A2B18", rootText: "#F5F3FF", secondText: "#EFF6FF", nodeText: "#FFF7ED" }) },
];

export const DEFAULT_DARK_MINDMAP_THEME_ID = DARK_MINDMAP_THEMES[0].id;

export function getDarkMindmapTheme(id: string): DarkMindmapTheme {
  return DARK_MINDMAP_THEMES.find(theme => theme.id === id) ?? DARK_MINDMAP_THEMES[0];
}
