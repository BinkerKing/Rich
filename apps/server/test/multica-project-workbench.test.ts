import { describe, expect, it } from "vitest";
import {
  multicaBoardSnapshotSchema,
  multicaIssueDetailSnapshotSchema,
} from "../src/mcp-v2/delegation/multica/MulticaProjectWorkbenchSchemas.js";

describe("Multica project workbench schemas", () => {
  it("parses a complete board snapshot without discarding Multica fields", () => {
    const result = multicaBoardSnapshotSchema.parse({
      project: { id: "mp-1", title: "【VTB】二代SAFE", status: "planned", upstream: "kept" },
      team: {
        squad: { id: "squad-1", name: "VTB SAFE 研析小队", leader_id: "agent-pm" },
        agents: [{ id: "agent-pm", name: "沈砚", model: "gpt-5.6-terra", role: "project-manager" }],
        resources: [{ id: "resource-1", type: "local_directory", local_path: "/tmp/vtb", execution_mode: "in_place" }],
      },
      statuses: [{ id: "in_progress", name: "进行中", category: "started", color: "#f5a524", position: 2 }],
      issues: [{
        id: "issue-1",
        identifier: "VTB-1",
        title: "熟悉项目",
        status: "in_progress",
        project_id: "mp-1",
        priority: "high",
        position: 10,
        labels: [{ id: "label-1", name: "analysis" }],
        custom_multica_field: "kept",
      }],
      syncedAt: "2026-08-28T06:00:00.000Z",
    });

    expect(result.issues[0]).toMatchObject({
      id: "issue-1",
      identifier: "VTB-1",
      priority: "high",
      custom_multica_field: "kept",
    });
    expect(result.project).toMatchObject({ upstream: "kept" });
  });

  it("parses issue detail resources including attachments and execution data", () => {
    const result = multicaIssueDetailSnapshotSchema.parse({
      issue: { id: "issue-1", title: "熟悉项目", status: "todo", project_id: "mp-1" },
      children: [{ id: "child-1", title: "目录分析", status: "todo", project_id: "mp-1", parent_id: "issue-1" }],
      attachments: [{ id: "attachment-1", name: "analysis.md", size: 321, content_type: "text/markdown" }],
      comments: [{ id: "comment-1", body: "开始分析", created_at: "2026-08-28T06:01:00.000Z" }],
      timeline: [{ id: "event-1", type: "status_changed", created_at: "2026-08-28T06:02:00.000Z" }],
      runs: [{ id: "run-1", status: "running", created_at: "2026-08-28T06:03:00.000Z" }],
      runMessages: [{ id: "message-1", run_id: "run-1", sequence: 1, role: "assistant", content: "working" }],
      pullRequests: [{ id: "pr-1", title: "No code changes", state: "open" }],
      usage: { input_tokens: 100, output_tokens: 20, total_tokens: 120 },
      metadata: { scope: "analysis-only" },
      properties: [{ id: "property-1", name: "Risk", value: "low" }],
      subscribers: [{ id: "agent-pm", name: "沈砚" }],
      syncedAt: "2026-08-28T06:04:00.000Z",
    });

    expect(result.attachments[0]).toMatchObject({ id: "attachment-1", name: "analysis.md" });
    expect(result.runMessages[0]).toMatchObject({ run_id: "run-1", sequence: 1 });
    expect(result.usage).toMatchObject({ total_tokens: 120 });
  });

  it("rejects issues without the identifiers required by Rich", () => {
    expect(() => multicaBoardSnapshotSchema.parse({
      project: { id: "mp-1", title: "VTB" },
      statuses: [],
      issues: [{ id: "issue-1", status: "todo" }],
      syncedAt: "2026-08-28T06:00:00.000Z",
    })).toThrow();
  });
});
