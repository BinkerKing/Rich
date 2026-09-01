import { z } from "zod";
import type { AIAdapter } from "../adapter.js";
import { withOperationContext, type OperationPromptArgs } from "../operationContext.js";
import { runStructuredAI, type StructuredEvent } from "../runStructuredAI.js";
import { zodValidator } from "../structuredValidation.js";
import { buildGreatMePrompt, type GreatMeMode } from "../prompts/greatMe.js";
import { buildDecomposePlanPrompt } from "../prompts/decomposePlan.js";
import { buildAnalyzeProgressPrompt } from "../prompts/analyzeProgress.js";
import { buildDraftReviewPrompt } from "../prompts/draftReview.js";
import { buildGuidedPracticePrompt } from "../prompts/guidedPractice.js";

type ProjectOperationArgs = OperationPromptArgs & { signal?: AbortSignal };

const GreatMeLaneSchema = z.enum(["主线任务", "能力突破", "健康能量", "关系连接", "财富系统", "创造输出"]);
const GreatMeAxisSchema = z.enum(["body", "mind", "wealth", "craft", "relations", "creation"]);
const GreatMePdcaSchema = z.object({
  plan: z.string().optional().default(""), do: z.string().optional().default(""),
  check: z.string().optional().default(""), act: z.string().optional().default(""),
}).partial().default({});
const GreatMeBrainResultSchema = z.object({
  mode: z.enum(["goal", "mission", "review", "week-simulation"]), title: z.string().min(1).max(48),
  summary: z.string().min(1).max(500), focus: z.string().min(1).max(160),
  risks: z.array(z.string().min(1).max(140)).max(6).default([]),
  nextActions: z.array(z.string().min(1).max(140)).max(8).default([]),
  missions: z.array(z.object({ title: z.string().min(1).max(120), lane: GreatMeLaneSchema.default("主线任务"), impact: z.number().int().min(0).max(100).default(70), effort: z.number().int().min(0).max(100).default(35), reason: z.string().max(180).optional().default("") })).max(8).default([]),
  pdca: GreatMePdcaSchema,
  axisAdjustments: z.array(z.object({ axis: GreatMeAxisSchema, delta: z.number().int().min(-10).max(10), reason: z.string().min(1).max(140) })).max(6).default([]),
  weekSimulation: z.array(z.object({ day: z.number().int().min(1).max(7), theme: z.string().min(1).max(80), mission: z.string().min(1).max(140), evidence: z.string().min(1).max(140), review: z.string().min(1).max(180) })).max(7).default([]),
});
export type GreatMeBrainResult = z.infer<typeof GreatMeBrainResultSchema>;

const IsoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");
const DecomposePlanResultSchema = z.object({
  plan: z.object({ title: z.string().min(1).max(200), detail: z.string().max(800).default(""), start: IsoDateSchema, end: IsoDateSchema, scopes: z.array(z.enum(["year", "month", "week", "day"])).min(1).max(4) }),
  goals: z.array(z.object({ tempId: z.string().min(1).max(40), scope: z.enum(["year", "month", "week"]), title: z.string().min(1).max(280), detail: z.string().max(800).default(""), due: IsoDateSchema, parentTempId: z.string().max(40).optional(), metric: z.object({ unit: z.string().min(1).max(20), target: z.number() }).optional() })).max(100),
  tasks: z.array(z.object({ title: z.string().min(1).max(280), date: IsoDateSchema, goalTempId: z.string().max(40).optional(), badge: z.string().max(20).default(""), note: z.string().max(400).default("") })).max(200),
  reasoning: z.string().max(800).default(""),
});
export type DecomposePlanResult = z.infer<typeof DecomposePlanResultSchema>;

const AnalyzeProgressResultSchema = z.object({
  keyInsight: z.string().min(1).max(400), blockers: z.array(z.string().min(1).max(280)).max(8).default([]),
  pushActions: z.array(z.string().min(1).max(280)).max(8).default([]),
  priorityTasks: z.array(z.object({ title: z.string().min(1).max(160), reason: z.string().max(280).default("") })).max(5).default([]),
});
export type AnalyzeProgressResult = z.infer<typeof AnalyzeProgressResultSchema>;

