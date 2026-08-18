import { z } from "zod";

export const ElementTypeSchema = z.enum([
  "topic", "concept", "step", "product-design",
  "viewpoint", "question", "case", "tool", "ability",
  "project", "practice", "summary", "relation",
  "dispute", "exercise", "report", "guide",
  "group",
  // 项目实战专属：让分组里的子元有匹配的语义类型，不再借用 concept/case/step 等
  "knowledge", "requirement", "feature", "prd", "dev-task", "revision", "inquiry",
  // 项目管理专属：生产项目运维信息
  "deployment-env", "deployment-step", "server", "credential", "repo",
  "version-release", "faq", "folder-snapshot",
  "connection",
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

// ── 项目管理 schemas ────────────────────────────────────────
export const ProjectContentSchema = z.object({
  description: z.string().optional(),
  status: z.enum(["active", "paused", "archived"]).optional(),
  localFolder: z.string().optional(),
  owner: z.string().optional(),
  startedAt: z.string().optional(),
  launchedAt: z.string().optional(),
  lastFolderScan: z.unknown().optional(),
  reportSchedule: z.object({
    daily: z.string().optional(),
    weekly: z.object({
      weekday: z.union([
        z.literal(0), z.literal(1), z.literal(2), z.literal(3),
        z.literal(4), z.literal(5), z.literal(6),
      ]),
      time: z.string(),
    }).optional(),
  }).optional(),
});

export const DeploymentEnvContentSchema = z.object({
  envName: z.string().min(1),
  description: z.string().optional(),
  publicUrl: z.string().optional(),
  attention: z.string().optional(),
});

export const DeploymentStepContentSchema = z.object({
  environment: z.string().min(1),
  version: z.string().min(1),
  phase: z.string().min(1),
  target: z.string().optional(),
  source: z.string().optional(),
  steps: z.array(z.object({
    n: z.number().int().positive(),
    actor: z.string().optional(),
    action: z.string().min(1),
    command: z.string().optional(),
    check: z.string().optional(),
    notes: z.string().optional(),
  })),
  checklist: z.array(z.object({
    id: z.string().min(1),
    label: z.string().min(1),
    done: z.boolean().optional(),
  })),
  importedAt: z.string().optional(),
});

export const ServerContentSchema = z.object({
  ip: z.string().min(1),
  serverRole: z.enum(["front", "app", "database", "vip", "router"]).optional(),
  port: z.number().int().min(1).max(65535).optional(),
  hostname: z.string().optional(),
  os: z.string().optional(),
  region: z.string().optional(),
  notes: z.string().optional(),
});

export const CredentialContentSchema = z.object({
  kind: z.enum(["ssh", "db", "web", "api", "other"]),
  label: z.string().min(1),
  username: z.string().optional(),
  password: z.string().optional(),
  privateKey: z.string().optional(),
  url: z.string().optional(),
  notes: z.string().optional(),
});

export const RepoContentSchema = z.object({
  url: z.string().min(1),
  defaultBranch: z.string().optional(),
  vendor: z.enum(["github", "gitee", "gitlab", "bitbucket", "self"]).optional(),
  localPath: z.string().optional(),
  notes: z.string().optional(),
});

export const VersionReleaseContentSchema = z.object({
  version: z.string().min(1),
  releasedAt: z.string(),
  deployedTo: z.array(z.string()).optional(),
  changelog: z.string(),
  refUrl: z.string().optional(),
});

export const FaqContentSchema = z.object({
  question: z.string().min(1),
  answer: z.string(),
  category: z.string().optional(),
  source: z.string().optional(),
});

export const ConnectionContentSchema = z.object({
  fromServerId: z.string().min(1),
  toServerId: z.string().min(1),
  port: z.number().int().min(1).max(65535),
  protocol: z.string().optional(),
  purpose: z.string().optional(),
  firewall: z.enum(["open", "pending", "blocked", "unknown"]).optional(),
  notes: z.string().optional(),
});

export const FolderSnapshotContentSchema = z.object({
  rootPath: z.string().min(1),
  scannedAt: z.string(),
  totalFiles: z.number().int().nonnegative(),
  totalSize: z.number().int().nonnegative(),
  report: z.string(),
  proposedMoves: z.array(z.object({
    from: z.string(),
    to: z.string(),
    reason: z.string(),
  })).optional(),
  appliedAt: z.string().optional(),
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
  // 项目管理：每个新类型都接上自己的 content schema
  project: ProjectContentSchema,
  "deployment-env": DeploymentEnvContentSchema,
  "deployment-step": DeploymentStepContentSchema,
  server: ServerContentSchema,
  credential: CredentialContentSchema,
  repo: RepoContentSchema,
  "version-release": VersionReleaseContentSchema,
  faq: FaqContentSchema,
  "folder-snapshot": FolderSnapshotContentSchema,
  connection: ConnectionContentSchema,
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
