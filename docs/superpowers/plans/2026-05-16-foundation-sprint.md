# Know Everything · Foundation Sprint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the foundational monorepo skeleton + an end-to-end vertical slice that proves the architecture: user types a topic in the browser → frontend calls local Node backend → backend returns a canned knowledge tree (no AI yet) → frontend renders it using the agreed polished design.

**Architecture:** pnpm monorepo with three workspaces — `apps/web` (React+TS+Vite), `apps/server` (Node+Hono), `packages/domain` (shared TS types + pure business logic). All seams that will later carry real AI / real storage are present as interfaces with simple JSON-backed mock implementations. After this sprint we can swap in Claude API and IndexedDB without restructuring.

**Tech Stack:** pnpm workspaces · TypeScript · React 18 · Vite · Hono · Zustand · Vitest · MiniSearch (later) · Claude API (later) · Codex CLI (later)

**Scope guardrails (DO NOT exceed in this sprint):**
- ✅ Monorepo + types + skeleton + canned data + end-to-end render
- ❌ Real Claude API calls — return canned `cog-psy.tree.json` from `/api/ai/generate-tree`
- ❌ IndexedDB / vector index / Codex tasks / textbook mode / element reader
- ❌ Real auth, real persistence write-back

A subsequent plan (`2026-05-XX-ai-integration.md`) will wire Claude.

---

## File Structure

```
know-everything/
├── package.json                      # workspaces root, scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json                # shared strict TS config
├── .gitignore
├── .editorconfig
├── apps/
│   ├── server/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vitest.config.ts
│   │   ├── src/
│   │   │   ├── index.ts              # Hono app bootstrap
│   │   │   ├── routes/
│   │   │   │   ├── elements.ts       # GET /api/elements{,/:id}
│   │   │   │   └── ai.ts             # POST /api/ai/generate-tree (canned)
│   │   │   ├── repos/
│   │   │   │   ├── ElementsRepo.ts   # interface
│   │   │   │   └── JsonElementsRepo.ts  # JSON-file impl
│   │   │   └── lib/paths.ts          # data dir resolution
│   │   └── test/
│   │       └── JsonElementsRepo.test.ts
│   └── web/
│       ├── package.json
│       ├── tsconfig.json
│       ├── vite.config.ts
│       ├── index.html
│       └── src/
│           ├── main.tsx              # React entrypoint
│           ├── App.tsx                # routing: input page vs tree page
│           ├── api/client.ts         # fetch wrapper
│           ├── state/store.ts        # Zustand store
│           ├── theme/tokens.css      # design tokens (colors, spacing)
│           ├── views/
│           │   ├── InputView.tsx     # topic input landing
│           │   └── TreeView.tsx      # main 3-layer radial tree
│           ├── components/
│           │   ├── CenterNode.tsx
│           │   ├── ChildCard.tsx
│           │   ├── GrandPill.tsx
│           │   ├── PathChip.tsx
│           │   └── SidePanel.tsx
│           └── renderers/            # per-element-type content renderers (stubs)
│               └── index.ts
├── packages/
│   └── domain/
│       ├── package.json
│       ├── tsconfig.json
│       ├── vitest.config.ts
│       └── src/
│           ├── index.ts              # barrel export
│           ├── types/
│           │   ├── element.ts        # Element, ElementType, ElementContent
│           │   ├── relation.ts
│           │   └── path.ts
│           ├── elementTypes/
│           │   ├── concept.ts        # ConceptContent schema
│           │   ├── topic.ts
│           │   ├── step.ts
│           │   └── practice.ts
│           └── logic/
│               └── tree.ts           # selectCenterView() pure fn
├── data/
│   ├── elements/                     # seed json files (committed)
│   │   ├── cog-psy.json
│   │   ├── cog-psy.perception.json
│   │   └── ... (12 seed files for 认知心理学 tree)
│   └── seed.tree.json                # canned response for /api/ai/generate-tree
├── ai/
│   ├── knowledge.md                  # placeholder
│   └── codex.md                      # placeholder
└── docs/
    └── superpowers/
        ├── specs/2026-05-16-know-everything-design.md  # (already exists)
        └── plans/2026-05-16-foundation-sprint.md       # (this file)
```

---

### Task 1: Initialize monorepo

