import { z } from "zod";
import type { McpOperationRepo } from "../../repos/McpOperationRepo.js";
import type { ProjectManagementRepo, ProjectModuleItem } from "../../repos/ProjectManagementRepo.js";
import { RichMcpError } from "../registry/errors.js";
import { richSuccess } from "../registry/response.js";
import type { RichToolRegistry } from "../registry/toolRegistry.js";
import { executeSafeWrite } from "../registry/writeSafety.js";
import { richContextSchema, richOptionsSchema } from "./schemas.js";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional();
const report = z.object({
  type: z.enum(["daily", "weekly", "monthly", "meeting"]).default("daily"), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), title: z.string().trim().min(1).max(280),
  projectProgress: z.number().min(0).max(100).optional(), completedWork: z.array(z.string().max(4_000)).optional(), tomorrowPlan: z.array(z.string().max(4_000)).optional(), risks: z.array(z.string().max(4_000)).optional(),
  summary: z.string().max(20_000).optional(), body: z.string().max(100_000).optional(), sources: z.array(z.string().max(4_000)).optional(), metrics: z.array(z.object({ label: z.string().max(280), value: z.string().max(4_000) })).optional(),
});
const input = z.object({ action: z.enum(["context", "list", "create", "update"]), projectId: z.string().trim().min(1), reportId: z.string().trim().min(1).optional(), date, report: report.optional(), context: richContextSchema, options: richOptionsSchema }).superRefine((value, issue) => {
  if (value.action === "create" && !value.report) issue.addIssue({ code: "custom", path: ["report"], message: "report is required." });
  if (value.action === "update" && (!value.reportId || !value.report)) issue.addIssue({ code: "custom", path: ["report"], message: "reportId and report are required." });
});

function textList(value: unknown): string[] { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []; }
function activities(items: ProjectModuleItem[], day: string) {
  return items.flatMap(item => Array.isArray(item.content.activities) ? item.content.activities.flatMap(value => {
    if (!value || typeof value !== "object") return [];
    const activity = value as Record<string, unknown>; const created = typeof activity.createdAt === "string" && activity.createdAt.slice(0, 10) === day;
    const completed = activity.done === true && typeof activity.completedAt === "string" && activity.completedAt.slice(0, 10) === day;
    const kind = typeof activity.kind === "string" ? activity.kind : ""; const content = typeof activity.text === "string" ? activity.text.trim() : "";
    return content && ((["record", "reminder", "end"].includes(kind) && created) || (["todo", "deliverable"].includes(kind) && completed)) ? [{ taskId: item.id, taskTitle: item.title, kind, text: content }] : [];
  }) : []);
}
function ref(item: ProjectModuleItem) { return [{ type: "projectItem", id: item.id, label: item.title }]; }

export function registerReportTools(registry: RichToolRegistry, projects: Pick<ProjectManagementRepo, "listAllModuleItems" | "createModuleItem" | "updateModuleItem">, operationRepo?: McpOperationRepo): void {
  registry.register({
    name: "rich_report_manage", title: "管理项目报告", category: "manage", description: "读取报告中心所需的项目计划、今日活动、明日计划与既有报告，并创建或维护项目报告。写入后会读取同一条报告确认结果。",
    inputSchema: input, annotations: { readOnly: false, destructive: false, idempotent: true }, examples: [{ description: "读取报告中心今日上下文。", input: { action: "context", projectId: "project-id" } }, { description: "创建项目日报。", input: { action: "create", projectId: "project-id", report: { type: "daily", date: "2026-09-24", title: "项目日报 · 9月24日", completedWork: [], tomorrowPlan: [] } } }], verification: "Writes are read back from the reports module and matched by report id and updated fields.",
    handler: async value => {
      const reports = async () => projects.listAllModuleItems(value.projectId, "reports");
      if (value.action === "context") {
        const day = value.date ?? new Date().toISOString().slice(0, 10); const [deliveryPlan, existing] = await Promise.all([projects.listAllModuleItems(value.projectId, "deliveryPlan"), reports()]);
        const todayReport = existing.find(item => item.content.date === day); const tomorrowPlan = todayReport ? textList(todayReport.content.tomorrowPlan) : [];
        return richSuccess("rich_report_manage", { date: day, projectPlan: deliveryPlan, todayActivities: activities(deliveryPlan, day), tomorrowPlan, reports: existing });
      }
      if (value.action === "list") return richSuccess("rich_report_manage", { reports: (await reports()).filter(item => !value.date || item.content.date === value.date) });
      if (value.action === "create") return executeSafeWrite({ toolName: "rich_report_manage", operationRepo, context: value.context, options: value.options, inputForHash: value, changes: [{ operation: "create", resource: "report" }], execute: async () => ({ item: await projects.createModuleItem(value.projectId, { moduleKey: "reports", title: value.report!.title, subtitle: value.report!.date, content: value.report! }) }), verify: async result => ({ status: (await reports()).some(item => item.id === result.item.id) ? "verified" : "failed", details: "Report was read back after creation." }), refs: result => ref(result.item) });
      return executeSafeWrite({ toolName: "rich_report_manage", operationRepo, context: value.context, options: value.options, inputForHash: value, changes: [{ operation: "update", resource: "report", id: value.reportId }], execute: async () => { const item = await projects.updateModuleItem(value.projectId, value.reportId!, { title: value.report!.title, subtitle: value.report!.date, content: value.report! }); if (!item) throw new RichMcpError("NOT_FOUND", "The requested report was not found."); return { item }; }, verify: async result => ({ status: (await reports()).some(item => item.id === result.item.id && item.updatedAt === result.item.updatedAt) ? "verified" : "failed", details: "Report was read back after update." }), refs: result => ref(result.item) });
    },
  });
}
