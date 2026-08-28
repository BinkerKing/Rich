import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { openDb } from "../src/db/sqlite.js";
import type { MulticaProjectBinding, MulticaTeamPlan } from "../src/mcp-v2/delegation/multica/MulticaBindingRepo.js";
import { SqliteMulticaBindingRepo } from "../src/mcp-v2/delegation/multica/SqliteMulticaBindingRepo.js";

const tempDirs: string[] = [];

afterEach(() => {
  for (const directory of tempDirs.splice(0)) rmSync(directory, { recursive: true, force: true });
});

function makeDatabase() {
  const directory = mkdtempSync(join(tmpdir(), "rich-multica-bindings-"));
  tempDirs.push(directory);
  const path = join(directory, "rich.db");
  return { db: openDb(path), path };
}

const binding: MulticaProjectBinding = {
  richProjectId: "rich",
  richProjectName: "Rich",
  projectId: "project-1",
  projectTitle: "Rich",
  defaultSquadId: "squad-1",
  defaultSquadName: "Rich 执行小队",
  agents: [{ agentId: "agent-dev", name: "Rich 开发", capabilities: ["development"], role: "负责实现和验证" }],
  createdAt: "2026-08-28T01:00:00.000Z",
  updatedAt: "2026-08-28T01:00:00.000Z",
};

const plan: MulticaTeamPlan = {
  id: "plan-1",
  richProjectId: "rich",
  request: {
    richProjectId: "rich",
    richProjectName: "Rich",
    goal: "实现 Multica Adapter",
    capabilities: [{ key: "development", description: "TypeScript development", proposedName: "Rich 开发", role: "负责实现" }],
  },
  definition: {
    project: { action: "reuse", id: "project-1", title: "Rich", description: "Rich execution context" },
    leader: { action: "create", name: "Rich 调度员", description: "协调 Rich 执行任务", instructions: "只负责调度", runtimeProvider: "codex" },
    members: [{ action: "reuse", id: "agent-dev", name: "Rich 开发", capabilityKey: "development", role: "负责实现" }],
    squad: { action: "create", name: "Rich 执行小队", description: "Rich default squad", instructions: "Leader delegates work" },
  },
  status: "pending",
  createdAt: "2026-08-28T01:00:00.000Z",
};

describe("SQLite Multica binding repository", () => {
  it("persists project bindings across database reopen", async () => {
    const { db, path } = makeDatabase();
    const repo = new SqliteMulticaBindingRepo(db);
    await repo.saveBinding(binding);
    db.close();

    const reopened = openDb(path);
    expect(new SqliteMulticaBindingRepo(reopened).getBinding("rich")).toEqual(binding);
    reopened.close();
  });

  it("stores immutable plan input and marks a plan applied", async () => {
    const { db } = makeDatabase();
    const repo = new SqliteMulticaBindingRepo(db);
    await repo.createPlan(plan);

    const loaded = await repo.getPlan("plan-1");
    expect(loaded).toEqual(plan);
    loaded!.request.goal = "mutated in memory";
    expect(repo.getPlan("plan-1")).toMatchObject({ request: { goal: "实现 Multica Adapter" }, status: "pending" });

    await repo.markPlanApplied("plan-1", binding, "2026-08-28T02:00:00.000Z");
    expect(repo.getPlan("plan-1")).toMatchObject({
      status: "applied",
      appliedAt: "2026-08-28T02:00:00.000Z",
      resolvedBinding: binding,
    });
    db.close();
  });

  it("rejects duplicate plan creation and missing plan completion", async () => {
    const { db } = makeDatabase();
    const repo = new SqliteMulticaBindingRepo(db);
    await repo.createPlan(plan);
    expect(() => repo.createPlan(plan)).toThrow();
    expect(() => repo.markPlanApplied("missing", binding, new Date().toISOString())).toThrow(/missing/);
    db.close();
  });
});
