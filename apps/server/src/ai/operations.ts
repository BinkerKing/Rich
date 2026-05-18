import { z } from "zod";
import type { Element, RichnessLevel, PathKind } from "@ke/domain";
import {
  ElementSchema, RelationSchema, LearningPathSchema,
} from "@ke/domain";
import type { AIAdapter } from "./adapter.js";
import { runStructuredAI, type StructuredEvent } from "./runStructuredAI.js";
import { buildGenerateTreePrompt } from "./prompts/generateTree.js";
import { buildRefinePrompt } from "./prompts/refine.js";
import { buildSectionRefinePrompt } from "./prompts/sectionRefine.js";
import { buildExpandPrompt } from "./prompts/expand.js";
import { buildExtendPrompt } from "./prompts/extend.js";
import { buildPathPrompt } from "./prompts/path.js";
import { buildReviewPrompt } from "./prompts/review.js";
import { buildAnalyzeMarkPrompt } from "./prompts/analyzeMark.js";
import { buildExtractKeywordsPrompt } from "./prompts/extractKeywords.js";
import { buildAnalyzeAttachmentPrompt, type CandidateElement } from "./prompts/analyzeAttachment.js";
import type { AIManual } from "./manuals.js";
import type { Signal } from "@ke/domain";

// ----- Operation result schemas (what AI must produce) -----

const GenerateTreeResultSchema = z.object({
  rootId: z.string().min(1),
  elements: z.array(ElementSchema).min(1),
  relations: z.array(RelationSchema),
  paths: z.array(LearningPathSchema),
});

const RefineResultSchema = z.object({
  content: z.unknown(),
});

// Section-scoped refinement: AI returns ONLY the updated section JSON.
// The server merges it back into element.content.sections by id — AI has
// no way to touch other sections or other content fields.
const SectionRefineResultSchema = z.object({
  section: z.object({
    id: z.string().min(1),
    title: z.string().min(1),
    blocks: z.array(z.unknown()),
  }),
});

const ElementsAndRelationsSchema = z.object({
  elements: z.array(ElementSchema),
  relations: z.array(RelationSchema),
});

const PathResultSchema = z.object({
  paths: z.array(LearningPathSchema),
});

const AnalyzeMarkResultSchema = z.object({
  title: z.string().min(1).max(60),
  body: z.string().min(1),
});

const ReviewResultSchema = z.object({
  rules: z.array(z.object({
    text: z.string().min(1).max(120),
    rationale: z.string().optional(),
    date: z.string(),
  })).max(10),
});

const ElementTypeSchema = z.enum(["topic", "concept", "practice", "project", "step", "exercise", "product-design", "summary"]);

const ExtractKeywordsResultSchema = z.object({
  keywords: z.array(z.string().min(1).max(20)).min(1).max(8),
  type: ElementTypeSchema,
  intent: z.string().min(1).max(80),
});

const Confidence = z.enum(["low", "medium", "high"]);
const AttachOptionSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("new-topic"),
    confidence: Confidence,
    reasoning: z.string().min(1).max(120),
  }),
  z.object({
    kind: z.literal("attach-direct"),
    parentId: z.string().min(1),
    confidence: Confidence,
    reasoning: z.string().min(1).max(160),
  }),
  z.object({
    kind: z.literal("attach-with-bridge"),
    parentId: z.string().min(1),
    bridges: z.array(z.string().min(1).max(40)).min(1).max(2),
    confidence: Confidence,
    reasoning: z.string().min(1).max(200),
  }),
]);
const AnalyzeAttachmentResultSchema = z.object({
  type: ElementTypeSchema,
  options: z.array(AttachOptionSchema).min(1).max(3),
});

