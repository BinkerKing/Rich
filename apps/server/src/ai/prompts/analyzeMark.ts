import type { Element } from "@ke/domain";

export interface AnalyzeMarkPromptArgs {
  element: Element;
  /** The text the user highlighted. */
  markedText: string;
  /** Optional surrounding context to disambiguate the mark's location. */
  contextBefore?: string;
  contextAfter?: string;
  /** Optional user-supplied focus (e.g. "解释 mechanism / 给个反例"). */
  hint?: string;
}

function elementSummary(el: Element): string {
  const c = (el.content as Record<string, unknown>) ?? {};
  const parts: string[] = [];
  if (typeof c.oneSentence === "string") parts.push(`一句话定义：${c.oneSentence}`);
  if (typeof c.intro === "string") parts.push(`引言：${c.intro}`);
  if (typeof c.coreExplain === "string") parts.push(`核心解释：${c.coreExplain}`);
  if (typeof c.whyMatters === "string") parts.push(`为什么重要：${c.whyMatters}`);
  if (typeof c.goal === "string") parts.push(`目标：${c.goal}`);
  if (typeof c.productPositioning === "string") parts.push(`项目定位：${c.productPositioning}`);
  if (typeof c.designQuestion === "string") parts.push(`设计问题：${c.designQuestion}`);
  return parts.join("\n");
}

export function buildAnalyzeMarkPrompt({ element, markedText, contextBefore, contextAfter, hint }: AnalyzeMarkPromptArgs): string {
  const ctx = elementSummary(element);
  const surrounding = contextBefore || contextAfter
    ? `\n上下文（用户标记句子的前后文）：${contextBefore ?? ""}【${markedText}】${contextAfter ?? ""}`
    : "";
  const hintBlock = hint?.trim() ? `\n用户的额外要求：「${hint.trim()}」` : "";

  return `你是 Know Everything 系统的知识深度分析师。直接输出 JSON，不要任何前后文。

任务：用户在当前元的正文中标记了下面这段文字，希望你结合当前元的语境，对**这一句**做精确、深入的展开分析（不是泛泛复述整个元）。

【当前元】
- 标题：${element.title}
- 类型：${element.type}
${ctx ? ctx : "（暂无概览字段）"}
${surrounding}
${hintBlock}

【用户标记的文字】
${markedText}

写作要求：
- 把这句话作为锚点，回答"它在这里指什么 / 为什么这样说 / 与上下文如何衔接 / 容易被忽略的细节 / 一个具体例子或反例"。
- 不要重述已经在元正文里出现过的内容；要补充新的角度、细节、或合理推论。
- 中文输出，2-5 段，可使用项目符号。
- 不要输出 JSON 围栏外的解释。

输出格式（严格 JSON）：
{
  "title": "围绕该标记的简短小标题（含「深入：」前缀），不超过 24 字",
  "body": "正文，可分段、可用 - 开头的项目列表"
}`;
}
