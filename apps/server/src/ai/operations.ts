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
