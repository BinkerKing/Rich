# GreatMe 重做设计（对齐 TheGreatMe Mac 原版）

> 反编译 `/Users/binkerking/Documents/Ai-WorkSpace/项目分析/Contents/MacOS/TheGreatMe` + 16 张截图 + 1458 条 `Localizable.strings`。
> 该 Mac 版定位是 **iPhone 主端的桌面观察台**，多数数据"等待 iPhone 同步"。我们的 Rich 版是 **单机版**：Hermes 当大脑，本地 SQLite 当唯一数据源，没有任何同步、社交、跨设备概念。

## 一、信息架构（必须对齐）

侧边栏一级导航（七项，去掉原版的"排行榜"）：

1. **首页** — 专注当下、持续进化
2. **目标管理** — 年/月/周目标 + 今日任务
3. **事件洞察** — 主题泡泡 + 时间视角
4. **数据分析** — 完成率趋势 / 能力图 / MBTI 趋势 / AI 洞察总结
5. **每周复盘** — 整体摘要 / 数据洞察 / 行动结论 / 历史考核 / 复盘证据
6. **对话详情页** — HQ 对话（接 Hermes，列表 + 详情双栏）
7. **设置** — 身份 / 周期 / 数据 / 体验 / 提醒 / 关于（去掉权限和订阅）

每个一级页右上角有 `命令栏`：`TheGreatMe / <当前页>` 标题 + 刷新按钮 + 静音 + 设置图标。

## 二、视觉系统（颜色完全推倒）

原版是 **暖琥珀 + 近黑** 配色，不是我之前那套蓝紫。

| Token | Value | 用途 |
|---|---|---|
| `--gm-bg` | `#0c0a08` | 全局底色（偏暖近黑） |
| `--gm-bg-soft` | `#15110c` | 卡片/侧栏底 |
| `--gm-bg-lift` | `#1d1813` | 选中态、hover |
| `--gm-line` | `rgba(217,154,62,.18)` | 卡片描边 |
| `--gm-line-strong` | `rgba(217,154,62,.45)` | 选中描边 |
| `--gm-amber` | `#d99a3e` | 主品牌色（图标、强调文字、关键曲线） |
| `--gm-amber-soft` | `#5b3a14` | 大块琥珀填充（按钮 active） |
| `--gm-amber-glow` | `rgba(217,154,62,.25)` | 发光、selection bg |
| `--gm-text` | `#ede4d3` | 主文字（偏奶白） |
| `--gm-text-mute` | `#7a6a52` | 次要文字 / caption |
| `--gm-success` | `#7bbf5b` | 完成态 |
| `--gm-danger` | `#d96a5b` | 阻碍 / 失败 |

字体：旧字号大幅缩水。导航 13px，正文 12-13px，KPI 大数 24-28px，section title 14px 半粗。圆角统一 10px，卡片 14px。

排版网格：**侧栏固定 220px** + 内容区。内容区里二级面板用 12 / 16 / 20px 间距三档，不要随机数字。

## 三、首页布局（重点重做）

从上到下：

1. **范围切换 chip 行**：`周度 · 月度 · 年度 · 全部 · 自定义`（带"第 N 周"小角标）
2. **三栏 KPI 行**：
   - 本周目标（带 AI 推荐按钮）
   - 本周完成率（百分比 + 进度环）
   - 复利指数（数字 + 趋势曲线 sparkline）
3. **二栏主体**：
   - 左：今日任务列表（带麦克风录音输入）
   - 右上：能力图（六角雷达：执行 / 聚焦 / 节奏 / 复盘 / 恢复 / 证据）
   - 右下：本周里程碑 + 阶段标签（校准 / 推进 / 复盘 / 收束）
4. **每日任务卡片组**（横向 4 张）：明日规划 / 今日在做 / 2 分钟冥想 / 胜利-阻碍
5. **每周行动汇报**：胜利回顾 / 阻碍复盘 / 下周规划 三列
6. **最近事件**：泡泡或列表，可点进事件洞察

呼吸冥想 02:13 是从这里一张卡片打开的全屏圆环动画。

## 四、其它页关键元素清单（只列出必须有的，避免漏抓）

