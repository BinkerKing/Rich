import type { Element } from "@ke/domain";
import { SCHEMAS } from "../jsonSchema.js";

export interface ExtendPromptArgs {
  element: Element;
  direction: string;
  count?: number;
}

export function buildExtendPrompt({ element, direction, count = 3 }: ExtendPromptArgs): string {
  const sentence = typeof element.content === "object" && element.content && "oneSentence" in element.content
    ? (element.content as { oneSentence: string }).oneSentence
    : element.title;

  return `你是 Know Everything 系统的知识联想师。

请基于下面这个元，朝**「${direction}」**方向延伸出 ${count} 个**横向关联元**。
横向延伸 = 与该元处于平行或交叉位置的其他知识点，不是上下层级关系。

源元：
- ID: ${element.id}
- 类型: ${element.type}
- 标题: ${element.title}
- 内容摘要: ${sentence}

延伸方向：「${direction}」

ID 命名：使用与源元同级的命名风格，可以引入新的领域前缀。
例：源 "cog-psy.attention"，朝 "AI 领域" 延伸 → "ai.attention-mechanism"。

所有 relation 的 from 必须 = "${element.id}"，kind 必须 = "related"，
应附 \`reason\`（中文说明为什么相关）和 \`strength\` (0-100)。

输出必须严格匹配下面的 JSON Schema：
${SCHEMAS.elementsAndRelations}

只输出符合上述 Schema 的 JSON。`;
}
