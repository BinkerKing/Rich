import type { ElementsRepo } from "../repos/ElementsRepo.js";
import type { RelationsRepo } from "../repos/RelationsRepo.js";
import type { ProjectManagementRepo } from "../repos/ProjectManagementRepo.js";
import type { McpOperationRepo } from "../repos/McpOperationRepo.js";
import type { GreatMeRepo } from "../repos/GreatMeRepo.js";
import type { ProjectAutomationRepo } from "../modules/project-automation/contracts.js";
import type { RichToolRegistry } from "./registry/toolRegistry.js";
import { registerContextTools } from "./resources/contextTools.js";
import { registerKnowledgeTools } from "./resources/knowledgeTools.js";
import { registerProjectTools } from "./resources/projectTools.js";
import { registerFlowchartTools } from "./resources/flowchartTools.js";
import { registerMindmapTools } from "./resources/mindmapTools.js";
import { registerReportTools } from "./resources/reportTools.js";
import { registerDictionaryTools } from "./resources/dictionaryTools.js";
import { registerDictionaryInfoTools } from "./resources/dictionaryInfoTools.js";
import { registerPlanningTools } from "./resources/planningTools.js";
import { registerPracticeResourceTools } from "./resources/practiceTools.js";
import { registerAutomationTools } from "./resources/automationTools.js";
import { registerTestCenterTools } from "./resources/testCenterTools.js";
import { registerStartupProjectManualTools } from "./resources/startupProjectManualTools.js";
import type { TestCenterSqliteRepo } from "../test-center/TestCenterSqliteRepo.js";
import type { FlowchartsRepo } from "../repos/FlowchartsRepo.js";
import type { DeepMindMapsRepo } from "../repos/DeepMindMapsRepo.js";
import { registerDeepMindMapTools } from "./resources/deepMindMapTools.js";

export interface ResourceToolDeps {
  elements: ElementsRepo;
  relations: RelationsRepo;
  projectManagement: ProjectManagementRepo;
  operationRepo?: McpOperationRepo;
  greatMe?: GreatMeRepo;
  projectAutomation?: ProjectAutomationRepo;
  testCenter?: TestCenterSqliteRepo;
  startupProjectsRoot?: string;
  flowcharts?: FlowchartsRepo;
  deepMindMaps?: DeepMindMapsRepo | null;
}

export function registerResourceTools(registry: RichToolRegistry, deps: ResourceToolDeps): void {
  registerContextTools(registry, deps);
  registerDictionaryTools(registry, deps.projectManagement, deps.operationRepo);
  registerDictionaryInfoTools(registry, deps.projectManagement, deps.operationRepo);
  registerKnowledgeTools(registry, deps.elements, deps.operationRepo);
  registerPracticeResourceTools(registry, deps.elements, deps.operationRepo);
  registerProjectTools(registry, deps.projectManagement, deps.operationRepo);
  registerFlowchartTools(registry, { projects: deps.projectManagement, elements: deps.elements, flowcharts: deps.flowcharts }, deps.operationRepo);
  registerMindmapTools(registry, { elements: deps.elements, relations: deps.relations }, deps.operationRepo);
  registerDeepMindMapTools(registry, deps.deepMindMaps ?? null);
  registerReportTools(registry, deps.projectManagement, deps.operationRepo);
  if (deps.greatMe) registerPlanningTools(registry, deps.greatMe, deps.operationRepo);
  if (deps.projectAutomation) registerAutomationTools(registry, deps.projectAutomation, deps.operationRepo);
  if (deps.testCenter) registerTestCenterTools(registry, deps.testCenter, deps.operationRepo);
  registerStartupProjectManualTools(registry, deps.startupProjectsRoot, deps.operationRepo);
}
