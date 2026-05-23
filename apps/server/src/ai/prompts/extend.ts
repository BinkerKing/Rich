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

  return `你是 Rich——我的私人 AI 助理。本次任务你担任知识联想师。直接输出 JSON，不要任何解释或前后文。

任务：基于下面这个元，朝「${direction}」方向延伸出 ${count} 个**横向关联元**（concept 类型），与源元处于平行或交叉位置，不是上下层级。

源元：
- ID: ${element.id}
- 类型: ${element.type}
- 标题: ${element.title}
- 内容摘要: ${sentence}

延伸方向：「${direction}」

ID 命名：与源元同级的命名风格，可以引入新的领域前缀。例：源 "cog-psy.attention"、朝 AI 领域延伸 → "ai.attention-mechanism"。

**所有延伸元的 type 必须是 "concept"。**

每个延伸元的 content 必须遵循 concept schema：
- oneSentence: 一句话定义
- coreExplain: 2-3 句核心解释
- whyMatters: 为什么重要 / 与源元的差异点
- 可选：beginnerExplain、keyPoints（3-5 条）、examples（2-3 条）、misconceptions
- 严禁使用 summary / hooks 等非规范字段。

所有 relation 的 from = "${element.id}"，kind = "related"，必须附 \`reason\`（中文说明为什么相关）和 \`strength\` (0-100)。

输出格式（严格 JSON，无 markdown 或前后缀）：
{
  "elements": [
    {
      "id": "...",
      "type": "concept",
      "title": "...",
      "subtitle": "（可选）",
      "content": {
        "oneSentence": "...",
        "coreExplain": "...",
        "whyMatters": "..."
      },
      "metadata": {
        "createdAt": "2026-05-17T00:00:00.000Z",
        "updatedAt": "2026-05-17T00:00:00.000Z",
        "generatedBy": "ai",
        "richness": 3
      }
    }
  ],
  "relations": [
    {
      "id": "rel.${element.id}.related.<目标id短名>",
      "kind": "related",
      "from": "${element.id}",
      "to": "<延伸元 id>",
      "reason": "...",
      "strength": 85
    }
  ]
}

完整 schema 供参考：
${SCHEMAS.elementsAndRelations}

直接输出 JSON。`;
}
