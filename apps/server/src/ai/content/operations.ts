import { z } from "zod";
import type { AIAdapter } from "../adapter.js";
import { withOperationContext, type OperationPromptArgs } from "../operationContext.js";
import { buildGenerateDailyNewsPrompt } from "../prompts/generateDailyNews.js";
import { buildGenerateImagePrompt } from "../prompts/generateImage.js";
import { buildGenerateMindmapPrompt } from "../prompts/generateMindmap.js";
import { runStructuredAI, type StructuredEvent } from "../runStructuredAI.js";
import { zodValidator } from "../structuredValidation.js";

type ContentOperationArgs = OperationPromptArgs & { signal?: AbortSignal };

const NewsCategorySchema = z.enum([
  "能力突破", "应用产品", "大模型", "工具与开源",
  "研究论文", "政策与安全", "投融资", "国内动态",
]);
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

const GenerateImageResultSchema = z.object({
  src: z.string().min(1),
  alt: z.string().min(1),
  caption: z.string().optional().default(""),
});
export type GenerateImageResult = z.infer<typeof GenerateImageResultSchema>;

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

export function generateDailyNews(
  adapter: AIAdapter,
  args: { date: string } & ContentOperationArgs,
): AsyncIterable<StructuredEvent<GenerateDailyNewsResult>> {
  return runStructuredAI(adapter, {
    prompt: withOperationContext(args, buildGenerateDailyNewsPrompt({ date: args.date }), "generate-daily-news", "content"),
    signal: args.signal,
    validate: zodValidator(GenerateDailyNewsResultSchema),
    opLog: { op: "generate-daily-news", model: adapter.name, scope: { date: args.date } },
  });
}

export function generateMindmap(
  adapter: AIAdapter,
  args: { prose: string; titleHint?: string; audience?: string; withImages?: boolean } & ContentOperationArgs,
): AsyncIterable<StructuredEvent<GenerateMindmapResult>> {
  const prompt = withOperationContext(args, buildGenerateMindmapPrompt(args), "generate-mindmap", "mindmap");
  return runStructuredAI(adapter, {
    prompt,
    signal: args.signal,
    validate: zodValidator(GenerateMindmapResultSchema),
    opLog: {
      op: "generate-mindmap",
      model: adapter.name,
      scope: { titleHint: args.titleHint, audience: args.audience, withImages: args.withImages, proseLength: args.prose.length },
    },
  });
}

export function generateImageFor(
  adapter: AIAdapter,
  args: { alt: string; caption?: string; imagePrompt?: string; surroundingText?: string; elementId?: string } & ContentOperationArgs,
): AsyncIterable<StructuredEvent<GenerateImageResult>> {
  const prompt = withOperationContext(args, buildGenerateImagePrompt(args), "generate-image", "image");
  return runStructuredAI(adapter, {
    prompt,
    signal: args.signal,
    validate: zodValidator(GenerateImageResultSchema),
    opLog: {
      op: "generate-image",
      model: adapter.name,
      elementId: args.elementId,
      scope: { alt: args.alt.slice(0, 60), hasPrompt: Boolean(args.imagePrompt) },
    },
  });
}
