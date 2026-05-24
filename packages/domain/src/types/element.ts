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
  | "inquiry";       // 项目实战：提问（AI 不确定时，向用户列出选项让用户拍板）

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
