/**
 * Rich 首页动画展示系统 v0.1 —— T20 长任务 stage 解析。
 *
 * AI 输出 `[STAGE: 理解]` 之类的行级标记，前端边读边匹配出 stage 切换事件。
 *
 * 标准 stage 序列：理解 → 查资料 → 起草 → 校对 → 完成
 * 任何 op 都可以用这套；不匹配的 stage 名（如 'foo'）也透传给 UI 决定怎么显示。
 */

const STAGE_RE = /\[STAGE:\s*([^\]]+)\]/g;

export type StandardStage = "理解" | "查资料" | "起草" | "校对" | "完成";

/** 用 stage 名映射到 Mascot 表情 hint */
export const STAGE_TO_MASCOT: Record<string, string> = {
  "理解":    "thinking",
  "查资料":  "thinking",
  "起草":    "talking",
  "校对":    "thinking",
  "完成":    "proud",
};

/**
 * 从一段（可能是流式累积）的文本里提取出现过的所有 stage 标记。
 * 返回按出现顺序排列的 stage 名数组。
 */
export function extractStages(text: string): string[] {
  const out: string[] = [];
  STAGE_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = STAGE_RE.exec(text)) !== null) {
    out.push(m[1].trim());
  }
  return out;
}

/** 当前最新 stage（用于切表情 / 进度条），无标记时返回 null */
export function currentStage(text: string): string | null {
  const all = extractStages(text);
  return all.length ? all[all.length - 1] : null;
}

/** 去掉所有 stage 标记后的纯净文本（用户最终看到的） */
export function stripStageMarkers(text: string): string {
  return text.replace(STAGE_RE, "").replace(/\n{3,}/g, "\n\n").trim();
}
