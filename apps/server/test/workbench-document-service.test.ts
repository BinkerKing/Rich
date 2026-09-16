import { afterEach, beforeEach, describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { SqliteWorkbenchDocumentRepo, WORKBENCH_DOCUMENT_SCHEMA } from "../src/workbench-document/repository.js";
import { WorkbenchDocumentService } from "../src/workbench-document/service.js";
import { SqliteMcpOperationRepo } from "../src/repos/SqliteMcpOperationRepo.js";
import { RichToolRegistry } from "../src/mcp-v2/registry/toolRegistry.js";
import { registerWorkbenchDocumentTools } from "../src/mcp-v2/resources/workbenchDocumentTools.js";
import { openDb } from "../src/db/sqlite.js";

describe("workbench document service", () => {
  let db: Database.Database;
  let service: WorkbenchDocumentService;

  beforeEach(() => {
    db = openDb(":memory:");
    db.exec(WORKBENCH_DOCUMENT_SCHEMA);
    service = new WorkbenchDocumentService(new SqliteWorkbenchDocumentRepo(db));
  });
  afterEach(() => db.close());

  it("creates an empty document and immediately saves automatic empty headings", async () => {
    const document = await service.create({ title: "登录方案", conversationId: "conversation-1" });
    expect(document.cards).toEqual([]);

    const updated = await service.outline(document.id, document.version, {
      operations: [{ type: "insert", card: { id: "goal", type: "heading", order: 0, title: "目标", content: null, properties: {} }, parentId: undefined, index: 0 }],
    });

    expect(updated.version).toBe(2);
    expect(updated.cards).toMatchObject([{ id: "goal", type: "heading", title: "目标", content: null }]);
  });

  it("keeps a substantive proposal out of the formal document until acceptance", async () => {
    const document = await service.create({ title: "登录方案", conversationId: "conversation-1" });
    const proposal = await service.propose(document.id, document.version, {
      summary: "新增人工复核观点，并解释其处理流程。",
      operations: [
        { type: "insert", card: { id: "idea", type: "rich_text", order: 0, content: { type: "doc", content: [] }, properties: {} }, parentId: undefined, index: 0 },
        { type: "insert", card: { id: "flow", type: "flowchart", order: 0, title: "异常处理流程", content: null, properties: { provider: "rich-flowchart", entityId: "flow-1" } }, parentId: undefined, index: 1 },
      ],
    });

    expect((await service.get(document.id)).cards).toEqual([]);
    const accepted = await service.acceptProposal(document.id, proposal.id);
    expect(accepted.cards.map(card => card.type)).toEqual(["rich_text", "flowchart"]);
    await expect(service.getProposal(document.id, proposal.id)).rejects.toThrow("提议不存在");
  });

  it("rejects substantive content in an automatic outline", async () => {
    const document = await service.create({ title: "登录方案", conversationId: "conversation-1" });
    await expect(service.outline(document.id, document.version, {
      operations: [{ type: "insert", card: { id: "idea", type: "rich_text", order: 0, content: { type: "doc", content: [] }, properties: {} }, parentId: undefined, index: 0 }],
    })).rejects.toThrow("空标题");
  });

  it("lets an agent submit proposals but never accept them through MCP", async () => {
    const document = await service.create({ title: "登录方案", conversationId: "conversation-1" });
    const registry = new RichToolRegistry();
    registerWorkbenchDocumentTools(registry, service, new SqliteMcpOperationRepo(db));

    const proposal = await registry.invoke("rich_workbench_document", {
      action: "propose",
      documentId: document.id,
      expectedVersion: document.version,
      input: {
        summary: "新增登录风险观点。",
        operations: [{ type: "insert", card: { id: "risk", type: "rich_text", order: 0, content: { type: "doc", content: [] }, properties: {} }, index: 0 }],
      },
      context: { requestId: "proposal-1" },
    });

    expect(proposal).toMatchObject({ ok: true });
    expect((await service.get(document.id)).cards).toEqual([]);
    expect(await registry.invoke("rich_workbench_document", { action: "accept", documentId: document.id })).toMatchObject({
      ok: false,
      error: { code: "VALIDATION_ERROR" },
    });
  });
});
