import type { ProjectManagementRepo } from "../../../repos/ProjectManagementRepo.js";
import { loadDictionaryEntityTarget } from "../../../routes/projectManagement.js";
import {
  createDictionaryEntityTable,
  extractDictionaryEntityTestData,
  prepareDictionaryEntityExtractionSql,
  validateDictionaryMappingSql,
} from "../../project-dictionary/application/entityService.js";
import type { AutomationStepExecutor } from "./runner.js";
import type { AutomationPlanItemInspector } from "./automationService.js";

type DictionaryTarget = Awaited<ReturnType<typeof loadDictionaryEntityTarget>>;

interface DictionaryAutomationDependencies {
  loadTarget(repo: ProjectManagementRepo, projectId: string, tableId: string): Promise<DictionaryTarget>;
  validateSql(input: DictionaryTarget & { projectId: string; repo: ProjectManagementRepo; runtimeParams?: Record<string, unknown> }): Promise<{
    ok: boolean;
    message?: string;
    caliber?: { error?: string };
    fields?: Array<{ error?: string }>;
  }>;
  syncTable(input: DictionaryTarget): Promise<{ message?: string }>;
  prepareExtraction(input: DictionaryTarget & { projectId: string; repo: ProjectManagementRepo; runtimeParams?: Record<string, unknown>; dryRun?: boolean }): Promise<{
    ready: boolean;
    message?: string;
    statementError?: string;
    caliber?: { error?: string };
    runtimeParamNames?: string[];
    runtimeParamTypes?: Record<string, string>;
  }>;
  extract(input: DictionaryTarget & { projectId: string; repo: ProjectManagementRepo; runtimeParams?: Record<string, unknown> }): Promise<{
    affectedRows?: number;
    message?: string;
  }>;
}

const defaultDependencies: DictionaryAutomationDependencies = {
  loadTarget: loadDictionaryEntityTarget,
  validateSql: validateDictionaryMappingSql,
  syncTable: createDictionaryEntityTable,
  prepareExtraction: prepareDictionaryEntityExtractionSql,
  extract: extractDictionaryEntityTestData,
};

export function createDictionaryAutomationStepExecutor(
  projectId: string,
  repo: ProjectManagementRepo,
  dependencies: DictionaryAutomationDependencies = defaultDependencies,
): AutomationStepExecutor {
  return async (item, step, context) => {
    const target = await dependencies.loadTarget(repo, projectId, item.tableId);
    if (step === "validate_sql") {
      const result = await dependencies.validateSql({ ...target, projectId, repo, runtimeParams: context?.runtimeParams });
      if (!result.ok) {
        const detail = result.caliber?.error || result.fields?.find(field => field.error)?.error;
        throw new Error([result.message || "SQL 验证失败", detail].filter(Boolean).join("："));
      }
      return { message: result.message };
    }
    if (step === "sync_table") {
      const result = await dependencies.syncTable(target);
      return { message: result.message };
    }
    if (step === "prepare_extraction") {
      const result = await dependencies.prepareExtraction({ ...target, projectId, repo, runtimeParams: context?.runtimeParams });
      if (!result.ready) throw new Error(result.statementError || result.caliber?.error || result.message || "抽取准备失败");
      return { message: result.message };
    }
    const result = await dependencies.extract({ ...target, projectId, repo, runtimeParams: context?.runtimeParams });
    return { affectedRows: result.affectedRows, message: result.message };
  };
}

export function createDictionaryAutomationPlanInspector(
  projectId: string,
  repo: ProjectManagementRepo,
  dependencies: Pick<DictionaryAutomationDependencies, "loadTarget" | "prepareExtraction"> = defaultDependencies,
): AutomationPlanItemInspector {
  return async item => {
    const target = await dependencies.loadTarget(repo, projectId, item.tableId);
    const result = await dependencies.prepareExtraction({ ...target, projectId, repo, dryRun: true });
    return {
      ready: result.ready,
      runtimeParamNames: result.runtimeParamNames,
      runtimeParamTypes: result.runtimeParamTypes,
      message: result.message,
      error: result.statementError || result.caliber?.error,
    };
  };
}
