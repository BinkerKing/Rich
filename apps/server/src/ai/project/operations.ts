import { z } from "zod";
import type { AIAdapter } from "../adapter.js";
import { withOperationContext, type OperationPromptArgs } from "../operationContext.js";
import { runStructuredAI, type StructuredEvent } from "../runStructuredAI.js";
import { zodValidator } from "../structuredValidation.js";
import { buildGreatMePrompt, type GreatMeMode } from "../prompts/greatMe.js";
import { buildDecomposePlanPrompt } from "../prompts/decomposePlan.js";
import { buildAnalyzeProgressPrompt } from "../prompts/analyzeProgress.js";
import { buildDraftReviewPrompt } from "../prompts/draftReview.js";

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
