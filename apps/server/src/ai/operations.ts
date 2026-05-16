import { z } from "zod";
import type { Element, RichnessLevel, PathKind } from "@ke/domain";
import {
  ElementSchema, RelationSchema, LearningPathSchema,
} from "@ke/domain";
import type { AIAdapter } from "./adapter.js";
import { runStructuredAI, type StructuredEvent } from "./runStructuredAI.js";
import { buildRefinePrompt } from "./prompts/refine.js";
import { buildExpandPrompt } from "./prompts/expand.js";
import { buildExtendPrompt } from "./prompts/extend.js";
import { buildPathPrompt } from "./prompts/path.js";

// ----- Operation result schemas (what AI must produce) -----

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

export type RefineResult = z.infer<typeof RefineResultSchema>;
export type ExpandResult = z.infer<typeof ElementsAndRelationsSchema>;
export type ExtendResult = z.infer<typeof ElementsAndRelationsSchema>;
export type PathResult = z.infer<typeof PathResultSchema>;

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

// ----- Operations -----

export function refineElement(
  adapter: AIAdapter,
  args: { element: Element; targetRichness: RichnessLevel; sessionId?: string },
): AsyncIterable<StructuredEvent<RefineResult>> {
  const prompt = buildRefinePrompt({ element: args.element, targetRichness: args.targetRichness });
  return runStructuredAI(adapter, { prompt, sessionId: args.sessionId, validate: zodValidator(RefineResultSchema) });
}

export function expandElement(
  adapter: AIAdapter,
  args: { parent: Element; existingChildren: Element[]; count?: number; sessionId?: string },
): AsyncIterable<StructuredEvent<ExpandResult>> {
  const prompt = buildExpandPrompt({ parent: args.parent, existingChildren: args.existingChildren, count: args.count });
  return runStructuredAI(adapter, { prompt, sessionId: args.sessionId, validate: zodValidator(ElementsAndRelationsSchema) });
}

export function extendElement(
  adapter: AIAdapter,
  args: { element: Element; direction: string; count?: number; sessionId?: string },
): AsyncIterable<StructuredEvent<ExtendResult>> {
  const prompt = buildExtendPrompt({ element: args.element, direction: args.direction, count: args.count });
  return runStructuredAI(adapter, { prompt, sessionId: args.sessionId, validate: zodValidator(ElementsAndRelationsSchema) });
}

export function generatePathsFor(
  adapter: AIAdapter,
  args: { center: Element; availableElements: Element[]; kinds: PathKind[]; sessionId?: string },
): AsyncIterable<StructuredEvent<PathResult>> {
  const prompt = buildPathPrompt({ center: args.center, availableElements: args.availableElements, kinds: args.kinds });
  return runStructuredAI(adapter, { prompt, sessionId: args.sessionId, validate: zodValidator(PathResultSchema) });
}
