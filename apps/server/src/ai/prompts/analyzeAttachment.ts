import type { ElementType } from "@ke/domain";

export interface CandidateElement {
  id: string;
  title: string;
  type: ElementType;
  subtitle?: string;
  /** Chain from topic root down to this element's parent (excluding the element
   *  itself), so the AI can reason about depth and theme. */
  parentPath: string[];
  /** Optional aliases / tags for additional matching context. */
  tags?: string[];
}

export interface AnalyzeAttachmentPromptArgs {
  text: string;
  keywords: string[];
  intent: string;
  suggestedType: ElementType;
  candidates: CandidateElement[];
}

/**
 * Step 2 of input-analysis: given the user input + a server-shortlisted set
 * of candidate elements, decide where the new element should live.
 * Returns 1-3 options the user picks from on the client:
 *   - new-topic       — start a brand-new tree
 *   - attach-direct   — put it directly under an existing element
 *   - attach-with-bridge — insert N intermediate elements then the target
 */
export function buildAnalyzeAttachmentPrompt({
  text, keywords, intent, suggestedType, candidates,
}: AnalyzeAttachmentPromptArgs): string {
  const candidateBlock = candidates.length === 0
    ? "（候选清单为空 — 系统里没有命中关键词的已有元。)"
    : candidates.map((c, i) => `${i + 1}. id="${c.id}" title="${c.title}" type=${c.type}${c.subtitle ? ` subtitle="${c.subtitle}"` : ""} path=[${c.parentPath.join(" > ") || "(root)"}]${c.tags && c.tags.length ? ` tags=${c.tags.join(",")}` : ""}`).join("\n");

  return `你是 Know Everything 系统的"挂载分析器"。

任务：根据用户输入 + 候选元清单，给出 1-3 个可行的挂载方案，由用户最终决定怎么落地。**不要做最终决定，列方案。**

用户输入：
${text}

第一轮解析（仅供参考）：
- 关键词: ${keywords.join("、") || "（无）"}
- 推断类型: ${suggestedType}
- 用户意图: ${intent}

候选元清单（由程序按关键词检索 + 加权得到）：
${candidateBlock}

请输出单个 JSON 对象（不要 Markdown 围栏、不要解释、不要前后文字）：

\`\`\`json
{
  "type": "${suggestedType}（可以微调）",
  "options": [
    {
      "kind": "new-topic",
      "confidence": "low | medium | high",
      "reasoning": "为什么应该独立新建主题，不超过 30 字"
    },
    {
      "kind": "attach-direct",
      "parentId": "候选清单里某个元的 id",
      "confidence": "low | medium | high",
      "reasoning": "为什么直接挂在这个父元下，不超过 40 字"
    },
    {
      "kind": "attach-with-bridge",
      "parentId": "候选清单里某个元的 id",
      "bridges": ["桥接层 1 中文标题", "桥接层 2 中文标题（可选）"],
      "confidence": "low | medium | high",
      "reasoning": "为什么需要先创建这几个中间层级再挂载，不超过 50 字"
    }
  ]
}
\`\`\`

规则：
1. options 数组**至少 1 项**、**最多 3 项**。可以只给 1 项（如果其它两类完全不适用）。
2. 所有 parentId **必须**来自候选清单；不要发明 id；不要用候选里没有的 id。
3. 候选清单为空时，只能输出一个 \`new-topic\` 选项。
4. bridges 是为了在父元和目标元之间补缺失的中间分类。最多 2 个桥接层，且要言之有理（如"按天数的路线模板"）。
5. confidence 反映置信度：是否真的命中了已有结构。命中度低就标 low，不要给 high。
6. reasoning 一句话讲清楚为什么。中文。
7. 优先把"最贴合"的方案放在数组第一项。`;
}
