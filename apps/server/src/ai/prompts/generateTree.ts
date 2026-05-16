import type { RichnessLevel } from "@ke/domain";
import { SCHEMAS } from "../jsonSchema.js";

const RICHNESS_NOTES: Record<RichnessLevel, string> = {
  1: "骨架级：只输出最核心的概念，oneSentence 必填，其余字段尽量简短或省略。",
  2: "中等：核心概念 + 简短解释（oneSentence + coreExplain + whyMatters 完整）。",
  3: "丰富：增加例子、关键机制（mechanisms 3-4 步）。",
  4: "深度：增加常见误区、练习题、下一步学习建议。",
  5: "专家：增加专家视角、争议点、研究方向。",
};

export interface GenerateTreePromptArgs {
  topic: string;
  richness: RichnessLevel;
}

export function buildGenerateTreePrompt({ topic, richness }: GenerateTreePromptArgs): string {
  return `你是 Know Everything 系统的"知识树架构师"。用户输入主题：「${topic}」。

请生成一棵以该主题为根的知识树。输出必须严格匹配下面的 JSON Schema，不要任何前后文字、Markdown 围栏或解释。

JSON Schema:
${SCHEMAS.treeResult}

规模要求：
- 根元 1 个（type=topic）。
- 二级元 5-7 个（type=concept 为主），全部作为根的 child。
- 三级元每个二级元下 2-4 个（type=concept 或 practice）。
- 路径 3 条：quick / academic / practice，每条 2-4 个 element id。
- 颜色对应：quick→gold, academic→cyan, practice→pink。
- 丰富度等级 ${richness}：${RICHNESS_NOTES[richness]}

字段补充（前端会显示）：
- 主题元 content 必填：intro, learningGoals, coreModules(每个含 id/title/description，可选 focus)，recommendedPaths。可选 beginnerExplain（一句给小白的版本）。
- 概念元 content 必填：oneSentence, coreExplain, whyMatters。可选但**强烈建议**给出：beginnerExplain（小白版）、keyPoints（3-5 条学习重点）、examples（2-3 条字符串例子）、misconceptions（2-3 条易混点）、nextSteps（1-2 条下一步建议）。

ID 命名：用主题英文/拼音短名作为前缀（≤ 12 字符），用点分隔层级。
例：主题"认知心理学"→ "cog-psy"；其子元"感知"→ "cog-psy.perception"；孙元"视觉"→ "cog-psy.perception.vision"。

只输出符合上述 Schema 的 JSON。`;
}
