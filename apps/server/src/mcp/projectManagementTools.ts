import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  PROJECT_MANAGEMENT_MODULES,
  type ProjectDictionaryRectification,
  type ProjectManagementModuleKey,
  type ProjectManagementRepo,
  type ProjectModuleItemPatch,
} from "../repos/ProjectManagementRepo.js";

const moduleKeys = PROJECT_MANAGEMENT_MODULES.map(module => module.key) as [
  ProjectManagementModuleKey,
  ...ProjectManagementModuleKey[],
];

const moduleKeySchema = z.enum(moduleKeys);
const rectificationEntityTypeSchema = z.enum(["library", "table", "field", "codeSet", "mapping"]);
const rectificationStatusSchema = z.enum(["open", "fixed", "verified", "cancelled"]);
const mappingStatusSchema = z.enum(["draft", "complete", "unable_to_convert", "invalid", "manual", "blocked"]);
const mappingRawSchema = z.record(z.string(), z.unknown());
const mappingSourceFieldInputSchema = z.object({
  id: z.string().min(1).optional(),
  field_id: z.string().min(1).nullable().optional(),
  ref_path: z.string().min(1),
  alias: z.string().max(160).nullable().optional(),
  role: z.string().max(120).nullable().optional(),
  remark: z.string().max(2000).nullable().optional(),
  sort_order: z.number().int().optional(),
  raw: mappingRawSchema.optional(),
});
const mappingActionInputSchema = z.object({
  id: z.string().min(1).optional(),
  action_type: z.string().min(1).max(80),
  condition_text: z.string().max(8000).nullable().optional(),
  expression_text: z.string().max(8000).nullable().optional(),
  result_text: z.string().max(8000).nullable().optional(),
  remark: z.string().max(4000).nullable().optional(),
  sort_order: z.number().int().optional(),
  raw: mappingRawSchema.optional(),
  source_field_ids: z.array(z.string().min(1)).max(200).optional(),
});

function jsonResult(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] };
}

function errorResult(message: string) {
  return { isError: true, content: [{ type: "text" as const, text: message }] };
}

function compactProjectModuleItemPatch(input: {
  parent_id?: string | null;
  title?: string;
  subtitle?: string | null;
  sort_order?: number;
  content?: Record<string, unknown>;
}): ProjectModuleItemPatch {
  return {
    parentId: input.parent_id,
    title: input.title,
    subtitle: input.subtitle,
    sortOrder: input.sort_order,
    content: input.content,
  };
}

function compactMappingRulePatch(input: {
  scenario_id?: string | null;
  system_id?: string | null;
  table_id?: string | null;
  field_id?: string | null;
  status?: string;
  logic_text?: string | null;
  converted_sql?: string | null;
  remark?: string | null;
  sort_order?: number;
  raw?: Record<string, unknown>;
}): Parameters<ProjectManagementRepo["updateDictionaryMappingRule"]>[2] {
  return {
    scenarioId: input.scenario_id,
    systemId: input.system_id,
    tableId: input.table_id,
    fieldId: input.field_id,
    status: input.status,
    logicText: input.logic_text,
    convertedSql: input.converted_sql,
    remark: input.remark,
    sortOrder: input.sort_order,
    raw: input.raw,
  };
}

function compactMappingActionPatch(input: {
  action_type?: string;
  condition_text?: string | null;
  expression_text?: string | null;
  result_text?: string | null;
  remark?: string | null;
  sort_order?: number;
  raw?: Record<string, unknown>;
  source_field_ids?: string[];
}): Parameters<ProjectManagementRepo["updateDictionaryMappingAction"]>[2] {
  return {
    actionType: input.action_type,
    conditionText: input.condition_text,
    expressionText: input.expression_text,
    resultText: input.result_text,
    remark: input.remark,
    sortOrder: input.sort_order,
    raw: input.raw,
    sourceFieldIds: input.source_field_ids,
  };
}

