import type { AutomationRunItem } from "./application/runner.js";

export interface AutomationPlan {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface AutomationItem {
  id: string;
  projectId: string;
  planId: string;
  groupId: string;
  tableId: string;
  tableName: string;
  tableCn?: string;
  systemId?: string;
  systemName?: string;
  sortOrder: number;
}

export interface AutomationGroup {
  id: string;
  projectId: string;
  planId: string;
  name: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  items: AutomationItem[];
}

export interface AutomationPlanDetail extends AutomationPlan {
  groups: AutomationGroup[];
}

export type AutomationRunStatus = "running" | "paused" | "success";

export interface AutomationRun {
  id: string;
  projectId: string;
  planId: string;
  planName: string;
  status: AutomationRunStatus;
  error?: string;
  startedAt: string;
  finishedAt?: string;
  updatedAt: string;
  runtimeParams?: Record<string, unknown>;
  items: AutomationRunItem[];
}

export interface AutomationRuntimeParameter {
  name: string;
  types: string[];
  tableIds: string[];
}

export interface AutomationInspectionItem {
  tableId: string;
  tableName: string;
  groupId: string;
  groupName: string;
  ready: boolean;
  parameterNames: string[];
  message?: string;
  error?: string;
}

export interface AutomationPlanInspection {
  planId: string;
  ready: boolean;
  checkedAt: string;
  parameters: AutomationRuntimeParameter[];
  items: AutomationInspectionItem[];
}

export interface AutomationPlanInput {
  name: string;
  description?: string | null;
  sortOrder?: number;
}

export interface AutomationGroupInput {
  name: string;
  sortOrder?: number;
}

export interface AutomationItemInput {
  tableId: string;
  sortOrder?: number;
}

export interface ProjectAutomationRepo {
  listPlans(projectId: string): Promise<AutomationPlan[]>;
  getPlan(projectId: string, planId: string): Promise<AutomationPlanDetail | null>;
  createPlan(projectId: string, input: AutomationPlanInput): Promise<AutomationPlan>;
  updatePlan(projectId: string, planId: string, input: Partial<AutomationPlanInput>): Promise<AutomationPlan | null>;
  deletePlan(projectId: string, planId: string): Promise<boolean>;
  createGroup(projectId: string, planId: string, input: AutomationGroupInput): Promise<AutomationGroup>;
  updateGroup(projectId: string, groupId: string, input: Partial<AutomationGroupInput>): Promise<AutomationGroup | null>;
  deleteGroup(projectId: string, groupId: string): Promise<boolean>;
  reorderGroups(projectId: string, planId: string, groupIds: string[]): Promise<void>;
  addItem(projectId: string, planId: string, groupId: string, input: AutomationItemInput): Promise<AutomationItem>;
  removeItem(projectId: string, itemId: string): Promise<boolean>;
  reorderItems(projectId: string, groupId: string, itemIds: string[]): Promise<void>;
  createRun(plan: AutomationPlanDetail, runtimeParams?: Record<string, unknown>): Promise<AutomationRun>;
  saveRun(run: AutomationRun): Promise<void>;
  getRun(projectId: string, runId: string): Promise<AutomationRun | null>;
  listRuns(projectId: string, planId: string, limit?: number): Promise<AutomationRun[]>;
}
