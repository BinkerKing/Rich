# Know Everything · 第一阶段设计文档

> 版本：2026-05-16 · 基于需求文档 v0.3 + 多轮可视化设计讨论

## 1. 范围

本文档只覆盖**第一阶段 MVP** 的"场景 ①"——
**用户输入主题 → 看到知识树 → 进行第一轮探索（点击/弹卡/切中心/沿路径学习/组成课本）**

刻意排除（后续阶段）：项目目标驱动、跨树接枝、复盘 AI、风格系统的全部能力。

## 2. 设计原则（不可妥协）

1. **数据为本，HTML 为渲染产物。** 元、关系、路径都是结构化数据，HTML 只是某一时刻的展示。
2. **切换中心 = 纯 JS 重渲染，不调 AI。** AI 仅在显式生成动作（细化/展开/延伸/推荐路径/实战）时被调用。
3. **路径属于元的属性。** 第一次调 AI 生成后持久化，下次该元成为中心直接读数据。
4. **元类型可插拔。** 新增元类型 = 加一个数据 schema + 一个渲染模板，不动核心。
5. **中心元视角，不全图渲染。** 默认只展示中心 + 上游 2 层 + 下游 2-3 层。
6. **架构为 10 万元设计，第一阶段先跑通 1000 元。**

## 3. 视觉与交互（已敲定）

- **配色调性**：深空蓝底（#050b16）+ 单一青色（#3dd5cd）主调；路径用金/青/品色点缀。冷静、专业、不堆霓虹。
- **主界面布局**：三栏 280 / 主 / 240
  - 左栏：起点（当前元）/ 深度范围 1–9 / 路径概览
  - 主区：上游面包屑 + 圆形中心元 + L2 卡片行 + L3 胶囊列 + "继续展开下一层" CTA
  - 右栏：推荐路径色条 + 中心元操作 + 同级元
- **三种内容深度**：
  - 点击元 → 浮出**卡片**（peek，不切走）
  - 长按 / 卡片按钮 →**设为中心**（纯 JS 切换）
  - "深度阅读" →**单元素全屏阅读视图**（TOC + 长文 + 元信息侧栏）
  - 多选元 / 选择整条路径 →**课本模式**（多章节拼装阅读）
- **元操作（中心元上）**：细化 / 展开 / 延伸 / 实战 / 推荐路径 / 定位 / 风格

详见已生成的 mockup：
- `main-restyled.html` — 主界面
- `element-reader.html` — 元阅读视图
- `textbook-v2.html` — 课本模式

## 4. 核心数据模型

### 4.1 元（Element）

```ts
type ElementType =
  | "topic"     // 主题元
  | "concept"   // 概念元
  | "step"      // 步骤元
  | "viewpoint" // 观点元
  | "question"  // 问题元
  | "case"      // 案例元
  | "tool"      // 工具元
  | "ability"   // 能力元
  | "project"   // 项目元
  | "practice"  // 实战元
  | "summary"   // 总结元
  | "relation"  // 关系元
  | "dispute"   // 争议元
  | "exercise"; // 练习元

interface Element {
  id: string;                  // 稳定 ID，如 cog.psy.attention
  type: ElementType;
  title: string;
  subtitle?: string;
  aliases?: string[];          // 别名，供搜索
  tags?: string[];
  domain?: string;             // 所属领域
  difficulty?: "low" | "mid" | "high";
  content: ElementContent;     // 按 type 不同 schema 不同（见 4.2）
  paths?: LearningPath[];      // 已生成的推荐路径（持久化）
  metadata: {
    createdAt: string;
    updatedAt: string;
    generatedBy: "ai" | "user";
    aiModel?: string;
    richness: 1 | 2 | 3 | 4 | 5; // 低/中/高/深度/专家
  };
}
```

### 4.2 元内容（ElementContent）

按 `ElementType` 分 schema。第一阶段实现 **concept / step / topic / practice** 四类，其余类型 schema 预留。

