import type { AIManual } from "../manuals.js";
import type { Signal } from "@ke/domain";

export interface ReviewPromptArgs {
  manualName: string;
  manual: AIManual;
  signals: Signal[];
  /** ISO date used in the rule timestamp. Falls back to today. */
  date?: string;
}

export function buildReviewPrompt({ manualName, manual, signals, date }: ReviewPromptArgs): string {
  const today = date ?? new Date().toISOString().slice(0, 10);

  // Aggregate signals so the AI sees patterns, not raw events.
  const byType: Record<string, number> = {};
  const failureMessages: string[] = [];
  const repeatedOnElements: Record<string, number> = {};
  for (const s of signals) {
    byType[s.type] = (byType[s.type] ?? 0) + 1;
    if (s.type === "op.failed" && s.data && typeof s.data.message === "string") {
      failureMessages.push(`${s.op ?? "?"}: ${(s.data.message as string).slice(0, 200)}`);
    }
    if ((s.type === "user.repeated_op" || s.type === "user.frustrated") && s.elementId) {
      repeatedOnElements[s.elementId] = (repeatedOnElements[s.elementId] ?? 0) + 1;
    }
  }
  const summaryLines = [
    `信号总数: ${signals.length}`,
    `按类型: ${JSON.stringify(byType)}`,
    failureMessages.length > 0 ? `失败样例 (最多 10):\n  - ${failureMessages.slice(0, 10).join("\n  - ")}` : "",
    Object.keys(repeatedOnElements).length > 0
      ? `用户反复操作的元: ${JSON.stringify(repeatedOnElements)}`
      : "",
  ].filter(Boolean).join("\n");

  return `你是 Rich——我的私人 AI 助理。本次任务你担任"复盘 AI"。

你正在为另一个 AI（${manualName}）总结经验。它最近产出的任务伴随了下面的用户信号，你需要从中提炼出 0-5 条新的 **Learned Rules**，写回它的说明书。

# 当前 ${manualName} 说明书

\`\`\`markdown
${manual.raw}
\`\`\`

# 最近用户信号摘要

${summaryLines}

# 原始信号（最近 ${signals.length} 条，按时间排序）

\`\`\`jsonl
${signals.slice(-50).map(s => JSON.stringify(s)).join("\n")}
\`\`\`

# 你的任务

按这些规则提炼新经验：
1. **高频**：至少 3 个独立信号支撑同一观察才能成为规则
2. **新颖**：和说明书已有 Pitfalls / Learned Rules 重复的不要再加
3. **可执行**：用 do X / don't Y 祈使句
4. **简短**：≤ 30 字一条
5. **诚实**：若信号不足以支撑任何新规则，返回空数组

输出严格 JSON：

\`\`\`json
{
  "rules": [
    { "text": "<规则文本>", "rationale": "<为什么 (内部审计用，不进说明书)>", "date": "${today}" }
  ]
}
\`\`\`

只输出 JSON。不要 Markdown 围栏或解释性文字。`;
}
