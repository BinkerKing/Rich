import type { RichnessLevel } from "@ke/domain";
import { SCHEMAS } from "../jsonSchema.js";
import { SECTION_STYLE_CATALOG } from "./sectionStyles.js";

interface RichnessSpec {
  label: string;
  /** Per-level structural rules (breadth/depth). */
  structure: string;
  /** Per-level content depth rules. */
  content: string;
}

/**
 * Public tier standard. Each tier controls BOTH the tree structure (how many
 * children, how deep) and the per-element content depth. Single source of
 * truth — frontend reads this via /api/ai/richness-spec to render the spec card.
 */
export const RICHNESS_SPECS: Record<RichnessLevel, RichnessSpec> = {
  1: {
    label: "低档（骨架）",
    structure: "根 + 3-4 个二级元，二级元下不再展开。总元数 4-5。",
    content: "每个元只填 oneSentence（概念）或 intro（主题）。其它字段省略。",
  },
  2: {
    label: "中档（入门）",
    structure: "根 + 4-5 个二级元，每个二级元下 2-3 个三级元。总元数 12-20。",
    content: "概念元含 oneSentence + coreExplain + whyMatters。主题元含 intro + learningGoals + coreModules。",
  },
  3: {
    label: "高档（完整）",
    structure: "根 + 5-7 个二级元，每个二级元下 3-4 个三级元。总元数 20-35。",
    content: "在中档基础上，概念元补 beginnerExplain + keyPoints(3-5) + examples(2-3) + mechanisms(3-4 步)。主题元补 beginnerExplain。",
  },
  4: {
    label: "深度（进阶）",
    structure: "根 + 5-7 个二级元，每个二级元下 3-4 个三级元，并在 2-3 个关键三级元下补一层四级元（2-3 个）。总元数 35-55。",
    content: "在高档基础上，概念元补 misconceptions(2-3) + nextSteps(1-2)。涉及流程的概念元必须有 mechanisms。",
  },
  5: {
    label: "专家（全景）",
    structure: "根 + 6-8 个二级元，每个二级元下 4-5 个三级元，关键分支下展开 2 层四级元。总元数 60-100。",
    content: "在深度基础上，概念元补充专家视角、与相邻概念的对比、争议点；为有歧义的字段提供 aliases。",
  },
};

export interface GenerateTreePromptArgs {
  topic: string;
  richness: RichnessLevel;
}

export function buildGenerateTreePrompt({ topic, richness }: GenerateTreePromptArgs): string {
  const spec = RICHNESS_SPECS[richness];
  return `你是 Know Everything 系统的"知识树架构师"。用户输入主题：「${topic}」。

请生成一棵以该主题为根的知识树。直接输出 JSON，不要任何前后文字、Markdown 围栏或解释。

**档位 = ${richness} · ${spec.label}**

结构规格（必须遵守）：
${spec.structure}

内容规格（必须遵守）：
${spec.content}

通用规则：
- 根元 1 个（type=topic）。
- 二级元主要为 concept，少量 practice。
- 三级元主要为 concept 或 practice。
- 概念元 content 至少含 oneSentence + coreExplain + whyMatters（档位 ≥ 2）。
- 主题元 content 至少含 intro + learningGoals + coreModules + recommendedPaths。
- 不要生成 exercises（练习题）；用户后续需要时会单独发起请求。
- 路径 3 条：quick / academic / practice，每条 2-4 个 element id，颜色：quick→gold, academic→cyan, practice→pink。

**动态章节（按需使用）：**
- 当主题天然是"按时间 / 步骤 / 多种异构信息"时（旅游、训练、烹饪、活动策划、项目方案…），可以为元额外加 \`content.sections\` 数组，让前端按你选择的样式渲染。前端会优先用 sections，老字段作兜底。
- 概念学习类主题（认知心理学、React 动画、机器学习算法…）继续用 oneSentence/coreExplain/whyMatters 等老字段即可，不需要 sections。
${SECTION_STYLE_CATALOG}

ID 命名：主题英文/拼音短名作前缀（≤ 12 字符），点分隔层级。
例：主题"认知心理学"→ "cog-psy"；子元"感知"→ "cog-psy.perception"；孙元"视觉"→ "cog-psy.perception.vision"。

输出格式（严格 JSON）：
{
  "rootId": "<主题元 id>",
  "elements": [ /* 见 schema */ ],
  "relations": [ /* kind=child，from 父 id，to 子 id */ ],
  "paths": [ /* 3 条，按上面颜色规则 */ ]
}

完整 schema 供参考：
${SCHEMAS.treeResult}

只输出 JSON。`;
}
