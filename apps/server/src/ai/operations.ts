import { z } from "zod";
import type { Element, RichnessLevel, PathKind } from "@ke/domain";
import {
  ElementSchema, RelationSchema, LearningPathSchema,
} from "@ke/domain";
import type { AIAdapter } from "./adapter.js";
import { runStructuredAI, type StructuredEvent } from "./runStructuredAI.js";
import { buildReviewPrompt } from "./prompts/review.js";
import { buildGenerateDailyNewsPrompt } from "./prompts/generateDailyNews.js";
import { buildGenerateImagePrompt } from "./prompts/generateImage.js";
import { buildGenerateMindmapPrompt } from "./prompts/generateMindmap.js";
import { buildDraftPrdPrompt } from "./prompts/draftPrd.js";
import { buildDraftChildPrompt } from "./prompts/draftChild.js";
import { buildAdjustChildPrompt } from "./prompts/adjustChild.js";
import { withOperationContext } from "./operationContext.js";
import { zodValidator } from "./structuredValidation.js";
export { analyzeAttachment, analyzeMark, attachUnder, expandElement, extendElement, extractKeywords, generatePathsFor, generateTreeFor, refineElement, refineSection } from "./knowledge/operations.js";
export type { AnalyzeAttachmentResult, AnalyzeMarkResult, AttachOption, ElementsAndRelationsResult as ExpandResult, ElementsAndRelationsResult as ExtendResult, ExtractKeywordsResult, GenerateTreeResult, PathResult, RefineResult, SectionRefineResult } from "./knowledge/operations.js";
export { runAnalyzeProgress, runDecomposePlan, runDraftReview, runGreatMeBrain } from "./project/operations.js";
export { runGuidedPractice } from "./project/operations.js";
export type { AnalyzeProgressResult, DecomposePlanResult, DraftReviewResult, GreatMeBrainResult, GuidedPracticeResult } from "./project/operations.js";
import type { AIManual } from "./manuals.js";
import type { Signal } from "@ke/domain";

// ----- Operation result schemas (what AI must produce) -----

const ReviewResultSchema = z.object({
  rules: z.array(z.object({
    text: z.string().min(1).max(120),
    rationale: z.string().optional(),
    date: z.string(),
  })).max(10),
});

export type ReviewResult = z.infer<typeof ReviewResultSchema>;

// AI 早报 — daily news generation result.
const NewsCategorySchema = z.enum([
  "能力突破", "应用产品", "大模型", "工具与开源",
  "研究论文", "政策与安全", "投融资", "国内动态",
]);
const NewsSourceSchema = z.object({
  cite: z.string().min(1).optional(),
  url: z.string().url().optional(),
  publishedAt: z.string().optional(),
});
const NewsBlockSchema = z.object({ style: z.string() }).passthrough();
const NewsSectionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  blocks: z.array(NewsBlockSchema).min(1),
});
const NewsItemSchema = z.object({
  title: z.string().min(2).max(80),
  subtitle: z.string().min(2).max(120),
  category: NewsCategorySchema,
  impact: z.enum(["major", "medium"]),
  sections: z.array(NewsSectionSchema).min(1),
});
const GenerateDailyNewsResultSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  editorNote: z.string().min(20).max(400),
  items: z.array(NewsItemSchema).min(3).max(12),
});
export type GenerateDailyNewsResult = z.infer<typeof GenerateDailyNewsResultSchema>;
export type DailyNewsItem = z.infer<typeof NewsItemSchema>;

// Dedicated image generation — one placeholder → one rendered image file.
const GenerateImageResultSchema = z.object({
  src: z.string().min(1),
  alt: z.string().min(1),
  caption: z.string().optional().default(""),
});
export type GenerateImageResult = z.infer<typeof GenerateImageResultSchema>;

// Mindmap PPT generation — see prompts/generateMindmap.ts
const MindmapImagePromptSchema = z.object({
  path: z.string().min(1),
  alt: z.string().optional().default(""),
  imagePrompt: z.string().optional().default(""),
});
const GenerateMindmapResultSchema = z.object({
  title: z.string().min(1).max(80),
  subtitle: z.string().max(160).optional().default(""),
  source: z.string().min(10),
  images: z.array(MindmapImagePromptSchema).max(20).optional().default([]),
});
export type GenerateMindmapResult = z.infer<typeof GenerateMindmapResultSchema>;

// Used by NewsSource discriminator above — keep schema referenced.
void NewsSourceSchema;