const DraftReviewResultSchema = z.object({
  score: z.number().int().min(0).max(100), victory: z.array(z.string().max(280)).max(10).default([]),
  blocker: z.array(z.string().max(280)).max(10).default([]), planning: z.array(z.string().max(280)).max(10).default([]),
  summary: z.string().max(2000), perspectives: z.array(z.object({ dimension: z.string().min(1).max(40), content: z.string().max(800) })).max(8).default([]),
});
export type DraftReviewResult = z.infer<typeof DraftReviewResultSchema>;

const GuidedPracticeStageSchema = z.enum(["goal", "scenario", "technical", "scope", "prd", "plan"]);
function guidedValueToText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(guidedValueToText).map(item => item.trim()).filter(Boolean).join("\n");
  if (typeof value !== "object") return String(value);
  const source = value as Record<string, unknown>;
  const preferred = ["summary", "goal", "objective", "problem", "coreValue", "initialProductConcept", "testingObjective", "testObject", "testScope", "testMethod", "successCriteria", "title", "desc", "description", "body", "value", "raw"];
  const lines: string[] = [];
  for (const key of preferred) if (key in source) {
    const text = guidedValueToText(source[key]);
    if (text) lines.push(text);
  }
  for (const [key, raw] of Object.entries(source)) {
    if (preferred.includes(key)) continue;
    const text = guidedValueToText(raw);
    if (text) lines.push(`${key}：${text}`);
  }
  return lines.join("\n");
}
const GuidedPracticeDraftPatchSchema = z.preprocess((value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const source = value as Record<string, unknown>;
  const keyMap: Record<string, string> = { 标题: "title", 项目标题: "title", projectName: "title", projectType: "title", 原始想法: "idea", 想法: "idea", background: "idea", 背景: "idea", 目标: "goal", 项目目标: "goal", objective: "goal", 用户: "users", 目标用户: "users", 使用者: "users", targetUsers: "users", 场景: "scenarios", 业务场景: "scenarios", useCases: "scenarios", initialRequirements: "scenarios", 技术: "technical", 技术分析: "technical", 功能: "features", MVP功能: "features", coreRequirements: "features", requirements: "features", initialScope: "features", 风险: "risks", assumptions: "risks", requirementsStatus: "risks", 暂不做: "outOfScope", 不做: "outOfScope", 任务: "tasks", 执行任务: "tasks" };
  const allowed = new Set(["title", "idea", "goal", "users", "scenarios", "technical", "features", "risks", "outOfScope", "tasks"]);
  const out: Record<string, string> = {};
  for (const [rawKey, rawVal] of Object.entries(source)) {
    if (rawKey === "scope" && rawVal && typeof rawVal === "object" && !Array.isArray(rawVal)) {
      const scope = rawVal as Record<string, unknown>;
      if (scope.included) out.features = guidedValueToText(scope.included);
      const pending = scope.notYetDecided ?? scope.outOfScope ?? scope.excluded;
      if (pending) out.outOfScope = guidedValueToText(pending);
      continue;
    }
    const key = keyMap[rawKey] ?? rawKey;
    if (allowed.has(key) && rawVal != null) out[key] = guidedValueToText(rawVal);
  }
  return out;
}, z.object({ title: z.string().max(120).optional(), idea: z.string().max(1200).optional(), goal: z.string().max(2000).optional(), users: z.string().max(1200).optional(), scenarios: z.string().max(3000).optional(), technical: z.string().max(3000).optional(), features: z.string().max(3000).optional(), risks: z.string().max(2200).optional(), outOfScope: z.string().max(2200).optional(), tasks: z.string().max(3000).optional() }).default({}));
const GuidedPracticeNextStageSchema = z.preprocess((value) => {
  if (typeof value !== "string") return "scenario";
  if (["goal", "scenario", "technical", "scope", "prd", "plan"].includes(value)) return value;
  if (["clarify", "clarification", "requirements", "requirement"].includes(value)) return "scenario";
  if (["tech", "architecture"].includes(value)) return "technical";
  if (["mvp", "scoping"].includes(value)) return "scope";
  return "scenario";
}, GuidedPracticeStageSchema);
const GuidedPracticeConfidenceSchema = z.preprocess((value) => {
  if (typeof value === "number") return value < 0.4 ? "low" : value > 0.75 ? "high" : "medium";
  return value === "low" || value === "medium" || value === "high" ? value : "medium";
}, z.enum(["low", "medium", "high"]).default("medium"));
const GuidedPracticeResultSchema = z.object({ reply: z.string().min(1).max(1200), draftPatch: GuidedPracticeDraftPatchSchema, nextStage: GuidedPracticeNextStageSchema, confidence: GuidedPracticeConfidenceSchema, openQuestions: z.array(z.string().min(1).max(240)).max(5).default([]) });
export type GuidedPracticeResult = z.infer<typeof GuidedPracticeResultSchema>;

