import type { Element, RichnessLevel } from "@ke/domain";
import { contentSchemaFor } from "../jsonSchema.js";

const RICHNESS: Record<RichnessLevel, string> = {
  1: "骨架级（只有一句话定义和最简要点）",
  2: "中等（定义 + 简短解释 + 为什么重要）",
  3: "丰富（增加例子、关键机制 3-5 步、易混点）",
  4: "深度（增加 mechanisms 详细描述、更多 examples、跨场景对比、下一步学习路径）",
  5: "专家（增加专家视角、争议、研究方向、跨学科联系）",
};

export interface RefinePromptArgs {
  element: Element;
  targetRichness: RichnessLevel;
}

export function buildRefinePrompt({ element, targetRichness }: RefinePromptArgs): string {
  const contentSchema = contentSchemaFor(element.type);
  const schemaBlock = contentSchema
    ? `新 content 必须严格匹配以下 JSON Schema：\n${contentSchema}`
    : "（此元类型没有结构化 content schema；保持现有字段结构，按需扩展。）";

  return `你是 Know Everything 系统的知识精炼师。

请把以下元的内容**加深到丰富度等级 ${targetRichness}（${RICHNESS[targetRichness]}）**。

当前元：
- ID: ${element.id}
- 类型: ${element.type}
- 标题: ${element.title}
- 现有 content:
${JSON.stringify(element.content, null, 2)}

要求：
1. 保留并增强现有字段，不要删除已有信息。
2. 内容必须准确、不能编造事实。
3. 中文输出。
4. **以"把事情讲清楚"为目标**——优先打磨 oneSentence / coreExplain / whyMatters / beginnerExplain / mechanisms 这些解释性字段。
5. **不要生成 exercises（练习题）**；用户需要练习时会单独发起请求。

${schemaBlock}

输出必须是单个 JSON 对象，形如 \`{ "content": <新 content 对象> }\`。不要解释、Markdown 围栏或前后文字。`;
}