const GuidedPracticeStageSchema = z.enum(["goal", "scenario", "technical", "scope", "prd", "plan"]);
function guidedValueToText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    return value
      .map((item) => guidedValueToText(item))
      .map((item) => item.trim())
      .filter(Boolean)
      .join("\n");
  }
  if (typeof value === "object") {
    const source = value as Record<string, unknown>;
    const preferred = [
      "summary", "goal", "objective", "problem", "coreValue", "initialProductConcept",
      "testingObjective", "testObject", "testScope", "testMethod", "successCriteria",
      "title", "desc", "description", "body", "value", "raw",
    ];
    const lines: string[] = [];
    for (const key of preferred) {
      if (key in source) {
        const text = guidedValueToText(source[key]);
        if (text) lines.push(text);
      }
    }
    for (const [key, raw] of Object.entries(source)) {
      if (preferred.includes(key)) continue;
      const text = guidedValueToText(raw);
      if (text) lines.push(`${key}：${text}`);
    }
    return lines.join("\n");
  }
  return String(value);
}

const GuidedPracticeDraftPatchSchema = z.preprocess((value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const source = value as Record<string, unknown>;
  const keyMap: Record<string, string> = {
    标题: "title",
    项目标题: "title",
    projectName: "title",
    projectType: "title",
    原始想法: "idea",
    想法: "idea",
    background: "idea",
    背景: "idea",
    目标: "goal",
    项目目标: "goal",
    objective: "goal",
    用户: "users",
    目标用户: "users",
    使用者: "users",
    targetUsers: "users",
    场景: "scenarios",
    业务场景: "scenarios",
    useCases: "scenarios",
    initialRequirements: "scenarios",
    技术: "technical",
    技术分析: "technical",
    功能: "features",
    MVP功能: "features",
    coreRequirements: "features",
    requirements: "features",
    initialScope: "features",
    风险: "risks",
    assumptions: "risks",
    requirementsStatus: "risks",
    暂不做: "outOfScope",
    不做: "outOfScope",
    任务: "tasks",
    执行任务: "tasks",
  };
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
    if (![
      "title", "idea", "goal", "users", "scenarios", "technical",
      "features", "risks", "outOfScope", "tasks",
    ].includes(key)) continue;
    if (rawVal == null) continue;
    out[key] = guidedValueToText(rawVal);
  }
  return out;
}, z.object({
  title: z.string().max(120).optional(),
  idea: z.string().max(1200).optional(),
  goal: z.string().max(2000).optional(),
  users: z.string().max(1200).optional(),
  scenarios: z.string().max(3000).optional(),
  technical: z.string().max(3000).optional(),
  features: z.string().max(3000).optional(),
  risks: z.string().max(2200).optional(),
  outOfScope: z.string().max(2200).optional(),
  tasks: z.string().max(3000).optional(),
}).default({}));
const GuidedPracticeNextStageSchema = z.preprocess((value) => {
  if (typeof value !== "string") return "scenario";
  if (["goal", "scenario", "technical", "scope", "prd", "plan"].includes(value)) return value;
  if (["clarify", "clarification", "requirements", "requirement"].includes(value)) return "scenario";
  if (["tech", "architecture"].includes(value)) return "technical";
  if (["mvp", "scoping"].includes(value)) return "scope";
  return "scenario";
}, GuidedPracticeStageSchema);
const GuidedPracticeConfidenceSchema = z.preprocess((value) => {
  if (typeof value === "number") {
    if (value < 0.4) return "low";
    if (value > 0.75) return "high";
    return "medium";
  }
  if (value === "low" || value === "medium" || value === "high") return value;
  return "medium";
}, z.enum(["low", "medium", "high"]).default("medium"));
const GuidedPracticeResultSchema = z.object({
  reply: z.string().min(1).max(1200),
  draftPatch: GuidedPracticeDraftPatchSchema,
  nextStage: GuidedPracticeNextStageSchema,
  confidence: GuidedPracticeConfidenceSchema,
  openQuestions: z.array(z.string().min(1).max(240)).max(5).default([]),
});
type LegacyGuidedPracticeResult = z.infer<typeof GuidedPracticeResultSchema>;

interface SharedOpArgs {
  sessionId?: string;
  signal?: AbortSignal;
  /** Pre-formatted AI manual block (use manualToPromptFragment). Optional. */
  manual?: string;
  contextNotes?: string[];
}

// ----- Operations -----

