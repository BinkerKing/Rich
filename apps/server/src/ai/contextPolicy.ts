export type AIContextSource =
  | "chat-summary"
  | "recent-chat"
  | "current-request"
  | "element"
  | "element-children"
  | "manual"
  | "project"
  | "plan-state"
  | "document"
  | "shortlist"
  | "none";

export interface AIContextPolicy {
  operation: string;
  scenario: string;
  sources: AIContextSource[];
  memory: "durable" | "request" | "none";
  notes: string;
  entryType?: "http" | "async-queue" | "route-only";
}

export const AI_CONTEXT_POLICIES: AIContextPolicy[] = [
  {
    operation: "/api/chat",
    scenario: "chat",
    sources: ["chat-summary", "recent-chat", "current-request"],
    memory: "durable",
    notes: "首页聊天和快捷聊天共享服务端会话，上下文由摘要、最近消息和当前输入组成。",
  },
  {
    operation: "/api/chat/stream",
    scenario: "chat",
    sources: ["chat-summary", "recent-chat", "current-request"],
    memory: "durable",
    notes: "流式聊天同样落库，回复完成后异步刷新长期摘要。",
  },
  {
    operation: "/api/ai/great-me",
    scenario: "planning",
    sources: ["current-request", "plan-state"],
    memory: "request",
    notes: "由前端传 GreatMe 状态快照，适合个人计划推演；不自动读取聊天历史。",
  },
  {
    operation: "/api/ai/decompose-plan",
    scenario: "planning",
    sources: ["current-request"],
    memory: "request",
    notes: "根据单次自然语言目标拆解计划；后续应接项目/用户偏好上下文。",
  },
  {
    operation: "/api/ai/analyze-progress",
    scenario: "analysis",
    sources: ["plan-state", "current-request"],
    memory: "request",
    notes: "依赖计划状态和指标快照，适合进度分析。",
  },
  {
    operation: "/api/ai/draft-review",
    scenario: "review",
    sources: ["plan-state", "current-request"],
    memory: "request",
    notes: "依赖周任务、周目标、计划和上次复盘。",
  },
  {
    operation: "/api/ai/draft-prd",
    scenario: "project-practice",
    sources: ["project", "element-children", "current-request"],
    memory: "request",
    notes: "根据项目实战结构化内容起草 PRD。",
  },
  {
    operation: "/api/ai/draft-child",
    scenario: "project-practice",
    sources: ["project", "element-children", "current-request"],
    memory: "request",
    notes: "根据项目和已有标题生成子项。",
  },
  {
    operation: "/api/ai/guided-practice",
    scenario: "project-practice",
    sources: ["current-request", "project"],
    memory: "request",
    notes: "由前端传立项对话和草稿；对话会作为项目内容落库，不接默认聊天会话。",
  },
  {
    operation: "/api/ai/adjust-child",
    scenario: "project-practice",
    sources: ["project", "element", "current-request"],
    memory: "request",
    notes: "基于当前子元和调整方向重写内容。",
  },
  {
    operation: "/api/ai/analyze-input",
    scenario: "agent-task",
    sources: ["current-request", "shortlist"],
    memory: "request",
    notes: "首页输入解析先抽关键词，再用知识树候选集辅助归类。",
  },
  {
    operation: "/api/ai/generate-tree",
    scenario: "knowledge",
    sources: ["current-request", "manual"],
    memory: "request",
    notes: "按主题生成知识树，使用知识手册约束结构。",
  },
  {
    operation: "/api/ai/refine",
    scenario: "knowledge",
    sources: ["element", "manual", "current-request"],
    memory: "request",
    notes: "深化单个知识元，使用元素内容和知识手册。",
  },
  {
    operation: "/api/ai/expand",
    scenario: "knowledge",
    sources: ["element", "element-children", "manual", "current-request"],
    memory: "request",
    notes: "生成子元素时读取父元素和现有子元素，避免重复。",
  },
  {
    operation: "/api/ai/extend",
    scenario: "knowledge",
    sources: ["element", "manual", "current-request"],
    memory: "request",
    notes: "横向扩展概念，主要依赖当前元素和扩展方向。",
  },
  {
    operation: "/api/ai/path",
    scenario: "knowledge",
    sources: ["element", "element-children", "manual"],
    memory: "request",
    notes: "学习路径生成读取中心元素和可用元素集合。",
  },
  {
    operation: "/api/ai/ask",
    scenario: "analysis",
    sources: ["element", "current-request"],
    memory: "request",
    notes: "围绕指定元素问答，不读取全局聊天历史。",
  },
  {
    operation: "/api/ai/analyze-mark",
    scenario: "analysis",
    sources: ["element", "current-request"],
    memory: "request",
    notes: "分析用户划线内容，包含划线前后上下文。",
  },
  {
    operation: "/api/ai/news-generate-daily",
    scenario: "content",
    sources: ["current-request", "manual"],
    memory: "request",
    notes: "AI 早报按日期生成，后续可接用户偏好摘要和语料模板。",
  },
  {
    operation: "/api/mindmaps/generate",
    scenario: "mindmap",
    sources: ["current-request"],
    memory: "request",
    notes: "导图 PPT 页面提交文稿后生成导图树和嵌入内容；可选传入模型偏好。",
  },
  {
    operation: "image-queue",
    scenario: "image",
    sources: ["element", "document"],
    memory: "request",
    entryType: "async-queue",
    notes: "内容或导图结果写入图片占位块后，图片队列串行生成插图或导图封面，并将图片回写到原元素。",
  },
  {
    operation: "coding",
    scenario: "coding",
    sources: ["none"],
    memory: "none",
    entryType: "route-only",
    notes: "coding 场景已配置执行模型路由，但当前没有注册对应的 Rich 前端或 API 功能入口。",
  },
  {
    operation: "MCP tools",
    scenario: "agent-task",
    sources: ["element", "element-children", "manual", "project", "plan-state", "current-request"],
    memory: "request",
    notes: "Hermes/Codex 通过 MCP 操作 Rich 时，工具本身读取对应业务数据，不默认继承聊天上下文。",
  },
];

export function listAIContextPolicies(): AIContextPolicy[] {
  return [...AI_CONTEXT_POLICIES];
}
