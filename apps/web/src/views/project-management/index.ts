// Public presentation boundary for project management.  Consumers should not
// import implementation files directly while sections are migrated by domain.
export { TodosSection } from "./sections/TodosSection.js";
export { CodeVersionsSection } from "./sections/CodeVersionsSection.js";
export { MonitoringSection } from "./sections/MonitoringSection.js";
export { ProjectDeploymentStepsSection } from "./sections/DeploymentStepsSection.js";
export { EnvironmentsSection } from "./sections/EnvironmentsSection.js";
export { ScenariosSection } from "./sections/ScenariosSection.js";
export { WorkflowSection } from "./sections/WorkflowSection.js";
export { DictionarySection } from "./DictionaryWorkspace.js";
export { AutomationSection } from "./AutomationWorkspace.js";
export { ProjectDescriptionSection } from "./ProjectDescriptionSection.js";
export { DeliveryPlanWorkspace, ProjectDashboard } from "./delivery/DeliveryWorkspace.js";
export { DeliverablesWorkspace } from "./deliverables/DeliverablesWorkspace.js";
export { ReportsWorkspace } from "./reports/ReportsWorkspace.js";
export { TestCenterWorkspace } from "./testing/TestCenterWorkspace.js";
export {
  PROJECT_MANAGEMENT_SECTIONS,
  ProjectManagementSearchBar,
  type ProjectManagementSection,
  type ProjectManagementSearchTarget,
} from "./ProjectManagementNavigation.js";
