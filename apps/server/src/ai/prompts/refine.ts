import type { Element, RichnessLevel } from "@ke/domain";

const RICHNESS: Record<RichnessLevel, string> = {
  1: "骨架级（只有一句话定义和最简要点）",
  2: "中等（定义 + 简短解释 + 为什么重要）",
  3: "丰富（增加例子、关键机制 3-5 步）",
  4: "深度（增加常见误区、练习题、下一步学习路径）",
  5: "专家（增加专家视角、争议、研究方向、跨学科联系）",
};

export interface RefinePromptArgs {
  element: Element;
  targetRichness: RichnessLevel;
}

export function buildRefinePrompt({ element, targetRichness }: RefinePromptArgs): string {
  return `你是 Know Everything 系统的知识精炼师。

请把以下元的内容**加深到丰富度等级 ${targetRichness}（${RICHNESS[targetRichness]}）**。

当前元：
- ID: ${element.id}
- 类型: ${element.type}
- 标题: ${element.title}
- 现有 content:
${JSON.stringify(element.content, null, 2)}

要求：
1. 保留并增强现有字段，不要删除已有信息
2. 按 type=${element.type} 的 content schema 添加缺失字段
3. 内容必须准确、不能编造事实
4. 中文输出

输出 JSON：
{
  "content": { ... 完整的新 content 对象，对应 ${element.type} 类型的 schema ... }
}

只输出 JSON。不要任何解释、Markdown 围栏或前后文字。`;
}
