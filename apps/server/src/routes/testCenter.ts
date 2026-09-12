import { Hono } from "hono";
import { z } from "zod";
import { TestCenterSqliteRepo } from "../test-center/TestCenterSqliteRepo.js";

const caseInput = z.object({ code: z.string().min(1), title: z.string().min(1), objective: z.string(), type: z.enum(["data", "functional"]), priority: z.enum(["low", "medium", "high", "critical"]), taskId: z.string().optional(), groupId: z.string().optional(), scenario: z.string().default("") });
const taskInput = z.object({ title: z.string().min(1), objective: z.string() });
const taskDetailsInput = z.object({ objective: z.string(), testData: z.string(), testLinks: z.string(), appVersion: z.string() });
const groupInput = z.object({ taskId: z.string().min(1), parentGroupId: z.string().optional(), title: z.string().min(1) });
const taskMoveInput = z.object({ beforeTaskId: z.string().nullable().optional() });
const groupMoveInput = z.object({ parentGroupId: z.string().nullable().optional(), beforeGroupId: z.string().nullable().optional() });
const caseMoveInput = z.object({ taskId: z.string().nullable().optional(), groupId: z.string().nullable().optional(), beforeCaseId: z.string().nullable().optional() });
const caseStepInput = z.object({ stepOrder: z.number().int().positive(), instruction: z.string().min(1), expectedResult: z.string() });
const runStepFinishInput = z.object({ status: z.enum(["passed", "failed", "blocked"]), actualResult: z.string() });
const evidenceInput = z.object({ title: z.string().min(1), kind: z.string().min(1), location: z.string().min(1), runStepId: z.string().optional() });
const issueInput = z.object({ caseId: z.string().min(1), runId: z.string().min(1).optional(), title: z.string().min(1), description: z.string(), owner: z.string().min(1).optional(), externalRef: z.string().min(1).optional(), customFields: z.record(z.string(), z.string()).default({}) });
const issuePatch = z.object({ title: z.string().min(1).optional(), description: z.string().optional(), status: z.enum(["open", "fixed", "retest", "closed"]).optional(), owner: z.string().min(1).nullable().optional(), externalRef: z.string().min(1).nullable().optional(), customFields: z.record(z.string(), z.string()).optional() });
const gridColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const gridColumn = z.object({ key: z.string().min(1).max(80), name: z.string().min(1).max(80), width: z.number().int().min(68).max(1000).optional(), frozen: z.boolean().optional(), editable: z.boolean().optional(), visible: z.boolean().optional(), searchable: z.boolean().optional(), deleted: z.boolean().optional(), fieldType: z.enum(["text", "date", "checkbox", "select", "multiSelect"]).optional(), contentMode: z.enum(["plain", "wrap", "numbered", "bulleted", "checklist"]).optional(), options: z.array(z.object({ label: z.string().min(1).max(80), value: z.string().max(80), style: z.enum(["standard", "soft", "pill", "signal"]).optional() })).max(20).optional(), dropdownStyle: z.enum(["standard", "soft", "pill", "signal"]).optional(), headerStyle: z.object({ fontSize: z.enum(["12px", "13px", "14px", "16px"]).optional(), color: gridColor.optional(), backgroundColor: gridColor.optional(), fontWeight: z.enum(["400", "600", "700"]).optional(), fontStyle: z.enum(["normal", "italic"]).optional(), textAlign: z.enum(["left", "center", "right"]).optional() }).optional(), cellStyle: z.object({ fontSize: z.enum(["12px", "13px", "14px", "16px"]).optional(), color: gridColor.optional(), backgroundColor: gridColor.optional(), fontWeight: z.enum(["400", "600", "700"]).optional(), textAlign: z.enum(["left", "center", "right"]).optional() }).optional() });
const gridStyle = z.object({ density: z.enum(["compact", "comfortable"]).optional(), headerTone: z.enum(["neutral", "slate", "cyan"]).optional(), stripedRows: z.boolean().optional() });
const gridSettingsInput = z.object({ columns: z.array(gridColumn).max(40), style: gridStyle.optional() });
const discussionInput = z.object({ content: z.string().min(1) });
const caseCommentInput = z.object({ content: z.string().min(1) });

