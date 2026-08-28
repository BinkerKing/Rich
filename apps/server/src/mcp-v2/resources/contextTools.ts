import { z } from "zod";
import type { ElementsRepo } from "../../repos/ElementsRepo.js";
import type { ProjectManagementRepo } from "../../repos/ProjectManagementRepo.js";
import { richSuccess } from "../registry/response.js";
import type { RichToolRegistry } from "../registry/toolRegistry.js";
import { richContextSchema, richOptionsSchema } from "./schemas.js";

export interface ContextToolDeps {
  elements: ElementsRepo;
  projectManagement: ProjectManagementRepo;
}

export function registerContextTools(registry: RichToolRegistry, deps: ContextToolDeps): void {
  registry.register({
    name: "rich_context_search",
    title: "Search Rich context",
    description: "Search Rich knowledge and, when projectId is supplied, project-management records. Use for finding or understanding information without changing it.",
    category: "query",
    inputSchema: z.object({
      query: z.string().trim().min(1),
      projectId: z.string().trim().min(1).optional(),
      sources: z.array(z.enum(["knowledge", "project"])).min(1).optional(),
      limit: z.number().int().min(1).max(50).default(20),
      context: richContextSchema,
      options: richOptionsSchema,
    }),
    annotations: { readOnly: true, destructive: false, idempotent: true },
    examples: [{
      description: "Search knowledge and one project for MCP records.",
      input: { query: "MCP", projectId: "project-rich" },
    }],
    verification: "Results are returned from the current knowledge and project repositories without writes.",
    handler: async ({ query, projectId, sources, limit }) => {
      const requestedSources = new Set(sources ?? ["knowledge", "project"]);
      const results: Array<Record<string, unknown> & { score: number }> = [];
      if (requestedSources.has("knowledge")) {
        const normalizedQuery = query.toLocaleLowerCase();
        const knowledge = await deps.elements.list();
        for (const element of knowledge) {
          const score = knowledgeScore(element, normalizedQuery);
          if (score === 0) continue;
          results.push({
            source: "knowledge",
            id: element.id,
            title: element.title,
            subtitle: element.subtitle,
            type: element.type,
            score,
          });
        }
      }
      if (requestedSources.has("project") && projectId) {
        const projectResults = await deps.projectManagement.searchAll(projectId, query, limit);
        results.push(...projectResults.map(result => ({
          source: "project",
          id: result.entityId,
          title: result.title,
          subtitle: result.subtitle,
          excerpt: result.excerpt,
          moduleKey: result.moduleKey,
          entityType: result.entityType,
          destination: result.destination,
          score: result.score,
        })));
      }
      const limited = results
        .sort((left, right) => right.score - left.score || String(left.title).localeCompare(String(right.title)))
        .slice(0, limit);
      const warnings = requestedSources.has("project") && !projectId
        ? ["Project search was skipped because projectId was not provided."]
        : [];
      return richSuccess("rich_context_search", { query, results: limited }, {
        refs: limited.map(result => ({
          type: result.source === "project" ? "projectItem" : "knowledge",
          id: String(result.id),
        })),
        ...(warnings.length > 0 ? { warnings } : {}),
      });
    },
  });

  registry.register({
    name: "rich_context_get_overview",
    title: "Get Rich overview",
    description: "Get a compact overview of the Rich knowledge base and an optional project's modules and dictionary counts.",
    category: "query",
    inputSchema: z.object({
      projectId: z.string().trim().min(1).optional(),
      context: richContextSchema,
      options: richOptionsSchema,
    }),
    annotations: { readOnly: true, destructive: false, idempotent: true },
    examples: [{
      description: "Summarize Rich knowledge and the selected project.",
      input: { projectId: "project-rich" },
    }],
    verification: "Counts are computed from current repository reads.",
    handler: async ({ projectId }) => {
      const elements = await deps.elements.list();
      const byType = elements.reduce<Record<string, number>>((counts, element) => {
        counts[element.type] = (counts[element.type] ?? 0) + 1;
        return counts;
      }, {});
      const project = projectId ? await deps.projectManagement.getSummary(projectId) : undefined;
      return richSuccess("rich_context_get_overview", {
        knowledge: { total: elements.length, byType },
        ...(project ? { project } : {}),
      }, {
        refs: projectId ? [{ type: "project", id: projectId }] : [],
      });
    },
  });
}

function knowledgeScore(element: Awaited<ReturnType<ElementsRepo["list"]>>[number], query: string): number {
  const title = element.title.toLocaleLowerCase();
  if (title === query) return 100;
  let score = title.includes(query) ? 60 : 0;
  if (element.subtitle?.toLocaleLowerCase().includes(query)) score += 25;
  if (element.domain?.toLocaleLowerCase().includes(query)) score += 20;
  if (element.tags?.some(tag => tag.toLocaleLowerCase().includes(query))) score += 20;
  if (JSON.stringify(element.content).toLocaleLowerCase().includes(query)) score += 10;
  return score;
}
