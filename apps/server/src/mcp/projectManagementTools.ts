import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  PROJECT_MANAGEMENT_MODULES,
  type ProjectDictionaryRectification,
  type ProjectManagementModuleKey,
  type ProjectManagementRepo,
  type ProjectModuleItem,
  type ProjectModuleItemPatch,
} from "../repos/ProjectManagementRepo.js";
import { validateDictionaryMappingSql } from "../modules/project-dictionary/application/entityService.js";
import { loadDictionaryEntityTarget } from "../routes/projectManagement.js";
import { getProjectDescription, saveProjectDescription } from "../modules/project-description/projectDescriptionService.js";

const moduleKeys = PROJECT_MANAGEMENT_MODULES.map(module => module.key) as [
  ProjectManagementModuleKey,
  ...ProjectManagementModuleKey[],
];

const moduleKeySchema = z.enum(moduleKeys);
const rectificationEntityTypeSchema = z.enum(["library", "table", "field", "codeSet", "mapping"]);
const rectificationStatusSchema = z.enum(["open", "fixed", "verified", "cancelled"]);
const mappingStatusSchema = z.enum(["draft", "complete", "unable_to_convert", "invalid", "manual", "blocked"]);
const mappingRawSchema = z.record(z.string(), z.unknown());
const todoStatusSchema = z.enum(["todo", "doing", "done"]);
const verificationStatusSchema = z.enum(["未验证", "已验证", "待整改"]);
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
const mappingTempFieldInputSchema = z.object({
  id: z.string().min(1).optional(),
  field_name: z.string().min(1).max(160),
  field_cn: z.string().max(500).nullable().optional(),
  field_type: z.string().max(120).nullable().optional(),
  field_length: z.string().max(80).nullable().optional(),
  logic_text: z.string().max(32_000).nullable().optional(),
  converted_sql: z.string().max(32_000).nullable().optional(),
  remark: z.string().max(4_000).nullable().optional(),
  sort_order: z.number().int().optional(),
  raw: mappingRawSchema.optional(),
});
const mappingTempTableInputSchema = z.object({
  id: z.string().min(1).optional(),
  table_name: z.string().min(1).max(160),
  table_cn: z.string().max(500).nullable().optional(),
  logic_text: z.string().max(32_000).nullable().optional(),
  converted_sql: z.string().max(100_000).nullable().optional(),
  remark: z.string().max(4_000).nullable().optional(),
  sort_order: z.number().int().optional(),
  raw: mappingRawSchema.optional(),
  fields: z.array(mappingTempFieldInputSchema).max(500).default([]),
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

function projectTodoOriginal(item: ProjectModuleItem): Record<string, unknown> {
  const original = item.content.original;
  return original && typeof original === "object" && !Array.isArray(original)
    ? original as Record<string, unknown>
    : {};
}

function projectTodoSubtitle(status: string, owner: string): string {
  return [status, owner].filter(Boolean).join(" · ");
}

function projectTodoString(value: string | null | undefined): string {
  return value ?? "";
}

function projectTodoMatchesStatus(item: ProjectModuleItem, status?: z.infer<typeof todoStatusSchema>): boolean {
  return !status || String(projectTodoOriginal(item).status || "todo").trim().toLowerCase() === status;
}

function projectTodoSummary(todos: ProjectModuleItem[]) {
  const counts = { todo: 0, doing: 0, done: 0, highPriority: 0, unassigned: 0, withDueDate: 0 };
  for (const todo of todos) {
    const original = projectTodoOriginal(todo);
    const status = String(original.status || "todo").trim().toLowerCase();
    if (status === "todo" || status === "doing" || status === "done") counts[status] += 1;
    if (String(original.priority || "").trim() === "高") counts.highPriority += 1;
    if (!String(original.owner || "").trim()) counts.unassigned += 1;
    if (String(original.dueAt || original.deadline || "").trim()) counts.withDueDate += 1;
  }
  return { total: todos.length, ...counts };
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
  verification_status?: "未验证" | "已验证" | "待整改" | null;
  verification_remark?: string | null;
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
    verificationStatus: input.verification_status,
    verificationRemark: input.verification_remark,
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

function compactDictionaryFieldPatch(input: Record<string, unknown>): Parameters<NonNullable<ProjectManagementRepo["updateDictionaryField"]>>[2] {
  return {
    fieldCn: input.field_cn as string | null | undefined,
    fieldType: input.field_type as string | null | undefined,
    fieldLength: input.field_length as string | null | undefined,
    formatPattern: input.format_pattern as string | null | undefined,
    nullable: input.nullable as string | null | undefined,
    primaryKey: input.primary_key as boolean | undefined,
    required: input.required as boolean | undefined,
    description: input.description as string | null | undefined,
    acquireLogic: input.acquire_logic as string | null | undefined,
    validationRule: input.validation_rule as string | null | undefined,
    codeValue: input.code_value as string | null | undefined,
    mappedTable: input.mapped_table as string | null | undefined,
    mappedField: input.mapped_field as string | null | undefined,
    mappedFieldCn: input.mapped_field_cn as string | null | undefined,
    dataSource: input.data_source as string | null | undefined,
    remark: input.remark as string | null | undefined,
    verificationStatus: input.verification_status as "未验证" | "已验证" | "待整改" | null | undefined,
    verificationRemark: input.verification_remark as string | null | undefined,
    extra: input.extra as Record<string, unknown> | undefined,
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

function compactMappingTempTableInputs(tempTables: z.infer<typeof mappingTempTableInputSchema>[]): Parameters<ProjectManagementRepo["replaceDictionaryMappingTempTables"]>[2] {
  return tempTables.map(tempTable => ({
    id: tempTable.id,
    tableName: tempTable.table_name,
    tableCn: tempTable.table_cn,
    logicText: tempTable.logic_text,
    convertedSql: tempTable.converted_sql,
    remark: tempTable.remark,
    sortOrder: tempTable.sort_order,
    raw: tempTable.raw,
    fields: tempTable.fields.map(field => ({
      id: field.id,
      fieldName: field.field_name,
      fieldCn: field.field_cn,
      fieldType: field.field_type,
      fieldLength: field.field_length,
      logicText: field.logic_text,
      convertedSql: field.converted_sql,
      remark: field.remark,
      sortOrder: field.sort_order,
      raw: field.raw,
    })),
  }));
}

export function registerProjectManagementTools(server: McpServer, repo: ProjectManagementRepo): void {
  server.tool(
    "project_management_get_description",
    "Read the canonical rich-text project description and its plain-text AI context. Call this first when joining an unfamiliar Rich project.",
    {
      project_id: z.string().min(1).describe("Rich project id."),
    },
    async ({ project_id }) => jsonResult(await getProjectDescription(repo, project_id)),
  );

  server.tool(
    "project_management_update_description",
    "Replace the canonical project description shown in 项目说明. Send the complete rich-text HTML content; the result includes both rendered HTML and plain-text AI context.",
    {
      project_id: z.string().min(1).describe("Rich project id."),
      html: z.string().max(500_000).describe("Complete rich-text HTML for 项目说明. Use an empty string to clear it."),
    },
    async ({ project_id, html }) => jsonResult(await saveProjectDescription(repo, project_id, html)),
  );

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
    "Search across the project-management app: project description, data dictionary, workflow, scenario manual, environment config, deployment steps, monitoring, code versions, todos, and folders. Use this before updating or deleting when you only know text.",
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
    "List structured items from a project-management module. This covers 项目说明, 作业流程, 场景手册, 环境配置, 部署步骤, 监控预警, 代码版本, 项目代办 and 文件夹. For nested modules pass parent_id.",
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
    "project_todo_summary",
    "Get an at-a-glance todo summary: total, status counts, high-priority, unassigned and dated todos. Use this before planning or assigning project todos.",
    {
      project_id: z.string().min(1),
    },
    async ({ project_id }) => jsonResult(projectTodoSummary(await repo.listModuleItems(project_id, "todos"))),
  );

  server.tool(
    "project_todo_list",
    "List project todos in board order. Optionally filter by todo/doing/done status or exact owner. Use this before updating or deleting a todo when you need its id.",
    {
      project_id: z.string().min(1),
      status: todoStatusSchema.optional(),
      owner: z.string().min(1).max(240).optional(),
    },
    async ({ project_id, status, owner }) => {
      const todos = await repo.listModuleItems(project_id, "todos");
      return jsonResult(todos.filter(todo => {
        const original = projectTodoOriginal(todo);
        return projectTodoMatchesStatus(todo, status)
          && (!owner || String(original.owner || "").trim() === owner);
      }));
    },
  );

  server.tool(
    "project_todo_get",
    "Get one project todo by id, including title, status, owner, priority, dueAt, description and preserved original metadata.",
    {
      project_id: z.string().min(1),
      todo_id: z.string().min(1),
    },
    async ({ project_id, todo_id }) => {
      const todo = (await repo.listModuleItems(project_id, "todos")).find(item => item.id === todo_id);
      if (!todo) return errorResult(`Project todo ${todo_id} not found`);
      return jsonResult(todo);
    },
  );

  server.tool(
    "project_todo_create",
    "Create a project todo. The UI-compatible fields are title, status, owner, priority, due_at and description.",
    {
      project_id: z.string().min(1),
      title: z.string().min(1).max(240),
      status: todoStatusSchema.default("todo"),
      owner: z.string().max(240).optional(),
      priority: z.string().max(120).optional(),
      due_at: z.string().max(120).optional(),
      description: z.string().max(16_000).optional(),
      sort_order: z.number().int().optional(),
    },
    async ({ project_id, title, status, owner, priority, due_at, description, sort_order }) => {
      const original = {
        title,
        status,
        owner: owner ?? "",
        priority: priority ?? "普通",
        dueAt: due_at ?? "",
        description: description ?? "",
      };
      const todo = await repo.createModuleItem(project_id, {
        moduleKey: "todos",
        title,
        subtitle: projectTodoSubtitle(status, original.owner),
        sortOrder: sort_order,
        content: { original },
      });
      return jsonResult({ ok: true, todo });
    },
  );

  server.tool(
    "project_todo_update",
    "Patch one project todo. Omitted fields are preserved; pass null for owner, priority, due_at or description to clear that field.",
    {
      project_id: z.string().min(1),
      todo_id: z.string().min(1),
      title: z.string().min(1).max(240).optional(),
      status: todoStatusSchema.optional(),
      owner: z.string().max(240).nullable().optional(),
      priority: z.string().max(120).nullable().optional(),
      due_at: z.string().max(120).nullable().optional(),
      description: z.string().max(16_000).nullable().optional(),
      sort_order: z.number().int().optional(),
    },
    async ({ project_id, todo_id, title, status, owner, priority, due_at, description, sort_order }) => {
      const current = (await repo.listModuleItems(project_id, "todos")).find(item => item.id === todo_id);
      if (!current) return errorResult(`Project todo ${todo_id} not found`);
      const currentOriginal = projectTodoOriginal(current);
      const nextTitle = title ?? String(currentOriginal.title || current.title || "未命名待办");
      const nextStatus = status ?? String(currentOriginal.status || "todo");
      const nextOwner = owner === undefined ? String(currentOriginal.owner || "") : projectTodoString(owner);
      const nextOriginal = {
        ...currentOriginal,
        title: nextTitle,
        status: nextStatus,
        owner: nextOwner,
        priority: priority === undefined ? String(currentOriginal.priority || "") : projectTodoString(priority),
        dueAt: due_at === undefined ? String(currentOriginal.dueAt || currentOriginal.deadline || "") : projectTodoString(due_at),
        description: description === undefined ? String(currentOriginal.description || "") : projectTodoString(description),
      };
      const todo = await repo.updateModuleItem(project_id, todo_id, {
        title: nextTitle,
        subtitle: projectTodoSubtitle(nextStatus, nextOwner),
        sortOrder: sort_order,
        content: { ...current.content, original: nextOriginal },
      });
      if (!todo) return errorResult(`Project todo ${todo_id} not found`);
      return jsonResult({ ok: true, todo });
    },
  );

  server.tool(
    "project_todo_delete",
    "Delete one project todo. Call only after the user explicitly asked to delete it and you have confirmed the todo id.",
    {
      project_id: z.string().min(1),
      todo_id: z.string().min(1),
    },
    async ({ project_id, todo_id }) => {
      const exists = (await repo.listModuleItems(project_id, "todos")).some(item => item.id === todo_id);
      if (!exists) return errorResult(`Project todo ${todo_id} not found`);
      const ok = await repo.deleteModuleItem(project_id, todo_id);
      if (!ok) return errorResult(`Project todo ${todo_id} not found`);
      return jsonResult({ ok: true, id: todo_id });
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
    "project_dictionary_update_system",
    "Patch a data-dictionary system's type, asset layer, or extra connection metadata. Read the system first and preserve unknown extra fields.",
    {
      project_id: z.string().min(1),
      system_id: z.string().min(1),
      type: z.string().max(500).nullable().optional(),
      asset_layer: z.string().max(500).nullable().optional(),
      extra: mappingRawSchema.optional(),
    },
    async ({ project_id, system_id, type, asset_layer, extra }) => {
      const system = await repo.updateDictionarySystem(project_id, system_id, { type, assetLayer: asset_layer, extra });
      if (!system) return errorResult(`Project dictionary system ${system_id} not found`);
      return jsonResult({ ok: true, system });
    },
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
    "project_dictionary_update_table",
    "Patch data-dictionary table metadata. Supports all common table fields; supplied extra metadata is merged without removing existing keys.",
    {
      project_id: z.string().min(1),
      table_id: z.string().min(1),
      system_id: z.string().min(1).nullable().optional(),
      table_name: z.string().min(1).max(500).optional(),
      table_cn: z.string().max(1000).nullable().optional(),
      table_group: z.string().max(500).nullable().optional(),
      data_layer: z.string().max(500).nullable().optional(),
      table_type: z.string().max(500).nullable().optional(),
      source_kind: z.enum(["文件", "数据库"]).nullable().optional(),
      file_type: z.enum(["txt", "xml", "csv", "excel"]).nullable().optional(),
      has_mapping: z.boolean().optional(),
      usage_status: z.string().max(120).nullable().optional(),
      verification_status: verificationStatusSchema.nullable().optional(),
      verification_remark: z.string().max(8000).nullable().optional(),
      description: z.string().max(20_000).nullable().optional(),
      caliber: z.string().max(100_000).nullable().optional(),
      extra: mappingRawSchema.optional(),
    },
    async ({ project_id, table_id, system_id, table_name, table_cn, table_group, data_layer, table_type, source_kind, file_type, has_mapping, usage_status, verification_status, verification_remark, description, caliber, extra }) => {
      const table = await repo.updateDictionaryTable(project_id, table_id, {
        systemId: system_id,
        tableName: table_name,
        tableCn: table_cn,
        tableGroup: table_group,
        dataLayer: data_layer,
        tableType: table_type,
        sourceKind: source_kind,
        fileType: file_type,
        hasMapping: has_mapping,
        usageStatus: usage_status,
        verificationStatus: verification_status,
        verificationRemark: verification_remark,
        description,
        caliber,
        extra,
      });
      if (!table) return errorResult(`Project dictionary table ${table_id} not found`);
      return jsonResult({ ok: true, table });
    },
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
    "project_dictionary_update_field",
    "Patch field metadata (type, length, nullability, Mapping references, logic, validation and descriptions). Read the field first and provide only properties to change.",
    {
      project_id: z.string().min(1), field_id: z.string().min(1),
      field_cn: z.string().max(500).nullable().optional(), field_type: z.string().max(120).nullable().optional(), field_length: z.string().max(80).nullable().optional(), format_pattern: z.string().max(500).nullable().optional(), nullable: z.string().max(80).nullable().optional(),
      primary_key: z.boolean().optional(), required: z.boolean().optional(), description: z.string().max(8000).nullable().optional(), acquire_logic: z.string().max(16000).nullable().optional(), validation_rule: z.string().max(8000).nullable().optional(), code_value: z.string().max(8000).nullable().optional(),
      mapped_table: z.string().max(500).nullable().optional(), mapped_field: z.string().max(500).nullable().optional(), mapped_field_cn: z.string().max(500).nullable().optional(), data_source: z.string().max(2000).nullable().optional(), remark: z.string().max(8000).nullable().optional(), verification_status: verificationStatusSchema.nullable().optional(), verification_remark: z.string().max(8000).nullable().optional(), extra: mappingRawSchema.optional(),
    },
    async input => {
      const field = await repo.updateDictionaryField(input.project_id, input.field_id, compactDictionaryFieldPatch(input));
      if (!field) return errorResult(`Project dictionary field ${input.field_id} not found`);
      return jsonResult({ ok: true, field });
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
    "project_dictionary_list_mapping_scenarios",
    "List the structured Mapping scenarios for one dictionary table. Each scenario owns its caliber and can be joined to field Mapping rules by scenario_id.",
    {
      project_id: z.string().min(1),
      table_id: z.string().min(1),
    },
    async ({ project_id, table_id }) => jsonResult({
      project_id,
      table_id,
      scenarios: await repo.listDictionaryMappingScenarios(project_id, table_id),
    }),
  );

  server.tool(
    "project_dictionary_create_mapping_scenario",
    "Create one structured Mapping scenario for a dictionary table. Then assign its field rules with project_dictionary_update_mapping_rule.",
    {
      project_id: z.string().min(1),
      table_id: z.string().min(1),
      title: z.string().min(1).max(240),
      caliber: z.string().max(100_000).nullable().optional(),
      remark: z.string().max(8000).nullable().optional(),
      sort_order: z.number().int().optional(),
      raw: mappingRawSchema.optional(),
    },
    async ({ project_id, table_id, title, caliber, remark, sort_order, raw }) => jsonResult({
      ok: true,
      scenario: await repo.createDictionaryMappingScenario(project_id, { tableId: table_id, title, caliber, remark, sortOrder: sort_order, raw }),
    }),
  );

  server.tool(
    "project_dictionary_update_mapping_scenario",
    "Patch the title, caliber, remark, order, or raw metadata of one structured Mapping scenario.",
    {
      project_id: z.string().min(1),
      scenario_id: z.string().min(1),
      title: z.string().min(1).max(240).optional(),
      caliber: z.string().max(100_000).nullable().optional(),
      remark: z.string().max(8000).nullable().optional(),
      sort_order: z.number().int().optional(),
      raw: mappingRawSchema.optional(),
    },
    async ({ project_id, scenario_id, title, caliber, remark, sort_order, raw }) => {
      const scenario = await repo.updateDictionaryMappingScenario(project_id, scenario_id, { title, caliber, remark, sortOrder: sort_order, raw });
      if (!scenario) return errorResult(`Project dictionary mapping scenario ${scenario_id} not found`);
      return jsonResult({ ok: true, scenario });
    },
  );

  server.tool(
    "project_dictionary_delete_mapping_scenario",
    "Delete one Mapping scenario. Its field Mapping rules are retained but unassigned, so they can be moved to another scenario.",
    {
      project_id: z.string().min(1),
      scenario_id: z.string().min(1),
    },
    async ({ project_id, scenario_id }) => {
      const deleted = await repo.deleteDictionaryMappingScenario(project_id, scenario_id);
      return deleted ? jsonResult({ ok: true, scenario_id }) : errorResult(`Project dictionary mapping scenario ${scenario_id} not found`);
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
    "Patch one Mapping 元 rule. Use this for status, logic_text, converted_sql, verification status/remark, remark, field binding, and raw scenario metadata. Preserve unknown raw fields.",
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
      verification_status: verificationStatusSchema.nullable().optional(),
      verification_remark: z.string().max(8000).nullable().optional(),
      sort_order: z.number().int().optional(),
      raw: mappingRawSchema.optional(),
    },
    async ({ project_id, mapping_rule_id, scenario_id, system_id, table_id, field_id, status, logic_text, converted_sql, remark, verification_status, verification_remark, sort_order, raw }) => {
      const rule = await repo.updateDictionaryMappingRule(project_id, mapping_rule_id, compactMappingRulePatch({
        scenario_id,
        system_id,
        table_id,
        field_id,
        status,
        logic_text,
        converted_sql,
        remark,
        verification_status,
        verification_remark,
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

  server.tool(
    "project_dictionary_list_mapping_temp_tables",
    "List Mapping temporary tables and their fields for one target dictionary table.",
    {
      project_id: z.string().min(1),
      table_id: z.string().min(1),
    },
    async ({ project_id, table_id }) => jsonResult({
      project_id,
      table_id,
      temp_tables: await repo.listDictionaryMappingTempTables(project_id, table_id),
    }),
  );

  server.tool(
    "project_dictionary_replace_mapping_temp_tables",
    "Replace all Mapping temporary tables and their fields for one target table. Each temporary table must provide converted_sql as a SELECT query (or logic_text plus field converted_sql expressions); the extraction procedure creates these tables before running the target Mapping.",
    {
      project_id: z.string().min(1),
      table_id: z.string().min(1),
      temp_tables: z.array(mappingTempTableInputSchema).max(100),
    },
    async ({ project_id, table_id, temp_tables }) => jsonResult({
      ok: true,
      project_id,
      table_id,
      temp_tables: await repo.replaceDictionaryMappingTempTables(project_id, table_id, compactMappingTempTableInputs(temp_tables)),
    }),
  );

  server.tool(
    "project_dictionary_validate_mapping_sql",
    "Compile and validate a table's Mapping SQL against its configured database. Returns caliber SQL and per-field validation results. Optional caliber and field_rules validate unsaved edits without changing metadata.",
    {
      project_id: z.string().min(1),
      table_id: z.string().min(1),
      caliber: z.string().max(100_000).optional(),
      field_rules: z.array(z.object({ field_id: z.string().min(1), logic: z.string().max(100_000) })).max(500).optional(),
      runtime_params: mappingRawSchema.optional(),
    },
    async ({ project_id, table_id, caliber, field_rules, runtime_params }) => {
      const target = await loadDictionaryEntityTarget(repo, project_id, table_id);
      return jsonResult(await validateDictionaryMappingSql({
        ...target,
        projectId: project_id,
        repo,
        caliber,
        fieldRules: field_rules?.map(rule => ({ fieldId: rule.field_id, logic: rule.logic })),
        runtimeParams: runtime_params,
      }));
    },
  );
}