export function testCenterRoutes(repo: TestCenterSqliteRepo) {
  const r = new Hono();
  r.onError((error, c) => {
    if (error instanceof z.ZodError) return c.json({ error: "invalid test center input" }, 400);
    if (error instanceof Error && (error.message.startsWith("test ") || error.message.startsWith("only fixed"))) return c.json({ error: error.message }, 400);
    return c.json({ error: "test center request failed" }, 500);
  });
  r.get("/:projectId/tasks", async c => c.json(await repo.listTasks(c.req.param("projectId"))));
  r.post("/:projectId/tasks", async c => c.json(await repo.createTask({ projectId: c.req.param("projectId"), ...taskInput.parse(await c.req.json()) }), 201));
  r.patch("/:projectId/tasks/:taskId/details", async c => {
    const task = await repo.updateTaskDetails({ projectId: c.req.param("projectId"), id: c.req.param("taskId"), ...taskDetailsInput.parse(await c.req.json()) });
    return task ? c.json(task) : c.json({ error: "test task not found" }, 404);
  });
  r.delete("/:projectId/tasks/:taskId", async c => await repo.deleteTask(c.req.param("projectId"), c.req.param("taskId")) ? c.body(null, 204) : c.json({ error: "test task not found" }, 404));
  r.patch("/:projectId/tasks/:taskId/move", async c => { await repo.moveTask({ projectId: c.req.param("projectId"), taskId: c.req.param("taskId"), ...taskMoveInput.parse(await c.req.json()) }); return c.body(null, 204); });
  r.get("/:projectId/groups", async c => c.json(await repo.listGroups(c.req.param("projectId"))));
  r.post("/:projectId/groups", async c => c.json(await repo.createGroup({ projectId: c.req.param("projectId"), ...groupInput.parse(await c.req.json()) }), 201));
  r.delete("/:projectId/groups/:groupId", async c => await repo.deleteGroup({ projectId: c.req.param("projectId"), groupId: c.req.param("groupId") }) ? c.body(null, 204) : c.json({ error: "test group not found" }, 404));
  r.patch("/:projectId/groups/:groupId/move", async c => { await repo.moveGroup({ projectId: c.req.param("projectId"), groupId: c.req.param("groupId"), ...groupMoveInput.parse(await c.req.json()) }); return c.body(null, 204); });
  r.get("/:projectId/cases", async c => c.json(await repo.listCases(c.req.param("projectId"))));
  r.post("/:projectId/cases", async c => c.json(await repo.createCase({ projectId: c.req.param("projectId"), ...caseInput.parse(await c.req.json()) }), 201));
  r.patch("/:projectId/cases/:caseId/move", async c => { await repo.moveCase({ projectId: c.req.param("projectId"), caseId: c.req.param("caseId"), ...caseMoveInput.parse(await c.req.json()) }); return c.body(null, 204); });
  r.post("/:projectId/cases/batch", async c => {
    const body = z.object({ cases: z.array(caseInput).min(1) }).parse(await c.req.json());
    return c.json(await Promise.all(body.cases.map(input => repo.createCase({ projectId: c.req.param("projectId"), ...input }))), 201);
  });
  r.get("/:projectId/runs", async c => c.json(await repo.listProjectRuns(c.req.param("projectId"))));
  r.get("/:projectId/report", async c => c.json(await repo.getReport(c.req.param("projectId"))));
  r.get("/:projectId/cases/:caseId/steps", async c => c.json(await repo.listCaseSteps(c.req.param("projectId"), c.req.param("caseId"))));
  r.post("/:projectId/cases/:caseId/steps", async c => c.json(await repo.addCaseStep({ projectId: c.req.param("projectId"), caseId: c.req.param("caseId"), ...caseStepInput.parse(await c.req.json()) }), 201));
  r.get("/:projectId/cases/:caseId/comments", async c => c.json(await repo.listCaseComments(c.req.param("projectId"), c.req.param("caseId"))));
  r.post("/:projectId/cases/:caseId/comments", async c => c.json(await repo.addCaseComment({ projectId: c.req.param("projectId"), caseId: c.req.param("caseId"), ...caseCommentInput.parse(await c.req.json()) }), 201));
  r.patch("/:projectId/case-comments/:commentId", async c => {
    const comment = await repo.updateCaseComment({ projectId: c.req.param("projectId"), id: c.req.param("commentId"), ...caseCommentInput.parse(await c.req.json()) });
    return comment ? c.json(comment) : c.json({ error: "case comment not found" }, 404);
  });
  r.delete("/:projectId/case-comments/:commentId", async c => {
    return await repo.deleteCaseComment(c.req.param("projectId"), c.req.param("commentId")) ? c.body(null, 204) : c.json({ error: "case comment not found" }, 404);
  });
  r.get("/:projectId/cases/:caseId/runs", async c => c.json(await repo.listRuns(c.req.param("projectId"), c.req.param("caseId"))));
  r.post("/:projectId/cases/:caseId/runs", async c => c.json(await repo.startRun({ projectId: c.req.param("projectId"), caseId: c.req.param("caseId") }), 201));
  r.post("/:projectId/runs/:runId/finish", async c => {
    const body = z.object({ status: z.enum(["passed", "failed", "blocked", "retest"]), actualResult: z.string() }).parse(await c.req.json());
    const run = await repo.finishRun({ projectId: c.req.param("projectId"), runId: c.req.param("runId"), ...body });
    return run ? c.json(run) : c.json({ error: "run not found" }, 404);
  });
  r.get("/:projectId/runs/:runId/steps", async c => c.json(await repo.listRunSteps(c.req.param("projectId"), c.req.param("runId"))));
  r.post("/:projectId/run-steps/:runStepId/finish", async c => {
    const step = await repo.finishRunStep({ projectId: c.req.param("projectId"), runStepId: c.req.param("runStepId"), ...runStepFinishInput.parse(await c.req.json()) });
    return step ? c.json(step) : c.json({ error: "run step not found" }, 404);
  });
  r.get("/:projectId/runs/:runId/evidence", async c => c.json(await repo.listEvidence(c.req.param("projectId"), c.req.param("runId"))));
  r.post("/:projectId/runs/:runId/evidence", async c => c.json(await repo.addEvidence({ projectId: c.req.param("projectId"), runId: c.req.param("runId"), ...evidenceInput.parse(await c.req.json()) }), 201));
  r.get("/:projectId/issues", async c => c.json(await repo.listIssues(c.req.param("projectId"))));
  r.get("/:projectId/grid-settings", async c => c.json(await repo.listGridSettings(c.req.param("projectId"), c.req.query("prefix") ?? "")));
  r.get("/:projectId/grid-settings/:gridKey", async c => c.json(await repo.getGridSettings(c.req.param("projectId"), c.req.param("gridKey"))));
  r.put("/:projectId/grid-settings/:gridKey", async c => { const input = gridSettingsInput.parse(await c.req.json()); return c.json(await repo.saveGridSettings(c.req.param("projectId"), c.req.param("gridKey"), input.columns, input.style)); });
  r.post("/:projectId/issues", async c => c.json(await repo.createIssue({ projectId: c.req.param("projectId"), ...issueInput.parse(await c.req.json()) }), 201));
  r.patch("/:projectId/issues/:issueId", async c => {
    const issue = await repo.updateIssue({ projectId: c.req.param("projectId"), issueId: c.req.param("issueId"), ...issuePatch.parse(await c.req.json()) });
    return issue ? c.json(issue) : c.json({ error: "issue not found" }, 404);
  });
  r.delete("/:projectId/issues/:issueId", async c => await repo.deleteIssue(c.req.param("projectId"), c.req.param("issueId")) ? c.body(null, 204) : c.json({ error: "issue not found" }, 404));
  r.post("/:projectId/issues/:issueId/retest", async c => c.json(await repo.startRetestFromIssue({ projectId: c.req.param("projectId"), issueId: c.req.param("issueId") }), 201));
  r.get("/:projectId/issues/:issueId/discussions", async c => c.json(await repo.listIssueDiscussions(c.req.param("projectId"), c.req.param("issueId"))));
  r.post("/:projectId/issues/:issueId/discussions", async c => c.json(await repo.addIssueDiscussion({ projectId: c.req.param("projectId"), issueId: c.req.param("issueId"), ...discussionInput.parse(await c.req.json()) }), 201));
  return r;
}