**Role:** Senior Software Engineer

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.gitignore`, `.editorconfig`

- [ ] **Step 1: Initialize git + create files**

```bash
cd "/Users/binkerking/Documents/Ai-WorkSpace/Project/Know Everything"
git init -b main
```

Create `.gitignore`:
```
node_modules
dist
.DS_Store
*.log
.env
.env.local
data/*.local.json
.superpowers/
```

Create `.editorconfig`:
```
root = true

[*]
indent_style = space
indent_size = 2
end_of_line = lf
insert_final_newline = true
charset = utf-8
trim_trailing_whitespace = true
```

Create `pnpm-workspace.yaml`:
```yaml
packages:
  - "apps/*"
  - "packages/*"
```

Create root `package.json`:
```json
{
  "name": "know-everything",
  "version": "0.0.1",
  "private": true,
  "packageManager": "pnpm@9.0.0",
  "scripts": {
    "dev": "pnpm -r --parallel run dev",
    "build": "pnpm -r run build",
    "test": "pnpm -r run test",
    "typecheck": "pnpm -r run typecheck"
  },
  "devDependencies": {
    "typescript": "^5.4.0"
  }
}
```

Create `tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "lib": ["ES2022", "DOM"]
  }
}
```

- [ ] **Step 2: Verify pnpm is installed**

```bash
pnpm --version
```
Expected: any version ≥ 8. If missing: `npm i -g pnpm@latest`.

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "chore: initialize monorepo skeleton"
```

---

### Task 2: Create `packages/domain` with core types

**Role:** Senior Software Engineer

**Files:**
- Create: `packages/domain/package.json`, `packages/domain/tsconfig.json`, `packages/domain/vitest.config.ts`
- Create: `packages/domain/src/index.ts`, `packages/domain/src/types/element.ts`, `relation.ts`, `path.ts`
- Create: `packages/domain/src/elementTypes/{concept,topic,step,practice}.ts`

- [ ] **Step 1: Scaffold package**

Create `packages/domain/package.json`:
```json
{
  "name": "@ke/domain",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "vitest": "^1.6.0"
  }
}
```

Create `packages/domain/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

Create `packages/domain/vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
export default defineConfig({ test: { environment: "node" } });
```

- [ ] **Step 2: Write element type definitions**

Create `packages/domain/src/types/element.ts`:
```ts
export type ElementType =
  | "topic" | "concept" | "step" | "viewpoint" | "question"
  | "case" | "tool" | "ability" | "project" | "practice"
  | "summary" | "relation" | "dispute" | "exercise";

export type ElementId = string;

export type RichnessLevel = 1 | 2 | 3 | 4 | 5;

export interface ElementMetadata {
  createdAt: string;
  updatedAt: string;
  generatedBy: "ai" | "user";
  aiModel?: string;
  richness: RichnessLevel;
}

export interface Element<TContent = unknown> {
  id: ElementId;
  type: ElementType;
  title: string;
  subtitle?: string;
  aliases?: string[];
  tags?: string[];
  domain?: string;
  difficulty?: "low" | "mid" | "high";
  content: TContent;
  metadata: ElementMetadata;
}
```

Create `packages/domain/src/types/relation.ts`:
```ts
import type { ElementId } from "./element.js";

export type RelationKind =
  | "parent" | "child" | "sibling" | "related"
  | "prerequisite" | "extension" | "practice";

export interface Relation {
  id: string;
  from: ElementId;
  to: ElementId;
  kind: RelationKind;
  strength?: number;
  reason?: string;
  createdAt: string;
}
```

Create `packages/domain/src/types/path.ts`:
```ts
import type { ElementId } from "./element.js";

export type PathKind = "quick" | "academic" | "practice" | "custom";

export interface LearningPath {
  id: string;
  centerElementId: ElementId;
  kind: PathKind;
  label: string;
  color: string;
  steps: ElementId[];
  estimatedTime?: string;
  generatedBy: "ai" | "user";
  createdAt: string;
}
```

- [ ] **Step 3: Write element-type content schemas**

Create `packages/domain/src/elementTypes/concept.ts`:
```ts
export interface FlowStep { label: string; description?: string }
export interface Example { title: string; body: string }
export interface Exercise { prompt: string; hint?: string }

export interface ConceptContent {
  oneSentence: string;
  coreExplain: string;
  whyMatters: string;
  mechanisms?: FlowStep[];
  examples?: Example[];
  misconceptions?: string[];
  exercises?: Exercise[];
  nextSteps?: string[];
}
```

Create `packages/domain/src/elementTypes/topic.ts`:
```ts
export interface TopicContent {
  intro: string;
  learningGoals: string[];
  coreModules: { id: string; title: string; description: string }[];
  recommendedPaths: string[];
}
```

Create `packages/domain/src/elementTypes/step.ts`:
```ts
export interface StepContent {
  goal: string;
  preconditions?: string[];
  steps: { n: number; action: string; check?: string }[];
  completionCriteria?: string[];
  commonFailures?: string[];
  nextAction?: string;
}
```

Create `packages/domain/src/elementTypes/practice.ts`:
```ts
export interface PracticeContent {
  productPositioning: string;
  targetAudience: string;
  needs: string[];
  competitors?: { name: string; takeaway: string }[];
  mvpFeatures: string[];
  implementationPath: string[];
}
```

- [ ] **Step 4: Barrel export**

Create `packages/domain/src/index.ts`:
```ts
export * from "./types/element.js";
export * from "./types/relation.js";
export * from "./types/path.js";
export * from "./elementTypes/concept.js";
export * from "./elementTypes/topic.js";
export * from "./elementTypes/step.js";
export * from "./elementTypes/practice.js";
```

- [ ] **Step 5: Install + typecheck**

```bash
pnpm install
pnpm --filter @ke/domain typecheck
```
Expected: zero errors.

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "feat(domain): add core element/relation/path types"
```

---

### Task 3: `packages/domain` — `selectCenterView` pure logic + test

**Role:** Senior Software Engineer

This is the function the renderer calls to decide which elements to show given the current center. Pure function over data — no I/O. Demonstrates the "切中心=纯 JS" principle.

**Files:**
- Create: `packages/domain/src/logic/tree.ts`
- Create: `packages/domain/test/tree.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/domain/test/tree.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { selectCenterView } from "../src/logic/tree.js";
import type { Element, Relation } from "../src/index.js";

const e = (id: string): Element => ({
  id, type: "concept", title: id,
  content: {},
  metadata: { createdAt: "", updatedAt: "", generatedBy: "ai", richness: 2 },
});

const r = (from: string, to: string, kind: "child" | "parent" = "child"): Relation => ({
  id: `${from}-${to}`, from, to, kind, createdAt: "",
});

describe("selectCenterView", () => {
  it("returns center, its children, and grandchildren within 2 layers down", () => {
    const elements = new Map([
      ["root", e("root")], ["a", e("a")], ["b", e("b")],
      ["a1", e("a1")], ["a2", e("a2")], ["b1", e("b1")],
      ["a1x", e("a1x")],
    ]);
    const relations = [
      r("root", "a"), r("root", "b"),
      r("a", "a1"), r("a", "a2"), r("b", "b1"),
      r("a1", "a1x"),
    ];
    const view = selectCenterView({ centerId: "root", elements, relations, depthDown: 2 });
    expect(view.center.id).toBe("root");
    expect(view.children.map(c => c.id).sort()).toEqual(["a", "b"]);
    expect(view.grandchildren["a"].map(c => c.id).sort()).toEqual(["a1", "a2"]);
    expect(view.grandchildren["b"].map(c => c.id)).toEqual(["b1"]);
    expect(view.grandchildren["a1"]).toBeUndefined(); // depth 2 cutoff
  });

  it("returns up to N upstream ancestors", () => {
    const elements = new Map([
      ["gp", e("gp")], ["p", e("p")], ["c", e("c")],
    ]);
    const relations = [r("gp", "p"), r("p", "c")];
    const view = selectCenterView({ centerId: "c", elements, relations, depthUp: 2 });
    expect(view.upstream.map(u => u.id)).toEqual(["p", "gp"]);
  });

  it("returns siblings (other children of the same parent)", () => {
    const elements = new Map([
      ["p", e("p")], ["c1", e("c1")], ["c2", e("c2")], ["c3", e("c3")],
    ]);
    const relations = [r("p", "c1"), r("p", "c2"), r("p", "c3")];
    const view = selectCenterView({ centerId: "c2", elements, relations });
    expect(view.siblings.map(s => s.id).sort()).toEqual(["c1", "c3"]);
  });
});
```

- [ ] **Step 2: Run — expect failure**

```bash
pnpm --filter @ke/domain test
```
Expected: FAIL with "Cannot find module" or similar.

- [ ] **Step 3: Implement**

Create `packages/domain/src/logic/tree.ts`:
```ts
import type { Element, ElementId } from "../types/element.js";
import type { Relation } from "../types/relation.js";

export interface CenterView {
  center: Element;
  upstream: Element[];                                   // closest first
  siblings: Element[];
  children: Element[];
  grandchildren: Record<ElementId, Element[]>;           // keyed by child id
}

export interface SelectArgs {
  centerId: ElementId;
  elements: Map<ElementId, Element>;
  relations: Relation[];
  depthUp?: number;       // default 2
  depthDown?: number;     // default 2  (1=children only, 2=+grand)
}

function childrenOf(id: ElementId, rels: Relation[]): ElementId[] {
  return rels.filter(r => r.kind === "child" && r.from === id).map(r => r.to);
}

function parentsOf(id: ElementId, rels: Relation[]): ElementId[] {
  return rels.filter(r => r.kind === "child" && r.to === id).map(r => r.from);
}

export function selectCenterView(args: SelectArgs): CenterView {
  const { centerId, elements, relations, depthUp = 2, depthDown = 2 } = args;
  const center = elements.get(centerId);
  if (!center) throw new Error(`Element not found: ${centerId}`);

  // upstream
  const upstream: Element[] = [];
  let cur = centerId;
  for (let i = 0; i < depthUp; i++) {
    const [p] = parentsOf(cur, relations);
    if (!p) break;
    const el = elements.get(p);
    if (!el) break;
    upstream.push(el);
    cur = p;
  }

  // siblings: other children of immediate parent
  const [immediateParent] = parentsOf(centerId, relations);
  const siblings = immediateParent
    ? childrenOf(immediateParent, relations)
        .filter(id => id !== centerId)
        .map(id => elements.get(id))
        .filter((e): e is Element => Boolean(e))
    : [];

  // children + grandchildren
  const childIds = childrenOf(centerId, relations);
  const children = childIds.map(id => elements.get(id)).filter((e): e is Element => Boolean(e));
  const grandchildren: Record<ElementId, Element[]> = {};
  if (depthDown >= 2) {
    for (const cid of childIds) {
      grandchildren[cid] = childrenOf(cid, relations)
        .map(id => elements.get(id))
        .filter((e): e is Element => Boolean(e));
    }
  }

  return { center, upstream, siblings, children, grandchildren };
}
```

Add export to `packages/domain/src/index.ts`:
```ts
export * from "./logic/tree.js";
```

- [ ] **Step 4: Run — expect pass**

```bash
pnpm --filter @ke/domain test
```
Expected: 3 passing tests.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat(domain): add selectCenterView with tests"
```

---

### Task 4: Seed data — hand-authored 认知心理学 tree

**Role:** Senior Software Engineer

We need real data to render against. Author a small but believable tree by hand.

**Files:**
- Create: `data/elements/*.json` (about 12 files)
- Create: `data/seed.tree.json` (the canned `/api/ai/generate-tree` response)

- [ ] **Step 1: Define a helper script**

We'll author all elements in one TS file and dump to JSON. Create `scripts/build-seed.ts`:
```ts
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const now = new Date().toISOString();
const meta = (richness = 2) => ({ createdAt: now, updatedAt: now, generatedBy: "ai", richness });

const els = [
  { id: "cog-psy", type: "topic", title: "认知心理学",
    subtitle: "研究人如何感知、记忆、思考、决策",
    domain: "心理学",
    content: {
      intro: "认知心理学是研究人类心智过程的科学，关注感知、注意、记忆、推理、决策等核心机制。",
      learningGoals: ["建立认知机制的整体框架", "理解信息加工模型", "掌握各核心子领域"],
      coreModules: [
        { id: "perception", title: "感知", description: "大脑如何加工感官信号" },
        { id: "memory", title: "记忆", description: "信息的编码、存储、提取" },
        { id: "attention", title: "注意力", description: "信息过滤与焦点选择" },
        { id: "language", title: "语言", description: "理解与产生语言" },
        { id: "reasoning", title: "推理", description: "归纳、演绎与类比" },
        { id: "decision", title: "决策", description: "评估与选择" },
      ],
      recommendedPaths: ["快速入门", "学术深度", "实战导向"],
    },
    metadata: meta(3),
  },
  { id: "cog-psy.perception", type: "concept", title: "感知", domain: "心理学",
    content: {
      oneSentence: "感知是大脑把感官输入加工成有意义体验的过程。",
      coreExplain: "眼睛接收光、耳朵接收声波——这只是感觉。真正'看见'或'听见'需要大脑做组织、识别、解释。",
      whyMatters: "所有更高级的认知能力——记忆、推理、决策——都建立在感知之上。",
    },
    metadata: meta(2),
  },
  { id: "cog-psy.memory", type: "concept", title: "记忆",
    content: { oneSentence: "记忆是信息的编码、存储与提取系统。", coreExplain: "...", whyMatters: "..." },
    metadata: meta(2) },
  { id: "cog-psy.attention", type: "concept", title: "注意力",
    content: { oneSentence: "注意力是大脑选择性处理某一部分信息、忽略其余的机制。", coreExplain: "...", whyMatters: "..." },
    metadata: meta(2) },
  { id: "cog-psy.language", type: "concept", title: "语言",
    content: { oneSentence: "...", coreExplain: "...", whyMatters: "..." }, metadata: meta(2) },
  { id: "cog-psy.reasoning", type: "concept", title: "推理",
    content: { oneSentence: "...", coreExplain: "...", whyMatters: "..." }, metadata: meta(2) },
  { id: "cog-psy.decision", type: "concept", title: "决策",
    content: { oneSentence: "...", coreExplain: "...", whyMatters: "..." }, metadata: meta(2) },
  // grandchildren
  { id: "cog-psy.perception.vision", type: "concept", title: "视觉",
    content: { oneSentence: "...", coreExplain: "...", whyMatters: "..." }, metadata: meta(2) },
  { id: "cog-psy.perception.audition", type: "concept", title: "听觉",
    content: { oneSentence: "...", coreExplain: "...", whyMatters: "..." }, metadata: meta(2) },
  { id: "cog-psy.attention.selective", type: "concept", title: "选择性注意",
    content: { oneSentence: "...", coreExplain: "...", whyMatters: "..." }, metadata: meta(2) },
  { id: "cog-psy.decision.heuristic", type: "concept", title: "启发式",
    content: { oneSentence: "...", coreExplain: "...", whyMatters: "..." }, metadata: meta(2) },
];

const relations = [
  // children of cog-psy
  ...["perception","memory","attention","language","reasoning","decision"].map(s => ({
    id: `cog-psy->cog-psy.${s}`, from: "cog-psy", to: `cog-psy.${s}`, kind: "child", createdAt: now,
  })),
  // children of perception
  { id: "p->v", from: "cog-psy.perception", to: "cog-psy.perception.vision", kind: "child", createdAt: now },
  { id: "p->a", from: "cog-psy.perception", to: "cog-psy.perception.audition", kind: "child", createdAt: now },
  // child of attention
  { id: "a->s", from: "cog-psy.attention", to: "cog-psy.attention.selective", kind: "child", createdAt: now },
  // child of decision
  { id: "d->h", from: "cog-psy.decision", to: "cog-psy.decision.heuristic", kind: "child", createdAt: now },
];

const paths = [
  { id: "p.quick", centerElementId: "cog-psy", kind: "quick", label: "快速入门 15min", color: "gold",
    steps: ["cog-psy.perception", "cog-psy.perception.vision"], generatedBy: "ai", createdAt: now },
  { id: "p.academic", centerElementId: "cog-psy", kind: "academic", label: "学术深度 2h", color: "cyan",
    steps: ["cog-psy.attention", "cog-psy.attention.selective"], generatedBy: "ai", createdAt: now },
  { id: "p.practice", centerElementId: "cog-psy", kind: "practice", label: "实战导向 1h", color: "pink",
    steps: ["cog-psy.decision", "cog-psy.decision.heuristic"], generatedBy: "ai", createdAt: now },
];

mkdirSync("data/elements", { recursive: true });
for (const el of els) {
  writeFileSync(join("data/elements", `${el.id}.json`), JSON.stringify(el, null, 2));
}
writeFileSync("data/seed.tree.json", JSON.stringify({ elements: els, relations, paths, rootId: "cog-psy" }, null, 2));
console.log(`Wrote ${els.length} elements + ${relations.length} relations + ${paths.length} paths`);
```

- [ ] **Step 2: Run script**

```bash
pnpm dlx tsx scripts/build-seed.ts
```
Expected: prints counts; `data/elements/*.json` and `data/seed.tree.json` exist.

- [ ] **Step 3: Commit**

```bash
git add scripts/build-seed.ts data/
git commit -m "feat(data): add 认知心理学 seed tree (12 elements, 3 paths)"
```

---

### Task 5: `apps/server` skeleton + `JsonElementsRepo` with tests

**Role:** Backend Engineer

**Files:**
- Create: `apps/server/package.json`, `apps/server/tsconfig.json`, `apps/server/vitest.config.ts`
- Create: `apps/server/src/lib/paths.ts`
- Create: `apps/server/src/repos/ElementsRepo.ts`, `apps/server/src/repos/JsonElementsRepo.ts`
- Create: `apps/server/test/JsonElementsRepo.test.ts`

- [ ] **Step 1: Scaffold package**

Create `apps/server/package.json`:
```json
{
  "name": "@ke/server",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@ke/domain": "workspace:*",
    "hono": "^4.4.0",
    "@hono/node-server": "^1.11.0"
  },
  "devDependencies": {
    "tsx": "^4.7.0",
    "typescript": "^5.4.0",
    "vitest": "^1.6.0",
    "@types/node": "^20.12.0"
  }
}
```

Create `apps/server/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "module": "ESNext",
    "moduleResolution": "Bundler"
  },
  "include": ["src"]
}
```

Create `apps/server/vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
export default defineConfig({ test: { environment: "node" } });
```

- [ ] **Step 2: Path helper**

Create `apps/server/src/lib/paths.ts`:
```ts
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// Resolves to monorepo data/ directory regardless of cwd.
export function dataDir(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, "../../../../data");
}
```

- [ ] **Step 3: Write failing repo test**

Create `apps/server/test/JsonElementsRepo.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { JsonElementsRepo } from "../src/repos/JsonElementsRepo.js";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "ke-test-"));
  mkdirSync(join(dir, "elements"), { recursive: true });
  writeFileSync(join(dir, "elements", "a.json"), JSON.stringify({
    id: "a", type: "concept", title: "A", content: {},
    metadata: { createdAt: "", updatedAt: "", generatedBy: "ai", richness: 2 },
  }));
  writeFileSync(join(dir, "elements", "b.json"), JSON.stringify({
    id: "b", type: "concept", title: "B", content: {},
    metadata: { createdAt: "", updatedAt: "", generatedBy: "ai", richness: 2 },
  }));
});

describe("JsonElementsRepo", () => {
  it("lists all elements", async () => {
    const repo = new JsonElementsRepo(dir);
    const all = await repo.list();
    expect(all.map(e => e.id).sort()).toEqual(["a", "b"]);
  });

  it("gets element by id", async () => {
    const repo = new JsonElementsRepo(dir);
    const e = await repo.get("a");
    expect(e?.title).toBe("A");
  });

  it("returns null for missing id", async () => {
    const repo = new JsonElementsRepo(dir);
    expect(await repo.get("nope")).toBeNull();
  });
});
```

- [ ] **Step 4: Repo interface + implementation**

Create `apps/server/src/repos/ElementsRepo.ts`:
```ts
import type { Element, ElementId } from "@ke/domain";

export interface ElementsRepo {
  list(): Promise<Element[]>;
  get(id: ElementId): Promise<Element | null>;
  put(el: Element): Promise<void>;
}
```

Create `apps/server/src/repos/JsonElementsRepo.ts`:
```ts
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { Element, ElementId } from "@ke/domain";
import type { ElementsRepo } from "./ElementsRepo.js";

export class JsonElementsRepo implements ElementsRepo {
  constructor(private root: string) {}

  private dir() { return join(this.root, "elements"); }

  async list(): Promise<Element[]> {
    const files = await readdir(this.dir()).catch(() => []);
    const all = await Promise.all(
      files.filter(f => f.endsWith(".json"))
        .map(f => readFile(join(this.dir(), f), "utf8").then(s => JSON.parse(s) as Element))
    );
    return all;
  }

  async get(id: ElementId): Promise<Element | null> {
    try {
      const raw = await readFile(join(this.dir(), `${id}.json`), "utf8");
      return JSON.parse(raw) as Element;
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw err;
    }
  }

  async put(el: Element): Promise<void> {
    await mkdir(this.dir(), { recursive: true });
    await writeFile(join(this.dir(), `${el.id}.json`), JSON.stringify(el, null, 2));
  }
}
```

- [ ] **Step 5: Run install + tests**

```bash
pnpm install
pnpm --filter @ke/server test
```
Expected: 3 tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/server packages/domain
git commit -m "feat(server): add JsonElementsRepo with tests"
```

---

### Task 6: Hono routes — `/api/elements`, `/api/ai/generate-tree`

**Role:** Backend Engineer

**Files:**
- Create: `apps/server/src/routes/elements.ts`, `apps/server/src/routes/ai.ts`
- Create: `apps/server/src/index.ts`
- Create: `apps/server/test/routes.test.ts`

- [ ] **Step 1: Failing route test**

Create `apps/server/test/routes.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { buildApp } from "../src/index.js";
import { dataDir } from "../src/lib/paths.js";

const app = buildApp(dataDir());

describe("API routes", () => {
  it("GET /api/elements returns array", async () => {
    const res = await app.request("/api/elements");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
  });

  it("GET /api/elements/:id returns one", async () => {
    const res = await app.request("/api/elements/cog-psy");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("cog-psy");
  });

  it("GET /api/elements/:id 404 on missing", async () => {
    const res = await app.request("/api/elements/nope");
    expect(res.status).toBe(404);
  });

  it("POST /api/ai/generate-tree returns seed tree", async () => {
    const res = await app.request("/api/ai/generate-tree", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ topic: "认知心理学" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rootId).toBe("cog-psy");
    expect(body.elements.length).toBeGreaterThanOrEqual(7);
    expect(body.paths.length).toBe(3);
  });
});
```

- [ ] **Step 2: Implement routes**

Create `apps/server/src/routes/elements.ts`:
```ts
import { Hono } from "hono";
import type { ElementsRepo } from "../repos/ElementsRepo.js";

export function elementsRoutes(repo: ElementsRepo): Hono {
  const r = new Hono();
  r.get("/", async (c) => c.json(await repo.list()));
  r.get("/:id", async (c) => {
    const el = await repo.get(c.req.param("id"));
    if (!el) return c.json({ error: "not found" }, 404);
    return c.json(el);
  });
  return r;
}
```

Create `apps/server/src/routes/ai.ts`:
```ts
import { Hono } from "hono";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export function aiRoutes(root: string): Hono {
  const r = new Hono();
  // Mock: return canned seed tree regardless of topic input.
  // Real Claude integration happens in a later plan.
  r.post("/generate-tree", async (c) => {
    const raw = await readFile(join(root, "seed.tree.json"), "utf8");
    return c.json(JSON.parse(raw));
  });
  return r;
}
```

Create `apps/server/src/index.ts`:
```ts
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { elementsRoutes } from "./routes/elements.js";
import { aiRoutes } from "./routes/ai.js";
import { JsonElementsRepo } from "./repos/JsonElementsRepo.js";
import { dataDir } from "./lib/paths.js";

export function buildApp(root: string) {
  const repo = new JsonElementsRepo(root);
  const app = new Hono();
  app.use("*", async (c, next) => {
    c.header("access-control-allow-origin", "*");
    c.header("access-control-allow-headers", "content-type");
    if (c.req.method === "OPTIONS") return c.body(null, 204);
    await next();
  });
  app.route("/api/elements", elementsRoutes(repo));
  app.route("/api/ai", aiRoutes(root));
  app.get("/api/health", (c) => c.json({ ok: true }));
  return app;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT ?? 3001);
  const app = buildApp(dataDir());
  serve({ fetch: app.fetch, port });
  console.log(`Know Everything server: http://localhost:${port}`);
}
```

- [ ] **Step 3: Run tests**

```bash
pnpm --filter @ke/server test
```
Expected: 7 tests pass (3 repo + 4 routes).

- [ ] **Step 4: Run dev server manually**

```bash
pnpm --filter @ke/server dev
```
In another terminal:
```bash
curl http://localhost:3001/api/health
curl http://localhost:3001/api/elements | head -c 200
```
Expected: `{"ok":true}` and a JSON array starting with element entries. Then Ctrl-C to stop.

- [ ] **Step 5: Commit**

```bash
git add apps/server
git commit -m "feat(server): add Hono routes for elements + mock generate-tree"
```

---

### Task 7: `apps/web` skeleton + theme tokens

**Role:** UI Developer

**Files:**
- Create: `apps/web/package.json`, `apps/web/tsconfig.json`, `apps/web/vite.config.ts`, `apps/web/index.html`
- Create: `apps/web/src/main.tsx`, `apps/web/src/App.tsx`
- Create: `apps/web/src/theme/tokens.css`

- [ ] **Step 1: Scaffold package**

Create `apps/web/package.json`:
```json
{
  "name": "@ke/web",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@ke/domain": "workspace:*",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "zustand": "^4.5.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "typescript": "^5.4.0",
    "vite": "^5.2.0"
  }
}
```

Create `apps/web/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "noEmit": true
  },
  "include": ["src"]
}
```

Create `apps/web/vite.config.ts`:
```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { "/api": "http://localhost:3001" },
  },
});
```

Create `apps/web/index.html`:
```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Know Everything</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 2: Theme tokens (lifted from the agreed mockup)**

Create `apps/web/src/theme/tokens.css`:
```css
:root {
  color-scheme: dark;
  --bg: #050b16;
  --panel: #0c1827;
  --panel-2: #0f1d2e;
  --line: rgba(120,200,220,.10);
  --line-2: rgba(120,200,220,.18);
  --text: #e7f1f7;
  --soft: #b8cfd9;
  --muted: #7a92a0;
  --dim: #52677a;
  --teal: #3dd5cd;
  --teal-2: #5be3da;
  --teal-soft: rgba(61,213,205,.10);
  --teal-line: rgba(61,213,205,.28);
  --violet: #9b7cff;
  --amber: #ffc977;
  --pink: #ff8fb5;
  --green: #74e5b0;
  --gold: #ffc977;
  --radius: 10px;
  --sans: "PingFang SC","Microsoft YaHei","Segoe UI",sans-serif;
  --mono: "SFMono-Regular","Cascadia Code",Consolas,monospace;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  min-height: 100vh;
  background:
    radial-gradient(ellipse 1200px 700px at 20% 0%, rgba(61,213,205,.06), transparent 60%),
    radial-gradient(ellipse 800px 600px at 90% 100%, rgba(155,124,255,.05), transparent 60%),
    var(--bg);
  color: var(--text);
  font-family: var(--sans);
  font-size: 14px;
  -webkit-font-smoothing: antialiased;
}
button { font: inherit; cursor: pointer; }
```

- [ ] **Step 3: Entry + minimal App**

Create `apps/web/src/main.tsx`:
```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App.js";
import "./theme/tokens.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode><App /></React.StrictMode>
);
```

Create `apps/web/src/App.tsx`:
```tsx
import { useStore } from "./state/store.js";
import { InputView } from "./views/InputView.js";
import { TreeView } from "./views/TreeView.js";

export function App() {
  const rootId = useStore(s => s.rootId);
  return rootId ? <TreeView /> : <InputView />;
}
```

- [ ] **Step 4: Install (state/views files come in next task — TS will error briefly, that's expected)**

```bash
pnpm install
```
Expected: install succeeds. `pnpm --filter @ke/web typecheck` will fail until next task — that's OK.

- [ ] **Step 5: Commit**

```bash
git add apps/web
git commit -m "feat(web): scaffold React+Vite app with theme tokens"
```

---

### Task 8: Zustand store + API client

**Role:** Senior Software Engineer

**Files:**
- Create: `apps/web/src/api/client.ts`
- Create: `apps/web/src/state/store.ts`

- [ ] **Step 1: API client**

Create `apps/web/src/api/client.ts`:
```ts
import type { Element, Relation, LearningPath } from "@ke/domain";

export interface GenerateTreeResponse {
  rootId: string;
  elements: Element[];
  relations: Relation[];
  paths: LearningPath[];
}

const base = "/api";

export const api = {
  async generateTree(topic: string): Promise<GenerateTreeResponse> {
    const r = await fetch(`${base}/ai/generate-tree`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ topic }),
    });
    if (!r.ok) throw new Error(`generate-tree failed: ${r.status}`);
    return r.json();
  },
  async getElement(id: string): Promise<Element | null> {
    const r = await fetch(`${base}/elements/${encodeURIComponent(id)}`);
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(`getElement failed: ${r.status}`);
    return r.json();
  },
};
```

- [ ] **Step 2: Zustand store**

Create `apps/web/src/state/store.ts`:
```ts
import { create } from "zustand";
import type { Element, Relation, LearningPath, ElementId } from "@ke/domain";
import { api } from "../api/client.js";

interface AppState {
  elements: Map<ElementId, Element>;
  relations: Relation[];
  pathsByCenter: Map<ElementId, LearningPath[]>;
  rootId: ElementId | null;
  centerId: ElementId | null;
  visiblePathKinds: Set<string>;
  loading: boolean;
  error: string | null;
  generate(topic: string): Promise<void>;
  setCenter(id: ElementId): void;
  togglePathKind(kind: string): void;
}

export const useStore = create<AppState>((set, get) => ({
  elements: new Map(),
  relations: [],
  pathsByCenter: new Map(),
  rootId: null,
  centerId: null,
  visiblePathKinds: new Set(["quick", "academic", "practice"]),
  loading: false,
  error: null,

  async generate(topic) {
    set({ loading: true, error: null });
    try {
      const tree = await api.generateTree(topic);
      const elements = new Map(tree.elements.map(e => [e.id, e]));
      const paths = new Map<string, LearningPath[]>();
      for (const p of tree.paths) {
        const list = paths.get(p.centerElementId) ?? [];
        list.push(p);
        paths.set(p.centerElementId, list);
      }
      set({
        elements,
        relations: tree.relations,
        pathsByCenter: paths,
        rootId: tree.rootId,
        centerId: tree.rootId,
        loading: false,
      });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  setCenter(id) { set({ centerId: id }); },

  togglePathKind(kind) {
    const next = new Set(get().visiblePathKinds);
    next.has(kind) ? next.delete(kind) : next.add(kind);
    set({ visiblePathKinds: next });
  },
}));
```

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter @ke/web typecheck
```
Expected: errors about missing InputView/TreeView only (next task fixes).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src
git commit -m "feat(web): add Zustand store + API client"
```

---

### Task 9: `InputView` — topic entry landing page

**Role:** UI Designer

**Files:**
- Create: `apps/web/src/views/InputView.tsx`
- Create: `apps/web/src/views/InputView.css`

- [ ] **Step 1: Component**

Create `apps/web/src/views/InputView.tsx`:
```tsx
import { useState } from "react";
import { useStore } from "../state/store.js";
import "./InputView.css";

export function InputView() {
  const [topic, setTopic] = useState("");
  const generate = useStore(s => s.generate);
  const loading = useStore(s => s.loading);
  const error = useStore(s => s.error);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!topic.trim()) return;
    void generate(topic.trim());
  }

  return (
    <div className="input-view">
      <div className="input-shell">
        <div className="brand">
          <div className="logo" />
          <strong>Know Everything</strong>
        </div>
        <h1>你想了解什么？</h1>
        <p className="sub">输入一个主题、概念，或一个想完成的项目目标。</p>
        <form onSubmit={submit}>
          <input
            autoFocus
            value={topic}
            onChange={e => setTopic(e.target.value)}
            placeholder="例如：认知心理学 / 用 AI 写一篇小说 / React 动画…"
            disabled={loading}
          />
          <button type="submit" disabled={loading || !topic.trim()}>
            {loading ? "正在生成知识树…" : "开始 →"}
          </button>
        </form>
        {error && <div className="err">{error}</div>}
        <div className="hint">提示：第一阶段无论输入什么，都会返回 "认知心理学" 的示例树。</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Styles**

Create `apps/web/src/views/InputView.css`:
```css
.input-view { min-height: 100vh; display: grid; place-items: center; padding: 40px 24px; }
.input-shell { width: 100%; max-width: 620px; display: flex; flex-direction: column; gap: 20px; }
.input-shell .brand { display: flex; align-items: center; gap: 10px; margin-bottom: 40px; }
.input-shell .brand .logo {
  width: 36px; height: 36px; border-radius: 50%;
  background: radial-gradient(circle at 30% 30%, var(--teal-2), #1a4045 55%, #0d2228);
  box-shadow: 0 0 22px rgba(61,213,205,.4);
}
.input-shell .brand strong { font-size: 16px; }
.input-shell h1 { margin: 0; font-size: 32px; font-weight: 600; letter-spacing: -.01em; }
.input-shell .sub { margin: 0; color: var(--muted); font-size: 15px; }
.input-shell form { display: flex; gap: 10px; margin-top: 12px; }
.input-shell input {
  flex: 1; height: 50px; padding: 0 18px;
  border: 1px solid var(--line-2); background: var(--panel);
  border-radius: var(--radius); color: var(--text); font-family: inherit; font-size: 15px; outline: 0;
}
.input-shell input:focus { border-color: var(--teal-line); box-shadow: 0 0 0 4px var(--teal-soft); }
.input-shell button {
  padding: 0 24px; height: 50px; border: 1px solid var(--teal-line);
  background: var(--teal-soft); color: var(--teal); border-radius: var(--radius);
  font-size: 15px; font-weight: 500;
}
.input-shell button:disabled { opacity: .5; cursor: not-allowed; }
.input-shell .err { color: var(--pink); font-size: 13px; }
.input-shell .hint { color: var(--dim); font-size: 12px; margin-top: 24px; }
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/views
git commit -m "feat(web): add InputView landing page"
```

---

### Task 10: `TreeView` — main view rendering center + L2 cards + L3 pills + paths

**Role:** UI Designer

**Files:**
- Create: `apps/web/src/views/TreeView.tsx`, `apps/web/src/views/TreeView.css`
- Create: `apps/web/src/components/CenterNode.tsx`, `ChildCard.tsx`, `GrandPill.tsx`, `PathChip.tsx`
- Create: `apps/web/src/components/components.css`

This task is the largest visual piece. The reference HTML mockup `main-restyled.html` (already in `.superpowers/brainstorm/`) is the design source — port it to React.

- [ ] **Step 1: Components**

Create `apps/web/src/components/components.css`:
```css
.center-node {
  position: relative; width: 180px; height: 180px;
  display: grid; place-items: center; border-radius: 50%;
  background: radial-gradient(circle, rgba(61,213,205,.15), rgba(61,213,205,.03) 60%, transparent 75%);
  cursor: pointer;
}
.center-node::before {
  content: ""; position: absolute; inset: 30px; border-radius: 50%;
  border: 1px solid var(--teal-line);
  background: radial-gradient(circle at 50% 40%, rgba(61,213,205,.18), rgba(8,19,35,.9) 70%);
  box-shadow: 0 0 50px rgba(61,213,205,.25), inset 0 0 30px rgba(61,213,205,.12);
}
.center-node .body { position: relative; z-index: 2; text-align: center; }
.center-node .body h3 { margin: 0; font-size: 16px; font-weight: 600; }
.center-node .body .lvl { font-size: 11px; color: var(--muted); font-family: var(--mono); margin-top: 4px; }

.child-card {
  padding: 18px 14px;
  background: linear-gradient(180deg, rgba(15,29,46,.9), rgba(12,24,39,.85));
  border: 1px solid var(--line-2); border-radius: 10px;
  cursor: pointer; transition: all .2s;
  display: flex; flex-direction: column; align-items: center; gap: 8px;
}
.child-card:hover { border-color: var(--teal-line); transform: translateY(-2px); }
.child-card.path-gold { border-color: rgba(255,201,119,.4);
  background: linear-gradient(180deg, rgba(255,201,119,.08), rgba(12,24,39,.85)); }
.child-card.path-cyan { border-color: var(--teal-line);
  background: linear-gradient(180deg, rgba(61,213,205,.10), rgba(12,24,39,.85)); }
.child-card.path-pink { border-color: rgba(255,143,181,.35);
  background: linear-gradient(180deg, rgba(255,143,181,.07), rgba(12,24,39,.85)); }
.child-card h4 { margin: 0; font-size: 13px; font-weight: 500; }
.child-card .badge {
  font-size: 9px; font-family: var(--mono); padding: 1px 6px;
  border-radius: 3px; letter-spacing: .05em;
  color: var(--teal); background: var(--teal-soft); border: 1px solid var(--teal-line);
}

.grand-pill {
  display: flex; align-items: center; gap: 6px; padding: 7px 10px;
  background: rgba(15,29,46,.6); border: 1px solid var(--line); border-radius: 6px;
  font-size: 12px; color: var(--soft); cursor: pointer; transition: all .15s;
}
.grand-pill:hover { border-color: var(--line-2); color: var(--text); }
.grand-pill::before { content: "●"; color: var(--teal); font-size: 8px; flex-shrink: 0; }
.grand-pill.path-gold::before { color: var(--amber); }
.grand-pill.path-cyan::before { color: var(--teal); }
.grand-pill.path-pink::before { color: var(--pink); }

.path-chip {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 6px 12px; border-radius: 999px; font-size: 12px;
  border: 1px solid; background: rgba(8,12,24,.6); cursor: pointer;
}
.path-chip .swatch { width: 14px; height: 3px; border-radius: 2px; }
.path-chip.gold { border-color: rgba(255,201,119,.45); color: var(--amber); }
.path-chip.gold .swatch { background: var(--amber); }
.path-chip.cyan { border-color: var(--teal-line); color: var(--teal); }
.path-chip.cyan .swatch { background: var(--teal); }
.path-chip.pink { border-color: rgba(255,143,181,.45); color: var(--pink); }
.path-chip.pink .swatch { background: var(--pink); }
.path-chip.off { opacity: .35; }
```

Create `apps/web/src/components/CenterNode.tsx`:
```tsx
import type { Element } from "@ke/domain";
import "./components.css";

export function CenterNode({ el }: { el: Element }) {
  return (
    <div className="center-node">
      <div className="body">
        <h3>{el.title}</h3>
        <div className="lvl">L1 · 当前元</div>
      </div>
    </div>
  );
}
```

Create `apps/web/src/components/ChildCard.tsx`:
```tsx
import type { Element, LearningPath } from "@ke/domain";
import "./components.css";

interface Props {
  el: Element;
  onPaths: LearningPath[]; // paths this element is part of (any step)
  onSelect: () => void;
}

export function ChildCard({ el, onPaths, onSelect }: Props) {
  const primary = onPaths[0];
  const cls = primary?.color === "gold" ? "path-gold"
    : primary?.color === "cyan" ? "path-cyan"
    : primary?.color === "pink" ? "path-pink" : "";
  return (
    <div className={`child-card ${cls}`} onClick={onSelect}>
      <h4>{el.title}</h4>
      {primary && <div className="badge">{primary.label}</div>}
    </div>
  );
}
```

Create `apps/web/src/components/GrandPill.tsx`:
```tsx
import type { Element, LearningPath } from "@ke/domain";
import "./components.css";

export function GrandPill({ el, onPaths, onSelect }:
  { el: Element; onPaths: LearningPath[]; onSelect: () => void }) {
  const primary = onPaths[0];
  const cls = primary?.color === "gold" ? "path-gold"
    : primary?.color === "cyan" ? "path-cyan"
    : primary?.color === "pink" ? "path-pink" : "";
  return <div className={`grand-pill ${cls}`} onClick={onSelect}>{el.title}</div>;
}
```

Create `apps/web/src/components/PathChip.tsx`:
```tsx
import type { LearningPath } from "@ke/domain";
import "./components.css";

export function PathChip({ p, visible, onToggle }:
  { p: LearningPath; visible: boolean; onToggle: () => void }) {
  return (
    <span className={`path-chip ${p.color} ${visible ? "" : "off"}`} onClick={onToggle}>
      <span className="swatch" />
      {p.label}
    </span>
  );
}
```

- [ ] **Step 2: TreeView composition**

Create `apps/web/src/views/TreeView.css`:
```css
.tree-view { display: grid; grid-template-columns: 280px 1fr 240px; min-height: 100vh; }
.tv-side { padding: 22px 18px; border-right: 1px solid var(--line); }
.tv-side.right { border-left: 1px solid var(--line); border-right: 0; }
.tv-main { padding: 22px 26px; display: flex; flex-direction: column; gap: 18px; min-width: 0; }
.tv-crumb { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--muted); }
.tv-crumb a.now { color: var(--teal); font-weight: 500; }
.tv-paths { display: flex; gap: 8px; align-items: center; margin: 4px 0; }
.tv-stage {
  flex: 1; padding: 30px 24px;
  background: linear-gradient(180deg, rgba(8,19,35,.4), rgba(8,19,35,.1));
  border: 1px solid var(--line); border-radius: 12px;
  display: flex; flex-direction: column; gap: 24px;
}
.tv-center-row { display: flex; justify-content: center; }
.tv-l2-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 14px; }
.tv-l3-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 14px; }
.tv-l3-col { display: flex; flex-direction: column; gap: 6px; }
.tv-label { font-size: 12px; color: var(--muted); }
.tv-panel-h { font-size: 13px; color: var(--text); font-weight: 600; margin-bottom: 10px; }
.tv-sibling, .tv-op {
  padding: 9px 10px; border-radius: 6px; color: var(--soft); font-size: 13px; cursor: pointer;
}
.tv-sibling:hover, .tv-op:hover { background: var(--teal-soft); color: var(--teal); }
.tv-sibling.active { background: var(--teal-soft); color: var(--text); border-left: 2px solid var(--teal); }
```

Create `apps/web/src/views/TreeView.tsx`:
```tsx
import { useStore } from "../state/store.js";
import { selectCenterView } from "@ke/domain";
import { CenterNode } from "../components/CenterNode.js";
import { ChildCard } from "../components/ChildCard.js";
import { GrandPill } from "../components/GrandPill.js";
import { PathChip } from "../components/PathChip.js";
import "./TreeView.css";

export function TreeView() {
  const elements = useStore(s => s.elements);
  const relations = useStore(s => s.relations);
  const centerId = useStore(s => s.centerId)!;
  const pathsByCenter = useStore(s => s.pathsByCenter);
  const visible = useStore(s => s.visiblePathKinds);
  const setCenter = useStore(s => s.setCenter);
  const togglePath = useStore(s => s.togglePathKind);

  const view = selectCenterView({ centerId, elements, relations });
  const paths = (pathsByCenter.get(centerId) ?? []).filter(p => visible.has(p.kind));

  // Map each element id to the list of currently-visible paths it appears in.
  const pathsForElement = (id: string) =>
    paths.filter(p => p.steps.includes(id));

  return (
    <div className="tree-view">
      <aside className="tv-side">
        <div className="tv-panel-h">起点（当前中心）</div>
        <div>{view.center.title}</div>
        <div className="tv-panel-h" style={{ marginTop: 24 }}>上游</div>
        {view.upstream.length === 0
          ? <div style={{ color: "var(--dim)", fontSize: 12 }}>（无）</div>
          : view.upstream.map(u => <div key={u.id} className="tv-sibling" onClick={() => setCenter(u.id)}>↑ {u.title}</div>)}
      </aside>

      <main className="tv-main">
        <div className="tv-crumb">
          {view.upstream.slice().reverse().map(u => (
            <span key={u.id}><a onClick={() => setCenter(u.id)}>{u.title}</a> › </span>
          ))}
          <a className="now">{view.center.title}</a>
        </div>

        <div className="tv-paths">
          <span style={{ fontSize: 11, color: "var(--muted)" }}>推荐路径</span>
          {(pathsByCenter.get(centerId) ?? []).map(p => (
            <PathChip key={p.id} p={p} visible={visible.has(p.kind)} onToggle={() => togglePath(p.kind)} />
          ))}
        </div>

        <div className="tv-stage">
          <div className="tv-label">L1 · 中心元</div>
          <div className="tv-center-row"><CenterNode el={view.center} /></div>

          <div className="tv-label">下游第 2 层（{view.children.length}）</div>
          <div className="tv-l2-row">
            {view.children.map(c => (
              <ChildCard key={c.id} el={c} onPaths={pathsForElement(c.id)} onSelect={() => setCenter(c.id)} />
            ))}
          </div>

          <div className="tv-label">下游第 3 层</div>
          <div className="tv-l3-row">
            {view.children.map(c => (
              <div key={c.id} className="tv-l3-col">
                {(view.grandchildren[c.id] ?? []).map(g => (
                  <GrandPill key={g.id} el={g} onPaths={pathsForElement(g.id)} onSelect={() => setCenter(g.id)} />
                ))}
              </div>
            ))}
          </div>
        </div>
      </main>

      <aside className="tv-side right">
        <div className="tv-panel-h">同级元</div>
        {view.siblings.map(s => (
          <div key={s.id} className="tv-sibling" onClick={() => setCenter(s.id)}>{s.title}</div>
        ))}
        <div className="tv-sibling active">{view.center.title}</div>

        <div className="tv-panel-h" style={{ marginTop: 24 }}>中心元操作</div>
        <div className="tv-op" title="尚未接入 AI">细化</div>
        <div className="tv-op" title="尚未接入 AI">展开</div>
        <div className="tv-op" title="尚未接入 AI">延伸</div>
        <div className="tv-op" title="尚未接入 AI">实战</div>
        <div className="tv-op" title="尚未接入 AI">推荐路径</div>
      </aside>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter @ke/web typecheck
```
Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src
git commit -m "feat(web): add TreeView with center + L2 + L3 + path chips"
```

---

### Task 11: End-to-end smoke run

**Role:** Senior Software Engineer

- [ ] **Step 1: Start both apps**

In terminal A:
```bash
pnpm --filter @ke/server dev
```
Expected: `Know Everything server: http://localhost:3001`

In terminal B:
```bash
pnpm --filter @ke/web dev
```
Expected: Vite prints local URL, e.g. `http://localhost:5173/`.

- [ ] **Step 2: Manual verification**

Open `http://localhost:5173/` in browser. Verify:
1. Input page shows with "你想了解什么？" heading
2. Type anything (e.g. "test"), click "开始 →"
3. Loading state appears briefly
4. Page transitions to TreeView showing:
   - "认知心理学" as center node
   - 6 child cards (感知/记忆/注意力/语言/推理/决策)
   - L3 pills under children (视觉/听觉 under 感知, etc.)
   - 3 path chips at top (★快速入门 / 学术深度 / 实战导向)
   - Children that are on the gold path (感知) have gold styling
5. Click a child card (e.g. 感知): page rerenders with 感知 as center, 视觉/听觉 as children, 认知心理学 in upstream

If all 5 pass: foundation is working end-to-end.

- [ ] **Step 3: Run all tests one final time**

```bash
pnpm -r test
```
Expected: all green (3 domain + 7 server).

- [ ] **Step 4: Commit final state + tag**

```bash
git add -A
git commit -m "chore: foundation sprint complete" --allow-empty
git tag v0.0.1-foundation
```

---

### Task 12: README + ai/ placeholders

**Role:** Senior Software Engineer

- [ ] **Step 1: Root README**

Create `README.md`:
```markdown
# Know Everything

Personal infinite-learning system. Phase 1 foundation sprint.

## Run

```bash
pnpm install
pnpm --filter @ke/server dev    # http://localhost:3001
pnpm --filter @ke/web dev        # http://localhost:5173
```

## Structure

- `apps/web` — React + Vite frontend
- `apps/server` — Node + Hono local backend
- `packages/domain` — shared types + pure business logic
- `data/` — seed elements + canned AI responses
- `ai/` — AI role manuals (placeholders for now)
- `docs/superpowers/` — design specs + plans

## Status

Foundation only. AI integration (Claude API + Codex CLI) is the next plan.
```

- [ ] **Step 2: AI placeholder manuals**

Create `ai/knowledge.md`:
```markdown
# Knowledge AI (Claude)

Responsible for generating element content, recommended paths, and relation judgements.

> Placeholder — populated in the AI integration sprint.
```

Create `ai/codex.md`:
```markdown
# Code AI (Codex CLI)

Responsible for executing code-modification tasks on the frontend.

> Placeholder — populated in the Codex integration sprint.
```

- [ ] **Step 3: Commit**

```bash
git add README.md ai/
git commit -m "docs: add README + AI manual placeholders"
```

---

## Definition of Done

- [ ] All 12 tasks complete with green tests
- [ ] `pnpm -r test` shows 10 passing tests
- [ ] Browser smoke test (Task 11 Step 2) passes all 5 checks
- [ ] `git tag v0.0.1-foundation` exists
- [ ] No `TODO` or placeholder strings remain in committed code (only in `ai/*.md` manuals, which is intentional)

## What's Next (separate plans)

1. **AI Integration** — wire real Claude API into `/api/ai/generate-tree` (streaming) + `/api/ai/refine` etc.
2. **Element Reader View** — single-element deep reading page (mockup: `element-reader.html`)
3. **Element Popup Card** — click non-center element → floating card peek
4. **Textbook Mode** — multi-element compiled reading
5. **Codex Task Center** — bottom bar + side panel for code-mod tasks
6. **Search + AI Locate** — fuzzy search + semantic locate + graft logic
