import { z } from "zod";

const id = z.string().trim().min(1).max(160);
const text = z.string().max(30_000);
export const stepSchema = z.object({
  startedAt: z.string().optional(),
  id, parentId: id.optional(), title: z.string().trim().min(1).max(280),
  goal: text.default(""), acceptance: text.default(""),
  status: z.enum(["todo", "running", "blocked", "done", "skipped"]).default("todo"),
  evidence: text.default(""),
}).strict();
export const createTaskSchema = z.object({
  title: z.string().trim().min(1).max(280), conversationId: id, projectId: id.optional(),
  prd: z.string().max(150_000).optional(), requirementChangeSummary: text.optional(),
  requirement: text, acceptance: text.default(""), openQuestions: text.default(""), outputTarget: text.default(""),
}).strict();
export const taskPatchSchema = z.object({
  requirementUpdateKind: z.enum(["supplement", "change"]).default("change"),
  conversationId: id.optional(),
  title: z.string().trim().min(1).max(280).optional(), projectId: id.optional(),
  prd: z.string().max(150_000).optional(), requirementChangeSummary: text.optional(),
  requirement: text.optional(), acceptance: text.optional(), openQuestions: text.optional(), outputTarget: text.optional(),
  status: z.enum(["draft", "active", "blocked", "completed", "archived"]).optional(),
}).strict();
export const stepPatchSchema = z.object({
  id, parentId: id.optional(), title: z.string().trim().min(1).max(280).optional(),
  goal: text.optional(), acceptance: text.optional(),
  status: z.enum(["todo", "running", "blocked", "done", "skipped"]).optional(), evidence: text.optional(),
}).strict();
export const recordSchema = z.object({
  id: id.optional(), stepId: id.optional(),
  kind: z.enum(["progress", "conclusion", "decision", "question"]), text: text.refine(value => Boolean(value.trim()), "text required"),
  evidence: text.default(""), resolved: z.boolean().default(false),
}).strict();
export const resourceSchema = z.object({
  id: id.optional(), stepId: id.optional(), kind: z.enum(["material", "intermediate", "final"]),
  title: z.string().trim().min(1).max(280),
  format: z.enum(["file", "link", "information"]).optional(), content: text.optional(),
  location: z.string().trim().max(4000).default(""),
  version: z.string().max(100).default("v1"), summary: text.default(""),
}).strict().superRefine((value, ctx) => {
  if (!value.location && !value.content?.trim()) ctx.addIssue({ code: "custom", message: "材料需要地址或信息内容" });
  if ((value.format === "file" || value.format === "link") && !value.location) ctx.addIssue({ code: "custom", path: ["location"], message: "文件或链接需要地址" });
});
export const checkpointSchema = z.object({
  id, stepId: id, title: z.string().trim().min(1).max(280), description: text.default(""),
  phase: z.enum(["before", "during"]).default("before"), required: z.boolean().default(true),
  options: z.array(z.object({ value: id, label: z.string().trim().min(1).max(280), allowsExecution: z.boolean().default(true) }).strict()).max(20).default([]),
}).strict().refine(item => new Set(item.options.map(option => option.value)).size === item.options.length, "选项值不能重复");
export const checkpointAnswerSchema = z.object({ id, answerMode: z.enum(["option", "text"]).optional(), answer: text.refine(value => Boolean(value.trim()), "请填写或选择答案") }).strict();
export const writeSchema = z.object({
  action: z.enum(["update", "plan", "step", "record", "resource", "confirm", "checkpoint", "answer"]),
  expectedVersion: z.number().int().positive(), input: z.unknown(),
}).strict();
