import { beforeEach, describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { SqliteWorkbenchDocumentRepo, WORKBENCH_DOCUMENT_SCHEMA } from "../src/workbench-document/repository.js";
import { WorkbenchDocumentService } from "../src/workbench-document/service.js";
import { workbenchDocumentRoutes } from "../src/routes/workbenchDocuments.js";

describe("workbench document routes", () => {
  let service: WorkbenchDocumentService;
  let app: ReturnType<typeof workbenchDocumentRoutes>;

  beforeEach(() => {
    const db = new Database(":memory:");
    db.exec(WORKBENCH_DOCUMENT_SCHEMA);
    service = new WorkbenchDocumentService(new SqliteWorkbenchDocumentRepo(db));
    app = workbenchDocumentRoutes(service);
  });

  it("creates, proposes, accepts, and reads an independent workbench document", async () => {
    const created = await app.request("/", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: "登录方案", conversationId: "conversation-1" }) });
    expect(created.status).toBe(201);
    const document = (await created.json()).document;

    const proposed = await app.request(`/${document.id}/proposals`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ expectedVersion: document.version, summary: "记录人工复核观点", operations: [{ type: "insert", card: { id: "idea", type: "rich_text", order: 0, content: { type: "doc", content: [] }, properties: {} }, index: 0 }] }) });
    expect(proposed.status).toBe(201);
    const proposal = (await proposed.json()).proposal;
    expect((await (await app.request(`/${document.id}`)).json()).document.cards).toEqual([]);

    const accepted = await app.request(`/${document.id}/proposals/${proposal.id}/accept`, { method: "POST" });
    expect(accepted.status).toBe(200);
    expect((await accepted.json()).document.cards).toMatchObject([{ id: "idea", type: "rich_text" }]);
  });
});
