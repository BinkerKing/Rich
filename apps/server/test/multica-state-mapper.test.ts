import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  multicaAgentListSchema,
  multicaIssueSchema,
  multicaProjectListSchema,
  multicaRunListSchema,
  multicaRuntimeListSchema,
  multicaSquadListSchema,
} from "../src/mcp-v2/delegation/multica/types.js";
import { aggregateMulticaStatus } from "../src/mcp-v2/delegation/multica/MulticaStateMapper.js";

function fixture(name: string): unknown {
  return JSON.parse(readFileSync(join(import.meta.dirname, "fixtures", "multica", name), "utf8"));
}

describe("Multica CLI schemas", () => {
  it("parses the v0.4.35 resources Rich uses", () => {
    expect(multicaProjectListSchema.parse(fixture("projects.json"))[0]).toMatchObject({ id: "project-1", title: "Rich" });
    expect(multicaAgentListSchema.parse(fixture("agents.json"))[0]).toMatchObject({ id: "agent-dev", name: "Rich 开发" });
    expect(multicaRuntimeListSchema.parse(fixture("runtimes.json"))[0]).toMatchObject({ provider: "codex", status: "online" });
    expect(multicaIssueSchema.parse(fixture("issue.json"))).toMatchObject({ id: "issue-1", status: "in_progress" });
    expect(multicaRunListSchema.parse(fixture("runs.json"))).toHaveLength(2);
    expect(multicaSquadListSchema.parse([])).toEqual([]);
  });

  it("rejects resources without stable IDs and display fields", () => {
    expect(() => multicaProjectListSchema.parse([{ title: "Rich" }])).toThrow();
    expect(() => multicaAgentListSchema.parse([{ id: "agent-1" }])).toThrow();
    expect(() => multicaIssueSchema.parse({ id: "issue-1" })).toThrow();
  });
});

describe("Multica task-state aggregation", () => {
  const issue = multicaIssueSchema.parse(fixture("issue.json"));
  const runs = multicaRunListSchema.parse(fixture("runs.json"));

  it("uses active member runs as progress authority", () => {
    expect(aggregateMulticaStatus(issue, runs)).toMatchObject({
      status: "running",
      progressSummary: expect.stringContaining("1 running"),
    });
  });

  it.each([
    ["queued", "queued"],
    ["dispatched", "queued"],
    ["waiting_local_directory", "waiting_input"],
    ["running", "running"],
  ] as const)("maps a %s run to %s", (runStatus, expected) => {
    expect(aggregateMulticaStatus(issue, [{ ...runs[1], status: runStatus }])).toMatchObject({ status: expected });
  });

  it("treats issue review and terminal issue states as authoritative", () => {
    expect(aggregateMulticaStatus({ ...issue, status: "in_review" }, runs.map(run => ({ ...run, status: "completed" })))).toMatchObject({ status: "waiting_input" });
    expect(aggregateMulticaStatus({ ...issue, status: "done" }, runs.map(run => ({ ...run, status: "completed" })))).toMatchObject({ status: "succeeded" });
    expect(aggregateMulticaStatus({ ...issue, status: "failed" }, [{ ...runs[1], status: "failed", error: "boom" }])).toMatchObject({ status: "failed", error: "boom" });
    expect(aggregateMulticaStatus({ ...issue, status: "cancelled" }, [{ ...runs[1], status: "cancelled" }])).toMatchObject({ status: "cancelled" });
  });

  it("does not make an old failed attempt terminal while a retry is active", () => {
    const result = aggregateMulticaStatus(issue, [
      { ...runs[1], id: "attempt-1", status: "failed", error: "temporary" },
      { ...runs[1], id: "attempt-2", status: "running", attempt: 2 },
    ]);
    expect(result).toMatchObject({ status: "running" });
  });

  it("returns result references from completed runs", () => {
    const result = aggregateMulticaStatus({ ...issue, status: "done" }, [{
      ...runs[0],
      status: "completed",
      result: { output: "Implemented and tested", pr_url: "https://github.com/example/rich/pull/1" },
    }]);
    expect(result.resultRefs).toEqual(expect.arrayContaining([
      { type: "multica_run", id: "run-leader", label: "Implemented and tested" },
      { type: "pull_request", id: "https://github.com/example/rich/pull/1", label: "Multica pull request" },
    ]));
  });
});
