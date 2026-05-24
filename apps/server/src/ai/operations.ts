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
import { buildAttachUnderPrompt } from "./prompts/attachUnder.js";
import { buildGenerateDailyNewsPrompt } from "./prompts/generateDailyNews.js";
import { buildGenerateImagePrompt } from "./prompts/generateImage.js";
import { buildGenerateMindmapPrompt } from "./prompts/generateMindmap.js";
import { buildGreatMePrompt, type GreatMeMode } from "./prompts/greatMe.js";
import { buildDecomposePlanPrompt } from "./prompts/decomposePlan.js";
import { buildAnalyzeProgressPrompt } from "./prompts/analyzeProgress.js";
import { buildDraftReviewPrompt } from "./prompts/draftReview.js";
import { buildDraftPrdPrompt } from "./prompts/draftPrd.js";
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
  topic: z.string().min(1).max(40),
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

const GreatMeModeSchema = z.enum(["goal", "mission", "review", "week-simulation"]);
const GreatMeLaneSchema = z.enum(["主线任务", "能力突破", "健康能量", "关系连接", "财富系统", "创造输出"]);
const GreatMeAxisSchema = z.enum(["body", "mind", "wealth", "craft", "relations", "creation"]);
const GreatMePdcaSchema = z.object({
  plan: z.string().optional().default(""),
  do: z.string().optional().default(""),
  check: z.string().optional().default(""),
  act: z.string().optional().default(""),
}).partial().default({});
const GreatMeBrainResultSchema = z.object({
  mode: GreatMeModeSchema,
  title: z.string().min(1).max(48),
  summary: z.string().min(1).max(500),
  focus: z.string().min(1).max(160),
  risks: z.array(z.string().min(1).max(140)).max(6).default([]),
  nextActions: z.array(z.string().min(1).max(140)).max(8).default([]),
  missions: z.array(z.object({
    title: z.string().min(1).max(120),
    lane: GreatMeLaneSchema.default("主线任务"),
    impact: z.number().int().min(0).max(100).default(70),
    effort: z.number().int().min(0).max(100).default(35),
    reason: z.string().max(180).optional().default(""),
  })).max(8).default([]),
  pdca: GreatMePdcaSchema,
  axisAdjustments: z.array(z.object({
    axis: GreatMeAxisSchema,
    delta: z.number().int().min(-10).max(10),
    reason: z.string().min(1).max(140),
  })).max(6).default([]),
  weekSimulation: z.array(z.object({
    day: z.number().int().min(1).max(7),
    theme: z.string().min(1).max(80),
    mission: z.string().min(1).max(140),
    evidence: z.string().min(1).max(140),
    review: z.string().min(1).max(180),
  })).max(7).default([]),
});
export type GreatMeBrainResult = z.infer<typeof GreatMeBrainResultSchema>;
// Used by NewsSource discriminator above — keep schema referenced.
void NewsSourceSchema;

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

/** Strict attach: creates either 1 leaf or a vertical chain of N elements
 *  under a chosen parent — no intermediate classifier, no auto-grandchildren,
 *  no horizontal siblings. Used by the home-page input-analysis flow. */
