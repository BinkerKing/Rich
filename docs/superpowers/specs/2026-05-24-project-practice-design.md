# 项目实战 系统设计

**Date:** 2026-05-24
**Author:** 大斌哥 + Rich (Hermes brainstorming)
**Status:** Design approved, awaiting plan

## 目标

为 Rich 加一个**项目实战**顶级模块，专门管理"实战项目"。
跟知识树、PPT 导图、计划管理 三个已有模块并列，但**数据完全复用知识树**
（实战项目 = type=`practice` 的 element）。

**核心价值：**

1. 把散在知识树里的 `practice` 元集中起来管理
2. 围绕项目做 **结构拆解**（知识点 / 需求分析 / PRD / 开发任务）
3. **AI 帮你起草 PRD** —— 这是 V1 的最重要 AI 能力
4. 项目级 **效果图画廊**

---

## 数据模型

### 实战项目 = 一个 `practice` 元

实战项目本身是知识树里 type=`practice` 的 element。**零新数据类型。**

### 子元 = 通过 "child" relation 挂在 practice 下的 element

按角色分 4 组，每组复用一种已有的 element type：

| UI 分组 | element.type | 备注 |
|---|---|---|
| 知识点 | `concept` | 学到的东西 |
| 需求分析 | `case` | 用户痛点 / 场景分析 |
| PRD | `product-design` | 产品需求文档 |
| 开发任务 | `step` | 实施步骤 |

效果图 = practice 元的**自身**图片附件（复用现有 image-attachment 系统，
按 parentElementId 索引），不通过子元承载。

### Schema 变更（最小）

```ts
interface Element {
  // ... 现有字段
  status?: "todo" | "doing" | "done";   // 仅 step 用
}
```

- 1 个新 optional 字段
- 向后兼容（旧元素 status 为 undefined，按 "todo" 渲染）
- 这次**不加** `analysis` / `extras` 等字段；按需未来再补

### 后续可能补充的属性（**不在 V1 范围**）

| 元类型 | 可能字段 | 何时加 |
|---|---|---|
| PRD (`product-design`) | `prdStatus`, `version`, `acceptance` | 用户开始写超过 1 份 PRD |
| 需求分析 (`case`) | `painPoints`, `targetUsers`, `competitors` | 用户做正式用户调研 |
| 开发任务 (`step`) | `estimate`, `actual`, `priority`, `assignee` | 多人协作 / 工时统计 |

---

## 导航

新增顶级 `AppView`：`"practice"`。

```
左侧 dock / TopBar：
├── 知识树   (existing "tree" AppView)
├── PPT 导图 (existing "mindmap")
├── 计划管理 (existing "greatme")
└── 项目实战 (NEW "practice")  ← 这次加
```

进入路径：dock 图标 → 列表页 → 点项目卡片 → 工作空间

---

## 列表页 (Practice 全部项目)

