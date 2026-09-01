import { z } from "zod";
import {
  ElementSchema,
  LearningPathSchema,
  RelationSchema,
  parseElementStrict,
  type Element,
  type LearningPath,
  type Relation,
} from "@ke/domain";

export interface GeneratedTree {
  rootId: string;
  elements: Element[];
  relations: Relation[];
  paths: LearningPath[];
}

const GeneratedTreeSchema = z.object({
  rootId: z.string().min(1),
  elements: z.array(ElementSchema).min(1),
  relations: z.array(RelationSchema),
  paths: z.array(LearningPathSchema),
});

/**
 * Validates the full graph produced by the model before it reaches storage.
 * Individual repository schemas cannot verify relationships across elements,
 * relations, and learning paths.
 */
export function validateGeneratedTree(raw: unknown): GeneratedTree {
  const parsed = GeneratedTreeSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map(issue => `${issue.path.join(".")}: ${issue.message}`)
      .slice(0, 3)
      .join("; ");
    throw new Error(`generated tree schema validation failed (${issues})`);
  }

  const elementIds = new Set<string>();
  for (const element of parsed.data.elements) {
    if (elementIds.has(element.id)) throw new Error(`generated tree has duplicate element id: ${element.id}`);
    try {
      parseElementStrict(element);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`generated tree element ${element.id} has invalid content: ${message}`);
    }
    elementIds.add(element.id);
  }

  if (!elementIds.has(parsed.data.rootId)) {
    throw new Error(`generated tree rootId ${parsed.data.rootId} is not in elements`);
  }

  for (const relation of parsed.data.relations) {
    if (!elementIds.has(relation.from) || !elementIds.has(relation.to)) {
      throw new Error(`generated tree relation ${relation.id} references an element outside the tree`);
    }
  }

  for (const path of parsed.data.paths) {
    if (!elementIds.has(path.centerElementId) || path.steps.some(step => !elementIds.has(step))) {
      throw new Error(`generated tree path ${path.id} references an element outside the tree`);
    }
  }

  return parsed.data;
}