```ts
// 概念元
interface ConceptContent {
  oneSentence: string;          // 一句话定义
  coreExplain: string;          // 核心解释
  whyMatters: string;           // 为什么重要
  mechanisms?: FlowStep[];      // 关键机制（可选流程图）
  examples?: Example[];         // 例子与类比
  misconceptions?: string[];    // 常见误区
  exercises?: Exercise[];       // 练习
  nextSteps?: string[];         // 下一步学习
}

// 步骤元 / 主题元 / 实战元 各有自己的 schema
// 详见 docs/superpowers/specs/element-schemas.md（后续单独写）
```

### 4.3 关系（Relation）

```ts
interface Relation {
  id: string;
  from: ElementId;
  to: ElementId;
  kind: "parent" | "child" | "sibling" | "related" | "prerequisite" | "extension" | "practice";
  strength?: number;            // 0-100，AI 计算或用户设置
  reason?: string;              // AI 生成的关联理由
  createdAt: string;
}
```

> 树结构通过 `kind: parent/child` 表达，主结构保持树状。相同元用 `kind: related` + 标注，不形成多父节点。

### 4.4 路径（LearningPath）

```ts
interface LearningPath {
  id: string;
  centerElementId: ElementId;   // 路径起点元
  kind: "quick" | "academic" | "practice" | "custom";
  label: string;                // 如"快速入门 15min"
  color: "gold" | "cyan" | "pink" | string;
  steps: ElementId[];           // 有序节点列表
  estimatedTime?: string;
  generatedBy: "ai" | "user";
  createdAt: string;
}
```

### 4.5 组织（Organization）

```ts
interface Organization {
  id: string;
  label: string;
  rootElementId: ElementId;
  scope: "tree" | "branch" | "subtree";
  style?: StyleSpec;            // 局部风格（第一阶段先留 schema 空实现）
}
```

## 5. 系统架构

```
┌─────────────────────────────────────────────────────┐
│  浏览器 · React + TS + Vite                          │
│  ┌──────────┬──────────┬──────────┬──────────────┐  │
│  │ Tree View│ Element  │ Textbook │ Search /     │  │
│  │  (中心元)│ Reader   │  Mode    │  AI Locate   │  │
│  └────┬─────┴────┬─────┴────┬─────┴──────┬───────┘  │
│       │          │          │            │          │
│  ┌────▼──────────▼──────────▼────────────▼───────┐  │
│  │   State Layer (Zustand) · 纯 JS 切换不调 AI    │  │
│  └────┬───────────────────────┬─────────────────-┘  │
│       │                       │                     │
│  ┌────▼────────┐         ┌────▼─────────────────┐   │
│  │ IndexedDB   │         │   Local Server API   │   │
│  │ (索引+缓存) │         │   /api/elements      │   │
│  └─────────────┘         │   /api/relations     │   │
│                          │   /api/ai/refine     │   │
│                          │   /api/ai/expand     │   │
│                          │   /api/ai/path       │   │
│                          │   /api/tasks/codex   │   │
│                          └────┬─────────────────┘   │
└───────────────────────────────│─────────────────────┘
                                │
              ┌─────────────────▼──────────────────┐
              │  本地 Node 后端 (Express / Hono)    │
              │  ┌────────┬──────────┬────────────┐ │
              │  │ JSON FS│ Indexer  │ AI Bridge  │ │
              │  │ Store  │ (元搜索) │            │ │
              │  └────────┴──────────┴─────┬──────┘ │
              └────────────────────────────│────────┘
                                           │
                ┌──────────────────────────┼──────────────────┐
                │                          │                  │
       ┌────────▼────────┐    ┌────────────▼──────┐   ┌───────▼──────┐
       │ Claude API      │    │ Codex CLI subprc  │   │ Vector Index │
       │ (知识生成)      │    │ (前端代码修改)    │   │ (相似元/接枝)│
       └─────────────────┘    └───────────────────┘   └──────────────┘
```

### 5.1 渲染层（React）

