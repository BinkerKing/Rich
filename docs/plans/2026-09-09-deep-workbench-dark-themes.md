# 深度工作台深色主题 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为可复用脑图组件提供六套方形彩色描边的深色主题，并让每个工作台保存自己的选择。

**Architecture:** 主题预设放入纯数据模块，返回 `MindmapTheme` 兼容的配置；工作台模型保存主题标识和对应配置。视图仅渲染选择器并调用保存逻辑，`MindmapCanvas` 保持不含业务主题知识。

**Tech Stack:** React、TypeScript、simple-mind-map、Node test runner。

---

### Task 1: 主题预设数据

**Files:**
- Create: `apps/web/src/components/mindmap/darkMindmapThemes.ts`
- Test: `apps/web/src/components/mindmap/darkMindmapThemes.test.ts`

**Step 1:** 写一个失败测试，要求恰有六套预设、每套为深色背景、方形小圆角节点、根/二级/普通节点都提供彩色边框。

**Step 2:** 运行 `node --test apps/web/src/components/mindmap/darkMindmapThemes.test.ts`，确认因缺少模块失败。

**Step 3:** 实现六个配置：霓虹蓝紫、赛博青橙、翡翠金、深海青、酒红玫紫、石墨多彩；所有节点采用 `rectangle`、4px 圆角、暗色填充和彩色分支线。

**Step 4:** 重跑测试，确认通过。

### Task 2: 工作台主题持久化与选择器

**Files:**
- Modify: `apps/web/src/views/deep-workbench/deepWorkbenchModel.ts`
- Modify: `apps/web/src/views/DeepWorkbenchView.tsx`
- Modify: `apps/web/src/views/DeepWorkbenchView.css`

**Step 1:** 写失败测试，要求新工作台默认使用第一套主题，且主题标识为可选的已知预设。

**Step 2:** 把模型主题类型收紧为预设 ID 和配置，新建工作台设定默认主题。

**Step 3:** 在脑图模式的头部工具栏渲染可访问的主题下拉框；切换时更新并持久化当前工作台的主题配置。

**Step 4:** 运行模型/主题测试及 `pnpm --filter @ke/web typecheck`。

### Task 3: 验证与桌面端发布

**Files:** 无额外源码文件。

**Step 1:** 运行主题测试、`pnpm --filter @ke/web build` 和 `pnpm --filter @ke/desktop package`。

**Step 2:** 替换 `/Applications/Rich.app` 并重新启动，只保留最新版本，旧应用移至废纸篓。

