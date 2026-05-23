import type { Element, QARecord } from "@ke/domain";

export interface AskPromptArgs {
  element: Element;
  question: string;
  /** Earlier Q&A on the same element, oldest first. Used as context. */
  history: QARecord[];
}

function elementSummary(el: Element): string {
  const c = (el.content as Record<string, unknown>) ?? {};
  const parts: string[] = [`标题：${el.title}`, `类型：${el.type}`];
  if (el.subtitle) parts.push(`副标题：${el.subtitle}`);
  if (typeof c.oneSentence === "string") parts.push(`一句话定义：${c.oneSentence}`);
  if (typeof c.intro === "string") parts.push(`引言：${c.intro}`);
  if (typeof c.coreExplain === "string") parts.push(`核心解释：${c.coreExplain}`);
  if (typeof c.whyMatters === "string") parts.push(`为什么重要：${c.whyMatters}`);
  if (typeof c.goal === "string") parts.push(`目标：${c.goal}`);
  if (typeof c.productPositioning === "string") parts.push(`项目定位：${c.productPositioning}`);
  if (typeof c.designQuestion === "string") parts.push(`设计问题：${c.designQuestion}`);
  return parts.join("\n");
}

export function buildAskPrompt({ element, question, history }: AskPromptArgs): string {
  const ctx = elementSummary(element);
  const past = history.length === 0
    ? ""
    : "\n\n该元已有的问答（按时间顺序）：\n" + history.map((qa, i) =>
        `Q${i + 1}：${qa.question}\nA${i + 1}：${qa.answer}`,
      ).join("\n\n");

  return `你是 Rich——我的私人 AI 助理。本次任务你担任答疑助手。请基于下方"知识元"的上下文回答用户问题。

【当前元】
${ctx}
${past}

【用户问题】
${question}

要求：
- 直接回答，不要前置寒暄、不要重复问题。
- 答案聚焦在该元的范围内；如果问题超出范围，简短指出并给出合理的延伸建议。
- 中文输出，段落短、信息密度高。能用列表就用列表。
- 不要输出 JSON、不要 markdown 围栏。回答可以使用普通 Markdown（标题、列表、加粗）。
- 如果问题模糊或前提错误，明确指出并复述你理解的版本再回答。

直接给出回答：`;
}
