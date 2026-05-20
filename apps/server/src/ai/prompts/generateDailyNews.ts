export interface GenerateDailyNewsArgs {
  date: string; // ISO YYYY-MM-DD
}

/**
 * Daily AI 早报 generation prompt.
 *
 * Asks codex to (a) actually browse current AI news on the web, (b) pick a
 * curated set under the user's editorial preferences (capability milestones &
 * applied tools beat model-speed/price news), and (c) write each item as a
 * detail page with real cited sources.
 *
 * Output is strict JSON — schema-validated server-side. AI must NOT fabricate
 * sources: every news item must have at least one block with a non-empty
 * `source.url` that AI actually visited / referenced.
 */
export function buildGenerateDailyNewsPrompt({ date }: GenerateDailyNewsArgs): string {
  return `你是 Know Everything 系统的 AI 早报主编。任务：为日期 ${date} 生成一期"今日 AI 早报"。

## 选题口径（用户偏好）

**优先选**：
1. **能力突破** —— "AI 现在能做到 X 了"（例：1 分钟视频生成、实时语音通话、健康主动预警）
2. **应用层** —— 帮用户解决具体现实问题的新产品 / APP / 网站 / 开源工具

**降低权重 / 不放头条**：
- 单纯的"模型变快了 X%"、"价格下调 Y%"
- 推理路径优化等指标性新闻
- benchmark 提升（除非跨越关键阈值）

理由：模型快不快用户没体感；用户在意"今天 AI 又能多做一件什么事"。

## 工作步骤

1. **抓取** —— 浏览今日（${date} 前后 48 小时内）的真实 AI 相关新闻。建议源（不限）：
   - Anthropic / OpenAI / Google DeepMind / Meta AI 官方博客
   - GitHub Trending（AI / Agent 类）
   - Hacker News 首页
   - TechCrunch / The Verge / Information / Wired 的 AI 板块
   - Vercel / Cursor / Replit / V0 等开发工具方的 changelog
   - arXiv 当日 cs.AI / cs.CL 热门论文（仅当确实有重要突破）
2. **筛选** —— 选出 6–10 条最值得读的；用上面的口径打分。
3. **分类** —— 给每条打一个 category（见下方枚举）+ impact（major / medium）。
4. **写稿** —— 为每条写一个 1-2 段的解读，注明你能怎么用。
5. **附来源** —— 每条至少一个 block 带真实 URL + 发布日期。**不要编造来源**。

## 输出 JSON Schema（严格）

\`\`\`json
{
  "date": "${date}",
  "editorNote": "1-2 段编辑按语，约 80-150 字，写当日整体的 takeaway（不剧透具体条目）",
  "items": [
    {
      "title": "新闻标题，10-30 字，凝练 + 信息完整，保留核心专有名词 / 英文术语",
      "subtitle": "副标题，15-50 字，一句话说清这条新闻的"意义"",
      "category": "能力突破 | 应用产品 | 大模型 | 工具与开源 | 研究论文 | 政策与安全 | 投融资 | 国内动态",
      "impact": "major | medium",
      "sections": [
        {
          "id": "lead",
          "title": "概要",
          "blocks": [
            {
              "style": "lead",
              "text": "一句话标题级总结，20-40 字"
            },
            {
              "style": "prose",
              "text": "1-2 段解读，第一段是发生了什么 + 为什么这是个突破，第二段是用户能怎么用 / 哪些场景会受益。每段 60-150 字。",
              "source": {
                "cite": "出处名（如 OpenAI Blog / TechCrunch / GitHub）",
                "url": "https://真实URL",
                "publishedAt": "YYYY-MM-DD"
              }
            }
          ]
        }
      ]
    }
  ]
}
\`\`\`

## 强制约束

1. **JSON 输出**：只能是合法 JSON，不要 Markdown 围栏、不要解释、不要前后文字。
2. **来源真实**：每条 news 至少有一个 \`source.url\` 是真实的、可访问的。如果你不能确认某条新闻的来源，就不要放它。
3. **数量**：items 数组长度 6–10 条。质量优先于数量 —— 宁缺毋滥。
4. **类型分布**：尽量覆盖 3 个以上 category，不要全集中在一个分类。
5. **重大级别**：impact=major 的条目控制在 3–5 条；其余 medium。
6. **title 凝练**：避免标题党，避免冒号后接副标题（副标题用 subtitle 字段）。
7. **不要包含**：任何模型速度提升 / 价格下调类新闻当头条；可以放在 medium 级别且 ≤ 1 条。
8. **日期一致**：所有 \`publishedAt\` 应在 ${date} 前 48 小时内。

开始抓取并生成 JSON。`;
}
