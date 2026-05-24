/**
 * AI 起草项目实战的单个子元（知识点 / 场景分析 / 功能说明 / 开发任务）。
 *
 * 输入：practice 元（顶层项目）+ groupType（要建什么类型）+ existingTitles
 *      （同分组现有元的标题，避免重复）+ direction（大斌哥写的方向/想法）
 * 输出：{ title, subtitle, content } —— content 形态按 type 走最自然的字段。
 */
export interface DraftChildArgs {
  practice: { title: string; subtitle?: string; content?: unknown };
  groupType: "knowledge" | "requirement" | "feature" | "dev-task" | "revision";
  existingTitles: string[];
  direction: string;
}

export function buildDraftChildPrompt(args: DraftChildArgs): string {
  const typeSpec = TYPE_SPEC[args.groupType];
  return `你是 Hermes Agent，正在帮 大斌哥 在实战项目里写一个**${typeSpec.label}**。

## 项目主元
- 标题：${args.practice.title}
- 副标题：${args.practice.subtitle ?? "(无)"}
- 详细：${args.practice.content ? JSON.stringify(args.practice.content).slice(0, 800) : "(无)"}

## 已有的${typeSpec.label}（避免重复）
${args.existingTitles.length === 0 ? "(暂无)" : args.existingTitles.map(t => `- ${t}`).join("\n")}

## 大斌哥 给的方向
${args.direction}

## 你的任务
基于上面的方向，写一个新的「${typeSpec.label}」元素：

${typeSpec.guidance}

## 不确定的地方 —— 列成 inquiries

写的过程中**如果有需要 大斌哥 拍板的地方**（多种合理走向、关键参数选择、范围边界等），
不要瞎填，而是把这些不确定点写到 inquiries 数组里。每条问题给 2-4 个具体选项 + 简短说明，
大斌哥 选一个再回来重写这部分。没有不确定就 inquiries: [] 留空。

## 严格输出 JSON

只输出合法 JSON，不要 Markdown，不要前后缀。

{
  "title": "...（≤40 字，简洁有信息量）",
  "subtitle": "...（≤80 字，一句话说明）",
  "content": ${typeSpec.contentExample},
  "inquiries": [
    {
      "question": "需要确认的问题（一句话）",
      "options": [
        { "label": "选项 A 短标签", "description": "解释这个选项含义" },
        { "label": "选项 B 短标签", "description": "..." }
      ],
      "context": "这个问题关系到 ${typeSpec.label} 的哪一段（如 PRD 的 acceptance / 场景 5 的 painPoint）",
      "importance": "blocker | nice-to-know"
    }
  ]
}`;
}

interface TypeSpec {
  label: string;
  guidance: string;
  /** JSON 字段示例，给 AI 看格式。 */
  contentExample: string;
}

const TYPE_SPEC: Record<"knowledge" | "requirement" | "feature" | "dev-task" | "revision", TypeSpec> = {
  knowledge: {
    label: "知识点",
    guidance: `要点：
- 知识点是项目过程中**复用性高的概念 / 方法 / 经验**
- 不要写"事项"或"待办"——那是开发任务
- 用大斌哥能 30 秒读完的密度，避免空话`,
    contentExample: `{
    "definition": "这是什么（1 句话）",
    "why": "为什么重要（1-2 句）",
    "how": "怎么用 / 关键做法（2-4 句或 3-5 条要点）",
    "example": "具体例子（项目相关，≤120 字）",
    "notes": "踩坑 / 备注（可选）"
  }`,
  },
  requirement: {
    label: "场景分析",
    guidance: `要点：
- 「场景分析」= 用户在什么情况下、想干什么、痛点是什么
- 标题用 "场景 N：xxx" 格式（N 是序号，参考已有的最大号 + 1）
- 不写解决方案——那是 PRD / 功能说明的事`,
    contentExample: `{
    "scenario": "用户在做什么 / 处于什么状态（2-3 句）",
    "painPoint": "当前的痛点 / 不爽的地方（1-2 句）",
    "expectedResponse": "用户期望系统怎么响应（1-2 句）",
    "trigger": "什么触发这个场景（1 句，可选）"
  }`,
  },
  feature: {
    label: "功能说明",
    guidance: `要点：
- 「功能说明」= 系统要做的事，分**显性**（用户直接看到）和**隐性**（背后的支撑）
- 一条 = 一个独立可识别的功能，不要混打
- 显性举例：「历史回看」「批量删除」；隐性举例：「空状态文案」「键盘快捷键」「错误恢复」`,
    contentExample: `{
    "visibility": "显性 | 隐性",
    "description": "这个功能做什么（1-2 句）",
    "userValue": "用户能获得什么（1 句）",
    "implementationHint": "实现思路 / 涉及模块（1-2 句，可选）"
  }`,
  },
  "dev-task": {
    label: "开发任务",
    guidance: `要点：
- 开发任务 = **一次能完成的小活**，2 小时以内做完最好
- 标题动词开头："实现 X" / "调通 Y" / "修复 Z"
- 任务太大就拆，不要塞「重构整个登录模块」这种粒度`,
    contentExample: `{
    "description": "做什么（1-2 句）",
    "steps": ["1. ...", "2. ...", "3. ..."],
    "doneWhen": "完成的判定标准（可观测、可验证）",
    "estimate": "预估耗时（如 30min / 1h / 半天）"
  }`,
  },
  revision: {
    label: "整改建议",
    guidance: `要点：
- 「整改建议」= 看到当前版本之后提出的改进意见 + 分析 + 整改方案
- 标题用具体动作开头："改 X 的 Y" / "把 A 调成 B" / "去掉 C"
- 必须包含 suggestion / analysis / plan 三段；analysis 要诚实地评估值不值得做`,
    contentExample: `{
    "suggestion": "用户提的建议（原话或精炼版，1-2 句）",
    "analysis": "影响范围 + 风险 + 是否值得做（2-4 句客观分析）",
    "plan": ["1. ...", "2. ...", "3. ..."],
    "relatedTo": "关联到哪些已有的元 / 功能 / PRD 段（可选）",
    "decision": "做 | 暂缓 | 不做（带一句理由）"
  }`,
  },
};