export function runGreatMeBrain(adapter: AIAdapter, args: { mode: GreatMeMode; input: string; state: unknown } & ProjectOperationArgs): AsyncIterable<StructuredEvent<GreatMeBrainResult>> {
  return runStructuredAI(adapter, {
    prompt: withOperationContext(args, buildGreatMePrompt(args), "great-me", "planning"), signal: args.signal, validate: zodValidator(GreatMeBrainResultSchema),
    opLog: { op: "great-me", model: adapter.name, scope: { mode: args.mode, input: args.input.slice(0, 120) } },
  });
}

export function runDecomposePlan(adapter: AIAdapter, args: { intent: string; today: string; targetEnd?: string } & ProjectOperationArgs): AsyncIterable<StructuredEvent<DecomposePlanResult>> {
  return runStructuredAI(adapter, {
    prompt: withOperationContext(args, buildDecomposePlanPrompt(args), "decompose-plan", "planning"), signal: args.signal, validate: zodValidator(DecomposePlanResultSchema),
    opLog: { op: "decompose-plan", model: adapter.name, scope: { intent: args.intent.slice(0, 120), targetEnd: args.targetEnd } },
  });
}

export function runAnalyzeProgress(adapter: AIAdapter, args: { state: unknown; metrics: unknown } & ProjectOperationArgs): AsyncIterable<StructuredEvent<AnalyzeProgressResult>> {
  return runStructuredAI(adapter, {
    prompt: withOperationContext(args, buildAnalyzeProgressPrompt({ state: args.state, metrics: args.metrics as Parameters<typeof buildAnalyzeProgressPrompt>[0]["metrics"] }), "analyze-progress", "analysis"), signal: args.signal, validate: zodValidator(AnalyzeProgressResultSchema),
    opLog: { op: "analyze-progress", model: adapter.name, scope: {} },
  });
}

export function runDraftReview(adapter: AIAdapter, args: Parameters<typeof buildDraftReviewPrompt>[0] & ProjectOperationArgs): AsyncIterable<StructuredEvent<DraftReviewResult>> {
  return runStructuredAI(adapter, {
    prompt: withOperationContext(args, buildDraftReviewPrompt(args), "draft-review", "review"), signal: args.signal, validate: zodValidator(DraftReviewResultSchema),
    opLog: { op: "draft-review", model: adapter.name, scope: { weekOf: args.weekOf } },
  });
}

export function runGuidedPractice(adapter: AIAdapter, args: { stage: z.infer<typeof GuidedPracticeStageSchema>; userInput: string; draft: Parameters<typeof buildGuidedPracticePrompt>[0]["draft"]; messages: Parameters<typeof buildGuidedPracticePrompt>[0]["messages"] } & ProjectOperationArgs): AsyncIterable<StructuredEvent<GuidedPracticeResult>> {
  return runStructuredAI(adapter, {
    prompt: withOperationContext(args, buildGuidedPracticePrompt(args), "guided-practice", "project-practice"),
    systemPrompt: "You are a product requirements analyst inside Rich. Return exactly one valid JSON object with keys reply, draftPatch, nextStage, confidence, openQuestions. Do not use Markdown.",
    signal: args.signal, validate: zodValidator(GuidedPracticeResultSchema),
    opLog: { op: "guided-practice", model: adapter.name, scope: { stage: args.stage, userInput: args.userInput.slice(0, 120) } },
  });
}
