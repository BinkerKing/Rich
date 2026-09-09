import type { AppView } from "../state/store.js";
import type { IconName } from "../components/Icon.js";

export interface AppMenuItem {
  id: AppView;
  label: string;
  icon: IconName;
  desc: string;
  tone: "cyan" | "green" | "gold" | "blue" | "rose" | "violet" | "orange" | "slate";
}

export const APP_MENU_ITEMS: AppMenuItem[] = [
  { id: "tree", label: "知识树", icon: "branch", desc: "选择、新建、细化知识元", tone: "cyan" },
  { id: "news", label: "AI 早报", icon: "calendar", desc: "每日 AI 新闻与技能推荐", tone: "green" },
  { id: "mindmap", label: "导图 PPT", icon: "diamond", desc: "把文稿和知识树变成可播放导图", tone: "violet" },
  { id: "deepWorkbench", label: "深度工作台", icon: "branch", desc: "用脑图拆解问题、任务与学习主题", tone: "violet" },
  { id: "greatme", label: "计划管理", icon: "target", desc: "目标拆解、每日任务、每周复盘", tone: "blue" },
  { id: "taskWorkbench", label: "任务工作台", icon: "card", desc: "需求、计划、Codex 执行与成果", tone: "gold" },
  { id: "practice", label: "应用开发", icon: "card", desc: "应用需求、功能拆解、代码开发与效果图", tone: "violet" },
  { id: "projects", label: "项目管理", icon: "card", desc: "部署、代码、待办、答疑、文件夹、日报周报", tone: "blue" },
  { id: "rikingProjects", label: "项目启动", icon: "rocket", desc: "本地与服务器项目启动、日志、连接信息", tone: "green" },
  { id: "health", label: "健康顾问", icon: "heart", desc: "Rich 帮你盯身体：目标、计划、走势、建议", tone: "rose" },
  { id: "toolbox", label: "工具箱", icon: "rocket", desc: "锁屏、定时器和系统动作", tone: "orange" },
  { id: "admin", label: "后台", icon: "gear", desc: "AI 引擎、语料、手册、改造任务", tone: "slate" },
];
