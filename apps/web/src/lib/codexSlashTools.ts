export interface CodexSlashTool {
  id: string;
  label: string;
  hint: string;
  searchTerms: string[];
}

export const CODEX_SLASH_TOOLS: CodexSlashTool[] = [
  { id: "image", label: "图片", hint: "添加图片", searchTerms: ["tupian", "tp", "image"] },
  { id: "location", label: "定位", hint: "附加页面和业务定位", searchTerms: ["dingwei", "dw", "location"] },
  { id: "location-screenshot", label: "定位截图", hint: "将当前界面作为图片附加", searchTerms: ["dingwei jietu", "dwjt", "location screenshot"] },
  { id: "task-mode", label: "任务模式", hint: "选择当前页面可用的任务模式", searchTerms: ["renwu moshi", "rwms", "task mode"] },
];

export function parseCodexSlashInput(value: string): { open: boolean; query: string } {
  if (!value.startsWith("/") || value.includes("\n")) return { open: false, query: "" };
  return { open: true, query: value.slice(1).trim().toLowerCase() };
}

export function filterCodexSlashTools(query: string): CodexSlashTool[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return CODEX_SLASH_TOOLS;
  return CODEX_SLASH_TOOLS.filter(tool => [tool.id, tool.label, tool.hint, ...tool.searchTerms]
    .some(term => term.toLowerCase().includes(normalized)));
}
