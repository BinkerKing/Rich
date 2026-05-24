/**
 * Rich 首页动画展示系统 v0.1 —— 字符级流式延迟规则表。
 *
 * 节奏感的核心：字符不是均匀 70ms 一个，而是根据**字符类型 + 上下文**抖动。
 * 标点停顿、关键词稍慢、视觉块前仪式感 —— 让 Rich 看起来「在念」而不是「在喷」。
 *
 * 规则（默认 default 预设）：
 *   句号 / 问号 / 感叹号：200-300ms（强停顿）
 *   逗号 / 顿号 / 分号：    80-120ms
 *   冒号：                   100-150ms
 *   换行：                   400ms（强呼吸）
 *   **加粗**起始 `*`：       +100ms（一次性，标记为关键词）
 *   普通字符：              60-90ms 抖动
 *   ASCII 视觉块前：         600ms 仪式感停（由 BLOCK_OPEN 触发）
 *
 * 预设：
 *   default     —— 平均 70-120ms，适合一般对话
 *   fast        —— 平均 50-80ms，列举 / 简短回答
 *   slow        —— 平均 90-140ms，警告 / 重点 / 解释复杂概念
 *   ceremonial  —— 视觉块前后用，停顿夸张
 */

export type DelayPreset = "default" | "fast" | "slow" | "ceremonial";

export interface DelayContext {
  /** 是不是关键词的第一个字符（如 ** 加粗的第一个字符） */
  isKeywordStart?: boolean;
  /** 当前字符前面是不是空格（避免连续标点停顿叠加） */
  prevIsSpace?: boolean;
}

// 各种字符类别的延迟范围（ms）
const RULES: Record<DelayPreset, {
  base: [number, number];      // [min, max] 普通字符
  comma: [number, number];     // ， 、 ；
  period: [number, number];    // 。 ？ ！
  colon: [number, number];     // ： :
  newline: number;             // \n
  keywordStartBoost: number;   // 关键词第一个字符 +N ms
}> = {
  default: {
    base: [60, 90],
    comma: [80, 120],
    period: [200, 300],
    colon: [100, 150],
    newline: 400,
    keywordStartBoost: 100,
  },
  fast: {
    base: [40, 70],
    comma: [60, 80],
    period: [120, 180],
    colon: [70, 100],
    newline: 250,
    keywordStartBoost: 50,
  },
  slow: {
    base: [90, 140],
    comma: [120, 180],
    period: [280, 380],
    colon: [150, 200],
    newline: 500,
    keywordStartBoost: 150,
  },
  ceremonial: {
    base: [120, 160],
    comma: [200, 280],
    period: [380, 500],
    colon: [220, 280],
    newline: 600,
    keywordStartBoost: 200,
  },
};

// 视觉块进入前的停顿（不区分 preset，统一仪式感）
export const BLOCK_OPEN_DELAY = 600;
// 视觉块整体出来的速度（不走字符级，由 VisualBlockRenderer 控制）
export const BLOCK_CHAR_DELAY = 12;

function pickInRange(range: [number, number]): number {
  return range[0] + Math.random() * (range[1] - range[0]);
}

/**
 * 给一个字符计算它应该停多久才 emit（下一个字符之前的延迟）。
 *
 * @param ch 当前字符
 * @param preset 预设名
 * @param ctx 上下文（isKeywordStart 等）
 * @returns 延迟毫秒数
 */
export function delayFor(
  ch: string,
  preset: DelayPreset = "default",
  ctx: DelayContext = {},
): number {
  const r = RULES[preset];
  let base: number;

  if (ch === "\n") {
    base = r.newline;
  } else if (ch === "。" || ch === "？" || ch === "！" || ch === "." || ch === "?" || ch === "!") {
    base = ctx.prevIsSpace ? pickInRange(r.base) : pickInRange(r.period);
  } else if (ch === "，" || ch === "、" || ch === "；" || ch === "," || ch === ";") {
    base = pickInRange(r.comma);
  } else if (ch === "：" || ch === ":") {
    base = pickInRange(r.colon);
  } else if (ch === " " || ch === "\t") {
    // 空格走 base 但偏短（连读感）
    base = pickInRange(r.base) * 0.6;
  } else {
    base = pickInRange(r.base);
  }

  if (ctx.isKeywordStart) {
    base += r.keywordStartBoost;
  }

  return base;
}
