import { Hono } from "hono";
import { z, ZodError } from "zod";
import { workbenchCardSchema } from "@ke/domain";
import { WorkbenchDocumentService } from "../workbench-document/service.js";

const operationSchema = z.union([
  z.object({ type: z.literal("insert"), card: workbenchCardSchema, parentId: z.string().trim().min(1).optional(), index: z.number().int().nonnegative() }).strict(),
  z.object({ type: z.literal("move"), cardId: z.string().trim().min(1), parentId: z.string().trim().min(1).optional(), index: z.number().int().nonnegative() }).strict(),
  z.object({ type: z.literal("remove"), cardId: z.string().trim().min(1) }).strict(),
  z.object({ type: z.literal("update"), cardId: z.string().trim().min(1), patch: z.object({ title: z.string().trim().min(1).max(500).optional(), content: z.unknown().optional(), properties: z.record(z.string(), z.unknown()).optional() }).strict() }).strict(),
]);
const writeSchema = z.object({ expectedVersion: z.number().int().positive(), operations: z.array(operationSchema).max(500), title: z.string().trim().min(1).max(500).optional() }).strict();

export function workbenchDocumentRoutes(service: WorkbenchDocumentService): Hono {
  const app = new Hono();
  app.onError((error, c) => c.json({ error: error.message }, error instanceof ZodError ? 400 : error.message.includes("不存在") ? 404 : error.message.includes("已更新") ? 409 : 400));
  app.get("/", async c => c.json({ documents: await service.repo.list() }));
  app.post("/", async c => c.json({ document: await service.create(z.object({ title: z.string().trim().min(1).max(500), conversationId: z.string().trim().min(1).max(160) }).strict().parse(await c.req.json())) }, 201));
  app.get("/:id", async c => c.json({ document: await service.get(c.req.param("id")) }));
  app.get("/:id/history", async c => { await service.get(c.req.param("id")); return c.json({ versions: await service.repo.history(c.req.param("id")) }); });
  app.get("/:id/proposals", async c => c.json({ proposals: await service.listProposals(c.req.param("id")) }));
  app.post("/:id/outline", async c => {
    const body = writeSchema.parse(await c.req.json());
    return c.json({ document: await service.outline(c.req.param("id"), body.expectedVersion, { operations: body.operations }) });
  });
  app.post("/:id/proposals", async c => {
    const body = z.object({ expectedVersion: z.number().int().positive(), summary: z.string().trim().min(1).max(1000), operations: z.array(operationSchema).min(1).max(500) }).strict().parse(await c.req.json());
    return c.json({ proposal: await service.propose(c.req.param("id"), body.expectedVersion, { summary: body.summary, operations: body.operations }) }, 201);
  });
  app.post("/:id/proposals/:proposalId/accept", async c => c.json({ document: await service.acceptProposal(c.req.param("id"), c.req.param("proposalId")) }));
  app.delete("/:id/proposals/:proposalId", async c => {
    await service.getProposal(c.req.param("id"), c.req.param("proposalId"));
    await service.repo.removeProposal(c.req.param("id"), c.req.param("proposalId"));
    return c.body(null, 204);
  });
  app.post("/:id/manual-save", async c => {
    const body = writeSchema.parse(await c.req.json());
    return c.json({ document: await service.commitManual(c.req.param("id"), body.expectedVersion, body.operations, body.title) });
  });
  app.post("/:id/format-markdown", async c => {
    const body = z.object({ expectedVersion: z.number().int().positive() }).strict().parse(await c.req.json());
    return c.json({ document: await service.formatMarkdown(c.req.param("id"), body.expectedVersion) });
  });
  return app;
}
