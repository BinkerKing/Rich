import { useEffect, useState, type ReactNode } from "react";
import { ProjectListView } from "./ProjectListView.js";
import { ProjectWorkspace } from "./ProjectWorkspace.js";
import { consumeShortcutOpen, SHORTCUT_OPEN_EVENT, type ShortcutTarget } from "../lib/shortcutEngine.js";
import "./ProjectsView.css";
import "./project-management/ProjectManagementLinear.css";

/**
 * 项目管理 顶级视图。
 *
 * 镜像 PracticeView 的两段式：
 *   - 无 selectedId → ProjectListView（项目卡片墙）
 *   - 有 selectedId → ProjectWorkspace（全屏项目控制台 + 7 个 section）
 *
 * 跟「项目实战」(practice) 的区分：
 *   - practice = 学习+练手项目，关注 PRD / 知识点 / 拆解
 *   - project  = 生产项目运维，关注部署 / 凭证 / 代码 / 待办 / 答疑 / 文件夹 / 报告
 */
export function ProjectsView(): ReactNode {
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    const target = consumeShortcutOpen();
    return target?.kind === "project" ? target.id : null;
  });

  useEffect(() => {
    const onShortcutOpen = (event: Event) => {
      const target = (event as CustomEvent<ShortcutTarget>).detail;
      if (target?.kind === "project") setSelectedId(target.id);
    };
    window.addEventListener(SHORTCUT_OPEN_EVENT, onShortcutOpen as EventListener);
    return () => window.removeEventListener(SHORTCUT_OPEN_EVENT, onShortcutOpen as EventListener);
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      const target = event.target as HTMLElement | null;
      const inputLike = target?.closest?.("input, textarea, [contenteditable='true']");
      if (inputLike) return;
      if (document.querySelector("[role='dialog'], dialog[open], .prj-drawer-overlay")) return;
      event.preventDefault();
      event.stopPropagation();
      setSelectedId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId]);

  if (selectedId) {
    return <ProjectWorkspace projectId={selectedId} />;
  }
  return <ProjectListView onPick={setSelectedId} />;
}
