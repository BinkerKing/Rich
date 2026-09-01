import { z } from "zod";
import {
  ElementSchema,
  LearningPathSchema,
  RelationSchema,
  type Element,
  type PathKind,
  type RichnessLevel,
} from "@ke/domain";
import type { AIAdapter } from "../adapter.js";
import { withOperationContext, type OperationPromptArgs } from "../operationContext.js";
import { runStructuredAI, type StructuredEvent } from "../runStructuredAI.js";
import { zodValidator } from "../structuredValidation.js";
import { buildGenerateTreePrompt } from "../prompts/generateTree.js";
import { buildRefinePrompt } from "../prompts/refine.js";
import { buildSectionRefinePrompt } from "../prompts/sectionRefine.js";
import { buildExpandPrompt } from "../prompts/expand.js";
import { buildExtendPrompt } from "../prompts/extend.js";
import { buildAnalyzeMarkPrompt } from "../prompts/analyzeMark.js";
import { buildPathPrompt } from "../prompts/path.js";
import { buildAttachUnderPrompt } from "../prompts/attachUnder.js";
import { validateGeneratedTree, type GeneratedTree } from "./generatedTreeValidator.js";

export type GenerateTreeResult = GeneratedTree;
export type RefineResult = { content: unknown };
export type SectionRefineResult = { section: { id: string; title: string; blocks: unknown[] } };
export type ElementsAndRelationsResult = { elements: Element[]; relations: import("@ke/domain").Relation[] };
export type PathResult = { paths: import("@ke/domain").LearningPath[] };
export type AnalyzeMarkResult = { title: string; body: string };

type KnowledgeOperationArgs = OperationPromptArgs & { sessionId?: string; signal?: AbortSignal };

const RefineResultSchema = z.object({ content: z.unknown() });
const SectionRefineResultSchema = z.object({
  section: z.object({ id: z.string().min(1), title: z.string().min(1), blocks: z.array(z.unknown()) }),
});
const ElementsAndRelationsSchema = z.object({ elements: z.array(ElementSchema), relations: z.array(RelationSchema) });
const PathResultSchema = z.object({ paths: z.array(LearningPathSchema) });
const AnalyzeMarkResultSchema = z.object({ title: z.string().min(1).max(60), body: z.string().min(1) });

export function generateTreeFor(
  adapter: AIAdapter,
  args: { topic: string; richness?: RichnessLevel; signal?: AbortSignal } & OperationPromptArgs,
): AsyncIterable<StructuredEvent<GenerateTreeResult>> {
  const prompt = withOperationContext(args, buildGenerateTreePrompt({
    topic: args.topic, richness: args.richness ?? 2,
  }), "generate-tree", "knowledge");
  return runStructuredAI(adapter, {
    prompt,
    signal: args.signal,
    validate: validateGeneratedTree,
    opLog: { op: "generate", model: adapter.name, scope: { topic: args.topic, richness: args.richness } },
  });
}

export function refineElement(
  adapter: AIAdapter,
  args: { element: Element; targetRichness: RichnessLevel; direction?: string } & KnowledgeOperationArgs,
): AsyncIterable<StructuredEvent<RefineResult>> {
  const prompt = withOperationContext(args, buildRefinePrompt(args), "refine", "knowledge");
  return runStructuredAI(adapter, {
    prompt, sessionId: args.sessionId, signal: args.signal, validate: zodValidator(RefineResultSchema),
    opLog: { op: "refine", model: adapter.name, elementId: args.element.id, scope: { targetRichness: args.targetRichness, direction: args.direction } },
  });
}

export function refineSection(
  adapter: AIAdapter,
  args: { element: Element; section: { id: string; title: string; blocks: unknown[] }; direction: string } & KnowledgeOperationArgs,
): AsyncIterable<StructuredEvent<SectionRefineResult>> {
  const prompt = withOperationContext(args, buildSectionRefinePrompt(args), "section-refine", "review");
  return runStructuredAI(adapter, {
    prompt, sessionId: args.sessionId, signal: args.signal, validate: zodValidator(SectionRefineResultSchema),
    opLog: { op: "section-refine", model: adapter.name, elementId: args.element.id, scope: { sectionId: args.section.id, direction: args.direction } },
  });
}

