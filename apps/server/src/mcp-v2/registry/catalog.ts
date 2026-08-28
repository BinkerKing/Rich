import { z } from "zod";
import { measureCatalog, type CatalogMetrics } from "./catalogMetrics.js";
import type { RichToolAnnotations, RichToolCategory } from "./types.js";

export interface RichToolExample {
  description: string;
  input: unknown;
}

export interface RichToolCatalogSource {
  name: string;
  title: string;
  description: string;
  category: RichToolCategory;
  inputSchema: z.ZodType;
  annotations: RichToolAnnotations;
  examples: RichToolExample[];
  verification: string;
}

export interface RichToolDefinition {
  name: string;
  title: string;
  description: string;
  category: RichToolCategory;
  inputSchema: Record<string, unknown>;
  annotations: RichToolAnnotations;
  examples: RichToolExample[];
  verification: string;
}

export function buildToolCatalog(sources: RichToolCatalogSource[]): RichToolDefinition[] {
  return [...sources]
    .sort((left, right) => left.name.localeCompare(right.name))
    .map(source => ({
      name: source.name,
      title: source.title,
      description: source.description,
      category: source.category,
      inputSchema: z.toJSONSchema(source.inputSchema, { target: "draft-7", io: "input" }),
      annotations: { ...source.annotations },
      examples: source.examples.map(example => ({ ...example })),
      verification: source.verification,
    }));
}

export function measureToolCatalog(definitions: RichToolDefinition[]): CatalogMetrics {
  return measureCatalog(definitions.map(definition => ({
    name: definition.name,
    description: definition.description,
    inputSchema: definition.inputSchema,
  })));
}