function compactMappingActionInputs(actions: z.infer<typeof mappingActionInputSchema>[]): Parameters<ProjectManagementRepo["replaceDictionaryMappingActions"]>[2] {
  return actions.map(action => ({
    id: action.id,
    actionType: action.action_type,
    conditionText: action.condition_text,
    expressionText: action.expression_text,
    resultText: action.result_text,
    remark: action.remark,
    sortOrder: action.sort_order,
    raw: action.raw,
    sourceFieldIds: action.source_field_ids,
  }));
}

function compactMappingSourceFieldInputs(sourceFields: z.infer<typeof mappingSourceFieldInputSchema>[]): Parameters<ProjectManagementRepo["replaceDictionaryMappingSourceFields"]>[2] {
  return sourceFields.map(sourceField => ({
    id: sourceField.id,
    fieldId: sourceField.field_id,
    refPath: sourceField.ref_path,
    alias: sourceField.alias,
    role: sourceField.role,
    remark: sourceField.remark,
    sortOrder: sourceField.sort_order,
    raw: sourceField.raw,
  }));
}

export function registerProjectManagementTools(server: McpServer, repo: ProjectManagementRepo): void {
  server.tool(
    "project_management_summary",
    "Get the module counts and data-dictionary counts for one Rich project-management project. Call this first to understand what content exists.",
    {
      project_id: z.string().min(1).describe("Rich project id, e.g. 'capital-bank-ybt'."),
    },
    async ({ project_id }) => jsonResult(await repo.getSummary(project_id)),
  );

  server.tool(
    "project_management_search",
    "Search across the project-management app: data dictionary, workflow, scenario manual, environment config, deployment steps, monitoring, code versions, todos, and folders. Use this before updating or deleting when you only know text.",
    {
      project_id: z.string().min(1),
      query: z.string().min(1),
      limit: z.number().int().min(1).max(100).default(30),
    },
    async ({ project_id, query, limit }) => jsonResult({
      project_id,
      query,
      results: await repo.searchAll(project_id, query, limit),
    }),
  );

  server.tool(
    "project_management_list_items",
    "List structured items from a project-management module. This covers 作业流程, 场景手册, 环境配置, 部署步骤, 监控预警, 代码版本, 项目代办 and 文件夹. For nested modules pass parent_id.",
    {
      project_id: z.string().min(1),
      module_key: moduleKeySchema,
      parent_id: z.string().min(1).optional(),
    },
    async ({ project_id, module_key, parent_id }) => jsonResult(await repo.listModuleItems(project_id, module_key, parent_id)),
  );

  server.tool(
    "project_management_create_item",
    "Create one project-management module item. Use content.original to preserve the UI's native payload shape when creating rich scenario/workflow/deployment records.",
    {
      project_id: z.string().min(1),
      module_key: moduleKeySchema,
      parent_id: z.string().min(1).nullable().optional(),
      title: z.string().min(1).max(240),
      subtitle: z.string().max(500).nullable().optional(),
      sort_order: z.number().int().optional(),
      content: z.record(z.string(), z.unknown()).optional(),
    },
    async ({ project_id, module_key, parent_id, title, subtitle, sort_order, content }) => {
      const item = await repo.createModuleItem(project_id, {
        moduleKey: module_key,
        parentId: parent_id ?? null,
        title,
        subtitle: subtitle ?? null,
        sortOrder: sort_order,
        content: content ?? {},
      });
      return jsonResult({ ok: true, item });
    },
  );

  server.tool(
    "project_management_update_item",
    "Patch one project-management module item. Read the item first, preserve unknown content fields, and only send the fields that should change.",
    {
      project_id: z.string().min(1),
      item_id: z.string().min(1),
      parent_id: z.string().min(1).nullable().optional(),
      title: z.string().min(1).max(240).optional(),
      subtitle: z.string().max(500).nullable().optional(),
      sort_order: z.number().int().optional(),
      content: z.record(z.string(), z.unknown()).optional(),
    },
    async ({ project_id, item_id, parent_id, title, subtitle, sort_order, content }) => {
      const item = await repo.updateModuleItem(project_id, item_id, compactProjectModuleItemPatch({
        parent_id,
        title,
        subtitle,
        sort_order,
        content,
      }));
      if (!item) return errorResult(`Project-management item ${item_id} not found`);
      return jsonResult({ ok: true, item });
    },
  );

  server.tool(
    "project_management_delete_item",
    "Delete one project-management module item. Only call after the user explicitly asks to delete, and after you have confirmed the item id via search/list.",
    {
      project_id: z.string().min(1),
      item_id: z.string().min(1),
    },
    async ({ project_id, item_id }) => {
      const ok = await repo.deleteModuleItem(project_id, item_id);
      if (!ok) return errorResult(`Project-management item ${item_id} not found`);
      return jsonResult({ ok: true, id: item_id });
    },
  );

  server.tool(
    "project_management_reorder_items",
    "Reorder items inside one project-management module scope. Pass the complete ordered item id list for the current module/parent scope.",
    {
      project_id: z.string().min(1),
      module_key: moduleKeySchema,
      item_ids: z.array(z.string().min(1)).min(1),
    },
    async ({ project_id, module_key, item_ids }) => {
      await repo.reorderModuleItems(project_id, module_key, item_ids);
      return jsonResult({ ok: true, project_id, module_key, count: item_ids.length });
    },
  );

  server.tool(
    "project_dictionary_list_systems",
    "List data-dictionary libraries/systems for a project. Use this before reading table or field metadata.",
    {
      project_id: z.string().min(1),
    },
    async ({ project_id }) => jsonResult(await repo.listDictionarySystems(project_id)),
  );

  server.tool(
    "project_dictionary_list_tables",
    "List data-dictionary tables/files under a project or one system. A table is a metadata entity and can represent a database table or a file-like source.",
    {
      project_id: z.string().min(1),
      system_id: z.string().min(1).optional(),
    },
    async ({ project_id, system_id }) => jsonResult(await repo.listDictionaryTables(project_id, system_id)),
  );

  server.tool(
    "project_dictionary_list_fields",
    "List field metadata for a data-dictionary table. Returns field type, length, format, description, code values, mapping snippets, and remarks when available.",
    {
      project_id: z.string().min(1),
      table_id: z.string().min(1),
    },
    async ({ project_id, table_id }) => jsonResult(await repo.listDictionaryFields(project_id, table_id)),
  );

  server.tool(
    "project_dictionary_get_field",
    "Get full metadata for one data-dictionary field. Use this when the UI floating panel needs all field properties or before changing a mapping rule.",
    {
      project_id: z.string().min(1),
      field_id: z.string().min(1),
    },
    async ({ project_id, field_id }) => {
      const field = await repo.getDictionaryField(project_id, field_id);
      if (!field) return errorResult(`Project dictionary field ${field_id} not found`);
      return jsonResult(field);
    },
  );

  server.tool(
    "project_dictionary_search_fields",
    "Search data-dictionary fields by English name, Chinese name, table, code value, mapping logic, or description. Use this for high-recall Mapping exploration.",
    {
      project_id: z.string().min(1),
      query: z.string().min(1),
      limit: z.number().int().min(1).max(100).default(30),
    },
    async ({ project_id, query, limit }) => jsonResult({
      project_id,
      query,
      results: await repo.searchDictionaryFields(project_id, query, limit),
    }),
  );

  server.tool(
    "project_dictionary_resolve_field_refs",
    "Resolve field references such as '库.表.字段', '表.字段', or imported Mapping field tokens to known dictionary field entities. Use this before writing Mapping content so references stay linked.",
    {
      project_id: z.string().min(1),
      refs: z.array(z.string().min(1)).min(1).max(200),
    },
    async ({ project_id, refs }) => jsonResult({
      project_id,
      results: await repo.resolveDictionaryFieldRefs(project_id, refs),
    }),
  );

  server.tool(
    "project_dictionary_list_rectifications",
    "List data-dictionary rectification records. These are AI/user-maintained requirements for library/table/field/codeSet/mapping metadata fixes.",
    {
      project_id: z.string().min(1),
    },
    async ({ project_id }) => jsonResult(await repo.listDictionaryRectifications(project_id)),
  );

  server.tool(
    "project_dictionary_create_rectification",
    "Create a data-dictionary rectification record when field/table/code/mapping metadata needs to be fixed or normalized. Use this instead of silently guessing the correct metadata.",
    {
      project_id: z.string().min(1),
      entity_type: rectificationEntityTypeSchema,
      entity_id: z.string().min(1),
      property_key: z.string().min(1).max(120),
      requirement: z.string().min(1).max(4000),
      created_by: z.string().min(1).max(120).optional(),
    },
    async ({ project_id, entity_type, entity_id, property_key, requirement, created_by }) => {
      const record = await repo.createDictionaryRectification(project_id, {
        entityType: entity_type,
        entityId: entity_id,
        propertyKey: property_key,
        requirement,
        createdBy: created_by,
      });
      return jsonResult({ ok: true, record });
    },
  );

  server.tool(
    "project_dictionary_update_rectification",
    "Update the status or resolution note of a data-dictionary rectification record.",
    {
      project_id: z.string().min(1),
      rectification_id: z.string().min(1),
      status: rectificationStatusSchema.optional(),
      resolution_note: z.string().max(4000).nullable().optional(),
      resolved_by: z.string().max(120).nullable().optional(),
    },
    async ({ project_id, rectification_id, status, resolution_note, resolved_by }) => {
      const patch: Parameters<ProjectManagementRepo["updateDictionaryRectification"]>[2] = {
        status: status as ProjectDictionaryRectification["status"] | undefined,
        resolutionNote: resolution_note,
        resolvedBy: resolved_by,
      };
      const record = await repo.updateDictionaryRectification(project_id, rectification_id, patch);
      if (!record) return errorResult(`Project dictionary rectification ${rectification_id} not found`);
      return jsonResult({ ok: true, record });
    },
  );

  server.tool(
    "project_dictionary_list_mapping_rules",
    "List Mapping 元 rules for one dictionary table. Returns each rule with sourceFields and actions so AI can review table-level Mapping by scenario and field.",
    {
      project_id: z.string().min(1),
      table_id: z.string().min(1),
    },
    async ({ project_id, table_id }) => jsonResult({
      project_id,
      table_id,
      rules: await repo.listDictionaryMappingRules(project_id, table_id),
    }),
  );

  server.tool(
    "project_dictionary_get_mapping_rule",
    "Get one Mapping 元 rule by id, including its involved source fields and standard action chain.",
    {
      project_id: z.string().min(1),
      mapping_rule_id: z.string().min(1),
    },
    async ({ project_id, mapping_rule_id }) => {
      const rule = await repo.getDictionaryMappingRule(project_id, mapping_rule_id);
      if (!rule) return errorResult(`Project dictionary mapping rule ${mapping_rule_id} not found`);
      return jsonResult(rule);
    },
  );

  server.tool(
    "project_dictionary_update_mapping_rule",
    "Patch one Mapping 元 rule. Use this for status, logic_text, converted_sql, remark, field binding, and raw scenario metadata. Preserve unknown raw fields.",
    {
      project_id: z.string().min(1),
      mapping_rule_id: z.string().min(1),
      scenario_id: z.string().min(1).nullable().optional(),
      system_id: z.string().min(1).nullable().optional(),
      table_id: z.string().min(1).nullable().optional(),
      field_id: z.string().min(1).nullable().optional(),
      status: mappingStatusSchema.optional(),
      logic_text: z.string().max(16000).nullable().optional(),
      converted_sql: z.string().max(16000).nullable().optional(),
      remark: z.string().max(8000).nullable().optional(),
      sort_order: z.number().int().optional(),
      raw: mappingRawSchema.optional(),
    },
    async ({ project_id, mapping_rule_id, scenario_id, system_id, table_id, field_id, status, logic_text, converted_sql, remark, sort_order, raw }) => {
      const rule = await repo.updateDictionaryMappingRule(project_id, mapping_rule_id, compactMappingRulePatch({
        scenario_id,
        system_id,
        table_id,
        field_id,
        status,
        logic_text,
        converted_sql,
        remark,
        sort_order,
        raw,
      }));
      if (!rule) return errorResult(`Project dictionary mapping rule ${mapping_rule_id} not found`);
      return jsonResult({ ok: true, rule });
    },
  );

  server.tool(
    "project_dictionary_update_mapping_action",
    "Patch one Mapping 标准动作. Actions describe SQL-convertible operations such as direct, default, condition, join, format, sum, concat, substring, and null handling.",
    {
      project_id: z.string().min(1),
      action_id: z.string().min(1),
      action_type: z.string().min(1).max(80).optional(),
      condition_text: z.string().max(8000).nullable().optional(),
      expression_text: z.string().max(8000).nullable().optional(),
      result_text: z.string().max(8000).nullable().optional(),
      remark: z.string().max(4000).nullable().optional(),
      sort_order: z.number().int().optional(),
      raw: mappingRawSchema.optional(),
      source_field_ids: z.array(z.string().min(1)).max(200).optional(),
    },
    async ({ project_id, action_id, action_type, condition_text, expression_text, result_text, remark, sort_order, raw, source_field_ids }) => {
      const action = await repo.updateDictionaryMappingAction(project_id, action_id, compactMappingActionPatch({
        action_type,
        condition_text,
        expression_text,
        result_text,
        remark,
        sort_order,
        raw,
        source_field_ids,
      }));
      if (!action) return errorResult(`Project dictionary mapping action ${action_id} not found`);
      return jsonResult({ ok: true, action });
    },
  );

  server.tool(
    "project_dictionary_replace_mapping_actions",
    "Replace the full standard action chain for one Mapping 元 rule. Use after reading the rule; send the complete ordered action list.",
    {
      project_id: z.string().min(1),
      mapping_rule_id: z.string().min(1),
      actions: z.array(mappingActionInputSchema).max(200),
    },
    async ({ project_id, mapping_rule_id, actions }) => {
      const rule = await repo.replaceDictionaryMappingActions(project_id, mapping_rule_id, compactMappingActionInputs(actions));
      if (!rule) return errorResult(`Project dictionary mapping rule ${mapping_rule_id} not found`);
      return jsonResult({ ok: true, rule });
    },
  );

  server.tool(
    "project_dictionary_replace_mapping_source_fields",
    "Replace the involved source field refs for one Mapping 元 rule. Prefer field_id when the ref can be resolved; keep ref_path for external or unresolved fields.",
    {
      project_id: z.string().min(1),
      mapping_rule_id: z.string().min(1),
      source_fields: z.array(mappingSourceFieldInputSchema).max(500),
    },
    async ({ project_id, mapping_rule_id, source_fields }) => {
      const rule = await repo.replaceDictionaryMappingSourceFields(project_id, mapping_rule_id, compactMappingSourceFieldInputs(source_fields));
      if (!rule) return errorResult(`Project dictionary mapping rule ${mapping_rule_id} not found`);
      return jsonResult({ ok: true, rule });
    },
  );

  server.tool(
    "project_dictionary_validate_mapping_table",
    "Validate Mapping 元 completeness for one table: source field links, logic/actions, completion status, and converted SQL availability.",
    {
      project_id: z.string().min(1),
      table_id: z.string().min(1),
    },
    async ({ project_id, table_id }) => jsonResult(await repo.validateDictionaryMappingTable(project_id, table_id)),
  );
}
