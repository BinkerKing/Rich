import type { ElementsRepo } from "../repos/ElementsRepo.js";
import type { ProjectManagementRepo } from "../repos/ProjectManagementRepo.js";
import type { RichToolRegistry } from "./registry/toolRegistry.js";
import { registerContextTools } from "./resources/contextTools.js";
import { registerKnowledgeTools } from "./resources/knowledgeTools.js";
import { registerProjectTools } from "./resources/projectTools.js";

export interface ResourceToolDeps {
  elements: ElementsRepo;
  projectManagement: ProjectManagementRepo;
}

export function registerResourceTools(registry: RichToolRegistry, deps: ResourceToolDeps): void {
  registerContextTools(registry, deps);
  registerKnowledgeTools(registry, deps.elements);
  registerProjectTools(registry, deps.projectManagement);
}
