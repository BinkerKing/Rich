# TheGreatMe Mac · 完整组件清单（反编译）

> 来源：从 `MacOS/TheGreatMe` Mach-O 二进制提取的 SwiftUI 视图类型名。
> 全部 199 个 View，下面按页归类。命名规则：
> - `*Page` = 顶层页（侧栏入口）
> - `*Panel` = 页内大区块
> - `*Card` = 卡片
> - `*Row` = 列表行
> - `*Cell` = 网格单元
> - `*Sheet` = 模态
> - `*Bar` = 横向控件条
> - `*Picker` = tabs / 切换器
> - `*Chart` = 数据图
> - `*Strip` = 横向序列

## 顶层框架
- `MacDashboardView` 根
- `MacDashboardSidebarView` 侧栏
- `MacDashboardSidebarSyncProgressView` 侧栏底部同步状态
- `MacDashboardDetailView` 主内容区
- `MacDashboardSection` 页内 section
- `MacDashboardPanel` 通用面板
- `MacDashboardReplicaPanel` 副本面板（？）
- `MacDashboardNoDataCard` 空态卡

## 1. 首页 · `MacDashboardHomeView`

**顶部 hero**
- `MacDashboardHomeScopePicker` ← 周/月/年/全部 tabs（嵌入 hero 卡里）
- `MacDashboardFocusedTodayPanel` ← 今日聚焦总面板
- `MacDashboardFocusedTaskRow` ← 今日任务行（4 个固定栏目就是这种）
- `MacDashboardTodayInputBar` ← 底部输入条
- `MacDashboardTaskWeekPicker` ← 周历
- `MacDashboardTaskCalendarSheet` ← 周历点开后的日历 sheet
- `MacDashboardSelectedWeekDayCell` ← 选中日 cell
- `MacDashboardMonthDayCell` ← 月内单日 cell
- `MacDashboardMonthWeekRow` ← 月历的周行

**本周里程碑**
- `MacDashboardWeeklyMilestonePanel`
- `MacDashboardWeeklyMilestoneStandaloneCard`
- `MacDashboardMilestonePhaseNodeStrip` ← 横向节点条
- `MacDashboardMilestoneCurveChart` ← 曲线
- `MacDashboardMilestoneFooter`
- `MacDashboardMilestonePhaseSelectionCard`
- `MacDashboardMilestoneAIProposalBar` ← AI 建议条
- `MacDashboardMilestonePhaseEditorSheet` ← 编辑 sheet

**复利指数**
- `MacDashboardHomeCompoundingIndexChart` ← 大数字 + 趋势 mini-chart
- `MacDashboardHomeCompoundingAssetCard` ← 单条复利资产
- `MacDashboardHomeCompoundingAssetGrid` ← Top 3 资产网格

**本周战术地图**
- `MacDashboardHomeTacticalRegionDrilldownPanel`
- `MacDashboardHomeThemeBubblesPanel` ← 主题泡泡

**KPI tiles**
- `MacDashboardHomeMiniMetricCard` ← 单个小 KPI 块

**本周任务完成率**
- `MacDashboardHomeAreaChartCard` ← 区域线图

**本周能力图**
- `MacDashboardHomeHexAbilityView` ← 六角能力图（核心组件）
- `MacDashboardHomeAbilityRadarPanel` ← 雷达面板

**输入与语音**
- `MacDashboardHomeVoiceTaskAnalysisCard` ← 语音任务分析卡
- `MacDashboardHomeTaskApplyNoticeView` ← 任务应用通知

**每周行动汇报**
- `MacDashboardWeeklyActionReportShortcutPanel`
- `MacDashboardWeeklyOverviewCard`
- `MacDashboardWeeklyOverviewRow`
- `MacDashboardLightProgressBar` ← 亮琥珀进度条

## 2. 目标管理 · `MacDashboardGoalManagementPage`
（页内 view 共用 home 的 Milestone / Panel / Row 系列）

## 3. 事件洞察
（顶级 page 类未单独命名，借用 `MacDashboardHomeTacticalRegionDrilldownPanel` 这套）

## 4. 数据分析 · `MacDashboardAnalyticsPage`
- `MacDashboardAnalyticsPanel`
- `MacDashboardAnalyticsCard`
- `MacDashboardAnalyticsHeroCard` ← 顶部 hero
- `MacDashboardAnalyticsScopePicker` ← 周/月/年/全部 tabs
- `MacDashboardCompletionTrendCard` ← 任务完成率趋势
- `MacDashboardContributionCard` ← 贡献格子
- `MacDashboardContributionGrid` ← 格子网格本体
- `MacDashboardContributionCell` ← 单个格子
- `MacDashboardAbilityRadarCard` ← 能力雷达
- `MacDashboardLevelTrendCard` ← 特工等级趋势（单机版砍）
- `MacDashboardMBTITrendCard` ← MBTI 趋势
- `MacDashboardInsightSummaryCard` ← AI 洞察总结
- `MacDashboardInsightSuggestionRow` ← AI 建议单条
- `MacDashboardLineChart` ← 通用线图

