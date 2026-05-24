/**
 * AI 起草 PRD。
 *
 * 输入：practice 元 + 已有子元（concept / case / 已有的 product-design / step）
 *      + 用户可选的额外上下文
 * 输出：结构化 PRD（8 个 section），调用方写入一个新的 product-design 子元。
 */
export interface DraftPrdArgs {
  practice: {
    title: string;
    subtitle?: string;
    content?: unknown;
  };
  children: Array<{ type: string; title: string; subtitle?: string; content?: unknown }>;
  extraContext?: string;
}

export function buildDraftPrdPrompt(args: DraftPrdArgs): string {
  return `你是 Hermes Agent，正在帮 大斌哥 起草一份**实战项目的 PRD（产品需求文档）**。

任务：基于项目当前状态 + 已有的知识点 / 需求分析 / 旧 PRD，
输出一份**结构齐全、可执行、不写废话**的 PRD 草稿。

## 项目主元
- 标题：${args.practice.title}
- 副标题：${args.practice.subtitle ?? "(无)"}
- 详细内容：${args.practice.content ? JSON.stringify(args.practice.content).slice(0, 1200) : "(无)"}

## 已有子元（按类型）
${JSON.stringify(args.children, null, 2).slice(0, 6000)}

${args.extraContext ? `## 大斌哥 的额外要求\n${args.extraContext}\n` : ""}

## PRD 必含 8 个 section

1. **overview** — 项目概述（2-3 句话，能让一个不知情的人 30 秒理解你在做什么）
2. **targetUsers** — 目标用户 + 核心痛点（具体到角色和场景）
3. **coreFeatures** — 核心功能（3-7 条，每条一句话能说清楚做什么）
4. **userStories** — 用户故事（3-5 条，格式: "作为 X，我希望 Y，从而 Z"）
5. **acceptance** — 验收标准（3-5 条，每条**可观测、可验证**，不写"运行良好"）
6. **nonFunctional** — 非功能需求（性能 / 安全 / 可维护性 / 多端 etc.）一段话
7. **outOfScope** — 范围外（明确不做的事，避免范围蔓延）
8. **risks** — 风险与未决问题（3-5 条，每条标注：风险 + 影响 + 缓解方向）

PRD 的 title 字段：基于 practice 标题生成形如 "X PRD v0.1" 的命名。

## 不确定的地方 —— 列成 inquiries

PRD 这种长文档写的时候**很容易碰到拍板项**（验收边界、范围裁剪、性能 SLO、用户分层等）。
不要瞎猜，把这些不确定点写到 inquiries 数组里，每条给 2-4 个具体选项 + 简短说明，
大斌哥 选完再重写。没有不确定就 inquiries: [] 留空。

## 输出顺序（重要——给前端看进度用）

PRD 起草是长任务（30-60s）。请在内容前**先输出阶段标记**，让前端能切表情 + 进度条。
stage 名固定五个：理解 / 查资料 / 起草 / 校对 / 完成。示例：

[STAGE: 理解]
（简短一句话说你理解了什么）

[STAGE: 查资料]
（一句话说你看了哪些子元）

[STAGE: 起草]
（开始输出真正的 PRD JSON）

[STAGE: 校对]
（输出完后简短一句话校对说明）

[STAGE: 完成]

stage 标记每个占一行，前后留空行。前端会用正则识别这些标记切换 mascot 表情。

## 严格输出 JSON

只输出合法 JSON，不要 Markdown 代码块，不要前后缀。

{
  "title": "...",
  "sections": {
    "overview": "...",
    "targetUsers": "...",
    "coreFeatures": ["...", "..."],
    "userStories": ["作为 X，我希望 Y，从而 Z"],
    "acceptance": ["..."],
    "nonFunctional": "...",
    "outOfScope": ["..."],
    "risks": ["..."]
  },
  "inquiries": [
    {
      "question": "需要拍板的问题（一句话）",
      "options": [
        { "label": "选项 A", "description": "解释" },
        { "label": "选项 B", "description": "..." }
      ],
      "context": "关联到 PRD 哪一段（overview / acceptance / outOfScope etc.）",
      "importance": "blocker | nice-to-know"
    }
  ]
}`;
}
