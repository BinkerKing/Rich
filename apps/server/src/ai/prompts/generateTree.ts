import type { RichnessLevel } from "@ke/domain";

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

请生成一棵以该主题为根的知识树，输出为单个 JSON 对象，不要任何前后文字、Markdown 围栏或解释。JSON 结构必须严格符合：

{
  "rootId": string,                              // 主题元的 id
  "elements": Element[],                          // 所有元（含 root + L2 + L3）
  "relations": Relation[],                        // 父子关系
  "paths": LearningPath[]                         // 3 条推荐路径
}

每个 Element：
{
  "id": string,                                  // 点分层级，例如 "cog-psy.perception.vision"
  "type": "topic" | "concept" | "step" | "practice",
  "title": string,                               // 简洁中文
  "subtitle"?: string,
  "domain"?: string,
  "content": {
    // 主题元 (type=topic):
    "intro": string,
    "learningGoals": string[],
    "coreModules": [{ "id": string, "title": string, "description": string }],
    "recommendedPaths": string[]
    // 概念元 (type=concept):
    "oneSentence": string,
    "coreExplain": string,
    "whyMatters": string
    // 实战元 (type=practice):
    "productPositioning": string,
    "targetAudience": string,
    "needs": string[],
    "mvpFeatures": string[],
    "implementationPath": string[]
  },
  "metadata": { "createdAt": ISO8601, "updatedAt": ISO8601, "generatedBy": "ai", "richness": ${richness} }
}

每个 Relation：
{ "id": string, "from": string, "to": string, "kind": "child", "createdAt": ISO8601 }

每个 LearningPath：
{
  "id": string,
  "centerElementId": string,                     // 必须 = rootId
  "kind": "quick" | "academic" | "practice",
  "label": string,                               // 如 "快速入门 15min"
  "color": "gold" | "cyan" | "pink",             // quick→gold, academic→cyan, practice→pink
  "steps": string[],                             // 2-4 个 element id，按学习顺序
  "estimatedTime": string,
  "generatedBy": "ai",
  "createdAt": ISO8601
}

规模与丰富度：
- 根元 1 个（type=topic）。
- 二级元 5-7 个（type=concept 为主），全部作为根的 child。
- 三级元每个二级元下 2-4 个（type=concept 或 practice）。
- 路径 3 条：quick / academic / practice，每条 2-4 个 element id。
- 丰富度等级 ${richness}：${RICHNESS_NOTES[richness]}

ID 命名规则：用主题英文/拼音短名作为前缀（≤ 12 字符），用点分隔层级。例如主题"认知心理学"→ "cog-psy"；其子元"感知"→ "cog-psy.perception"；孙元"视觉"→ "cog-psy.perception.vision"。

只输出 JSON。不要任何其他文字。`;
}
