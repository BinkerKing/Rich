import type { Element, PathKind } from "@ke/domain";

const KIND_DESC: Record<PathKind, string> = {
  quick: "快速入门 · 用最短时间获得直觉理解 · 颜色 gold",
  academic: "学术深度 · 系统全面、概念严谨、论文级 · 颜色 cyan",
  practice: "实战导向 · 产品/项目可落地 · 颜色 pink",
  custom: "用户自定义",
};

export interface PathPromptArgs {
  center: Element;
  availableElements: Element[];
  kinds: PathKind[];
}

export function buildPathPrompt({ center, availableElements, kinds }: PathPromptArgs): string {
  const elList = availableElements.length === 0
    ? "（无）"
    : availableElements.map(e => `  - ${e.id}: ${e.title}`).join("\n");
  const kindList = kinds.map(k => `  - ${k}: ${KIND_DESC[k]}`).join("\n");

  return `你是 Know Everything 系统的学习路径规划师。

请为下面这个中心元规划 ${kinds.length} 条不同侧重的**学习路径**。
每条路径是从中心元出发的有序学习步骤，每步引用一个具体的元 ID。

中心元：
- ID: ${center.id}
- 类型: ${center.type}
- 标题: ${center.title}

**可用元 ID 列表**（steps 数组的每个 ID 必须严格来自此列表，否则视为无效输出。不要发明新 ID，不要修改格式，不要把点 . 改为短划 -）：
${elList}

要生成的路径种类（${kinds.length} 条，每条 2-4 步）：
${kindList}

输出 JSON：
{
  "paths": [
    {
      "id": string,
      "centerElementId": "${center.id}",
      "kind": "${kinds[0]}",
      "label": "<中文短标题，含预计时长，例如 '快速入门 15min'>",
      "color": "<gold | cyan | pink>",
      "steps": [ "<elementId-1>", "<elementId-2>", ... ],
      "estimatedTime": "<例如 '15 min' / '2 h'>",
      "generatedBy": "ai",
      "createdAt": ISO8601
    },
    ...
  ]
}

颜色对应：quick→gold, academic→cyan, practice→pink, custom→紫色 violet。
只输出 JSON。不要解释。`;
}
