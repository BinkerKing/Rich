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
1. **topic 是要给一个元当标题的，必须凝练 + 信息完整**：
   - **必须保留用户原文里明确提到的核心专有名词、英文术语、领域词**（如 "skill"、"React"、"prompt"、"AI"、"Codex"），不要因为追求"短"就把这些信息丢掉。
   - 删的是修饰、连接词、口语化短语（"我想"、"了解一下"、"相关的"、"整理出"），不是删名词。
   - 长度 3-12 字（含英文），优先用名词短语，可以含「与 / · / X 体系 / X 模板 / X 写法」等结构连接词。
2. **正反例**（务必学习）：
   - 用户输入 "我想了解提示词相关的 skill，理解我的要求，整理出 AI 能理解的提示词"
     - ✅ "提示词与 Skill 体系"、"AI 提示词写作 · Skill 化"、"Skill 化提示词写作"
     - ❌ "AI 提示词写作"（丢了 skill 这个用户明确提及的核心词）
     - ❌ "Skill 体系"（丢了"提示词"这个主体）
   - 用户输入 "3 天去重庆怎么玩"
     - ✅ "3 天重庆游法"
     - ❌ "重庆旅行"（丢了"3 天"这个关键约束）
   - 用户输入 "光合作用"
     - ✅ "光合作用"
   - 用户输入 "用 AI 做一部 15 分钟短电影"
     - ✅ "AI · 15 分钟短电影"、"AI 短电影制作（15 分钟）"
     - ❌ "AI 视频制作"（丢了"15 分钟短电影"的体量约束）
3. keywords 必须从用户原文中精炼，不要造词；优先名词性短语。
4. intent 要凝练，不要复述输入。
5. 输出只能是合法 JSON，不要任何 Markdown / 注释。`;
}
