import type { Element, RichnessLevel } from "@ke/domain";
import { contentSchemaFor } from "../jsonSchema.js";
import { SECTION_STYLE_CATALOG } from "./sectionStyles.js";

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
  /** Optional user instruction for targeted refinement; empty/undefined = refine all. */
  direction?: string;
}

export function buildRefinePrompt({ element, targetRichness, direction }: RefinePromptArgs): string {
  const contentSchema = contentSchemaFor(element.type);
  const schemaBlock = contentSchema
    ? `新 content 必须严格匹配以下 JSON Schema：\n${contentSchema}`
    : "（此元类型没有结构化 content schema；保持现有字段结构，按需扩展。）";

  const focusBlock = direction && direction.trim()
    ? `\n**用户指定的细化方向：「${direction.trim()}」**\n- 把改动重点放在该方向上：可以是某个字段（如「补充 mechanisms」）、某个角度（如「补充真实代码例子」）、或某种叙述风格（如「换成更易懂的小白版」）。\n- 与该方向无关的字段保持不动或仅做小幅润色。\n`
    : "\n（用户未指定方向，按「全面细化」处理：所有字段都按等级标准扩展。）\n";

  return `你是 Rich——我的私人 AI 助理。本次任务你担任知识精炼师。

请把以下元的内容**加深到丰富度等级 ${targetRichness}（${RICHNESS[targetRichness]}）**。
${focusBlock}
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

**新增章节规则（重要）：**
- 当用户的方向是"添加 / 新增 / 增加 …"某个新章节时（如「添加场景使用方法」「新增最佳实践」「增加和 XX 的对比」），不要硬塞到 oneSentence / coreExplain 等现有字段里。
- 改为往 \`extraSections\` 数组里追加一个新对象：\`{ id: "短slug-kebab", title: "中文标题", body: "正文，可以分段、可以包含项目符号" }\`。
- 如果该 title 已经存在于 extraSections 中，更新对应那条而不是重复添加。
- 保留 extraSections 里已有的、与本次方向无关的章节，不要删。
- extraSections 中的 \`body\` 可以是较长的多段文本，使用 \\n 分段；可以用「- 」开头表示要点列表。

**动态章节规则（重要 — 当元的天然结构不适合 oneSentence/coreExplain 这套老字段时用）：**
- 你可以往 content.sections 数组里追加章节，让前端按你选的 style 来渲染。每节 \`{ id, title, blocks: [{ style, ... }] }\`。
- **何时该用 sections**：旅游 / 训练 / 烹饪 / 项目计划 / 任何"按时间或步骤组织的元"——这些用 day-schedule / phase-timeline / budget-table / kv-table / checklist-grouped 比硬塞 oneSentence 更自然。
- **何时不该用**：概念解释型（认知心理学、设计原理…）——继续用现有字段更合适。
- 已有的 sections 数组要保留，与本次方向无关的章节不要删；同标题章节可以更新。
${SECTION_STYLE_CATALOG}

**流程图规则（重要，每次细化都应主动考虑）：**
- 如果当前元描述的内容涉及"流程 / 步骤 / 状态切换 / 数据流 / 决策分支 / 因果链"——优先用流程图来表达。
- 流程图写到 \`diagrams\` 数组：\`{ id: "短slug", title: "中文标题", caption?: "一句话补充说明", mermaid: "Mermaid 语法代码" }\`。
- 必须使用合法的 Mermaid 语法，常用类型：
  - \`flowchart TD\`（自上而下）或 \`flowchart LR\`（从左到右）—— 最常用，画"A→B→C"或"分支决策"。
  - \`sequenceDiagram\`—— 画两方/多方交互（用户↔Agent↔后端）。
  - \`stateDiagram-v2\`—— 画状态机。
- 节点 label 用中文短句，3-10 字；箭头上的文字（条件/触发）也写中文。例：
  \`\`\`
  flowchart TD
    A[读取 SKILL.md] --> B{是否含触发条件?}
    B -- 是 --> C[匹配场景调用]
    B -- 否 --> D[人工提示要求显式调用]
  \`\`\`
- 用户在方向里说"流程图 / 画图 / 可视化 / 图解 / 用图说明 / 改成图"等关键词时，必须新增或更新一个对应的 diagrams 项；如果已有同 title 的 diagram，更新它而不是重复添加。
- 一次细化通常只输出 1 个 diagram；多了反而稀释重点。
- 如果元天然没有流程性（纯定义型）则可以不画，不要硬画。

${schemaBlock}

输出必须是单个 JSON 对象，形如 \`{ "content": <新 content 对象> }\`。不要解释、Markdown 围栏或前后文字。`;
}
