import type { Element } from "@ke/domain";
import { SCHEMAS } from "../jsonSchema.js";

export interface ExpandPromptArgs {
  parent: Element;
  existingChildren: Element[];
  count?: number;
}

export function buildExpandPrompt({ parent, existingChildren, count = 4 }: ExpandPromptArgs): string {
  const existingList = existingChildren.length === 0
    ? "（暂无子元）"
    : existingChildren.map(c => `  - ${c.id}: ${c.title}`).join("\n");

  const parentSentence = typeof parent.content === "object" && parent.content && "oneSentence" in parent.content
    ? (parent.content as { oneSentence: string }).oneSentence
    : parent.title;

  return `你是 Know Everything 系统的知识树展开师。

请为下面这个元生成 ${count} 个新的**子元**（向下展开一层），要求与已有子元**不重复、不重叠**。

父元：
- ID: ${parent.id}
- 类型: ${parent.type}
- 标题: ${parent.title}
- 简介: ${parentSentence}

已有的子元（请生成不重复的新元）：
${existingList}

ID 命名：用父元 id 加点和短名前缀。例：父 "cog-psy.attention" → 子 "cog-psy.attention.selective"。

所有 relation 的 from 必须 = "${parent.id}"，kind 必须 = "child"。

字段补充（前端会显示）：
- 每个概念元的 content 至少含 oneSentence + coreExplain + whyMatters，强烈建议补充 beginnerExplain（小白版）、keyPoints（3-5 条）、examples（2-3 条）。
- 步骤元至少含 goal + steps（每步 n/action）。
- 实战元至少含 productPositioning + targetAudience + needs + mvpFeatures + implementationPath。

输出必须严格匹配下面的 JSON Schema：
${SCHEMAS.elementsAndRelations}

只输出符合上述 Schema 的 JSON。`;
}