- **目标管理**：左侧"目标金字塔"（年/月/周 三角堆叠）+ 右侧目标列表 + 新增目标 modal（标题 / 阶段 / 关键动作 / 截止日）
- **事件洞察**：泡泡云（大小 = 热度，颜色 = 主题分类）+ 右键合并/屏蔽/删除 + 详情面板（30 天活跃 / 90 天趋势 / 今日在做）
- **数据分析**：数据概览 4-KPI（总任务 / 完成率 / 最长连续 / 累计天数，原"获得经验/等级"砍掉）+ 任务完成率趋势曲线 + 贡献格子 + 能力图（六维）+ MBTI 趋势 + AI 洞察总结
- **每周复盘**：整体摘要（含分数 + 趋势）/ 数据洞察 4-metric / 行动结论 3 列 / 历史考核 / 复盘证据（本周目标 / 今日任务 / 最近事件 三 tab）+ 进入复盘对话
- **对话详情页**：左侧对话列表 + 右侧详情；底栏快捷 chip：`自动判断 / 第一性原理 / 五问法 / SWOT` + 操作 chip `今日在做 / 分析框架 / 问我 / 目标探索`；HQ 人格切换：参谋长 Nova / 严格执行官 / 温和陪跑官 / 自定义
- **设置**：六大节（去掉订阅、权限）—— 身份 / 周期 / 数据（仅本地备份导出） / 体验 / 提醒 / 关于

## 五、Rich 适配差异（必须显式说明）

| 原版概念 | Rich 等价 |
|---|---|
| iPhone 同步 | 本地 SQLite 唯一数据源；所有"等待同步"文案改成空态 CTA（如"还没有数据，去新增第一条目标"） |
| AI 网关 BackendAPIToken | 走 Hermes，不需要 Token，去掉 `APIKeys.local.plist` 相关错误链路 |
| iCloud / 备份导入导出 | 砍掉（数据全在本地 SQLite，Rich 已有备份机制） |
| 排行榜 / 赛季 / 特工等级 / EXP | **全砍**，单机版无社交、无积分系统 |
| 订阅 / StoreKit | **全砍** |
| HQ 人格 | 通过 Hermes session system prompt 切换 |
| 语音输入 | Web Speech API（已有 chat 用过） |
| 冥想音 | `Contents/Resources/breath/` 里有 wav，拷一份到 `apps/web/public/sound/breath/` |
| 特工代号 / 任务模式（主线/偶遇） | 保留作为"身份"设置项，但不再驱动其它逻辑 |

## 六、改造范围（文件清单）

- `apps/web/src/views/GreatMeView.css` — **整体重写**，全部色 token 替换为琥珀方案
- `apps/web/src/views/GreatMeView.tsx` — 改信息架构，侧栏 8 项，每页对应一个子组件文件
- `apps/web/src/views/greatme/HomeSection.tsx`（拆分）
- `apps/web/src/views/greatme/GoalsSection.tsx`
- `apps/web/src/views/greatme/EventsSection.tsx`
- `apps/web/src/views/greatme/AnalyticsSection.tsx`
- `apps/web/src/views/greatme/WeeklyReviewSection.tsx`
- `apps/web/src/views/greatme/MissionControlSection.tsx`（HQ 对话）
- `apps/web/src/views/greatme/SettingsSection.tsx`
- ~~`apps/web/src/views/greatme/LeaderboardSection.tsx`~~ ← 砍掉
- `apps/web/src/views/greatme/BreathOverlay.tsx`（冥想全屏）
- Server：`apps/server/src/repos/SqliteGreatMeRepo.ts` 数据 schema 扩到能装下：goals[]、events[]、daily_tasks[]、reviews[]、ability_snapshots[]、compounding_assets[]、conversations[]
- 资源：拷 `Contents/Resources/breath/*.wav` → `apps/web/public/sound/breath/`

## 七、Phase 切分（落实成 plan 的时候用）

1. **P0 视觉骨架**：换色 token、新七项侧栏、命令栏。每页留空 panel 占位。
2. **P1 首页**：范围 chip、三栏 KPI、今日任务、能力图、本周里程碑。
3. **P2 每日任务卡 + 每周行动汇报 + 最近事件**。
4. **P3 目标管理 + 新增目标 modal + 目标金字塔**。
5. **P4 事件洞察泡泡**（用 d3-force 或简单弹簧布局）。
6. **P5 数据分析全套图表**（recharts）。
7. **P6 每周复盘 + 复盘对话**。
8. **P7 对话详情页（接 Hermes）+ 人格切换**。
9. **P8 设置八节**。
10. **P9 呼吸冥想全屏 + 音效**。

每个 Phase 落地后单独 commit + 截图对比原版截图。

## 八、不做（单机版砍清单）

- 排行榜 / 赛季 / 贡献排名 / 徽章（含侧栏入口）
- 特工等级 / EXP / Lv 进度环（数据分析里的"等级趋势"图也砍）
- iCloud 同步 / iPhone 同步状态 / 跨端备份导入导出
- 订阅 / StoreKit / App Store 评分跳转
- 系统权限页（麦克风/语音识别走浏览器原生授权，不做汇总面板）
- 所有"等待 iPhone 同步"系列文案
