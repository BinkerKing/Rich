import type { Element } from "@ke/domain";

export interface ExpandPromptArgs {
  parent: Element;
  existingChildren: Element[];
  count?: number;
}

export function buildExpandPrompt({ parent, existingChildren, count = 4 }: ExpandPromptArgs): string {
  const existingList = existingChildren.length === 0
    ? "（暂无子元）"
    : existingChildren.map(c => `  - ${c.id}: ${c.title}`).join("\n");

  return `你是 Know Everything 系统的知识树展开师。

请为下面这个元生成 ${count} 个新的**子元**（向下展开一层），要求与已有子元**不重复、不重叠**。

父元：
- ID: ${parent.id}
- 类型: ${parent.type}
- 标题: ${parent.title}
- 简介: ${typeof parent.content === "object" && parent.content && "oneSentence" in parent.content ? (parent.content as { oneSentence: string }).oneSentence : parent.title}

已有的子元（请生成不重复的新元）：
${existingList}

ID 命名：用父元 id 加点和短名前缀。例如父元是 "cog-psy.attention"，子元可以是 "cog-psy.attention.selective" / "cog-psy.attention.divided" 等。

输出 JSON：
{
  "elements": [
    {
      "id": string,
      "type": "concept" | "step" | "practice",
      "title": string,
      "content": {
        // 概念元 (type=concept): { oneSentence, coreExplain, whyMatters }
        // 步骤元 (type=step): { goal, steps: [{n, action, check?}], completionCriteria? }
        // 实战元 (type=practice): { productPositioning, targetAudience, needs, mvpFeatures, implementationPath }
      },
      "metadata": { "createdAt": ISO8601, "updatedAt": ISO8601, "generatedBy": "ai", "richness": 2 }
    },
    ...
  ],
  "relations": [
    { "id": string, "from": "${parent.id}", "to": "<子元 id>", "kind": "child", "createdAt": ISO8601 },
    ...
  ]
}

只输出 JSON。不要任何解释、Markdown 围栏或前后文字。`;
}
