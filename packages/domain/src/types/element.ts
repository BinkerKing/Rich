export type ElementType =
  | "topic"
  | "concept"
  | "step"
  | "product-design"
  | "viewpoint"
  | "question"
  | "case"
  | "tool"
  | "ability"
  | "project"
  | "practice"
  | "summary"
  | "relation"
  | "dispute"
  | "exercise"
  | "report"
  | "guide"
  | "group"          // 项目实战：分组节点
  | "knowledge"      // 项目实战：知识点
  | "requirement"    // 项目实战：场景分析（type 名沿用历史 requirement，display label 改为"场景分析"）
  | "feature"        // 项目实战：功能说明（显性 + 隐性功能清单）
  | "prd"            // 项目实战：PRD 文档
  | "dev-task"       // 项目实战：开发任务
  | "revision"       // 项目实战：整改建议（看到当前版本 → 提建议 → 分析 → 规划 → 实施）
  | "inquiry"        // 项目实战：提问（AI 不确定时，向用户列出选项让用户拍板）
  // ── 项目管理（生产项目，非学习实战）─────────────────────────
  | "deployment-env" // 部署环境（dev/staging/prod 各一个）
  | "deployment-step" // 部署步骤（按环境 + 版本拆分，内含 checklist）
  | "server"         // 服务器（IP / 端口 / OS / 备注）
  | "credential"     // 账号凭证（账号/密码/key/URL，明文存 + 隐藏 UI）
  | "repo"           // 代码仓库（URL / 默认分支 / vendor）
  | "version-release" // 发布版本（version / changelog / releasedAt）
  | "faq"            // 业务答疑（Q/A 配对）
  | "folder-snapshot" // 项目文件夹 AI 分析快照 + 整理 plan
  | "connection";    // 服务器端口连接（fromServerId → toServerId / 协议 / 用途 / 防火墙状态）

export type ElementId = string;

export type RichnessLevel = 1 | 2 | 3 | 4 | 5;

export interface ElementMetadata {
  createdAt: string;
  updatedAt: string;
  generatedBy: "ai" | "user";
  aiModel?: string;
  aiSessionId?: string;
  richness: RichnessLevel;
}

export interface Element<TContent = unknown> {
  id: ElementId;
  type: ElementType;
  title: string;
  subtitle?: string;
  aliases?: string[];
  tags?: string[];
  domain?: string;
  difficulty?: "low" | "mid" | "high";
  /** 仅 type="step" (开发任务) 用。其他类型忽略。
   *  undefined → UI 按 "todo" 渲染（向后兼容老元素） */
  status?: "todo" | "doing" | "done";
  content: TContent;
  metadata: ElementMetadata;
}
