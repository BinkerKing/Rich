import { create } from "zustand";

export type ThemeId = "cyber" | "brutal" | "blueprint" | "duotone" | "fabric" | "editorial" | "ghibli";

export const THEMES: { id: ThemeId; label: string; description: string }[] = [
  { id: "cyber", label: "黑曜客户端", description: "黑底白字 · 多彩重点 · 桌面感" },
  { id: "brutal", label: "野兽派", description: "硬边 · 实色块 · 偏移黑影" },
  { id: "blueprint", label: "蓝图工程", description: "靛蓝纸 · 细线 · 制图字体" },
  { id: "duotone", label: "双色编辑", description: "荧光柠绿 · 深墨 · 电光粉" },
  { id: "fabric", label: "织物手作", description: "亚麻 · 圆角 · 缝线虚边" },
  { id: "editorial", label: "报刊版面", description: "奶纸 · 浓墨粗边 · 衬线标题" },
  { id: "ghibli", label: "宫崎骏绘本", description: "天空蓝 · 草坡绿 · 暖橙夕阳" },
];

const STORAGE_KEY = "ke.theme";

function readInitial(): ThemeId {
  if (typeof localStorage === "undefined") return "cyber";
  const stored = localStorage.getItem(STORAGE_KEY);
  const valid: ThemeId[] = ["cyber", "brutal", "blueprint", "duotone", "fabric", "editorial", "ghibli"];
  return (valid as string[]).includes(stored ?? "") ? (stored as ThemeId) : "cyber";
}

function applyToDom(theme: ThemeId) {
  if (typeof document !== "undefined") {
    document.documentElement.dataset.theme = theme;
  }
}

interface ThemeState {
  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;
}

const initial = readInitial();
applyToDom(initial);

export const useThemeStore = create<ThemeState>(set => ({
  theme: initial,
  setTheme: (theme) => {
    applyToDom(theme);
    try { localStorage.setItem(STORAGE_KEY, theme); } catch { /* ignore */ }
    set({ theme });
  },
}));
