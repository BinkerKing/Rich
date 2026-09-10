import { z } from "zod";
import type { McpOperationRepo } from "../../repos/McpOperationRepo.js";
import { richSuccess } from "../registry/response.js";
import type { RichToolRegistry } from "../registry/toolRegistry.js";
import { executeSafeWrite } from "../registry/writeSafety.js";
import { richContextSchema, richOptionsSchema } from "./schemas.js";
import { TestCenterSqliteRepo } from "../../test-center/TestCenterSqliteRepo.js";

const actionSchema = z.enum([
  "list_tasks", "list_cases", "list_runs", "list_issues", "list_case_comments", "get_report",
  "create_task", "create_case", "create_cases", "add_case_step", "start_run", "finish_run", "finish_run_step",
  "add_evidence", "create_issue", "update_issue", "add_discussion", "add_case_comment", "update_case_comment", "start_retest",
]);
const caseInput = z.object({ code: z.string().min(1), title: z.string().min(1), objective: z.string(), type: z.enum(["data", "functional"]), priority: z.enum(["low", "medium", "high", "critical"]), taskId: z.string().min(1).optional(), scenario: z.string().default("") });

export function registerTestCenterTools(registry: RichToolRegistry, testCenter: TestCenterSqliteRepo, operationRepo?: McpOperationRepo): void {
  registry.register({
    name: "rich_test_center_manage",
    title: "Manage test center",
    description: "Read and write test tasks, cases, execution history, step results, evidence, issues, case comments, discussions, retests, and derived reports in one project.",
    category: "manage",
    inputSchema: z.object({
      action: actionSchema,
      projectId: z.string().min(1),
      caseId: z.string().min(1).optional(), runId: z.string().min(1).optional(), runStepId: z.string().min(1).optional(), issueId: z.string().min(1).optional(), commentId: z.string().min(1).optional(),
      input: z.record(z.string(), z.unknown()).optional(), context: richContextSchema, options: richOptionsSchema,
    }).superRefine((value, issues) => {
      const required: Partial<Record<z.infer<typeof actionSchema>, keyof typeof value>> = { list_case_comments: "caseId", add_case_step: "caseId", start_run: "caseId", finish_run: "runId", add_evidence: "runId", finish_run_step: "runStepId", update_issue: "issueId", add_discussion: "issueId", add_case_comment: "caseId", update_case_comment: "commentId", start_retest: "issueId" };
      const key = required[value.action];
      if (key && !value[key]) issues.addIssue({ code: "custom", path: [key], message: `${key} is required.` });
      if (!value.action.startsWith("list_") && value.action !== "get_report" && !value.input && value.action !== "start_run" && value.action !== "start_retest") issues.addIssue({ code: "custom", path: ["input"], message: "input is required." });
    }),
    annotations: { readOnly: false, destructive: false, idempotent: true },
    examples: [
      { description: "List test cases.", input: { action: "list_cases", projectId: "project-rich" } },
      { description: "Create a data-validation case.", input: { action: "create_case", projectId: "project-rich", input: { code: "TC-001", title: "金额校验", objective: "校验汇总金额", type: "data", priority: "high" }, context: { requestId: "create-tc-001" } } },
    ],
    verification: "Every write is idempotent by request ID and followed by a repository read-back before success is returned.",
    handler: async ({ action, projectId, caseId, runId, runStepId, issueId, commentId, input, context, options }) => {
      if (action === "list_tasks") return richSuccess("rich_test_center_manage", { tasks: await testCenter.listTasks(projectId) });
      if (action === "list_cases") return richSuccess("rich_test_center_manage", { cases: await testCenter.listCases(projectId) });
      if (action === "list_runs") return richSuccess("rich_test_center_manage", { runs: await testCenter.listProjectRuns(projectId) });
      if (action === "list_issues") return richSuccess("rich_test_center_manage", { issues: await testCenter.listIssues(projectId) });
      if (action === "list_case_comments") return richSuccess("rich_test_center_manage", { comments: await testCenter.listCaseComments(projectId, caseId!) });
      if (action === "get_report") return richSuccess("rich_test_center_manage", { report: await testCenter.getReport(projectId) });

      const entity = await executeSafeWrite({
        toolName: "rich_test_center_manage", operationRepo, context, options,
        inputForHash: { action, projectId, caseId, runId, runStepId, issueId, commentId, input },
        changes: [{ operation: action.startsWith("create") || action === "start_run" || action === "start_retest" || action.startsWith("add_") ? "create" : "update", resource: "testCenter", id: caseId ?? runId ?? runStepId ?? issueId ?? commentId }],
        execute: async () => {
          if (action === "create_task") return testCenter.createTask({ projectId, ...z.object({ title: z.string().min(1), objective: z.string() }).parse(input) });
          if (action === "create_case") return testCenter.createCase({ projectId, ...caseInput.parse(input) });
          if (action === "create_cases") return Promise.all(z.object({ cases: z.array(caseInput).min(1) }).parse(input).cases.map(item => testCenter.createCase({ projectId, ...item })));
          if (action === "add_case_step") return testCenter.addCaseStep({ projectId, caseId: caseId!, ...z.object({ stepOrder: z.number().int().positive(), instruction: z.string().min(1), expectedResult: z.string() }).parse(input) });
          if (action === "start_run") return testCenter.startRun({ projectId, caseId: caseId! });
          if (action === "finish_run") return testCenter.finishRun({ projectId, runId: runId!, ...z.object({ status: z.enum(["passed", "failed", "blocked", "retest"]), actualResult: z.string() }).parse(input) });
          if (action === "finish_run_step") return testCenter.finishRunStep({ projectId, runStepId: runStepId!, ...z.object({ status: z.enum(["passed", "failed", "blocked"]), actualResult: z.string() }).parse(input) });
          if (action === "add_evidence") return testCenter.addEvidence({ projectId, runId: runId!, ...z.object({ title: z.string().min(1), kind: z.string().min(1), location: z.string().min(1), runStepId: z.string().min(1).optional() }).parse(input) });
          if (action === "create_issue") return testCenter.createIssue({ projectId, ...z.object({ caseId: z.string().min(1), runId: z.string().min(1).optional(), title: z.string().min(1), description: z.string(), owner: z.string().min(1).optional(), externalRef: z.string().min(1).optional() }).parse(input) });
          if (action === "update_issue") return testCenter.updateIssue({ projectId, issueId: issueId!, ...z.object({ status: z.enum(["open", "fixed", "retest", "closed"]).optional(), owner: z.string().min(1).nullable().optional(), externalRef: z.string().min(1).nullable().optional() }).parse(input) });
          if (action === "add_discussion") return testCenter.addIssueDiscussion({ projectId, issueId: issueId!, ...z.object({ content: z.string().min(1) }).parse(input) });
          if (action === "add_case_comment") return testCenter.addCaseComment({ projectId, caseId: caseId!, ...z.object({ content: z.string().min(1) }).parse(input) });
          if (action === "update_case_comment") return testCenter.updateCaseComment({ projectId, id: commentId!, ...z.object({ content: z.string().min(1) }).parse(input) });
          return testCenter.startRetestFromIssue({ projectId, issueId: issueId! });
        },
        verify: async result => ({ status: result ? "verified" : "failed", details: "Test-center write returned a persisted entity." }),
        refs: result => Array.isArray(result) ? result.map(item => ({ type: "testCenter", id: item.id, label: item.title })) : result ? [{ type: "testCenter", id: result.id, label: "title" in result ? String(result.title) : undefined }] : [],
      });
      return entity;
    },
  });
}
