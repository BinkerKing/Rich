import type { Element } from "@ke/domain";
import type { CSSProperties } from "react";

type CenterStyleInput = {
  name?: string;
  accent?: string;
  accent2?: string;
  warm?: string;
  soft?: string;
  line?: string;
  glow?: string;
};

export interface CenterStyle {
  name: string;
  vars: CSSProperties;
}

const presets: Record<string, CenterStyleInput> = {
  perception: {
    name: "感知蓝",
    accent: "#43a4ff",
    accent2: "#3dd5cd",
    warm: "#ffc977",
    soft: "rgba(67, 164, 255, .13)",
    line: "rgba(67, 164, 255, .36)",
    glow: "rgba(67, 164, 255, .24)",
  },
  memory: {
    name: "记忆青",
    accent: "#3dd5cd",
    accent2: "#74e5b0",
    warm: "#ffc977",
    soft: "rgba(61, 213, 205, .13)",
    line: "rgba(61, 213, 205, .36)",
    glow: "rgba(61, 213, 205, .24)",
  },
  attention: {
    name: "注意紫",
    accent: "#9b7cff",
    accent2: "#55caff",
    warm: "#ff8fb5",
    soft: "rgba(155, 124, 255, .13)",
    line: "rgba(155, 124, 255, .36)",
    glow: "rgba(155, 124, 255, .24)",
  },
  language: {
    name: "语言天青",
    accent: "#55caff",
    accent2: "#3dd5cd",
    warm: "#ffc977",
    soft: "rgba(85, 202, 255, .13)",
    line: "rgba(85, 202, 255, .36)",
    glow: "rgba(85, 202, 255, .24)",
  },
  reasoning: {
    name: "推理金",
    accent: "#ffc977",
    accent2: "#3dd5cd",
    warm: "#ff7a59",
    soft: "rgba(255, 201, 119, .13)",
    line: "rgba(255, 201, 119, .36)",
    glow: "rgba(255, 201, 119, .24)",
  },
  decision: {
    name: "决策橙",
    accent: "#ff7a59",
    accent2: "#ffc977",
    warm: "#ff8fb5",
    soft: "rgba(255, 122, 89, .13)",
    line: "rgba(255, 122, 89, .36)",
    glow: "rgba(255, 122, 89, .24)",
  },
  emotion: {
    name: "情绪蓝紫",
    accent: "#6aa8ff",
    accent2: "#9b7cff",
    warm: "#ff8fb5",
    soft: "rgba(106, 168, 255, .13)",
    line: "rgba(106, 168, 255, .36)",
    glow: "rgba(106, 168, 255, .24)",
  },
  learning: {
    name: "学习绿",
    accent: "#74e5b0",
    accent2: "#3dd5cd",
    warm: "#ffc977",
    soft: "rgba(116, 229, 176, .13)",
    line: "rgba(116, 229, 176, .36)",
    glow: "rgba(116, 229, 176, .24)",
  },
  practice: {
    name: "实战红",
    accent: "#ff6f5f",
    accent2: "#ffc977",
    warm: "#ff8fb5",
    soft: "rgba(255, 111, 95, .13)",
    line: "rgba(255, 111, 95, .36)",
    glow: "rgba(255, 111, 95, .24)",
  },
  review: {
    name: "复盘青蓝",
    accent: "#3dd5cd",
    accent2: "#6aa8ff",
    warm: "#9b7cff",
    soft: "rgba(61, 213, 205, .13)",
    line: "rgba(61, 213, 205, .36)",
    glow: "rgba(61, 213, 205, .24)",
  },
  expert: {
    name: "专家金紫",
    accent: "#ffc977",
    accent2: "#9b7cff",
    warm: "#ff8fb5",
    soft: "rgba(255, 201, 119, .13)",
    line: "rgba(255, 201, 119, .36)",
    glow: "rgba(255, 201, 119, .24)",
  },
  // 报告元（AI 早报里每条新闻都是 report）— 用绿色与卡片上分类 chip 视觉一致。
  report: {
    name: "情报绿",
    accent: "#4ade80",
    accent2: "#74e5b0",
    warm: "#ffd86b",
    soft: "rgba(74, 222, 128, .13)",
    line: "rgba(74, 222, 128, .36)",
    glow: "rgba(74, 222, 128, .24)",
  },
  // 项目元 — 独立蓝紫调，区别于概念元的浅蓝、实战元的橙红。
  project: {
    name: "项目蓝紫",
    accent: "#6366f1",
    accent2: "#8b8eff",
    warm: "#ffb6e2",
    soft: "rgba(99, 102, 241, .13)",
    line: "rgba(99, 102, 241, .38)",
    glow: "rgba(99, 102, 241, .26)",
  },
  // 攻略元 — 玫粉，跟"实战橙"互补；用于旅游 / 游戏 / 学习攻略类元。
  guide: {
    name: "攻略玫粉",
    accent: "#f472b6",
    accent2: "#fb7185",
    warm: "#ffd28d",
    soft: "rgba(244, 114, 182, .13)",
    line: "rgba(244, 114, 182, .40)",
    glow: "rgba(244, 114, 182, .26)",
  },
  default: {
    name: "宇宙青",
    accent: "#3dd5cd",
    accent2: "#6aa8ff",
    warm: "#ffc977",
    soft: "rgba(61, 213, 205, .12)",
    line: "rgba(61, 213, 205, .32)",
    glow: "rgba(61, 213, 205, .22)",
  },
};

export function centerStyleFor(element: Element): CenterStyle {
  const preset = presetFor(element);
  const custom = readCustomStyle(element);
  const style = { ...preset, ...custom };

  return {
    name: style.name ?? "中心风格",
    vars: {
      "--center-accent": style.accent,
      "--center-accent-2": style.accent2,
      "--center-warm": style.warm,
      "--center-soft": style.soft,
      "--center-line": style.line,
      "--center-glow": style.glow,
    } as CSSProperties,
  };
}

function presetFor(element: Element) {
  if (element.title.includes("感知") || element.title.includes("视觉")) return presets.perception;
  if (element.title.includes("记忆")) return presets.memory;
  if (element.title.includes("注意")) return presets.attention;
  if (element.title.includes("语言")) return presets.language;
  if (element.title.includes("推理")) return presets.reasoning;
  if (element.title.includes("决策")) return presets.decision;
  if (element.title.includes("情绪")) return presets.emotion;
  if (element.title.includes("学习")) return presets.learning;
  if (element.title.includes("复盘")) return presets.review;
  if (element.title.includes("专家")) return presets.expert;
  if (element.type === "project") return presets.project;
  if (element.type === "practice" || element.title.includes("实战")) return presets.practice;
  if (element.type === "report") return presets.report;
  if (element.type === "guide" || element.title.includes("攻略")) return presets.guide;
  return presets.default;
}

function readCustomStyle(element: Element): CenterStyleInput {
  const content = element.content;
  if (!content || typeof content !== "object" || Array.isArray(content)) return {};
  const centerStyle = (content as Record<string, unknown>).centerStyle;
  if (!centerStyle || typeof centerStyle !== "object" || Array.isArray(centerStyle)) return {};
  const record = centerStyle as Record<string, unknown>;
  return {
    name: text(record.name),
    accent: text(record.accent),
    accent2: text(record.accent2),
    warm: text(record.warm),
    soft: text(record.soft),
    line: text(record.line),
    glow: text(record.glow),
  };
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value : undefined;
}
