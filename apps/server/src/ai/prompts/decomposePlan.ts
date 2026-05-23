/**
 * Plan decomposition prompt — Hermes / Codex takes a user's natural-language
 * intent ("我想 3 个月减 10 斤") and emits a structured tree of
 * plan → year/month/week goals → day tasks.
 *
 * Granularity is AI-decided: short-window goals may skip the year/month
 * layers; long-window goals fan out to year + month + week + day.
 */
export interface DecomposePlanPromptArgs {
  /** User's raw intent. */
  intent: string;
  /** Today (ISO YYYY-MM-DD). Server fills this — AI needs an anchor. */
  today: string;
  /** Optional hint from the user about target end date. May be empty. */
  targetEnd?: string;
}

export function buildDecomposePlanPrompt({ intent, today, targetEnd }: DecomposePlanPromptArgs): string {
  return `你是 Hermes Agent，正在担任「计划管理」的目标拆解器。

你的任务：把一句自然语言意图拆成一棵可执行的计划树
（plan → year/month/week 目标 → 日任务），让用户能立刻开始行动。

## 用户意图
${intent}

## 今天
${today}

${targetEnd ? `## 用户希望完成的目标日期\n${targetEnd}\n` : ""}

## 拆解原则
1. **自己判断时间跨度和层级**：
   - 1-3 周搞定的目标 → 只生成 week + day 两层（不要硬塞 month/year）
   - 1-3 个月的目标 → 生成 month + week + day 三层
   - 6 个月以上 → 生成 year + month + week + day 四层
   - scopes 字段必须如实反映你输出的层级（只列你确实创建了的层）
2. **目标命名要可验证**：不写"加强锻炼"，写"每周跑 3 次 / 累计 12 公里"
3. **数字目标尽量带 metric**：减重/学习时长/阅读量这类，给 metric 字段（unit + target）
4. **parentTempId 必须形成正确的树**：week 目标的 parentTempId 指向某个 month 目标的 tempId（如果有 month 层）；month 目标的 parentTempId 指向 year 目标（如果有 year 层）
5. **day 任务的 goalTempId**：任务挂到最末层目标上（通常是 week 目标）。挂错层级 = 失败拆解
6. **任务必须今天到目标日期之间的实际日期**：不要写"YYYY-MM-DD"占位符，给真实日期
7. **任务数量严格克制**：每个 week 目标下**只生成 1-2 个示例任务**（最关键的一两个动作），用户后续会自己补。不要堆满一周。如果只有 day 层，每天最多 1 个任务。整棵树的任务总数控制在 20 个以内。
8. **reasoning 字段**：用 50-150 字解释你为什么这样拆，帮用户判断要不要采纳

## 严格输出 JSON
只输出合法 JSON，不要 Markdown 代码块，不要解释前后缀。

{
  "plan": {
    "title": "计划标题，10-30 字",
    "detail": "1-2 句话说明这个计划的核心策略",
    "start": "${today}",
    "end": "YYYY-MM-DD（你判断的目标完成日，如果用户没给则自己定）",
    "scopes": ["month", "week", "day"]
  },
  "goals": [
    {
      "tempId": "m1",
      "scope": "month",
      "title": "第 1 个月：建立基础代谢，减重 4 斤",
      "detail": "可选，更多说明",
      "due": "YYYY-MM-DD",
      "metric": { "unit": "斤", "target": 4 }
    },
    {
      "tempId": "w1",
      "scope": "week",
      "parentTempId": "m1",
      "title": "第 1 周：跑步 3 次，控糖 7 天",
      "due": "YYYY-MM-DD"
    }
  ],
  "tasks": [
    {
      "title": "晨跑 30 分钟",
      "date": "YYYY-MM-DD",
      "goalTempId": "w1",
      "badge": "每日",
      "note": ""
    }
  ],
  "reasoning": "50-150 字解释：为什么这样分层、关键节点是什么、最大风险是什么"
}`;
}
