import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { z } from "zod";
import type { McpOperationRepo } from "../../repos/McpOperationRepo.js";
import { RichMcpError } from "../registry/errors.js";
import { richSuccess } from "../registry/response.js";
import type { RichToolRegistry } from "../registry/toolRegistry.js";
import { executeSafeWrite } from "../registry/writeSafety.js";
import { richContextSchema, richOptionsSchema } from "./schemas.js";

type StartupProject = { id: string; name: string; location: string; projectPath: string; aiManual: string };
type StartupProjectStore = { projects: Array<Record<string, unknown>> };

async function readStartupStore(root: string): Promise<StartupProjectStore> {
  try {
    const raw = await readFile(join(root, "riking-projects.json"), "utf8");
    const value = JSON.parse(raw) as { projects?: unknown };
    return { projects: Array.isArray(value.projects) ? value.projects.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item)) : [] };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { projects: [] };
    throw error;
  }
}

function toStartupProject(value: Record<string, unknown>): StartupProject | null {
  const id = typeof value.id === "string" ? value.id.trim() : "";
  if (!id) return null;
  return {
    id,
    name: typeof value.name === "string" ? value.name : "未命名启动项",
    location: typeof value.location === "string" ? value.location : "local",
    projectPath: typeof value.projectPath === "string" ? value.projectPath.trim() : "",
    aiManual: typeof value.aiManual === "string" ? value.aiManual : "",
  };
}

async function listStartupProjects(root: string): Promise<StartupProject[]> {
  return (await readStartupStore(root)).projects.flatMap(project => {
    const item = toStartupProject(project);
    return item ? [item] : [];
  });
}

async function writeManual(root: string, projectId: string, content: string): Promise<StartupProject> {
  const store = await readStartupStore(root);
  const index = store.projects.findIndex(project => project.id === projectId);
  if (index < 0) throw new RichMcpError("NOT_FOUND", `Startup project ${projectId} was not found.`);
  const updated = { ...store.projects[index], aiManual: content };
  const project = toStartupProject(updated);
  if (!project) throw new RichMcpError("NOT_FOUND", `Startup project ${projectId} was not found.`);
  store.projects[index] = updated;
  await mkdir(root, { recursive: true });
  const target = join(root, "riking-projects.json");
  const temporary = `${target}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(store, null, 2)}\n`, "utf8");
  await rename(temporary, target);
  return project;
}

export function registerStartupProjectManualTools(
  registry: RichToolRegistry,
  startupProjectsRoot: string | undefined,
  operationRepo?: McpOperationRepo,
): void {
  registry.register({
    name: "rich_startup_project_manual",
    title: "Read or write a startup project's AI manual",
    description: "List startup projects, read their stored AI manual, or write the complete manual before working in that project. The manual is stored in Rich's startup-project configuration, not in the deployment directory.",
    category: "manage",
    inputSchema: z.object({
      action: z.enum(["list", "read", "write"]),
      projectId: z.string().trim().min(1).optional(),
      content: z.string().max(200_000).optional(),
      context: richContextSchema,
      options: richOptionsSchema,
    }).superRefine((input, issueContext) => {
      if ((input.action === "read" || input.action === "write") && !input.projectId) {
        issueContext.addIssue({ code: "custom", path: ["projectId"], message: "projectId is required for read and write." });
      }
      if (input.action === "write" && input.content === undefined) {
        issueContext.addIssue({ code: "custom", path: ["content"], message: "content is required for write." });
      }
    }),
    annotations: { readOnly: false, destructive: false, idempotent: true },
    examples: [
      { description: "List startup projects that AI can use.", input: { action: "list" } },
      { description: "Write an AI manual for one startup project.", input: { action: "write", projectId: "etl-postgresql", content: "# ETL AI 使用手册\n\n## 启动\n- 使用 Tomcat 启动脚本。", context: { requestId: "write-etl-manual-1" } } },
    ],
    verification: "Manual writes are read back from Rich's riking-projects.json startup-project configuration.",
    handler: async ({ action, projectId, content, context, options }) => {
      if (!startupProjectsRoot) throw new RichMcpError("DEPENDENCY_UNAVAILABLE", "Startup project storage is not configured.", { retryable: true });
      if (action === "list") {
        const projects = await listStartupProjects(startupProjectsRoot);
        return richSuccess("rich_startup_project_manual", {
          projects: projects.map(({ aiManual, ...project }) => ({ ...project, hasManual: Boolean(aiManual.trim()) })),
        }, { refs: projects.map(project => ({ type: "startupProject", id: project.id, label: project.name })) });
      }
      const target = (await listStartupProjects(startupProjectsRoot)).find(project => project.id === projectId);
      if (!target) throw new RichMcpError("NOT_FOUND", `Startup project ${projectId} was not found.`);
      if (action === "read") {
        return richSuccess("rich_startup_project_manual", { project: { ...target, aiManual: undefined }, content: target.aiManual }, {
          refs: [{ type: "startupProject", id: target.id, label: target.name }],
        });
      }
      return executeSafeWrite({
        toolName: "rich_startup_project_manual",
        operationRepo,
        context,
        options,
        inputForHash: { action, projectId, content },
        changes: [{ operation: "write", resource: "startupProjectManual", id: target.id }],
        execute: async () => {
          const project = await writeManual(startupProjectsRoot, projectId!, content!);
          return { project, content: content! };
        },
        verify: async result => {
          const saved = (await listStartupProjects(startupProjectsRoot)).find(project => project.id === result.project.id);
          return { status: saved?.aiManual === result.content ? "verified" : "failed", details: "AI manual was read back from the startup project configuration." };
        },
        refs: result => [{ type: "startupProject", id: result.project.id, label: result.project.name }],
      });
    },
  });
}
