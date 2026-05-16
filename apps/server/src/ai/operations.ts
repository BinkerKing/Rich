import { z } from "zod";
import type { Element, RichnessLevel, PathKind } from "@ke/domain";
import {
  ElementSchema, RelationSchema, LearningPathSchema,
} from "@ke/domain";
import type { AIAdapter } from "./adapter.js";
import { runStructuredAI, type StructuredEvent } from "./runStructuredAI.js";
import { buildGenerateTreePrompt } from "./prompts/generateTree.js";
import { buildRefinePrompt } from "./prompts/refine.js";
import { buildExpandPrompt } from "./prompts/expand.js";
import { buildExtendPrompt } from "./prompts/extend.js";
import { buildPathPrompt } from "./prompts/path.js";
import { buildReviewPrompt } from "./prompts/review.js";
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

const ElementsAndRelationsSchema = z.object({
  elements: z.array(ElementSchema),
  relations: z.array(RelationSchema),
});

const PathResultSchema = z.object({
  paths: z.array(LearningPathSchema),
});

const ReviewResultSchema = z.object({
  rules: z.array(z.object({
    text: z.string().min(1).max(120),
    rationale: z.string().optional(),
    date: z.string(),
  })).max(10),
});

export type GenerateTreeResult = z.infer<typeof GenerateTreeResultSchema>;
export type RefineResult = z.infer<typeof RefineResultSchema>;
export type ExpandResult = z.infer<typeof ElementsAndRelationsSchema>;
export type ExtendResult = z.infer<typeof ElementsAndRelationsSchema>;
export type PathResult = z.infer<typeof PathResultSchema>;
export type ReviewResult = z.infer<typeof ReviewResultSchema>;

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
  return runStructuredAI(adapter, { prompt, signal: args.signal, validate: zodValidator(GenerateTreeResultSchema) });
}

export function refineElement(
  adapter: AIAdapter,
  args: { element: Element; targetRichness: RichnessLevel } & SharedOpArgs,
): AsyncIterable<StructuredEvent<RefineResult>> {
  const prompt = withManual(args.manual, buildRefinePrompt({
    element: args.element, targetRichness: args.targetRichness,
  }));
  return runStructuredAI(adapter, { prompt, sessionId: args.sessionId, signal: args.signal, validate: zodValidator(RefineResultSchema) });
}

export function expandElement(
  adapter: AIAdapter,
  args: { parent: Element; existingChildren: Element[]; count?: number } & SharedOpArgs,
): AsyncIterable<StructuredEvent<ExpandResult>> {
  const prompt = withManual(args.manual, buildExpandPrompt({
    parent: args.parent, existingChildren: args.existingChildren, count: args.count,
  }));
  return runStructuredAI(adapter, { prompt, sessionId: args.sessionId, signal: args.signal, validate: zodValidator(ElementsAndRelationsSchema) });
}

export function extendElement(
  adapter: AIAdapter,
  args: { element: Element; direction: string; count?: number } & SharedOpArgs,
): AsyncIterable<StructuredEvent<ExtendResult>> {
  const prompt = withManual(args.manual, buildExtendPrompt({
    element: args.element, direction: args.direction, count: args.count,
  }));
  return runStructuredAI(adapter, { prompt, sessionId: args.sessionId, signal: args.signal, validate: zodValidator(ElementsAndRelationsSchema) });
}

export function generatePathsFor(
  adapter: AIAdapter,
  args: { center: Element; availableElements: Element[]; kinds: PathKind[] } & SharedOpArgs,
): AsyncIterable<StructuredEvent<PathResult>> {
  const prompt = withManual(args.manual, buildPathPrompt({
    center: args.center, availableElements: args.availableElements, kinds: args.kinds,
  }));
  return runStructuredAI(adapter, { prompt, sessionId: args.sessionId, signal: args.signal, validate: zodValidator(PathResultSchema) });
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
  return runStructuredAI(adapter, { prompt, signal: args.signal, validate: zodValidator(ReviewResultSchema) });
}
