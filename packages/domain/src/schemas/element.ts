import { z } from "zod";

export const ElementTypeSchema = z.enum([
  "topic", "concept", "step", "product-design",
  "viewpoint", "question", "case", "tool", "ability",
  "project", "practice", "summary", "relation",
  "dispute", "exercise", "report", "guide",
]);

export const RichnessLevelSchema = z.union([
  z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5),
]);

export const ElementMetadataSchema = z.object({
  createdAt: z.string(),
  updatedAt: z.string(),
  generatedBy: z.enum(["ai", "user"]),
  aiModel: z.string().optional(),
  aiSessionId: z.string().optional(),
  richness: RichnessLevelSchema,
});

// Per-type content schemas
export const ExtraSectionSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
  order: z.number().optional(),
});

export const DiagramBlockSchema = z.object({
  id: z.string(),
  title: z.string(),
  caption: z.string().optional(),
  mermaid: z.string().min(1),
});

/**
 * Dynamic sections schema is permissive on `blocks[*]` — the frontend
 * dispatches by `block.style` and ignores unknown blocks gracefully.
 * This keeps the AI ↔ schema contract loose enough to evolve the palette
 * without breaking older generations.
 */
export const StyleBlockSchema = z.object({ style: z.string() }).passthrough();
export const DynamicSectionSchema = z.object({
  id: z.string(),
  title: z.string(),
  blocks: z.array(StyleBlockSchema),
});

export const ConceptContentSchema = z.object({
  oneSentence: z.string(),
  coreExplain: z.string(),
  whyMatters: z.string(),
  beginnerExplain: z.string().optional(),
  keyPoints: z.array(z.string()).optional(),
  learningGoals: z.array(z.string()).optional(),
  mechanisms: z.array(z.object({
    label: z.string(),
    description: z.string().optional(),
  })).optional(),
  examples: z.array(z.string()).optional(),
  misconceptions: z.array(z.string()).optional(),
  exercises: z.array(z.object({
    prompt: z.string(),
    hint: z.string().optional(),
  })).optional(),
  nextSteps: z.array(z.string()).optional(),
  extraSections: z.array(ExtraSectionSchema).optional(),
  diagrams: z.array(DiagramBlockSchema).optional(),
  sections: z.array(DynamicSectionSchema).optional(),
});

export const TopicContentSchema = z.object({
  intro: z.string(),
  learningGoals: z.array(z.string()),
  coreModules: z.array(z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    focus: z.string().optional(),
  })),
  recommendedPaths: z.array(z.string()),
  beginnerExplain: z.string().optional(),
  extraSections: z.array(ExtraSectionSchema).optional(),
  diagrams: z.array(DiagramBlockSchema).optional(),
  sections: z.array(DynamicSectionSchema).optional(),
});

export const StepContentSchema = z.object({
  goal: z.string(),
  preconditions: z.array(z.string()).optional(),
  steps: z.array(z.object({
    n: z.number(),
    action: z.string(),
    check: z.string().optional(),
  })),
  completionCriteria: z.array(z.string()).optional(),
  commonFailures: z.array(z.string()).optional(),
  nextAction: z.string().optional(),
});

export const ProductDesignContentSchema = z.object({
  designQuestion: z.string(),
  positioning: z.string().optional(),
  targetAudience: z.string().optional(),
  needs: z.array(z.string()).optional(),
  competitors: z.array(z.object({
    name: z.string(),
    takeaway: z.string(),
  })).optional(),
  decisions: z.array(z.object({
    topic: z.string(),
    choice: z.string(),
    rationale: z.string(),
    alternatives: z.array(z.string()).optional(),
  })).optional(),
  mvpScope: z.array(z.string()).optional(),
  outOfScope: z.array(z.string()).optional(),
  architectureNote: z.string().optional(),
});

export const PracticeContentSchema = z.object({
  productPositioning: z.string(),
  targetAudience: z.string(),
  needs: z.array(z.string()),
  competitors: z.array(z.object({
    name: z.string(),
    takeaway: z.string(),
  })).optional(),
  mvpFeatures: z.array(z.string()),
  implementationPath: z.array(z.string()),
});

// Generic content: accept any object — strict per-type validation happens via
// validateElementContent(element) at boundaries that know which schema to apply.
export const ElementContentSchema = z.unknown();

export const ElementSchema = z.object({
  id: z.string().min(1),
  type: ElementTypeSchema,
  title: z.string().min(1),
  subtitle: z.string().optional(),
  aliases: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  domain: z.string().optional(),
  difficulty: z.enum(["low", "mid", "high"]).optional(),
  // 项目实战：仅 step (开发任务) 用，其他 type 忽略；undefined 视为 todo
  status: z.enum(["todo", "doing", "done"]).optional(),
  content: ElementContentSchema,
  metadata: ElementMetadataSchema,
});

const TYPE_TO_CONTENT_SCHEMA: Partial<Record<z.infer<typeof ElementTypeSchema>, z.ZodSchema>> = {
  topic: TopicContentSchema,
  concept: ConceptContentSchema,
  step: StepContentSchema,
  practice: PracticeContentSchema,
  "product-design": ProductDesignContentSchema,
};

/**
 * Returns a parsed Element with content typed against the per-type schema if available,
 * or throws ZodError. Other element types fall through with content untyped.
 */
export function parseElementStrict(raw: unknown): z.infer<typeof ElementSchema> {
  const parsed = ElementSchema.parse(raw);
  const contentSchema = TYPE_TO_CONTENT_SCHEMA[parsed.type];
  if (contentSchema) {
    contentSchema.parse(parsed.content);
  }
  return parsed;
}