```
┌────────────────────────────────────────────────────────────┐
│  项目实战                                  [+ 新建项目]    │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│  │ 标题      │ │ 标题      │ │ 标题      │ │ + 新建   │    │
│  │ 知识 12   │ │ ...      │ │ ...      │ │ 项目     │    │
│  │ PRD  2   │ │          │ │          │ │          │    │
│  │ 任务 ▓5 │ │          │ │          │ │          │    │
│  │      ░3 │ │          │ │          │ │          │    │
│  │ status   │ │          │ │          │ │          │    │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘    │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

**数据来源：** `state.elements` 里所有 type === "practice" 的元。

**每张卡显示：**

- 标题 + subtitle（如有）
- 子元统计：知识点 N / 需求分析 M / PRD K / 任务 done/total
- 任务进度条（按 step 子元的 status 算）

**新建项目：** 复用现有 `createElement` 流程，type 锁死为 "practice"，
触发后跳入工作空间。

---

## 工作空间（一个 practice 元）

3 个 Tab：**总览 / 拆解 / 效果图**

### Tab 1 · 总览

```
┌────────────────────────────────────────────────────────────┐
│  ← 全部项目                                                │
│  «practice 元的 title»                       [进行中]      │
│  practice · 创建 YYYY-MM-DD · 最近 YYYY-MM-DD              │
├────────────────────────────────────────────────────────────┤
│  总览  |  拆解  |  效果图                                  │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  ┌──────┬──────┬──────┬──────┐                            │
│  │ 知识 │ 需求 │ PRD  │ 任务 │                            │
│  │  12  │  3   │  2   │ ▓5/8 │                            │
│  └──────┴──────┴──────┴──────┘                            │
│                                                            │
│  开发任务进度 ████░░░░ 62%                                │
│  (5 done / 2 doing / 1 todo)                              │
│                                                            │
│  最近改动                                                  │
│  · YYYY-MM-DD  完成 PRD v0.3                              │
│  · YYYY-MM-DD  新增 知识点：X                              │
│  · ...                                                     │
└────────────────────────────────────────────────────────────┘
```

打开 5 秒了解项目当前状态。

### Tab 2 · 拆解（最常用）

```
┌────────────────────────────────────────────────────────────┐
│  📚 知识点 (12)                              [+ 新增]      │
│  ├─ React Server Components                                │
│  ├─ Zustand 中间件                                         │
│  └─ ...                                                    │
│                                                            │
│  🎯 需求分析 (3)                             [+ 新增]      │
│  ├─ 目标用户 + 痛点                                        │
│  └─ ...                                                    │
│                                                            │
│  📄 PRD (2)                  [🪄 让 Rich 起草] [+ 手动]    │
│  ├─ Rich v0.3 — 计划管理模块                              │
│  └─ Rich v0.4 — 项目实战模块                              │
│                                                            │
│  ⚙️ 开发任务 (8)                             [+ 新增]      │
│  ┌─ todo (1) ──┬─ doing (2) ──┬─ done (5) ───────┐       │
│  │ · 实现 X   │ · 写 Y...     │ · 完成 Z         │       │
│  │            │ · 调 Foo      │ · ...            │       │
│  └────────────┴───────────────┴──────────────────┘       │
└────────────────────────────────────────────────────────────┘
```

- 4 个分组，每组顶部 `+ 新增` 按钮
- **开发任务** 用 3 列小看板（todo / doing / done），**拖拽改 status**
- 其他 3 组用列表
- 点单条 → 右侧滑出 drawer 显示完整编辑器（复用知识树元素编辑器）
- **PRD 分组顶部多一个 `🪄 让 Rich 起草` 按钮** — 这是 V1 唯一的 AI 入口

### Tab 3 · 效果图

```
┌────────────────────────────────────────────────────────────┐
│  效果图 (8)                  [+ 上传]  [全屏看图]          │
│                                                            │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                     │
│  │ [缩] │ │ [缩] │ │ [缩] │ │ [缩] │                     │
│  │ Hero │ │ Plan │ │ Tab3 │ │ ...  │                     │
│  └──────┘ └──────┘ └──────┘ └──────┘                     │
│  ┌──────┐ ┌──────┐ ...                                    │
│                                                            │
│  点击 → 大图 + caption 编辑                               │
└────────────────────────────────────────────────────────────┘
```

- 3-4 列网格，懒加载
- 上传走现有图片附件 API
- AI 生成入口 V2 再加（按钮先不放）
- 全屏轮播（空格切下一张）

---

## AI 集成

**只 1 处用 AI：起草 PRD。**

### Endpoint

```
POST /api/ai/draft-prd
  body: {
    practice: { title, subtitle, content },
    children: Element[],          // 已有知识点 / 需求分析 / 其他 PRD
    extraContext?: string,        // 可选：用户对 PRD 的特殊要求
  }
  →
  {
    title: string,                // PRD 自身的 title（例如"Rich v0.5 - 协作模式 PRD"）
    sections: {
      overview: string,           // 项目概述（2-3 句）
      targetUsers: string,        // 目标用户 + 痛点
      coreFeatures: string[],     // 核心功能列表
      userStories: string[],      // 用户故事 (3-5 条)
      acceptance: string[],       // 验收标准
      nonFunctional: string,      // 非功能需求
      outOfScope: string[],       // 范围外
      risks: string[],            // 风险与未决问题
    },
  }