export function reviewManual(
  adapter: AIAdapter,
  args: { manualName: string; manual: AIManual; signals: Signal[]; signal?: AbortSignal },
): AsyncIterable<StructuredEvent<ReviewResult>> {
  // Note: review never reuses a session (each review is independent), and it
  // doesn't take a manual fragment because the manual itself is the input.
  const prompt = buildReviewPrompt({
    manualName: args.manualName, manual: args.manual, signals: args.signals,
  });
  return runStructuredAI(adapter, {
    prompt, signal: args.signal, validate: zodValidator(ReviewResultSchema),
    opLog: { op: "review", model: adapter.name, scope: { manualName: args.manualName, signalCount: args.signals.length } },
  });
}

/** Daily AI 早报 generation. AI fetches today's real AI news from the web,
 *  curates 6-10 items by the user's editorial preferences (capability
 *  milestones & applied tools > model speed/price), and emits structured JSON.
 *  Server-side then materializes the response into a date-roundup parent
 *  element + N child news elements under `ai-news`. */
export function generateDailyNews(
  adapter: AIAdapter,
  args: { date: string } & SharedOpArgs,
): AsyncIterable<StructuredEvent<GenerateDailyNewsResult>> {
  const prompt = withOperationContext(
    args,
    buildGenerateDailyNewsPrompt({ date: args.date }),
    "generate-daily-news",
    "content",
  );
  return runStructuredAI(adapter, {
    prompt, signal: args.signal,
    validate: zodValidator(GenerateDailyNewsResultSchema),
    opLog: { op: "generate-daily-news", model: adapter.name, scope: { date: args.date } },
  });
}

/** Mindmap PPT generation. Takes prose (article / report / notes) and returns
 *  a Markdown indented tree + optional image placeholder list. The route
 *  materializes the result into a MindmapDeck and hands placeholders to the
 *  image queue. */
export function generateMindmap(
  adapter: AIAdapter,
  args: {
    prose: string;
    titleHint?: string;
    audience?: string;
    withImages?: boolean;
  } & SharedOpArgs,
): AsyncIterable<StructuredEvent<GenerateMindmapResult>> {
  const prompt = withOperationContext(args, buildGenerateMindmapPrompt({
    prose: args.prose,
    titleHint: args.titleHint,
    audience: args.audience,
    withImages: args.withImages,
  }), "generate-mindmap", "mindmap");
  return runStructuredAI(adapter, {
    prompt, signal: args.signal,
    validate: zodValidator(GenerateMindmapResultSchema),
    opLog: {
      op: "generate-mindmap", model: adapter.name,
      scope: { titleHint: args.titleHint, audience: args.audience, withImages: args.withImages, proseLength: args.prose.length },
    },
  });
}

// ----- Draft PRD (项目实战) -----
// AI 不确定时给用户列出的问题——支持 2-6 个选项，前端做选择卡片。
// 用在 draftPrd / draftChild / adjustChild 三种 op 的输出末尾。
export const InquirySchema = z.object({
  question: z.string().min(1).max(400),
  options: z.array(z.object({
    label: z.string().min(1).max(80),
    description: z.string().max(200).default(""),
  })).min(2).max(6),
  context: z.string().max(200).default(""),
  importance: z.enum(["blocker", "nice-to-know"]).default("nice-to-know"),
});
export type Inquiry = z.infer<typeof InquirySchema>;

const DraftPrdResultSchema = z.object({
  title: z.string().min(1).max(200),
  sections: z.object({
    overview: z.string().max(800),
    targetUsers: z.string().max(800),
    coreFeatures: z.array(z.string().max(280)).min(1).max(10),
    userStories: z.array(z.string().max(280)).max(10).default([]),
    acceptance: z.array(z.string().max(280)).max(10).default([]),
    nonFunctional: z.string().max(800).default(""),
    outOfScope: z.array(z.string().max(280)).max(10).default([]),
    risks: z.array(z.string().max(280)).max(10).default([]),
  }),
  inquiries: z.array(InquirySchema).default([]),
});
export type DraftPrdResult = z.infer<typeof DraftPrdResultSchema>;

export function runDraftPrd(
  adapter: AIAdapter,
  args: {
    practice: Parameters<typeof buildDraftPrdPrompt>[0]["practice"];
    children: Parameters<typeof buildDraftPrdPrompt>[0]["children"];
    extraContext?: string;
  } & SharedOpArgs,
): AsyncIterable<StructuredEvent<DraftPrdResult>> {
  const prompt = withOperationContext(args, buildDraftPrdPrompt({
    practice: args.practice,
    children: args.children,
    extraContext: args.extraContext,
  }), "draft-prd", "project-practice");
  return runStructuredAI(adapter, {
    prompt,
    signal: args.signal,
    validate: zodValidator(DraftPrdResultSchema),
    opLog: {
      op: "draft-prd",
      model: adapter.name,
      scope: { title: args.practice.title.slice(0, 80) },
    },
  });
}