## 5. 每周复盘 · `MacDashboardWeeklyReviewPage`
- `MacDashboardWeeklySummaryFocusPanel`
- `MacDashboardWeeklySummaryListCard`
- `MacDashboardMonthlyStoryCoverCard` ← 月度故事封面
- `MacDashboardMonthlyStoryFocusPanel`
- `MacDashboardMonthlyStoryListCard`
- `MacDashboardMonthlyStoryProgressBar`

## 6. 对话详情页 · `MacDashboardConversationPage`
- `MacDashboardConversationSessionList` ← 左侧对话列表
- `MacDashboardConversationSessionRow` ← 列表项
- `MacDashboardDailyTaskDetailSheet` ← 每日任务详情 sheet
- `MacDashboardFrameworkPickerBar` ← 分析框架（自动判断/第一性原理/五问法/SWOT）
- `MacDashboardFrameworkPickerRow` ← 框架行
- `MacDashboardHQInputBar` ← 底部 HQ 输入条
- `MacDashboardHQQuickActionGrid` ← 快捷动作（今日在做/分析框架/问我/目标探索）
- `MacDashboardHQStatusPill` ← 状态徽章

## 7. 设置 · `MacDashboardSettingsPage`
- `MacDashboardSettingsPanel` ← 主面板
- `MacDashboardSettingsSearchBar` ← 顶部搜索栏
- `MacDashboardSettingsSectionPanel` ← 二级节面板
- `MacDashboardSettingsAgentCard` ← 特工卡（身份）
- `MacDashboardSettingsActionRow` ← 可点击动作行
- `MacDashboardSettingsBriefRow` ← 简略只读行
- `MacDashboardSettingsControlRow` ← 带控件（toggle/select）的行
- `MacDashboardSettingsNavigationRow` ← 跳转行
- `MacDashboardSettingsReadOnlyRow` ← 只读行
- `MacDashboardSettingsBackgroundProfileGroupItem` ← 背景资料分组项
- `MacDashboardSettingsBackgroundHistoryRow` ← 背景历史行
- `MacDashboardSettingsBackgroundHistoryItem` ← 背景历史项
- `MacDashboardSettingsReleaseNoteRow` ← 版本说明行
- `MacDashboardSettingsReleaseNoteItem` ← 版本说明项
- `MacDashboardSettingsAuthorAppRow` ← 作者其他 app 行（XPAN Cam、Flip Timer 等）
- `MacDashboardSettingsBarcodeView` ← 二维码（用于扫码 iPhone 端拉数据）

## 8. 排行榜（**Rich 单机版砍掉**）
- `MacDashboardLeaderboardPanel`、`*Card`、`*HeroCard`、`*HeroPill`、`*KPICard`、`*RowView`、`*DisplayRow`、`*ContributionBar`、`*ContributionRankChart`、`*ContributionRankItem`、`*ContributionRankRow`、`*RankTrendChart`、`*LineItem`、`*AmberBarGrid`、`*ChartGrid`

## 共用工具
- `MacDashboardLightProgressBar` 亮琥珀细进度条
- `MacDashboardLineChart` 通用折线图
- 持久化常量：`MacDashboardLastSelectedSection`（用户上次停留页）

## 颜色 / 资源说明
- Assets.car **里没有 Color 资产**（colors 全部 inline 在 SwiftUI 代码里写死）
- Assets.car 只有图片：
  - **AppIcon**
  - **AgentBadge** × 8 种语言（DE/EN/ES/FR/JP/KO/ZH/ZHHant）
  - **HQ 头像** × 3 角色 × 2 状态：HQNovaGood/Think、HQMaxGood/Think、HQVeraGood/Think
  - **AuthorAppXxx**：作者其它产品的图标（CropandGrade、FlipTimer、MistLens、SideProject、TheGreatMe、XPANCam）
  - **StoryCard1/2/3**：每周复盘的故事封面
  - **PackedAsset** 大图集（包含其它小素材）

## 关键发现：HQ 三个人格

原版有 **三个** HQ 角色（不是只有 Nova）：
- **Nova**（参谋长 / 主考官）
- **Max**（执行官）
- **Vera**（陪跑官）

每个角色有两个表情态：Good（顺利）/ Think（思考）。Rich 端要对应做 3 个头像 placeholder + Hermes system prompt 切换。

## CoreData 模型

主体：`MeetingSessionDraftEntity`（HQ 对话草稿），其它属性碎片：
- `activationHQHelp`
- `defaultSpeakerRoleID`
- `innovationScore`
- `lastMentionedAt`、`isPinned`
- `sourceLabelsRaw`
- `textFingerprint`
- `urgentNotesData`
- `weekStartOptionRaw`

## 用这份清单做什么

接下来 **每改一页都要对照这份清单**：原版有哪些组件、组件之间什么关系、命名表意。我自己写代码时也按这些名字组织（即 `WeeklyMilestonePanel`、`HexAbilityView`、`FrameworkPickerBar` 这种）。