export function expandElement(
  adapter: AIAdapter,
  args: { parent: Element; existingChildren: Element[]; count?: number; direction?: string; maxDepth?: number } & KnowledgeOperationArgs,
): AsyncIterable<StructuredEvent<ElementsAndRelationsResult>> {
  const prompt = withOperationContext(args, buildExpandPrompt(args), "expand", "knowledge");
  return runStructuredAI(adapter, {
    prompt, sessionId: args.sessionId, signal: args.signal, validate: zodValidator(ElementsAndRelationsSchema),
    opLog: { op: "expand", model: adapter.name, elementId: args.parent.id, scope: { count: args.count, direction: args.direction, maxDepth: args.maxDepth } },
  });
}

export function extendElement(
  adapter: AIAdapter,
  args: { element: Element; direction: string; count?: number } & KnowledgeOperationArgs,
): AsyncIterable<StructuredEvent<ElementsAndRelationsResult>> {
  const prompt = withOperationContext(args, buildExtendPrompt(args), "extend", "knowledge");
  return runStructuredAI(adapter, {
    prompt, sessionId: args.sessionId, signal: args.signal, validate: zodValidator(ElementsAndRelationsSchema),
    opLog: { op: "extend", model: adapter.name, elementId: args.element.id, scope: { count: args.count, direction: args.direction } },
  });
}

export function analyzeMark(
  adapter: AIAdapter,
  args: { element: Element; markedText: string; contextBefore?: string; contextAfter?: string; hint?: string } & KnowledgeOperationArgs,
): AsyncIterable<StructuredEvent<AnalyzeMarkResult>> {
  const prompt = withOperationContext(args, buildAnalyzeMarkPrompt(args), "analyze-mark", "analysis");
  return runStructuredAI(adapter, {
    prompt, sessionId: args.sessionId, signal: args.signal, validate: zodValidator(AnalyzeMarkResultSchema),
    opLog: { op: "analyze-mark", model: adapter.name, elementId: args.element.id, scope: { markedText: args.markedText.slice(0, 80) } },
  });
}

export function generatePathsFor(
  adapter: AIAdapter,
  args: { center: Element; availableElements: Element[]; kinds: PathKind[] } & KnowledgeOperationArgs,
): AsyncIterable<StructuredEvent<PathResult>> {
  const prompt = withOperationContext(args, buildPathPrompt(args), "generate-paths", "knowledge");
  return runStructuredAI(adapter, {
    prompt, sessionId: args.sessionId, signal: args.signal, validate: zodValidator(PathResultSchema),
    opLog: { op: "path", model: adapter.name, elementId: args.center.id, scope: { kinds: args.kinds } },
  });
}

export function attachUnder(
  adapter: AIAdapter,
  args: {
    parent: Element;
    mode: "leaf" | "chain";
    leafTitle?: string;
    chain?: string[];
    fullIntent: string;
    richness?: RichnessLevel;
  } & KnowledgeOperationArgs,
): AsyncIterable<StructuredEvent<ElementsAndRelationsResult>> {
  const prompt = withOperationContext(args, buildAttachUnderPrompt({
    parent: args.parent, mode: args.mode, leafTitle: args.leafTitle, chain: args.chain,
    fullIntent: args.fullIntent, richness: args.richness ?? 2,
  }), "attach-under", "knowledge");
  return runStructuredAI(adapter, {
    prompt, sessionId: args.sessionId, signal: args.signal, validate: zodValidator(ElementsAndRelationsSchema),
    opLog: { op: "attach-under", model: adapter.name, elementId: args.parent.id, scope: { mode: args.mode, leafTitle: args.leafTitle, chain: args.chain, richness: args.richness } },
  });
}
