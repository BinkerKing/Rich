import { z } from "zod";

const questionListSchema = z.object({
  key: z.literal("question_list"),
  rows: z.array(z.object({
    id: z.string().trim().min(1).max(160),
    question: z.string().trim().min(1).max(10_000),
    status: z.enum(["open", "resolved"]),
  }).strict()).max(1_000),
}).strict();

export type WorkbenchModule = z.infer<typeof questionListSchema>;

const modules = [{ key: "question_list", label: "问题清单" }] as const;

export function listWorkbenchModules() { return modules.map(module => ({ ...module })); }

export function validateWorkbenchModule(value: unknown): WorkbenchModule {
  if (!value || typeof value !== "object" || (value as { key?: unknown }).key !== "question_list") throw new Error("未知工作台模块");
  return questionListSchema.parse(value);
}
