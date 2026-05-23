import type { Element } from "@ke/domain";
import { SCHEMAS } from "../jsonSchema.js";

export interface ExpandPromptArgs {
  parent: Element;
  existingChildren: Element[];
  count?: number;
  /** Optional user direction; empty/undefined = AI chooses how to expand. */
  direction?: string;
  /** Max depth of generated subtree (1 = only children, 2 = children + grandchildren). */
  maxDepth?: number;
}

/**
 * Parent → child type matrix.
 * - concept 是通用挂件，可作为任何元的"知识点"子元
 * - 主线下钻按表执行
 */
function allowedChildTypesFor(parentType: string): { primary: string[]; note: string } {
  switch (parentType) {
    case "topic":
      return {
        primary: ["concept", "practice"],
        note: "主题元下面是知识模块（concept）或实战项目（practice）。",
      };
    case "practice":
    case "project":
      return {
        primary: ["product-design"],
        note: "实战元下面应该是产品设计元（product-design），把项目拆解为定位/用户/需求/竞品/MVP/架构等设计子项。",
      };
    case "product-design":
      return {
        primary: ["step"],
        note: "产品设计元下面是具体的实现步骤（step）。每个 step 描述一段可执行的工作。",
      };
    case "step":
    case "exercise":
      return {
        primary: ["concept"],
        note: "步骤元下面通常是这一步需要理解的知识点（concept）。",
      };
    case "concept":
      return {
        primary: ["concept"],
        note: "概念元下面是更细粒度的子概念（concept），继续把这件事拆清楚。",
      };
    default:
      return {
        primary: ["concept"],
        note: "默认按知识点（concept）展开。",
      };
  }
}

export function buildExpandPrompt({ parent, existingChildren, count = 4, direction, maxDepth = 1 }: ExpandPromptArgs): string {
  const existingList = existingChildren.length === 0
    ? "（暂无子元）"
    : existingChildren.map(c => `  - ${c.id}: ${c.title} (${c.type})`).join("\n");

  const parentSentence = typeof parent.content === "object" && parent.content && "oneSentence" in parent.content
    ? (parent.content as { oneSentence: string }).oneSentence
    : parent.title;

  const { primary, note } = allowedChildTypesFor(parent.type);
  const primaryList = primary.join(" / ");

  const dir = direction?.trim();
  const directionBlock = dir
    ? `\n**用户指定的展开方向：「${dir}」**

**层级规则（极其重要，不要摊平）：**
1. 先在父元下生成 **1 个**（最多 2-3 个）"中间分类元"，这一层是对方向的高层归纳。例如方向是"skill 相关内容、每个热门 skill 一个单独的元"，中间分类元就是 "热门 Skill 一览"（或 "Skill 分类索引"），而不是直接列具体 skill。
2. 然后把方向里要求的具体条目作为**孙元**挂在中间分类元下面（如：Find Skills / Web Crawler Skill / GitHub Skill … 这些挂在 "热门 Skill 一览" 之下）。
3. **严禁把具体条目直接挂到父元 ${parent.id} 下面**。父元的直接子元只能是中间分类元。
4. 全部 elements 与全部 relations 都写在同一个 JSON 里，relation.kind 都是 "child"，中间分类元 relation.from = "${parent.id}"，具体条目 relation.from = 对应的中间分类元 id。
5. 总元数（中间分类元 + 孙元）控制在 ${Math.max(count * 2, 6)} 个以内，避免一次性塞太多。\n`
    : `\n（用户没有指定方向，按"全面展开"处理：直接生成 ${count} 个覆盖父元主要侧面的子元，本次**不**展开孙元。）\n`;

  return `你是 Rich——我的私人 AI 助理。本次任务你担任知识树展开师。直接输出 JSON，不要任何解释或前后文。

任务：为下面这个父元生成新的子元（指定方向时，必须先建中间分类，再把条目放到孙元层），与已有子元不重复、不重叠。
${directionBlock}
父元：
- ID: ${parent.id}
- 类型: ${parent.type}
- 标题: ${parent.title}
- 简介: ${parentSentence}

已有子元（避免重复）：
${existingList}

**类型规则：父元 ${parent.type} 的直接子元 type 必须是 ${primaryList} 中的一个。**
${note}
如果生成孙元，其 type 由对应子元的类型按同一矩阵决定。

ID 命名：父 id 加点和短名前缀。例：父 "claude-code.workflow" → 子 "claude-code.workflow.tdd" → 孙 "claude-code.workflow.tdd.unit"。

所有 relation 的 kind = "child"。直接子元 relation 的 from = "${parent.id}"；孙元 relation 的 from = 对应的子元 id。

各类型 content 的最少字段：
- concept: oneSentence, coreExplain, whyMatters（建议再加 beginnerExplain、keyPoints、examples、misconceptions）
- step: goal, steps[{n, action, check?}]（建议再加 preconditions、completionCriteria、commonFailures）
- practice: productPositioning, targetAudience, needs, mvpFeatures, implementationPath
- product-design: designQuestion，再从 positioning/targetAudience/needs/decisions/mvpScope/outOfScope/architectureNote 选 3-5 项填充
- 不要生成 exercises（练习题）。

输出格式（严格 JSON，无任何 markdown、解释、前后缀）：
{
  "elements": [ /* 所有新生成的元，包括子元和（如有的）孙元 */ ],
  "relations": [ /* 所有 kind=child 的关系，from 指向各自的直接父元 */ ]
}

完整 schema 供参考：
${SCHEMAS.elementsAndRelations}

直接输出 JSON。`;
}