**关键原则：所有视图都从 State 读数据，不直接调后端。** 切中心、切路径显隐、点元弹卡——全部 JS 即时。

视图模块：
- `TreeView`：3 层放射 + 路径 + 同级 + 操作
- `ElementReader`：单元素全屏阅读
- `TextbookMode`：多元素拼装课本
- `ElementCard`（peek 弹卡）
- `Search` + `AILocate`
- `TaskCenter`（Codex 任务队列）

### 5.2 状态层（Zustand）

```ts
interface AppState {
  elements: Map<ElementId, Element>;
  relations: Relation[];
  paths: Map<ElementId, LearningPath[]>;   // 每个元的已生成路径
  currentCenter: ElementId | null;
  selectionMode: boolean;
  selection: ElementId[];
  activeView: "tree" | "reader" | "textbook";
  visiblePathKinds: Set<string>;           // 哪些路径显示
}
```

### 5.3 本地后端（Node + Hono）

- **职责**：文件读写、AI 调用、Codex 子进程编排、向量索引维护
- **不做**：UI 状态、视图逻辑
- **API 风格**：REST + SSE（AI 流式生成）

关键端点：
```
GET    /api/elements              列表 + 筛选
GET    /api/elements/:id          单元素详情
POST   /api/elements              新建（通常由 AI 触发）
PATCH  /api/elements/:id          更新
GET    /api/relations?from=:id    出边
POST   /api/ai/refine             细化（流式）
POST   /api/ai/expand             向下展开
POST   /api/ai/extend             横向延伸
POST   /api/ai/path               生成推荐路径（多条）
POST   /api/tasks/codex           创建改码任务
GET    /api/tasks/codex/:id       任务状态
GET    /api/search?q=:query       模糊搜索
POST   /api/locate                AI 语义定位
```

### 5.4 AI Bridge

- **Knowledge AI**（Claude API）：负责生成元内容、路径、关系判断
- **Code AI**（Codex CLI 子进程）：负责前端代码修改任务
- **Orchestrator**（本地编排）：读 AI 经验说明书（`ai/*.md`），组合提示词

每个 AI 角色一份 markdown 说明书：`ai/knowledge.md` / `ai/codex.md` / `ai/orchestrator.md` / `ai/reviewer.md`。说明书可手编 + AI 自动补，不做严格版本管理。

### 5.5 存储层

```
data/
├── elements/
│   ├── cog.psy.attention.json
│   ├── cog.psy.memory.json
│   └── ...
├── relations.jsonl              # 关系按行存，append-friendly
├── paths/
│   └── <element-id>.json        # 该元的所有路径
├── organizations.json
├── indexes/
│   ├── fulltext.idx             # 前缀/分词索引（MiniSearch）
│   └── vectors.bin              # 嵌入向量（后续阶段）
└── snapshots/                   # 重要时刻快照
```

**为什么不一上来用 SQLite**：JSON 文件可读、可 diff、可手动改、git friendly。1000 元规模完全够用。10 万元时再迁 SQLite 或 DuckDB，迁移路径通过 `ElementsRepository` 接口隔离。

## 6. 目录结构