export type GenerateTreeResult = z.infer<typeof GenerateTreeResultSchema>;
export type RefineResult = z.infer<typeof RefineResultSchema>;
export type SectionRefineResult = z.infer<typeof SectionRefineResultSchema>;
export type ExpandResult = z.infer<typeof ElementsAndRelationsSchema>;
export type ExtendResult = z.infer<typeof ElementsAndRelationsSchema>;
export type PathResult = z.infer<typeof PathResultSchema>;
export type ReviewResult = z.infer<typeof ReviewResultSchema>;
export type AnalyzeMarkResult = z.infer<typeof AnalyzeMarkResultSchema>;
export type ExtractKeywordsResult = z.infer<typeof ExtractKeywordsResultSchema>;
export type AnalyzeAttachmentResult = z.infer<typeof AnalyzeAttachmentResultSchema>;
export type AttachOption = z.infer<typeof AttachOptionSchema>;

// Build a validator that throws a readable error (zod gives field paths automatically).
function zodValidator<T>(schema: z.ZodSchema<T>): (parsed: unknown) => T {
  return (parsed) => {
    const result = schema.safeParse(parsed);
    if (!result.success) {
      const issues = result.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).slice(0, 3).join("; ");
      throw new Error(`schema validation failed (${issues})`);
    }
    return result.data;
  };
}

function withManual(manual: string | undefined, taskPrompt: string): string {
  return manual ? `${manual}${taskPrompt}` : taskPrompt;
}

interface SharedOpArgs {
  sessionId?: string;
  signal?: AbortSignal;
  /** Pre-formatted AI manual block (use manualToPromptFragment). Optional. */
  manual?: string;
}

// ----- Operations -----

export function generateTreeFor(
  adapter: AIAdapter,
  args: { topic: string; richness?: RichnessLevel } & SharedOpArgs,
): AsyncIterable<StructuredEvent<GenerateTreeResult>> {
  const prompt = withManual(args.manual, buildGenerateTreePrompt({
    topic: args.topic, richness: args.richness ?? 2,
  }));
  return runStructuredAI(adapter, {
    prompt, signal: args.signal, validate: zodValidator(GenerateTreeResultSchema),
    opLog: { op: "generate", model: adapter.name, scope: { topic: args.topic, richness: args.richness } },
  });
}

export function refineElement(
  adapter: AIAdapter,
  args: { element: Element; targetRichness: RichnessLevel; direction?: string } & SharedOpArgs,
): AsyncIterable<StructuredEvent<RefineResult>> {
  const prompt = withManual(args.manual, buildRefinePrompt({
    element: args.element, targetRichness: args.targetRichness, direction: args.direction,
  }));
  return runStructuredAI(adapter, {
    prompt, sessionId: args.sessionId, signal: args.signal, validate: zodValidator(RefineResultSchema),
    opLog: { op: "refine", model: adapter.name, elementId: args.element.id, scope: { targetRichness: args.targetRichness, direction: args.direction } },
  });
}

/** Section-scoped refine: AI sees only one section and outputs only that
 *  section's new JSON. The route handler merges it back by id. */
export function refineSection(
  adapter: AIAdapter,
  args: {
    element: Element;
    section: { id: string; title: string; blocks: unknown[] };
    direction: string;
  } & SharedOpArgs,
): AsyncIterable<StructuredEvent<SectionRefineResult>> {
  const prompt = withManual(args.manual, buildSectionRefinePrompt({
    element: args.element, section: args.section, direction: args.direction,
  }));
  return runStructuredAI(adapter, {
    prompt, sessionId: args.sessionId, signal: args.signal, validate: zodValidator(SectionRefineResultSchema),
    opLog: { op: "section-refine", model: adapter.name, elementId: args.element.id, scope: { sectionId: args.section.id, direction: args.direction } },
  });
}

export function expandElement(
  adapter: AIAdapter,
  args: { parent: Element; existingChildren: Element[]; count?: number; direction?: string; maxDepth?: number } & SharedOpArgs,
): AsyncIterable<StructuredEvent<ExpandResult>> {
  const prompt = withManual(args.manual, buildExpandPrompt({
    parent: args.parent, existingChildren: args.existingChildren,
    count: args.count, direction: args.direction, maxDepth: args.maxDepth,
  }));
  return runStructuredAI(adapter, {
    prompt, sessionId: args.sessionId, signal: args.signal, validate: zodValidator(ElementsAndRelationsSchema),
    opLog: { op: "expand", model: adapter.name, elementId: args.parent.id, scope: { count: args.count, direction: args.direction, maxDepth: args.maxDepth } },
  });
}