// ====== draft-child：AI 起草项目实战的单个子元（知识点/场景分析/功能说明/开发任务） ======
const DraftChildResultSchema = z.object({
  title: z.string().min(1).max(200),
  subtitle: z.string().max(400).default(""),
  // content 留宽松——不同 type 字段不同；上层渲染靠 ChildElementModal 智能渲染。
  content: z.record(z.string(), z.union([z.string(), z.array(z.string()), z.null()])).default({}),
  // AI 写的时候碰到不确定点 → 列成 inquiries，上层会建成独立的 inquiry 元
  inquiries: z.array(InquirySchema).default([]),
});
export type DraftChildResult = z.infer<typeof DraftChildResultSchema>;

export function runDraftChild(
  adapter: AIAdapter,
  args: {
    practice: Parameters<typeof buildDraftChildPrompt>[0]["practice"];
    groupType: Parameters<typeof buildDraftChildPrompt>[0]["groupType"];
    existingTitles: string[];
    direction: string;
  } & SharedOpArgs,
): AsyncIterable<StructuredEvent<DraftChildResult>> {
  const prompt = withOperationContext(args, buildDraftChildPrompt({
    practice: args.practice,
    groupType: args.groupType,
    existingTitles: args.existingTitles,
    direction: args.direction,
  }), "draft-child", "project-practice");
  return runStructuredAI(adapter, {
    prompt,
    signal: args.signal,
    validate: zodValidator(DraftChildResultSchema),
    opLog: {
      op: "draft-child",
      model: adapter.name,
      scope: {
        title: args.practice.title.slice(0, 80),
        groupType: args.groupType,
      },
    },
  });
}

// ====== adjust-child：AI 基于"当前状态 + 调整方向"重写一个已有子元 ======
// 复用 DraftChildResultSchema —— 返回结构跟 draft 一致（title + subtitle + content + inquiries）
const AdjustChildResultSchema = z.object({
  title: z.string().min(1).max(200),
  subtitle: z.string().max(400).default(""),
  content: z.record(z.string(), z.union([z.string(), z.array(z.string()), z.null()])).default({}),
  inquiries: z.array(InquirySchema).default([]),
});
export type AdjustChildResult = z.infer<typeof AdjustChildResultSchema>;

export function runAdjustChild(
  adapter: AIAdapter,
  args: {
    practice: Parameters<typeof buildAdjustChildPrompt>[0]["practice"];
    groupType: Parameters<typeof buildAdjustChildPrompt>[0]["groupType"];
    current: Parameters<typeof buildAdjustChildPrompt>[0]["current"];
    direction: string;
  } & SharedOpArgs,
): AsyncIterable<StructuredEvent<AdjustChildResult>> {
  const prompt = withOperationContext(args, buildAdjustChildPrompt({
    practice: args.practice,
    groupType: args.groupType,
    current: args.current,
    direction: args.direction,
  }), "adjust-child", "project-practice");
  return runStructuredAI(adapter, {
    prompt,
    signal: args.signal,
    validate: zodValidator(AdjustChildResultSchema),
    opLog: {
      op: "adjust-child",
      model: adapter.name,
      scope: {
        title: args.practice.title.slice(0, 80),
        groupType: args.groupType,
        currentTitle: args.current.title.slice(0, 60),
      },
    },
  });
}

/** Dedicated image-gen op. The text-AI emits image-placeholder blocks; this
 *  op processes each placeholder via Codex's image_gen skill and returns
 *  { src, alt, caption }. The route then adopts the returned local file into
 *  /api/images/<elementId>/ and patches the element's content. */
export function generateImageFor(
  adapter: AIAdapter,
  args: {
    alt: string;
    caption?: string;
    imagePrompt?: string;
    surroundingText?: string;
    elementId?: string;
  } & SharedOpArgs,
): AsyncIterable<StructuredEvent<GenerateImageResult>> {
  const prompt = withOperationContext(args, buildGenerateImagePrompt({
    alt: args.alt, caption: args.caption,
    imagePrompt: args.imagePrompt, surroundingText: args.surroundingText,
  }), "generate-image", "image");
  return runStructuredAI(adapter, {
    prompt, signal: args.signal,
    validate: zodValidator(GenerateImageResultSchema),
    opLog: {
      op: "generate-image", model: adapter.name, elementId: args.elementId,
      scope: { alt: args.alt.slice(0, 60), hasPrompt: Boolean(args.imagePrompt) },
    },
  });
}