```
know-everything/
├── apps/
│   ├── web/                        # React 前端
│   │   ├── src/
│   │   │   ├── views/              # TreeView / ElementReader / TextbookMode
│   │   │   ├── components/         # ElementCard / OperationsPanel / PathChip ...
│   │   │   ├── state/              # Zustand stores
│   │   │   ├── api/                # 调本地后端的封装
│   │   │   ├── renderers/          # 按元类型渲染（可插拔）
│   │   │   │   ├── concept.tsx
│   │   │   │   ├── step.tsx
│   │   │   │   ├── topic.tsx
│   │   │   │   └── practice.tsx
│   │   │   ├── theme/              # 颜色/排版 token
│   │   │   └── lib/                # 工具
│   │   └── vite.config.ts
│   └── server/                     # Node 本地后端
│       ├── src/
│       │   ├── routes/             # /api/* 路由
│       │   ├── ai/                 # AI 调用封装
│       │   │   ├── claude.ts
│       │   │   ├── codex.ts
│       │   │   └── prompts/        # 提示词模板
│       │   ├── repos/              # 数据访问层（接口 + JSON 实现）
│       │   │   ├── elements.ts
│       │   │   ├── relations.ts
│       │   │   └── paths.ts
│       │   ├── indexer/            # 全文/向量索引维护
│       │   └── tasks/              # Codex 任务队列
│       └── package.json
├── packages/
│   ├── domain/                     # 共享类型 + 业务逻辑（前后端共用）
│   │   └── src/
│   │       ├── types.ts            # Element / Relation / Path 等核心类型
│   │       ├── elementTypes/       # 各元类型的 schema 定义
│   │       └── pathLogic.ts        # 路径相关纯函数
│   └── ui-kit/                     # 可复用 UI 原子（按钮/卡片/segmented）
├── ai/                             # AI 角色说明书
│   ├── knowledge.md
│   ├── codex.md
│   ├── orchestrator.md
│   └── reviewer.md
├── data/                           # 实际数据（gitignore，仅 sample 入库）
├── docs/
│   └── superpowers/specs/          # 本文档所在
├── package.json                    # pnpm workspaces 根
└── pnpm-workspace.yaml
```

**为什么这样拆**：

- `apps/web` 和 `apps/server` 物理隔离 → 前后端可独立替换（未来要做 Tauri 桌面壳，前端代码完全复用）
- `packages/domain` 共享类型 → 元类型扩展只动这里，前后端自动跟上
- `renderers/` 目录是**元类型扩展点**——加新元类型 = 加一个文件
- `repos/` 是**存储扩展点**——JSON→SQLite→云端，只改这一层
- `ai/*.md` 是**AI 经验扩展点**——AI 行为调整 = 改 markdown，不动代码

## 7. 扩展性核心约定

| 演化方向 | 扩展点 | 改什么 |
|---|---|---|
| 加新元类型 | `packages/domain/elementTypes/` + `apps/web/src/renderers/` | 一个 schema + 一个组件 |
| 换存储引擎 | `apps/server/src/repos/` | 实现 Repository 接口 |
| 换 AI 模型 | `apps/server/src/ai/` | 替换 `claude.ts` |
| 换前端框架 | apps/web 整个替换 | server 不动 |
| 加视图（如时间线、关系图） | `apps/web/src/views/` | 新增视图组件，State 不变 |
| 加新路径类型 | `paths.kind` 加枚举 + UI chip | 数据已支持 |

## 8. 第一阶段范围（与 v0.3 §14 对齐）

必须跑通：
1. 输入主题 → AI 生成第一棵知识树（中心元 + 2 层下游 + 同级 + 上游 2 层）
2. 默认中心元视角，不全图渲染
3. 三种元操作：细化 / 展开 / 延伸（调 AI 流式生成）
4. 任意元设为中心（纯 JS 切换）
5. 至少 4 种元类型：主题 / 概念 / 步骤 / 实战
6. 不同元类型渲染不同内容结构
7. 模糊搜索 + AI 语义定位
8. 元阅读视图 + 课本模式（多元素拼装）
9. 1000 元模拟数据下搜索、定位、局部展示流畅

不做（留后续阶段）：
- 项目目标驱动学习
- 跨树接枝
- Codex 改码闭环（架构预留，但完整链路放下一阶段）
- 风格系统
- 复盘 AI

## 9. 风险与缓解

- **Claude API 成本失控**：所有 AI 调用走流式 + 本地缓存（同元同操作 24h 内不重复调）
- **JSON 文件大量小文件**：1 元 1 文件方便 git diff；超过 5000 元改为按组织聚合
- **IndexedDB 索引漂移**：每次启动校验索引 hash vs 文件 hash，不一致重建
- **Codex CLI 不稳定**：任务隔离在子进程，失败不影响主分支；先做"建议补丁"模式再做"自动合并"
