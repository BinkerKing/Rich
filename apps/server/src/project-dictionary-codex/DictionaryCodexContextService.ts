import { createHash } from "node:crypto";
import { realpath } from "node:fs/promises";
import type { ElementsRepo } from "../repos/ElementsRepo.js";

export interface DictionaryCodexContext {
  scopeKey: string;
  contextVersion: string;
  systemInstruction: string;
  initialContext: string;
  allowedMcpTools: string[];
  workspaceRoot?: string;
}

function object(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export class DictionaryCodexContextService {
  constructor(private readonly elements: Pick<ElementsRepo, "get">) {}

  async build(projectId: string): Promise<DictionaryCodexContext> {
    const project = await this.elements.get(projectId);
    if (!project || project.type !== "project") throw new Error("项目不存在或不是项目记录。");
    const localFolder = object(project.content) && typeof project.content.localFolder === "string" ? project.content.localFolder.trim() : "";
    const workspaceRoot = localFolder ? await realpath(localFolder).catch(() => undefined) : undefined;
    const initialContext = [
      "## Rich project dictionary context",
      `- Project ID: ${projectId}`,
      "",
      "Before analysis or changes, use rich_dictionary_manage to read the latest dictionary data.",
    ].join("\n");
    return {
      scopeKey: `dictionary:${projectId}`,
      contextVersion: createHash("sha256").update(`${projectId}:${project.metadata.updatedAt}`).digest("hex"),
      systemInstruction: "You are working in Rich free mode for this project's data dictionary. Before analysis or changes, use rich_dictionary_manage with the supplied Project ID. Do not claim changes unless they are saved through Rich.",
      initialContext,
      allowedMcpTools: ["rich_dictionary_manage", "rich_project_files_get", "rich_project_file_read"],
      workspaceRoot,
    };
  }
}
