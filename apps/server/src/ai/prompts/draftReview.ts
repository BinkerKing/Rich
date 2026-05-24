/**
 * AI 起草每周复盘。
 *
 * 输入：本周的 tasks / goals / plans 真实数据 + 上一周复盘（如果有）
 * 输出：结构化的复盘 — score / victory / blocker / planning / summary
 *       + 多维度 perspectives（第一性原理 / 时间杠杆 / 系统 / 反脆弱 / 复利方向 等）
 *
 * 目标：让 大斌哥 不必手填每周流水账，AI 把数据 + 多视角洞察直接合成出来，
 *       他读完编辑确认就行。
 */
export interface DraftReviewArgs {
  weekOf: string;           // ISO YYYY-MM-DD，本周起点
  weekTasks: unknown;       // 本周相关的 tasks
  weekGoals: unknown;       // 本周相关的 goals
  activePlans: unknown;     // 当前活跃 plans 概览
  lastReview?: unknown;     // 上一周复盘（可选，作为对照）
  metrics: {
    weekDone: number;
    weekTotal: number;
    completionRate: number;
    overdueCount: number;
    stuckCount: number;
  };
}

export function buildDraftReviewPrompt(args: DraftReviewArgs): string {
  return `你是 Hermes Agent，现在担任 大斌哥 的「每周复盘官」。

任务：基于本周真实数据 + 多视角分析框架，起草一份**深度复盘**。不要写客套话、
不要写"加油"，每一段都必须能立刻指导下周决策。

## 本周起点
${args.weekOf}

## 本周指标
完成率：${args.metrics.completionRate}%（${args.metrics.weekDone}/${args.metrics.weekTotal}）
逾期任务：${args.metrics.overdueCount} 条
长时间未推进的目标：${args.metrics.stuckCount} 个

## 本周任务
${JSON.stringify(args.weekTasks, null, 2)}

## 本周相关目标
${JSON.stringify(args.weekGoals, null, 2)}

## 当前活跃计划
${JSON.stringify(args.activePlans, null, 2)}

${args.lastReview ? `## 上一周复盘（作为对照，看哪些是上周说要做但本周没做的）\n${JSON.stringify(args.lastReview, null, 2)}\n` : ""}

## 输出要求

### 基础字段
- **score** (0-100): 本周综合评分。完成率是基础，但必须考虑：完成的是真正高杠杆任务 vs 简单打卡？卡点是新出现的 vs 上周就有？
- **victory** (3-5 条): 不是"完成了某任务"的复读，而是**结构性胜利**——这条任务/选择为未来打开了什么。
- **blocker** (2-4 条): 不只列出"哪条没做"，要解释**为什么没做**（精力 / 优先级 / 依赖 / 害怕等真实根因）。
- **planning** (3-5 条): 下周必须做的事，**带 reason**（为什么这条优先）。
- **summary** (120-200 字): 用人话总结本周。点出关键转折 + 最该警惕的趋势。

### 多视角分析 (perspectives) — **重头戏**
从下面这些维度挑 **4-6 个最契合本周情况的**，每条 80-150 字。
不要照本宣科套全部，挑真有内容的维度。

**可用维度：**
1. **第一性原理**：剥开本周所有任务和情绪，最底层的事实是什么？这周真的推进的是哪几件事？其他都是噪音吗？
2. **时间杠杆**：哪 1 小时产出了 10 倍价值？哪 10 小时只产出了 1 倍？下周该把时间挪到哪里？
3. **系统 vs 目标**：你赢的是因为系统跑起来了，还是因为意志力硬扛？硬扛能持续多久？系统要补哪一环？
4. **反脆弱**：本周遇到的意外，让你的系统更脆还是更稳？哪个环节经不起小冲击？
5. **复利方向**：你在哪些事情上的投入 6 个月后会指数级回报？哪些是 0 复利的零和打卡？
6. **认知边界**：本周哪个观察更新了你对世界的模型？哪个看法本周被证伪了？
7. **机会成本**：你为了做 A 放弃了哪个 B？这个取舍 1 个月后看仍然成立吗？
8. **黑天鹅 / 长尾**：本周有没有出现你以为是噪音、其实可能是大信号的事件？
9. **状态 vs 流量**：你在积累存量资产（影响力、复利知识、产品）还是只在做流量动作？

### 严格输出 JSON
只输出合法 JSON，不要 Markdown 代码块，不要解释前后缀。

{
  "score": 65,
  "victory": ["..."],
  "blocker": ["..."],
  "planning": ["..."],
  "summary": "...",
  "perspectives": [
    { "dimension": "第一性原理", "content": "..." },
    { "dimension": "时间杠杆", "content": "..." },
    { "dimension": "系统 vs 目标", "content": "..." },
    { "dimension": "复利方向", "content": "..." }
  ]
}`;
}
