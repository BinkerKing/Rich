/**
 * AI 推进分析提示词。
 *
 * 输入：
 *   - 完整 state（plans + goals + tasks）
 *   - 客户端预算的指标（per-plan health、各类卡点计数）
 * 输出 JSON：
 *   - keyInsight: 一句话核心判断
 *   - blockers: 主要卡点列表（解释为什么卡住）
 *   - pushActions: 可执行的推进办法
 *   - priorityTasks: 这周优先做的 1-3 件事
 */
export interface AnalyzeProgressArgs {
  state: unknown;
  metrics: {
    planHealthList: Array<{
      title: string;
      progress: number;
      timeProgress: number;
      delta: number;
      status: string;
      weekDone: number;
      weekTotal: number;
    }>;
    overdueCount: number;
    stuckCount: number;
    emptyGoalCount: number;
    orphanTaskCount: number;
  };
}

export function buildAnalyzeProgressPrompt({ state, metrics }: AnalyzeProgressArgs): string {
  return `你是 Hermes Agent，正在担任「计划管理」系统的推进分析师。

任务：基于用户当前的计划/目标/任务数据 + 预计算的健康度指标，输出
可执行的推进策略。不写空话，每一句必须可落地。

## 客户端预计算的健康度指标
${JSON.stringify(metrics, null, 2)}

## 用户的完整 state（参考用，重点看 tasks 的 date/done 分布、goals 的层级 + due）
${JSON.stringify(state, null, 2)}

## 输出原则
1. **keyInsight 必须一针见血**：不写"你做得不错"，而是"你的 X 计划严重落后，根源是 Y"。
2. **blockers 解释因果**：不只说"逾期任务 5 条"，要说"5 条逾期都是健身计划的跑步任务，可能跟天气/作息有关"。
3. **pushActions 必须具体可做**：不写"加强执行力"，而是"今天选 2 条最近的逾期任务，调整到本周日，并把目标拆细成 30 分钟可完成的小任务"。
4. **priorityTasks 是 1-3 件 30 分钟内能做的**：不堆任务，挑能产生杠杆的。每条带 reason 说明为什么挑它。
5. 如果数据都很健康，老实说"目前推进健康，不必干预"。不要硬找问题。

## 严格输出 JSON
只输出合法 JSON，不要 Markdown，不要前后缀。

{
  "keyInsight": "一句话核心判断，60-160 字",
  "blockers": [
    "主要卡点 1，包含因果解释",
    "主要卡点 2"
  ],
  "pushActions": [
    "可执行的推进办法 1",
    "推进办法 2",
    "推进办法 3"
  ],
  "priorityTasks": [
    { "title": "今天先做这件事", "reason": "为什么挑它" },
    { "title": "...", "reason": "..." }
  ]
}`;
}
