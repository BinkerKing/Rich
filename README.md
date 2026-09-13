# Know Everything

Personal infinite-learning system. Phase 1 — foundation sprint complete (`v0.0.1-foundation`).

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
| `pnpm run deploy` | start a detached macOS deployment job. It packages Rich, replaces `/Applications/Rich.app`, relaunches it, and immediately prints the job log path. |
| `pnpm test` | run all package tests |
| `pnpm typecheck` | typecheck all packages |