export function attachUnder(
  adapter: AIAdapter,
  args: {
    parent: Element;
    mode: "leaf" | "chain";
    leafTitle?: string;
    chain?: string[];
    fullIntent: string;
    richness?: RichnessLevel;
  } & SharedOpArgs,
): AsyncIterable<StructuredEvent<ExpandResult>> {
  const prompt = withManual(args.manual, buildAttachUnderPrompt({
    parent: args.parent, mode: args.mode,
    leafTitle: args.leafTitle, chain: args.chain,
    fullIntent: args.fullIntent,
    richness: args.richness ?? 2,
  }));
  return runStructuredAI(adapter, {
    prompt, sessionId: args.sessionId, signal: args.signal,
    validate: zodValidator(ElementsAndRelationsSchema),
    opLog: { op: "attach-under", model: adapter.name, elementId: args.parent.id, scope: { mode: args.mode, leafTitle: args.leafTitle, chain: args.chain, richness: args.richness } },
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
  const prompt = buildGenerateDailyNewsPrompt({ date: args.date });
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
  const prompt = buildGenerateMindmapPrompt({
    prose: args.prose,
    titleHint: args.titleHint,
    audience: args.audience,
    withImages: args.withImages,
  });
  return runStructuredAI(adapter, {
    prompt, signal: args.signal,
    validate: zodValidator(GenerateMindmapResultSchema),
    opLog: {
      op: "generate-mindmap", model: adapter.name,
      scope: { titleHint: args.titleHint, audience: args.audience, withImages: args.withImages, proseLength: args.prose.length },
    },
  });
}

export function runGreatMeBrain(
  adapter: AIAdapter,
  args: {
    mode: GreatMeMode;
    input: string;
    state: unknown;
  } & SharedOpArgs,
): AsyncIterable<StructuredEvent<GreatMeBrainResult>> {
  const prompt = buildGreatMePrompt({
    mode: args.mode,
    input: args.input,
    state: args.state,
  });
  return runStructuredAI(adapter, {
    prompt,
    signal: args.signal,
    validate: zodValidator(GreatMeBrainResultSchema),
    opLog: {
      op: "great-me",
      model: adapter.name,
      scope: { mode: args.mode, input: args.input.slice(0, 120) },
    },
  });
}

// ----- Plan decomposition (Stage 3) -----
// AI receives an intent + today + optional target end date, and emits a
// plan → goals → tasks tree with tempIds that the client converts to UIDs.

const ISO_DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");
const PlanScopeSchema = z.enum(["year", "month", "week", "day"]);
const PlanMetricSchema = z.object({
  unit: z.string().min(1).max(20),
  target: z.number(),
}).optional();

const DecomposePlanResultSchema = z.object({
  plan: z.object({
    title: z.string().min(1).max(200),
    detail: z.string().max(800).default(""),
    start: ISO_DATE,
    end: ISO_DATE,
    scopes: z.array(PlanScopeSchema).min(1).max(4),
  }),
  goals: z.array(z.object({
    tempId: z.string().min(1).max(40),
    scope: z.enum(["year", "month", "week"]),
    title: z.string().min(1).max(280),
    detail: z.string().max(800).default(""),
    due: ISO_DATE,
    parentTempId: z.string().max(40).optional(),
    metric: PlanMetricSchema,
  })).max(100),
  tasks: z.array(z.object({
    title: z.string().min(1).max(280),
    date: ISO_DATE,
    goalTempId: z.string().max(40).optional(),
    badge: z.string().max(20).default(""),
    note: z.string().max(400).default(""),
  })).max(200),
  reasoning: z.string().max(800).default(""),
});
export type DecomposePlanResult = z.infer<typeof DecomposePlanResultSchema>;

export function runDecomposePlan(
  adapter: AIAdapter,
  args: {
    intent: string;
    today: string;
    targetEnd?: string;
  } & SharedOpArgs,
): AsyncIterable<StructuredEvent<DecomposePlanResult>> {
  const prompt = buildDecomposePlanPrompt({
    intent: args.intent,
    today: args.today,
    targetEnd: args.targetEnd,
  });
  return runStructuredAI(adapter, {
    prompt,
    signal: args.signal,
    validate: zodValidator(DecomposePlanResultSchema),
    opLog: {
      op: "decompose-plan",
      model: adapter.name,
      scope: { intent: args.intent.slice(0, 120), targetEnd: args.targetEnd },
    },
  });
}

// ----- Progress analysis (任务推进卡点 + 推进策略) -----
const AnalyzeProgressResultSchema = z.object({
  keyInsight: z.string().min(1).max(400),
  blockers: z.array(z.string().min(1).max(280)).max(8).default([]),
  pushActions: z.array(z.string().min(1).max(280)).max(8).default([]),
  priorityTasks: z.array(z.object({
    title: z.string().min(1).max(160),
    reason: z.string().max(280).default(""),
  })).max(5).default([]),
});
export type AnalyzeProgressResult = z.infer<typeof AnalyzeProgressResultSchema>;

export function runAnalyzeProgress(
  adapter: AIAdapter,
  args: {
    state: unknown;
    metrics: unknown;
  } & SharedOpArgs,
): AsyncIterable<StructuredEvent<AnalyzeProgressResult>> {
  const prompt = buildAnalyzeProgressPrompt({
    state: args.state,
    metrics: args.metrics as Parameters<typeof buildAnalyzeProgressPrompt>[0]["metrics"],
  });
  return runStructuredAI(adapter, {
    prompt,
    signal: args.signal,
    validate: zodValidator(AnalyzeProgressResultSchema),
    opLog: {
      op: "analyze-progress",
      model: adapter.name,
      scope: {},
    },
  });
}

// ----- Draft weekly review (multi-perspective) -----
const DraftReviewResultSchema = z.object({
  score: z.number().int().min(0).max(100),
  victory: z.array(z.string().max(280)).max(10).default([]),
  blocker: z.array(z.string().max(280)).max(10).default([]),
  planning: z.array(z.string().max(280)).max(10).default([]),
  summary: z.string().max(2000),
  perspectives: z.array(z.object({
    dimension: z.string().min(1).max(40),
    content: z.string().max(800),
  })).max(8).default([]),
});
export type DraftReviewResult = z.infer<typeof DraftReviewResultSchema>;

export function runDraftReview(
  adapter: AIAdapter,
  args: {
    weekOf: string;
    weekTasks: unknown;
    weekGoals: unknown;
    activePlans: unknown;
    lastReview?: unknown;
    metrics: Parameters<typeof buildDraftReviewPrompt>[0]["metrics"];
  } & SharedOpArgs,
): AsyncIterable<StructuredEvent<DraftReviewResult>> {
  const prompt = buildDraftReviewPrompt({
    weekOf: args.weekOf,
    weekTasks: args.weekTasks,
    weekGoals: args.weekGoals,
    activePlans: args.activePlans,
    lastReview: args.lastReview,
    metrics: args.metrics,
  });
  return runStructuredAI(adapter, {
    prompt,
    signal: args.signal,
    validate: zodValidator(DraftReviewResultSchema),
    opLog: {
      op: "draft-review",
      model: adapter.name,
      scope: { weekOf: args.weekOf },
    },
  });
}

// ----- Draft PRD (项目实战) -----
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
  const prompt = buildDraftPrdPrompt({
    practice: args.practice,
    children: args.children,
    extraContext: args.extraContext,
  });
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
  const prompt = buildGenerateImagePrompt({
    alt: args.alt, caption: args.caption,
    imagePrompt: args.imagePrompt, surroundingText: args.surroundingText,
  });
  return runStructuredAI(adapter, {
    prompt, signal: args.signal,
    validate: zodValidator(GenerateImageResultSchema),
    opLog: {
      op: "generate-image", model: adapter.name, elementId: args.elementId,
      scope: { alt: args.alt.slice(0, 60), hasPrompt: Boolean(args.imagePrompt) },
    },
  });
}
