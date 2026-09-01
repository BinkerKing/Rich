import { z } from "zod";
import type { AIAdapter } from "./adapter.js";
import { runStructuredAI, type StructuredEvent } from "./runStructuredAI.js";
import { buildReviewPrompt } from "./prompts/review.js";
import { zodValidator } from "./structuredValidation.js";
export { analyzeAttachment, analyzeMark, attachUnder, expandElement, extendElement, extractKeywords, generatePathsFor, generateTreeFor, refineElement, refineSection } from "./knowledge/operations.js";
export type { AnalyzeAttachmentResult, AnalyzeMarkResult, AttachOption, ElementsAndRelationsResult as ExpandResult, ElementsAndRelationsResult as ExtendResult, ExtractKeywordsResult, GenerateTreeResult, PathResult, RefineResult, SectionRefineResult } from "./knowledge/operations.js";
export { runAnalyzeProgress, runDecomposePlan, runDraftReview, runGreatMeBrain } from "./project/operations.js";
export { runGuidedPractice } from "./project/operations.js";
export type { AnalyzeProgressResult, DecomposePlanResult, DraftReviewResult, GreatMeBrainResult, GuidedPracticeResult } from "./project/operations.js";
export { generateDailyNews, generateImageFor, generateMindmap } from "./content/operations.js";
export type { DailyNewsItem, GenerateDailyNewsResult, GenerateImageResult, GenerateMindmapResult } from "./content/operations.js";
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
