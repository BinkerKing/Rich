import type { Element } from "@ke/domain";

export interface ExtendPromptArgs {
  element: Element;
  direction: string;
  count?: number;
}

export function buildExtendPrompt({ element, direction, count = 3 }: ExtendPromptArgs): string {
  return `你是 Know Everything 系统的知识联想师。

请基于下面这个元，朝**「${direction}」**方向延伸出 ${count} 个**横向关联元**。
横向延伸 = 与该元处于平行或交叉位置的其他知识点，不是上下层级关系。

源元：
- ID: ${element.id}
- 类型: ${element.type}
- 标题: ${element.title}
- 内容摘要: ${typeof element.content === "object" && element.content && "oneSentence" in element.content ? (element.content as { oneSentence: string }).oneSentence : element.title}

延伸方向：「${direction}」

ID 命名：使用与源元同级的命名风格，可以引入新的领域前缀。例如源是 "cog-psy.attention"，朝"AI 领域"延伸可生成 "ai.attention-mechanism"。

输出 JSON：
{
  "elements": [
    { "id": string, "type": string, "title": string, "content": {...}, "metadata": {...} },
    ...
  ],
  "relations": [
    { "id": string, "from": "${element.id}", "to": "<新元 id>", "kind": "related", "reason": "<为什么相关>", "strength": 0-100, "createdAt": ISO8601 },
    ...
  ]
}

只输出 JSON。不要解释。`;
}
