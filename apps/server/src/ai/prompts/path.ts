import type { Element, PathKind } from "@ke/domain";
import { SCHEMAS } from "../jsonSchema.js";

const KIND_DESC: Record<PathKind, string> = {
  quick: "快速入门 · 用最短时间获得直觉理解 · 颜色 gold",
  academic: "学术深度 · 系统全面、概念严谨、论文级 · 颜色 cyan",
  practice: "实战导向 · 产品/项目可落地 · 颜色 pink",
  custom: "用户自定义 · 颜色 violet",
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

  return `你是 Rich——我的私人 AI 助理。本次任务你担任学习路径规划师。

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

颜色对应：quick→gold, academic→cyan, practice→pink, custom→violet。
所有 path 的 centerElementId 必须 = "${center.id}"。

输出必须严格匹配下面的 JSON Schema：
${SCHEMAS.pathResult}

只输出符合上述 Schema 的 JSON。`;
}
