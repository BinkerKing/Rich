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
  { id: "greatme", label: "计划管理", icon: "target", desc: "目标拆解、每日任务、每周复盘", tone: "blue" },
  { id: "practice", label: "项目实战", icon: "card", desc: "PRD、开发任务、整改建议", tone: "gold" },
  { id: "projects", label: "项目管理", icon: "card", desc: "部署、代码、待办、答疑、文件夹、日报周报", tone: "blue" },
  { id: "rikingProjects", label: "Riking 项目", icon: "rocket", desc: "本地与服务器项目启动、日志、连接信息", tone: "green" },
  { id: "health", label: "健康顾问", icon: "heart", desc: "Rich 帮你盯身体：目标、计划、走势、建议", tone: "rose" },
  { id: "miniapps", label: "小程序", icon: "grid", desc: "Script、tools 和独立工具入口", tone: "cyan" },
  { id: "toolbox", label: "工具箱", icon: "rocket", desc: "锁屏、定时器和系统动作", tone: "orange" },
  { id: "admin", label: "后台", icon: "gear", desc: "AI 引擎、语料、手册、改造任务", tone: "slate" },
];
