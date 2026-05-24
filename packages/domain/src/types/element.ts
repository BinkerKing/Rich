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
  | "group";    // 项目实战分组节点：实战项目下挂分组，分组下挂具体子元

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
