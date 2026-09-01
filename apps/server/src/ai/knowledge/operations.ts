import type { RichnessLevel } from "@ke/domain";
import type { AIAdapter } from "../adapter.js";
import { withOperationContext, type OperationPromptArgs } from "../operationContext.js";
import { runStructuredAI, type StructuredEvent } from "../runStructuredAI.js";
import { buildGenerateTreePrompt } from "../prompts/generateTree.js";
import { validateGeneratedTree, type GeneratedTree } from "./generatedTreeValidator.js";

export type GenerateTreeResult = GeneratedTree;

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
