import { Hono } from "hono";
import { ZodError } from "zod";
import { WorkbenchDocumentService, type DocumentOperation } from "../workbench-document/service.js";

export function workbenchDocumentRoutes(service: WorkbenchDocumentService): Hono {
  const app = new Hono();
  app.onError((error, c) => c.json({ error: error.message }, error instanceof ZodError ? 400 : error.message.includes("不存在") ? 404 : error.message.includes("已更新") ? 409 : 400));
  app.get("/", async c => c.json({ documents: await service.repo.list() }));
  app.post("/", async c => c.json({ document: await service.create(await c.req.json()) }, 201));
  app.get("/:id", async c => c.json({ document: await service.get(c.req.param("id")) }));
  app.get("/:id/history", async c => { await service.get(c.req.param("id")); return c.json({ versions: await service.repo.history(c.req.param("id")) }); });
  app.post("/:id/outline", async c => {
    const body = await c.req.json() as { expectedVersion: number; operations: DocumentOperation[] };
    return c.json({ document: await service.outline(c.req.param("id"), body.expectedVersion, { operations: body.operations }) });
  });
  app.post("/:id/proposals", async c => {
    const body = await c.req.json() as { expectedVersion: number; summary: string; operations: DocumentOperation[] };
    return c.json({ proposal: await service.propose(c.req.param("id"), body.expectedVersion, { summary: body.summary, operations: body.operations }) }, 201);
  });
  app.post("/:id/proposals/:proposalId/accept", async c => c.json({ document: await service.acceptProposal(c.req.param("id"), c.req.param("proposalId")) }));
  app.delete("/:id/proposals/:proposalId", async c => {
    await service.getProposal(c.req.param("id"), c.req.param("proposalId"));
    await service.repo.removeProposal(c.req.param("id"), c.req.param("proposalId"));
    return c.body(null, 204);
  });
  app.post("/:id/manual-save", async c => {
    const body = await c.req.json() as { expectedVersion: number; operations: DocumentOperation[]; title?: string };
    return c.json({ document: await service.commitManual(c.req.param("id"), body.expectedVersion, body.operations, body.title) });
  });
  return app;
}
