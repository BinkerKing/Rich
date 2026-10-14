# Rich

Rich 是一个本地优先的桌面工作台：Electron 桌面端、React 前端和 Node 服务端组成一个 pnpm monorepo。

## 给 AI 的部署入口

在另一台 macOS Apple Silicon 电脑上部署时，先读
[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)。它明确列出了所需环境、密钥应放置的位置、验证命令、常见故障，以及多机共享数据的配置方式。

最短的生产部署流程如下：

```bash
git clone https://github.com/BinkerKing/Rich.git
cd Rich
corepack enable
pnpm install
cp .env.example .env       # 填入 DATABASE_URL 等本机密钥，绝不提交 .env
pnpm test:deploy
pnpm deploy                # 打包、替换 /Applications/Rich.app，并自动启动
```

部署前必须准备：macOS 13+（Apple Silicon）、Node.js 22.x、pnpm 9、Git、Xcode Command Line Tools；如使用 AI 功能，还需要本机可访问的 Hermes OpenAI 兼容服务。若要让多台电脑共享 Rich 数据，所有机器必须在 `.env` 中使用同一个 Postgres `DATABASE_URL`。

## Quick start

Use Node.js 22 LTS (the required version is recorded in `.nvmrc`). If native
dependencies were installed under a different Node version, run
`pnpm rebuild:sqlite` after switching to Node 22.

```bash
pnpm install
pnpm --filter @ke/server dev   # http://localhost:3001
pnpm --filter @ke/web dev      # http://localhost:5173
```

Then open http://localhost:5173, type any topic, and hit "开始 →" to see the seeded 认知心理学 knowledge tree render.

## Structure

```
apps/
  web/        React + Vite + Zustand frontend
  server/     Node + Hono local backend
packages/
  domain/     shared TS types + pure business logic (selectCenterView)
data/         seed elements + canned AI responses (JSON)
ai/           AI role manuals (placeholders)
docs/
  superpowers/specs/   design specifications
  superpowers/plans/   implementation plans
```

## Status

- ✅ Monorepo + types + repo skeleton
- ✅ End-to-end vertical slice: input topic → mock generation → render polished tree
- ✅ Real AI `generate-tree` via Claude Code SDK + Codex CLI subprocess (SSE streaming)
- ✅ Real AI `refine` / `expand` / `extend` / `path` endpoints (SSE, per-element session continuity)
- ✅ Relations + Paths persistence (SQLite by default; PostgreSQL for multi-machine use)
- ✅ 29 tests passing (domain + repos + AI ops + extractJson)
- ✅ Center switching is pure JS (no AI call)
- ⬜ Frontend element-operation buttons wired to these endpoints (next sprint)
- ⬜ Search / AI semantic locate / Codex task center (later sprints)
- ⬜ Element reader view, popup card, textbook mode (subsequent plans)
- ⬜ Codex task center, search, AI locate (subsequent plans)

## Scripts

| Command | Effect |
|---|---|
| `pnpm dev` | run web + server in parallel |
| `pnpm deploy` | start a detached macOS deployment job. It packages Rich, replaces `/Applications/Rich.app`, relaunches it, and immediately prints the job log path. |
| `pnpm test` | run all package tests |
| `pnpm typecheck` | typecheck all packages |
