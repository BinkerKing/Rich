import { useState, type ReactNode } from "react";
import { ProjectListView } from "./ProjectListView.js";
import { ProjectWorkspace } from "./ProjectWorkspace.js";
import "./ProjectsView.css";

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
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (selectedId) {
    return <ProjectWorkspace projectId={selectedId} onBack={() => setSelectedId(null)} />;
  }
  return <ProjectListView onPick={setSelectedId} />;
}
