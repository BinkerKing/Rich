/**
 * AI 调整项目实战的单个子元。
 *
 * 输入：practice（项目上下文）+ 这个元当前状态 + 大斌哥给的调整方向
 * 输出：整版的新 title + subtitle + content（前端直接替换）
 *
 * 跟 draft-child 不同：draft 是从无到有，adjust 是基于已有内容微调。
 * AI 必须 *尊重原有结构*——content 里的字段名保持稳定，只改值；除非
 * 大斌哥 明确说"改字段"。
 */
export interface AdjustChildArgs {
  practice: { title: string; subtitle?: string; content?: unknown };
  /** 元的类型，决定 content 的字段模板。 */
  groupType: "knowledge" | "requirement" | "feature" | "prd" | "dev-task" | "revision";
  /** 当前元的快照——AI 在这个基础上调整。 */
  current: {
    title: string;
    subtitle?: string;
    content?: unknown;
  };
  /** 大斌哥 写的调整方向。 */
  direction: string;
}

export function buildAdjustChildPrompt(args: AdjustChildArgs): string {
  const typeSpec = TYPE_SPEC[args.groupType];
  return `你是 Hermes Agent，正在帮 大斌哥 调整一个已有的「${typeSpec.label}」元。

## 项目主元
- 标题：${args.practice.title}
- 副标题：${args.practice.subtitle ?? "(无)"}
- 详细：${args.practice.content ? JSON.stringify(args.practice.content).slice(0, 600) : "(无)"}

## 这个元当前的状态
- title: ${args.current.title}
- subtitle: ${args.current.subtitle ?? "(无)"}
- content: ${args.current.content ? JSON.stringify(args.current.content, null, 2).slice(0, 2000) : "{}"}

## 大斌哥 的调整方向
${args.direction}

## 你的任务
基于上面的方向**调整这个元**，整版重写后返回 (title + subtitle + content)，前端会整体替换。

约束：
- **尊重原有 content 的字段结构**——字段名保持稳定，只改字段的值；除非 大斌哥 明确说"加 / 删 / 重命名某个字段"
- 没让你改的部分，保留原样
- 让你改的部分，按 大斌哥 的方向重写
- 标题如果方向没提到，保留原样；提到了就改
${typeSpec.guidance}

${typeSpec.contentTemplate ? `## content 推荐字段模板（仅作参考，原有字段优先保留）
${typeSpec.contentTemplate}
` : ""}

## 不确定的地方 —— 列成 inquiries

调整过程中**如果方向不够清楚 / 有多种合理走法**，不要瞎猜，列到 inquiries 数组里，
每条给 2-4 个选项 + 简短说明，大斌哥 选完再来重写。没有不确定就 inquiries: [] 留空。

## 严格输出 JSON

只输出合法 JSON，不要 Markdown，不要前后缀。

{
  "title": "...",
  "subtitle": "...",
  "content": { ... },
  "inquiries": [
    {
      "question": "需要拍板的问题（一句话）",
      "options": [
        { "label": "选项 A", "description": "解释" },
        { "label": "选项 B", "description": "..." }
      ],
      "context": "关联到当前元的哪一段",
      "importance": "blocker | nice-to-know"
    }
  ]
}`;
}

interface TypeSpec {
  label: string;
  guidance: string;
  contentTemplate?: string;
}

const TYPE_SPEC: Record<"knowledge" | "requirement" | "feature" | "prd" | "dev-task" | "revision", TypeSpec> = {
  knowledge: {
    label: "知识点",
    guidance: "- 密度要高，避免空话；具体例子优于抽象说明",
    contentTemplate: `definition: 这是什么（1 句）
why: 为什么重要（1-2 句）
how: 怎么用 / 关键做法（2-4 句或要点）
example: 具体例子（项目相关）
notes: 踩坑 / 备注（可选）`,
  },
  requirement: {
    label: "场景分析",
    guidance: `- "场景分析" = 用户在什么情况、想干什么、痛点是什么；不写解决方案
- 如果标题包含 "场景 N" 序号，调整时保留序号`,
    contentTemplate: `scenario: 用户在做什么 / 处于什么状态
painPoint: 当前痛点
expectedResponse: 用户期望系统怎么响应
trigger: 什么触发这个场景（可选）`,
  },
  feature: {
    label: "功能说明",
    guidance: `- "功能说明" = 系统要做的事，区分显性（用户直接看到）和隐性（背后的支撑）
- 不要把多个功能塞一条`,
    contentTemplate: `visibility: "显性" 或 "隐性"
description: 这个功能做什么
userValue: 用户能获得什么
implementationHint: 实现思路 / 涉及模块（可选）`,
  },
  prd: {
    label: "PRD",
    guidance: "- PRD 通常有 overview/targetUsers/coreFeatures/userStories/acceptance/nonFunctional/outOfScope/risks 8 段；按方向调整对应段",
    contentTemplate: `overview / targetUsers / coreFeatures[] / userStories[] / acceptance[] / nonFunctional / outOfScope[] / risks[]`,
  },
  "dev-task": {
    label: "开发任务",
    guidance: `- 开发任务 = 一次能完成的小活，2 小时内
- 标题动词开头："实现 X" / "调通 Y" / "修复 Z"`,
    contentTemplate: `description: 做什么（1-2 句）
steps: [步骤数组]
doneWhen: 完成判定（可观测）
estimate: 预估耗时`,
  },
  revision: {
    label: "整改建议",
    guidance: `- "整改建议" = 看到当前版本后提的改进建议 + 分析 + 整改方案
- 必含 suggestion / analysis / plan / decision；analysis 要诚实评估值不值得做`,
    contentTemplate: `suggestion: 用户提的建议
analysis: 影响 + 风险 + 是否值得做
plan: [整改步骤]
relatedTo: 关联元（可选）
decision: 做 | 暂缓 | 不做（带理由）`,
  },
};
