import type { ElementsRepo } from "../repos/ElementsRepo.js";
import type { ProjectManagementRepo } from "../repos/ProjectManagementRepo.js";
import type { McpOperationRepo } from "../repos/McpOperationRepo.js";
import type { GreatMeRepo } from "../repos/GreatMeRepo.js";
import type { ProjectAutomationRepo } from "../modules/project-automation/contracts.js";
import type { RichToolRegistry } from "./registry/toolRegistry.js";
import { registerContextTools } from "./resources/contextTools.js";
import { registerKnowledgeTools } from "./resources/knowledgeTools.js";
import { registerProjectTools } from "./resources/projectTools.js";
import { registerDictionaryTools } from "./resources/dictionaryTools.js";
import { registerPlanningTools } from "./resources/planningTools.js";
import { registerPracticeResourceTools } from "./resources/practiceTools.js";
import { registerAutomationTools } from "./resources/automationTools.js";

export interface ResourceToolDeps {
  elements: ElementsRepo;
  projectManagement: ProjectManagementRepo;
  operationRepo?: McpOperationRepo;
  greatMe?: GreatMeRepo;
  projectAutomation?: ProjectAutomationRepo;
}

export function registerResourceTools(registry: RichToolRegistry, deps: ResourceToolDeps): void {
  registerContextTools(registry, deps);
  registerDictionaryTools(registry, deps.projectManagement, deps.operationRepo);
  registerKnowledgeTools(registry, deps.elements, deps.operationRepo);
  registerPracticeResourceTools(registry, deps.elements, deps.operationRepo);
  registerProjectTools(registry, deps.projectManagement, deps.operationRepo);
  if (deps.greatMe) registerPlanningTools(registry, deps.greatMe, deps.operationRepo);
  if (deps.projectAutomation) registerAutomationTools(registry, deps.projectAutomation, deps.operationRepo);
}
