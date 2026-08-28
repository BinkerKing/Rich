import type { ElementsRepo } from "../../repos/ElementsRepo.js";
import type { McpOperationRepo } from "../../repos/McpOperationRepo.js";
import type { ProjectManagementRepo } from "../../repos/ProjectManagementRepo.js";
import type { RichToolRegistry } from "../registry/toolRegistry.js";
import { registerAnalyzeAndPlanTool } from "./analyzeAndPlan.js";
import { registerCaptureInformationTool } from "./captureInformation.js";
import { registerOrganizeIntoProjectTool } from "./organizeIntoProject.js";
import { registerExecutionTeamTools, type ExecutionTeamAdministrationPort } from "./manageExecutionTeam.js";

export interface ScenarioToolDeps {
  elements: ElementsRepo;
  projects: ProjectManagementRepo;
  operationRepo?: McpOperationRepo;
  executionTeams?: ExecutionTeamAdministrationPort;
}

export function registerScenarioTools(registry: RichToolRegistry, deps: ScenarioToolDeps): void {
  registerCaptureInformationTool(registry, deps.elements, deps.operationRepo);
  registerOrganizeIntoProjectTool(registry, deps.projects, deps.operationRepo);
  registerAnalyzeAndPlanTool(registry, deps.elements, deps.projects);
  if (deps.executionTeams) registerExecutionTeamTools(registry, deps.executionTeams, deps.operationRepo);
}
