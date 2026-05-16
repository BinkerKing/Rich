import { z } from "zod";
import {
  ElementSchema, RelationSchema, LearningPathSchema,
  ConceptContentSchema, TopicContentSchema, StepContentSchema, PracticeContentSchema,
  type ElementType,
} from "@ke/domain";

function asText(schema: z.ZodType): string {
  // z.toJSONSchema returns plain JSON; we serialize for embedding in prompts.
  // `target: "draft-7"` keeps the output broadly compatible with most consumers.
  const raw = z.toJSONSchema(schema, { target: "draft-7" });
  return JSON.stringify(raw, null, 2);
}

/** Embeddable JSON Schema fragments for prompts. */
export const SCHEMAS = {
  element: asText(ElementSchema),
  relation: asText(RelationSchema),
  path: asText(LearningPathSchema),
  treeResult: asText(z.object({
    rootId: z.string(),
    elements: z.array(ElementSchema),
    relations: z.array(RelationSchema),
    paths: z.array(LearningPathSchema),
  })),
  elementsAndRelations: asText(z.object({
    elements: z.array(ElementSchema),
    relations: z.array(RelationSchema),
  })),
  pathResult: asText(z.object({
    paths: z.array(LearningPathSchema),
  })),
};

const CONTENT_BY_TYPE: Partial<Record<ElementType, z.ZodType>> = {
  concept: ConceptContentSchema,
  topic: TopicContentSchema,
  step: StepContentSchema,
  practice: PracticeContentSchema,
};

/** Returns JSON Schema text for the content sub-schema of `type`, or null if unknown. */
export function contentSchemaFor(type: ElementType): string | null {
  const schema = CONTENT_BY_TYPE[type];
  return schema ? asText(schema) : null;
}
