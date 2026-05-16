import type { Element, Relation, LearningPath, RichnessLevel, PathKind } from "@ke/domain";
import type { AIAdapter } from "./adapter.js";
import { runStructuredAI, type StructuredEvent } from "./runStructuredAI.js";
import { buildRefinePrompt } from "./prompts/refine.js";
import { buildExpandPrompt } from "./prompts/expand.js";
import { buildExtendPrompt } from "./prompts/extend.js";
import { buildPathPrompt } from "./prompts/path.js";

function isObj(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

export interface RefineResult { content: unknown }
export interface ExpandResult { elements: Element[]; relations: Relation[] }
export interface ExtendResult { elements: Element[]; relations: Relation[] }
export interface PathResult { paths: LearningPath[] }

function validateRefine(parsed: unknown): RefineResult {
  if (!isObj(parsed) || !("content" in parsed)) throw new Error("Missing 'content' field");
  return { content: parsed.content };
}

function validateElementsAndRelations(parsed: unknown): { elements: Element[]; relations: Relation[] } {
  if (!isObj(parsed) || !Array.isArray(parsed.elements) || !Array.isArray(parsed.relations)) {
    throw new Error("Missing 'elements' or 'relations' array");
  }
  return { elements: parsed.elements as Element[], relations: parsed.relations as Relation[] };
}

function validatePaths(parsed: unknown): PathResult {
  if (!isObj(parsed) || !Array.isArray(parsed.paths)) throw new Error("Missing 'paths' array");
  return { paths: parsed.paths as LearningPath[] };
}

export function refineElement(
  adapter: AIAdapter,
  args: { element: Element; targetRichness: RichnessLevel; sessionId?: string },
): AsyncIterable<StructuredEvent<RefineResult>> {
  const prompt = buildRefinePrompt({ element: args.element, targetRichness: args.targetRichness });
  return runStructuredAI(adapter, { prompt, sessionId: args.sessionId, validate: validateRefine });
}

export function expandElement(
  adapter: AIAdapter,
  args: { parent: Element; existingChildren: Element[]; count?: number; sessionId?: string },
): AsyncIterable<StructuredEvent<ExpandResult>> {
  const prompt = buildExpandPrompt({ parent: args.parent, existingChildren: args.existingChildren, count: args.count });
  return runStructuredAI(adapter, { prompt, sessionId: args.sessionId, validate: validateElementsAndRelations });
}

export function extendElement(
  adapter: AIAdapter,
  args: { element: Element; direction: string; count?: number; sessionId?: string },
): AsyncIterable<StructuredEvent<ExtendResult>> {
  const prompt = buildExtendPrompt({ element: args.element, direction: args.direction, count: args.count });
  return runStructuredAI(adapter, { prompt, sessionId: args.sessionId, validate: validateElementsAndRelations });
}

export function generatePathsFor(
  adapter: AIAdapter,
  args: { center: Element; availableElements: Element[]; kinds: PathKind[]; sessionId?: string },
): AsyncIterable<StructuredEvent<PathResult>> {
  const prompt = buildPathPrompt({ center: args.center, availableElements: args.availableElements, kinds: args.kinds });
  return runStructuredAI(adapter, { prompt, sessionId: args.sessionId, validate: validatePaths });
}
