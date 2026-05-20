import type { Element } from "@ke/domain";

export interface AttachUnderPromptArgs {
  parent: Element;
  /** "leaf"  — create exactly 1 element directly under parent.
   *  "chain" — create a vertical chain of N elements, each the single child
   *  of the previous, where chain[i] is the title of the i-th layer. */
  mode: "leaf" | "chain";
  /** When mode === "leaf" — the title of the new element. */
  leafTitle?: string;
  /** When mode === "chain" — title of each layer from shallow to deep.
   *  chain[length-1] is the target leaf. */
  chain?: string[];
  /** The user's full original intent — given to the AI so the new element's
   *  content actually covers what the user meant. */
  fullIntent: string;
  /** Richness 1-5 for the deepest leaf's content. 1=skeleton, 5=expert.
   *  Defaults to 2 if omitted. */
  richness?: 1 | 2 | 3 | 4 | 5;
}

function richnessLine(r: 1 | 2 | 3 | 4 | 5): string {
  switch (r) {
    case 1: return "极简骨架 —— 一句话定义 + 一句为什么重要，不要 sections";
    case 2: return "基础 —— 一句话定义 + 简短解释 + 为什么重要（可有 1 个 section）";
    case 3: return "完整 —— 涵盖核心要点 + 关键机制 + 2-3 个例子（3-4 个 sections）";
    case 4: return "深度 —— 详尽阐述、对比、误区、应用场景（4-6 个 sections，含图表 / 示意图）";
    case 5: return "专家级 —— 全面体系化，含理论 / 案例 / 决策 / 数据，6+ sections";
  }
}

/**
 * "Attach under" prompt: strictly creates new elements under a chosen parent
 * with the EXACT structure the caller requested. NO intermediate classifiers,
 * NO automatic grandchildren — just the elements asked for, in the layout
 * asked for. Used by the home-page input-analysis flow.
 */
export function buildAttachUnderPrompt(args: AttachUnderPromptArgs): string {
  const { parent, mode, fullIntent } = args;
  const richness = args.richness ?? 2;
  const richnessHint = richnessLine(richness);
  const parentSentence = typeof parent.content === "object" && parent.content && "oneSentence" in parent.content
    ? (parent.content as { oneSentence: string }).oneSentence
    : parent.title;

  if (mode === "leaf") {
    const title = (args.leafTitle ?? "").trim();
    if (!title) throw new Error("attachUnder: leaf mode requires leafTitle");
    return `你是 Know Everything 知识树挂载器。任务：在指定父元下，**精确创建 1 个新元**。

父元（用户已经选定，不要改动）：
- ID: ${parent.id}
- 类型: ${parent.type}
- 标题: ${parent.title}
- 简介: ${parentSentence}

必须创建的新元：
- 标题（精确字面，不要更改）：${title}
- 内容要覆盖的用户完整意图：${fullIntent}

**严格规则（违反就算失败）**
1. 输出恰好 1 个 element，relation.kind = "child"，relation.from = "${parent.id}"，relation.to = 新元 id。
2. 不要创建中间分类元、不要创建孙元、不要顺手补"相关概念"或"同类元"。整个输出只有 1 个 element + 1 个 relation。
3. 新元 .title **必须等于**「${title}」（一字不差）。
4. 新元 .id 用合理的英文 / 拼音 slug-kebab，长度 ≤ 60。
5. 新元 .type 选最合适的（concept / step / product-design / topic / summary）。**禁止使用 practice / project** —— 这两类只能由用户手动创建。
6. 新元 .content 按对应类型的 schema 填，**深度等级 ${richness}** —— ${richnessHint}。
7. 输出严格 JSON，形如 \`{ "elements": [<新元>], "relations": [<那一条 child relation>] }\`。不要解释、不要 Markdown 围栏。`;
  }

  // chain mode
  const chain = args.chain ?? [];
  if (chain.length < 1) throw new Error("attachUnder: chain mode requires non-empty chain");
  const chainLines = chain.map((t, i) => `  层 ${i + 1}: 标题「${t}」`).join("\n");
  return `你是 Know Everything 知识树挂载器。任务：在指定父元下创建一条**垂直单链**，每层只有一个元，最深一层是目标。

父元（不要改）：
- ID: ${parent.id}
- 类型: ${parent.type}
- 标题: ${parent.title}
- 简介: ${parentSentence}

链路结构（从浅到深，共 ${chain.length} 层，每层 1 个元，每层是上一层的子元）：
${chainLines}

最深一层（层 ${chain.length}「${chain[chain.length - 1]}」）需要覆盖用户的完整意图：${fullIntent}

**严格规则（违反就算失败）**
1. 输出恰好 ${chain.length} 个 element 和 ${chain.length} 条 child relation：
   - relation 1: from="${parent.id}" → to=层 1 的元 id
   - relation 2: from=层 1 元 id → to=层 2 的元 id
   - …
2. 每层 .title **必须等于**上面给出的字面（一字不差）。
3. 不要在链外横生枝节，不要创建"同级元"、"相关概念"等。链外干净。
4. 每个元 .id 用合理 slug-kebab；.type 按其位置和语义选最合适的。
5. 中间层的 content 简短（一句话定义 + 简短解释），把内容深度留给最深一层；最深一层按**深度 ${richness}** 填 —— ${richnessHint}。
6. 输出严格 JSON：\`{ "elements": [<层 1>, ..., <层 N>], "relations": [<relation 1>, ..., <relation N>] }\`。不要解释、不要 Markdown 围栏。`;
}