export function extendElement(
  adapter: AIAdapter,
  args: { element: Element; direction: string; count?: number } & SharedOpArgs,
): AsyncIterable<StructuredEvent<ExtendResult>> {
  const prompt = withManual(args.manual, buildExtendPrompt({
    element: args.element, direction: args.direction, count: args.count,
  }));
  return runStructuredAI(adapter, {
    prompt, sessionId: args.sessionId, signal: args.signal, validate: zodValidator(ElementsAndRelationsSchema),
    opLog: { op: "extend", model: adapter.name, elementId: args.element.id, scope: { count: args.count, direction: args.direction } },
  });
}

export function analyzeMark(
  adapter: AIAdapter,
  args: {
    element: Element;
    markedText: string;
    contextBefore?: string;
    contextAfter?: string;
    hint?: string;
  } & SharedOpArgs,
): AsyncIterable<StructuredEvent<AnalyzeMarkResult>> {
  const prompt = withManual(args.manual, buildAnalyzeMarkPrompt({
    element: args.element,
    markedText: args.markedText,
    contextBefore: args.contextBefore,
    contextAfter: args.contextAfter,
    hint: args.hint,
  }));
  return runStructuredAI(adapter, {
    prompt, sessionId: args.sessionId, signal: args.signal, validate: zodValidator(AnalyzeMarkResultSchema),
    opLog: { op: "analyze-mark", model: adapter.name, elementId: args.element.id, scope: { markedText: args.markedText.slice(0, 80) } },
  });
}

export function generatePathsFor(
  adapter: AIAdapter,
  args: { center: Element; availableElements: Element[]; kinds: PathKind[] } & SharedOpArgs,
): AsyncIterable<StructuredEvent<PathResult>> {
  const prompt = withManual(args.manual, buildPathPrompt({
    center: args.center, availableElements: args.availableElements, kinds: args.kinds,
  }));
  return runStructuredAI(adapter, {
    prompt, sessionId: args.sessionId, signal: args.signal, validate: zodValidator(PathResultSchema),
    opLog: { op: "path", model: adapter.name, elementId: args.center.id, scope: { kinds: args.kinds } },
  });
}

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

/** Step 1: AI extracts keywords + type guess + intent from raw user input. */
export function extractKeywords(
  adapter: AIAdapter,
  args: { text: string; signal?: AbortSignal },
): AsyncIterable<StructuredEvent<ExtractKeywordsResult>> {
  const prompt = buildExtractKeywordsPrompt({ text: args.text });
  return runStructuredAI(adapter, {
    prompt, signal: args.signal, validate: zodValidator(ExtractKeywordsResultSchema),
    opLog: { op: "extract-keywords", model: adapter.name, scope: { text: args.text.slice(0, 80) } },
  });
}

/** Step 2: AI proposes 1-3 attachment options given the user input + a
 *  program-shortlisted candidate set. The user picks one on the client. */
export function analyzeAttachment(
  adapter: AIAdapter,
  args: {
    text: string;
    keywords: string[];
    intent: string;
    suggestedType: import("@ke/domain").ElementType;
    candidates: CandidateElement[];
    signal?: AbortSignal;
  },
): AsyncIterable<StructuredEvent<AnalyzeAttachmentResult>> {
  const prompt = buildAnalyzeAttachmentPrompt({
    text: args.text, keywords: args.keywords, intent: args.intent,
    suggestedType: args.suggestedType, candidates: args.candidates,
  });
  return runStructuredAI(adapter, {
    prompt, signal: args.signal, validate: zodValidator(AnalyzeAttachmentResultSchema),
    opLog: { op: "analyze-attachment", model: adapter.name, scope: { text: args.text.slice(0, 80), candidateCount: args.candidates.length } },
  });
}