```

**Prompt 原则：**

- 简短结构齐全，不写废话
- 用 practice 元和已有子元做上下文，不重复堆已存在的信息
- 每条 acceptance / story 必须可验证

**用户流程：**

1. 拆解 tab → PRD 分组 → 点 `🪄 让 Rich 起草`
2. （可选）弹窗输入额外上下文 / 直接确认
3. 30-60s 后预览弹窗，所有 section 展开可编辑
4. 编辑后确认 → 创建一个 `product-design` 子元，content 存这份 PRD，
   通过 "child" relation 挂到 practice 上

---

## MCP 工具（给 Hermes / Codex / Claude Desktop）

新增 6 个：

| 工具 | 用途 |
|---|---|
| `practice_list` | 列出所有 practice 元 + 子元统计 + 任务进度 |
| `practice_get` | 取单个项目 + 全部子元（按 type 分组返回） |
| `practice_create` | 创建新 practice 项目（封装 create_element） |
| `practice_add_child` | 在指定 practice 下新建子元（concept/case/product-design/step），自动建 "child" relation |
| `practice_set_task_status` | 快速改一个 step 元的 status 字段 |
| `draft_prd` | 触发 AI 起草 PRD，写成 product-design 子元 |

**通用元 CRUD 复用现有：** `create_element` / `update_element` / `delete_element` / `get_element`。

---

## 实现范围

### V1（这次做）

1. `AppView` 加 `"practice"` 类型 + 左侧 dock 入口
2. `ProjectPracticeView` 容器：列表页 + 工作空间路由
3. 列表页：所有 practice 元的卡片
4. 工作空间 3 tabs 全部跑通
5. **拆解 tab**：4 个分组（concept / case / product-design / step）
   - step 用 3 列看板，**拖拽改 status**
6. **PRD 分组顶部：🪄 起草 PRD 按钮 + 预览弹窗 + 写入子元**
7. **效果图 tab**：网格画廊 + 上传 + 全屏看图
8. **Schema**：Element 加 `status` 字段 optional
9. **后端**：`/api/ai/draft-prd` endpoint + prompt
10. **MCP**：6 个新工具
11. **侧滑 drawer** 编辑子元（复用知识树元素编辑器）

### V2（押后到真有需求时）

- AI 生成效果图（按钮先不放）
- 把已有知识树元素**导入**成某 practice 子元
- PRD / 需求分析 / 任务的额外结构字段
- practice ↔ plan 自动联动（创建 practice 自动建对应 plan）
- 拖拽重排子元
- Project 模板（"Web App"/"学习项目"等预设分组）

---

## 风险 & 未决

| 风险 | 缓解 |
|---|---|
| 拆解 tab 里子元用现有元素编辑器，drawer 内嵌会不会奇怪？ | 先做 V1 看，丑则换 modal 全屏编辑 |
| step 拖拽改 status — 多设备同时拖会冲突？ | 走 Phase 1 version 锁，最坏一次 refetch 重试 |
| AI 起草 PRD 失败率？ | 跟现有 decompose-plan / analyze-progress 一样的容错（取消/重试） |
| 效果图全屏看图组件，要不要做？ | V1 做最简版（点击放大居中），不做轮播；按需 V2 加 |
| `practice` 元如果没子元，工作空间总览/拆解空状态怎么显示？ | 拆解 tab 给"先建一个 PRD 开始 / + 新增知识点"双 CTA |

---

## 不做的事（明确边界）

- ❌ **不**新增 element type（坚持复用 concept / case / product-design / step）
- ❌ **不**重做元素编辑器（drawer 嵌已有的）
- ❌ **不**做多视角分析 tab（留给每周复盘）
- ❌ **不**自动从 plan 推导出 practice，反之亦然（两者独立）
- ❌ **不**做协作 / 多人 / 权限（单用户多机已被 version 锁覆盖）
