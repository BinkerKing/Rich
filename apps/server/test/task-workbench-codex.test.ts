import { describe, expect, it, vi } from "vitest";
import { DeliverableCodexContextService } from "../src/deliverable-codex/DeliverableCodexContextService.js";
import { deliverableCodexRoutes } from "../src/routes/deliverableCodex.js";

describe("general Codex task mode", () => {
  it("does not require a project or deliverable context", async () => {
    const snapshots = { createSnapshot: vi.fn() };
    const context = new DeliverableCodexContextService(snapshots as any, { get: vi.fn() } as any);
    expect(await context.build({ projectId: "__general__", deliverableId: "__general__", mode: "free" })).toMatchObject({ scopeKey: "workbench:general", allowedMcpTools: ["rich_workbench_manage"] });
    expect(snapshots.createSnapshot).not.toHaveBeenCalled();
  });
  it("starts general task mode without invoking the deliverable template and binds the correct record ID", async () => {
    const context = { build: vi.fn() }; const prompts = { render: vi.fn() }; const appendMessage = vi.fn();
    const app = deliverableCodexRoutes({ conversations: { get: async () => ({ id: "rich-record-1", conversationId: "internal-chat-2", status: "active" }) }, context, prompts, chats: { appendMessage }, agents: {}, attachments: null } as any);
    const response = await app.request("/conversations/rich-record-1/events/task-mode-started", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ eventId: "event-1", startedAt: new Date().toISOString(), mode: { id: "general-task", label: "任务模式" }, location: { page: ["任务工作台"] } }) });
    expect(response.status).toBe(201);
    const payload = await response.json();
    expect(payload.instruction).toContain("当前 Rich Codex 对话记录 ID：rich-record-1");
    expect(payload.instruction).toContain("rich_workbench_manage");
    expect(context.build).not.toHaveBeenCalled(); expect(prompts.render).not.toHaveBeenCalled();
    expect(appendMessage).toHaveBeenCalledOnce();
  });
});
