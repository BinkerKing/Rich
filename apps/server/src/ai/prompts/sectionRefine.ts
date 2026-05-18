import type { Element } from "@ke/domain";
import { SECTION_STYLE_CATALOG } from "./sectionStyles.js";

export interface SectionRefinePromptArgs {
  element: Element;
  /** The single section JSON we want the AI to rewrite. */
  section: { id: string; title: string; blocks: unknown[] };
  /** What the user wants changed about this section. */
  direction: string;
}

/**
 * Scoped section refinement prompt.
 * AI ONLY sees the one target section + a brief element summary for context.
 * AI ONLY outputs the updated section JSON — no other sections, no element
 * fields, nothing else can be touched. The server merges it back by id.
 */
export function buildSectionRefinePrompt({ element, section, direction }: SectionRefinePromptArgs): string {
  return `你是 Know Everything 系统的章节编辑器。

任务：根据用户反馈，**只修改下面这一个章节**的内容。其它章节、其它字段、元的标题/类型/标签等等，你都看不到，也无权改动 —— 程序会在你输出之后做 id 替换。

所属元（仅作上下文参考，不要改）：
- 标题：${element.title}
- 类型：${element.type}
${element.subtitle ? `- 副标题：${element.subtitle}\n` : ""}
要修改的章节（当前 JSON）：
${JSON.stringify(section, null, 2)}

用户反馈 / 指令：
${direction}

要求：
1. **必须保留章节的 \`id\` 字段不变**（值为 \`"${section.id}"\`），程序按 id 做替换。
2. \`title\` 可以根据反馈调整，但反馈未提及就保持原 title。
3. \`blocks\` 数组可以全部重写、可以新增 block、可以删除 block —— 这一节内部你有完全的自由度。
4. 不要返回任何其它字段（不要返回 element / content / sections 数组 / extraSections / oneSentence 等）。
5. 必须使用合法的 block style（见下文），不要发明新 style 名。
6. 中文输出。

${SECTION_STYLE_CATALOG}

**反馈语义解析参考**
- "加一张图 / 画个流程图 / 改成图" → 在 blocks 里追加一个 \`{ style: "diagram", id, title, mermaid }\` block，或换 image-placeholder。
- "改成检查清单 / 列表" → 用 check-list 或 dot-list 重写主要内容。
- "补例子" → 追加 example-list block 或 prose block。
- "讲得太抽象 / 重写得更易懂" → 重写所有 prose block，语言更口语。
- "拆分 / 加小标题" → 把长 prose 拆成多个 prose + lead block。

输出必须是单个 JSON 对象，形如 \`{ "section": { "id": "${section.id}", "title": "...", "blocks": [ ... ] } }\`。
不要解释、不要 Markdown 围栏、不要任何前后文字。`;
}
