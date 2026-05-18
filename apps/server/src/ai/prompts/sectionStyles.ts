/**
 * Catalog of section block styles the frontend can render.
 * Injected into refine / generate-tree prompts so AI can compose a
 * `sections: [{ id, title, blocks: [{ style, ... }] }]` array tailored to the
 * actual nature of the element being written about.
 *
 * Keep this in sync with apps/web/src/components/SectionRenderer.tsx.
 */
export const SECTION_STYLE_CATALOG = `
**章节样式目录（block.style）**

通用文本：
- "lead" { text } —— 段落起手的关键句，加粗放大。一节最多 1 个。
- "prose" { text } —— 普通段落正文，支持 \\n\\n 分段。
- "quote" { text, cite? } —— 引用 / 名言 / 摘录。
- "callout" { kind, title?, body } —— 提示卡片。kind ∈ tip/insight/example/warning/info。

列表：
- "check-list" { items[], columns?: 1|2 } —— ✓ 勾选清单。columns=2 = 两列紧凑。
- "dot-list" { items[] } —— 圆点列表，常用作"下一步 / 推荐路径"。
- "checklist-grouped" { groups: [{ title, items[] }] } —— 按主题分组的清单（行前准备 / 着装 / 文件…）。
- "warn-cards" { items[] } —— 红色警示卡片（一行一条），用于易混点 / 风险 / 失败点。
- "example-list" { items[] } —— 编号示例卡片（绿色边），用于"典型例子"。

流程 / 决策：
- "mechanism-flow" { steps: [{ label, description? }] } —— 编号机制 / 工作流，每步 label + 说明。
- "phase-timeline" { phases: [{ label, body }] } —— 编号阶段（项目实施 / 学习路径）。
- "decision-list" { decisions: [{ topic, choice, rationale?, alternatives?[] }] } —— 设计决策卡片。
- "diagram" { title, caption?, mermaid } —— Mermaid 图。**只允许 \`flowchart LR\` / \`flowchart TD\` / \`sequenceDiagram\` / \`stateDiagram-v2\` / \`gantt\` 这几种类型；严禁使用 \`mindmap\`。**
  - **只在真正"线性流程 / 决策分支 / 状态切换 / 时序 / 时间甘特"时才用 diagram。**
  - 表达"1 个主题 → N 个并列分支 → 每个分支下若干条目"这种**类目结构**时，**不要用 diagram 画思维导图**——它会渲染成放射状一团乱。改用 \`module-grid\`（每个分支一张卡片，body 列出子条目）。
  - 必须用 diagram 时：所有节点必须连边（不能孤立），少用 subgraph；中文标签 3-10 字；节点风格 [中文标签]。

结构 / 表格：
- "kv-table" { rows: [{ key, value }] } —— 关键-取值表（基本信息 / 配置 / 规格）。
- "competitor-table" { rows: [{ name, takeaway }] } —— 竞品 / 对比表。
- "module-grid" { cards: [{ title, body, focus? }] } —— 卡片网格（主题分模块）。
- "mvp-grid" { features: string[] } —— 编号特性卡片（项目 MVP / 功能列表）。

行程 / 计划专用：
- "day-schedule" { days: [{ label, summary?, items: [{ time?, what, note? }] }] } —— 按日的行程表（旅游、训练计划、活动安排）。
- "budget-table" { lines: [{ item, qty?, cost, note? }], total? } —— 预算 / 费用清单。

辅助：
- "image" { src, alt, caption? } —— 真实图片。**你应当主动调用 image_gen 工具**（按 imagegen skill）生成图片并把工具返回的绝对路径填入 src（如 "/Users/binkerking/.codex/generated_images/<sid>/ig_xxx.png"）。后端会把这个文件复制到 /api/images/<elementId>/<file> 并自动改写 src。每次生成图片必须给 alt（无障碍描述）和 caption（图片下方一行说明）。
- "image-placeholder" { alt, caption? } —— 仅当用户明确说不要图片或 image_gen 不可用时才用，否则一律用 "image"。
- **图片生成质量门槛**：调用 image_gen 前先在心里列出 prompt 关键词（主体、构图、光线、季节、风格），保证生成出来的是高质量配图而不是抽象草稿。
- **图片数量建议**：每个元 1-3 张关键图（不要每节都塞），优先给"地标 / 食物 / 装备 / 路线地图 / 风景"这类有视觉价值的内容配图。

**组合规则：**
1. 每节（section）= 一个 title + 若干 blocks，blocks 顺序就是渲染顺序。
2. 一节可以混搭多个 block（例：先 lead 一句话定义 → 再 prose 展开 → 再 callout 关键洞察 → 再 example-list 配例子）。
3. 章节数量 = 元天然需要的章节数，**不要硬凑** "是什么 / 为什么 / 易混点" 这种模板——按元自己的结构来。
4. 旅游元 → 推荐章节："行程概览(prose+kv-table)" / "每日安排(day-schedule)" / "预算(budget-table)" / "出行清单(checklist-grouped)" / "注意事项(warn-cards)"
5. 训练元 → 推荐章节："目标(lead+prose)" / "每周计划(day-schedule)" / "饮食建议(checklist-grouped)" / "进度跟踪(kv-table)" / "常见错误(warn-cards)"
6. 概念元（认知心理学、React 动画等）→ 仍可用旧字段；如果想用 sections 也可以，但更适合 "lead + prose + mechanism-flow + example-list + warn-cards"。
7. **未知 style 会被前端兜底成警告**，所以请严格使用上面列表中的 style 名。
`;
