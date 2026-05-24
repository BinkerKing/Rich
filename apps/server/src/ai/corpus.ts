import { z } from "zod";

export const CorpusToneSchema = z.enum(["concise", "warm", "executive", "diagnostic", "narrative"]);
export const CorpusAccentSchema = z.enum(["teal", "blue", "violet", "amber", "rose"]);

export const CorpusTemplateSchema = z.object({
  id: z.string().min(1).max(120),
  name: z.string().min(1).max(160),
  scene: z.string().max(500).default(""),
  intent: z.string().max(1000).default(""),
  tone: CorpusToneSchema.default("concise"),
  accent: CorpusAccentSchema.default("teal"),
  mustInclude: z.string().max(1200).default(""),
  styleGuide: z.string().max(1600).default(""),
  template: z.string().max(6000).default(""),
  sample: z.string().max(6000).default(""),
  updatedAt: z.string().default(() => new Date().toISOString()),
});

export type CorpusTone = z.infer<typeof CorpusToneSchema>;
export type CorpusAccent = z.infer<typeof CorpusAccentSchema>;
export type CorpusTemplate = z.infer<typeof CorpusTemplateSchema>;

export const DEFAULT_CORPUS_TEMPLATES: CorpusTemplate[] = [
  {
    id: "system-status-report",
    name: "系统运行情况汇报",
    scene: "后台 / Hermes 定时汇报 / Rich 自检",
    intent: "把系统当前运行状态讲清楚：哪些正常、哪些异常、下一步要不要处理。",
    tone: "diagnostic",
    accent: "blue",
    mustInclude: "总体状态、关键指标、异常/风险、最近变化、建议动作",
    styleGuide: "先给结论，再给证据。避免堆日志；只保留用户需要做决策的信息。语气稳定，不夸张。",
    template: "【结论】\n{overall_status}\n\n【关键状态】\n- 服务：{service_status}\n- 数据：{data_status}\n- AI / Hermes：{agent_status}\n\n【异常与风险】\n{risks}\n\n【建议动作】\n{next_actions}",
    sample: "【结论】\nRich 当前可用，云数据库连接正常；Hermes 有 1 个定时任务上次投递超时，需要观察。\n\n【建议动作】\n先不做大改，下一次 cron 后再看是否重复超时。",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "information-briefing",
    name: "信息汇报",
    scene: "AI 早报 / 调研摘要 / 热点信息归纳",
    intent: "把收集到的信息变成可读、可判断、可行动的简报。",
    tone: "executive",
    accent: "amber",
    mustInclude: "一句话结论、信息来源/时间、为什么重要、对 Rich/用户的启发、建议关注点",
    styleGuide: "不要流水账。每条信息都要解释价值，不只是复述新闻。尽量用短段落和明确标题。",
    template: "【一句话】\n{one_liner}\n\n【发生了什么】\n{facts}\n\n【为什么重要】\n{why_it_matters}\n\n【可以怎么用】\n{application}\n\n【继续关注】\n{watchlist}",
    sample: "【一句话】\n今天值得关注的不是参数榜，而是多个产品把 agent 能力做成了稳定工作流。\n\n【可以怎么用】\nRich 的 AI 早报应该增加“可直接上手的 Skill 推荐”。",
    updatedAt: new Date().toISOString(),
  },
];

export function normalizeCorpusTemplates(value: unknown): CorpusTemplate[] {
  if (!Array.isArray(value)) return DEFAULT_CORPUS_TEMPLATES;
  const parsed: CorpusTemplate[] = [];
  for (const item of value) {
    const result = CorpusTemplateSchema.safeParse(item);
    if (result.success) parsed.push(result.data);
  }
  return parsed.length > 0 ? parsed : DEFAULT_CORPUS_TEMPLATES;
}

export function renderCorpusPromptFragment(template: CorpusTemplate): string {
  return [
    `# AI 语料模板：${template.name}`,
    `场景：${template.scene || "未填写"}`,
    `表达目标：${template.intent || "未填写"}`,
    `语气风格：${template.tone}`,
    `必须包含：${template.mustInclude || "未填写"}`,
    `风格规则：${template.styleGuide || "未填写"}`,
    "",
    "## 答复模板",
    template.template || "未填写",
    "",
    "## 示例答复",
    template.sample || "未填写",
  ].join("\n");
}
