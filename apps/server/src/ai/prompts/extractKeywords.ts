export interface ExtractKeywordsPromptArgs {
  text: string;
}

/**
 * Step 1 of input-analysis: ask the AI to read the user's raw input and
 * return a small structured object the program can act on:
 *   - keywords: 3-6 short tokens that will be used by the server to search
 *     the existing element store (substring / tag / alias matching).
 *   - type: best guess of element type, drives downstream rendering.
 *   - intent: one short sentence describing what the user is trying to do
 *     (used as additional context for step 2's hierarchy analysis).
 *
 * Kept intentionally lightweight — tokens, not full sentences — so server-
 * side keyword search has something concrete to match on.
 */
export function buildExtractKeywordsPrompt({ text }: ExtractKeywordsPromptArgs): string {
  return `你是 Know Everything 系统的输入解析器。任务：把用户输入的一条话变成结构化关键词，便于后续在已有知识树里检索相关元。

用户输入：
${text}

请按以下要求输出单个 JSON 对象，不要任何解释、不要 Markdown 围栏：

\`\`\`json
{
  "topic": "3-12 字的简短中文短语 — 用作元的标题；要凝练、像目录条目，不要复述用户原文、不要标点结尾、不要 emoji",
  "keywords": ["3-6 个 2-6 字的中文 / 英文关键词，覆盖主题、概念、动作、领域；不要重复同义词；从用户输入里直接抓"],
  "type": "topic | concept | practice | project | step | exercise | product-design 之一",
  "intent": "一句话（不超过 30 字）描述用户想做什么，例如：『学习一个旅行规划方法』『落地一段实战项目』『理解一个概念』"
}
\`\`\`

类型判断参考：
- topic：用户想从零开始建一棵全新主题（"泰国旅游攻略"、"认知心理学"）。
- concept：一个独立概念 / 方法 / 原理（"光合作用"、"State Hoisting"、"3 天游法"）。
- practice / project：一段可落地的实战 / 项目目标（"做一个 ai 内容生成器"）。
- step / exercise：明确的"步骤"或"练习题"。
- product-design：产品 / 系统 / 工具设计相关。

注意：
1. **topic 是要给一个元当标题的，必须凝练**：把用户的一长串需求总结成一个目录条目级别的短语。例如：
   - 用户输入 "我想了解提示词相关的 skill，理解我的要求，整理出 AI 能理解的提示词" → topic = "提示词与 Skill 体系" 或 "AI 提示词写作"
   - 用户输入 "3 天去重庆怎么玩" → topic = "3 天重庆游法"
   - 用户输入 "光合作用" → topic = "光合作用"
   不要重复整段原文，不要太长。
2. keywords 必须从用户原文中精炼，不要造词；优先名词性短语。
3. intent 要凝练，不要复述输入。
4. 输出只能是合法 JSON，不要任何 Markdown / 注释。`;
}
