import { describe, expect, it } from "vitest";
import { buildMcpServer } from "../src/mcp/server.js";
import type {
  ProjectDictionaryFieldDetail,
  ProjectDictionaryFieldHit,
  ProjectDictionaryFieldPatch,
  ProjectDictionaryMappingAction,
  ProjectDictionaryMappingActionInput,
  ProjectDictionaryMappingActionPatch,
  ProjectDictionaryMappingRule,
  ProjectDictionaryMappingRulePatch,
  ProjectDictionaryMappingSourceFieldInput,
  ProjectDictionaryMappingTempTable,
  ProjectDictionaryMappingTempTableInput,
  ProjectDictionaryMappingValidation,
  ProjectDictionaryTable,
  ProjectManagementModuleKey,
  ProjectManagementRepo,
  ProjectModuleItem,
} from "../src/repos/ProjectManagementRepo.js";

function tool(server: unknown, name: string) {
  return (server as { _registeredTools: Record<string, { inputSchema: { safeParse(input: unknown): { success: boolean } }; handler(args: unknown): Promise<unknown> }> })._registeredTools[name];
}

function textOf(result: unknown): string {
  return ((result as { content: Array<{ text: string }> }).content[0]).text;
}

function makeProjectManagementRepo(): ProjectManagementRepo {
  const items = new Map<string, ProjectModuleItem>();
  const mappingRules = new Map<string, ProjectDictionaryMappingRule>();
  let tempTables: ProjectDictionaryMappingTempTable[] = [];
  let tables: ProjectDictionaryTable[] = [{ id: "table-1", systemId: "sys-1", tableName: "BLZCCZ", tableCn: "不良资产处置", dataLayer: "源表层", sourceKind: "数据库", usageStatus: "未使用", extra: { existingFlag: true }, fieldCount: 1 }];
  const fields: ProjectDictionaryFieldHit[] = [{
    id: "field-1",
    tableId: "table-1",
    tableName: "BLZCCZ",
    tableCn: "不良资产处置",
    fieldName: "G080009",
    fieldCn: "处置本金金额",
    fieldType: "decimal",
    fieldLength: "20,2",
    formatPattern: "数字，精度20,2",
    description: "填报该笔处置交易的本金处置发生额。",
    codeItems: [],
    score: 10,
  }];
  mappingRules.set("mapping-1", {
    id: "mapping-1",
    projectId: "capital-bank-ybt",
    tableId: "table-1",
    fieldId: "field-1",
    status: "draft",
    logicText: "直取源字段。",
    sortOrder: 1,
    sourceFields: [{
      id: "source-1",
      projectId: "capital-bank-ybt",
      mappingRuleId: "mapping-1",
      fieldId: "field-1",
      refPath: "YBT.BLZCCZ.G080009",
      sortOrder: 1,
      createdAt: "2026-08-20T00:00:00.000Z",
      updatedAt: "2026-08-20T00:00:00.000Z",
    }],
    actions: [],
    createdAt: "2026-08-20T00:00:00.000Z",
    updatedAt: "2026-08-20T00:00:00.000Z",
  });

  return {
    async getSummary(projectId) {
      return {
        projectId,
        modules: [
          { key: "workflow", label: "作业流程", count: 1 },
          { key: "scenarios", label: "场景手册", count: 0 },
        ],
        dictionary: { systems: 1, tables: 1, fields: fields.length },
      };
    },
    async searchAll(projectId, query, limit) {
      return Array.from(items.values())
        .filter(item => item.projectId === projectId && item.title.includes(query))
        .slice(0, limit)
        .map(item => ({
          id: item.id,
          moduleKey: item.moduleKey,
          entityType: "moduleItem",
          entityId: item.id,
          title: item.title,
          subtitle: item.subtitle,
          excerpt: item.subtitle,
          score: 1,
          updatedAt: item.updatedAt,
        }));
    },
    async listModuleItems(projectId, moduleKey, parentId) {
      return Array.from(items.values())
        .filter(item => item.projectId === projectId && item.moduleKey === moduleKey && item.parentId === parentId)
        .sort((a, b) => a.sortOrder - b.sortOrder);
    },
    async createModuleItem(projectId, input) {
      const now = "2026-08-20T00:00:00.000Z";
      const item: ProjectModuleItem = {
        id: `pm-${items.size + 1}`,
        projectId,
        moduleKey: input.moduleKey,
        parentId: input.parentId ?? undefined,
        title: input.title,
        subtitle: input.subtitle ?? undefined,
        sortOrder: input.sortOrder ?? items.size,
        content: input.content ?? {},
        createdAt: now,
        updatedAt: now,
      };
      items.set(item.id, item);
      return item;
    },
    async updateModuleItem(projectId, itemId, patch) {
      const current = items.get(itemId);
      if (!current || current.projectId !== projectId) return null;
      const next = {
        ...current,
        parentId: patch.parentId === null ? undefined : patch.parentId ?? current.parentId,
        title: patch.title ?? current.title,
        subtitle: patch.subtitle === null ? undefined : patch.subtitle ?? current.subtitle,
        sortOrder: patch.sortOrder ?? current.sortOrder,
        content: patch.content ?? current.content,
        updatedAt: "2026-08-20T00:01:00.000Z",
      };
      items.set(itemId, next);
      return next;
    },
    async deleteModuleItem(projectId, itemId) {
      const current = items.get(itemId);
      if (!current || current.projectId !== projectId) return false;
      return items.delete(itemId);
    },
    async reorderModuleItems(projectId, moduleKey, itemIds) {
      itemIds.forEach((id, index) => {
        const item = items.get(id);
        if (item?.projectId === projectId && item.moduleKey === moduleKey) {
          items.set(id, { ...item, sortOrder: index });
        }
      });
    },
    async listDictionarySystems() {
      return [{ id: "sys-1", code: "YBT", name: "sys-ybt", type: "source system", assetLayer: "source layer", fieldCount: fields.length, tableCount: 1 }];
    },
    async listDictionaryTables() {
      return tables.map(table => ({ ...table, fieldCount: fields.length }));
    },
    async updateDictionaryTable(_projectId, tableId, patch) {
      const index = tables.findIndex(table => table.id === tableId);
      if (index < 0) return null;
      const current = tables[index]!;
      tables[index] = {
        ...current,
        systemId: patch.systemId === undefined ? current.systemId : patch.systemId ?? undefined,
        tableName: patch.tableName ?? current.tableName,
        tableCn: patch.tableCn === undefined ? current.tableCn : patch.tableCn ?? undefined,
        tableGroup: patch.tableGroup === undefined ? current.tableGroup : patch.tableGroup ?? undefined,
        dataLayer: patch.dataLayer === undefined ? current.dataLayer : patch.dataLayer ?? undefined,
        tableType: patch.tableType === undefined ? current.tableType : patch.tableType ?? undefined,
        sourceKind: patch.sourceKind === undefined ? current.sourceKind : patch.sourceKind ?? undefined,
        fileType: patch.fileType === undefined ? current.fileType : patch.fileType ?? undefined,
        hasMapping: patch.hasMapping ?? current.hasMapping,
        usageStatus: patch.usageStatus === undefined ? current.usageStatus : patch.usageStatus ?? undefined,
        description: patch.description === undefined ? current.description : patch.description ?? undefined,
        caliber: patch.caliber === undefined ? current.caliber : patch.caliber ?? undefined,
        extra: patch.extra === undefined ? current.extra : { ...current.extra, ...patch.extra },
      };
      return { ...tables[index]!, fieldCount: fields.length };
    },
    async listDictionaryFields() { return fields; },
    async resolveDictionaryFieldRefs(_projectId, refs) {
      return fields.filter(field => refs.some(ref => ref.includes(field.fieldName) || ref.includes(field.tableName ?? "")));
    },
    async searchDictionaryFields(_projectId, query, limit) {
      return fields
        .filter(field => field.fieldName.includes(query) || field.fieldCn?.includes(query))
        .slice(0, limit);
    },
    async getDictionaryField(_projectId, fieldId): Promise<ProjectDictionaryFieldDetail | null> {
      const field = fields.find(item => item.id === fieldId);
      return field ? { ...field, primaryKey: false, required: false } : null;
    },
    async updateDictionaryField(_projectId, fieldId, patch: ProjectDictionaryFieldPatch): Promise<ProjectDictionaryFieldDetail | null> {
      const index = fields.findIndex(item => item.id === fieldId);
      if (index < 0) return null;
      const current = fields[index]!;
      fields[index] = {
        ...current,
        fieldCn: patch.fieldCn ?? current.fieldCn,
        fieldType: patch.fieldType ?? current.fieldType,
        fieldLength: patch.fieldLength ?? current.fieldLength,
        formatPattern: patch.formatPattern ?? current.formatPattern,
        description: patch.description ?? current.description,
      };
      return { ...fields[index]!, primaryKey: patch.primaryKey ?? false, required: patch.required ?? false };
    },
    async listDictionaryRectifications() { return []; },
    async createDictionaryRectification(projectId, input) {
      const now = "2026-08-20T00:00:00.000Z";
      return {
        id: "rect-1",
        projectId,
        entityType: input.entityType,
        entityId: input.entityId,
        propertyKey: input.propertyKey,
        requirement: input.requirement,
        status: "open",
        createdBy: input.createdBy,
        createdAt: now,
        updatedAt: now,
      };
    },
    async updateDictionaryRectification() { return null; },
    async listDictionaryMappingRules(_projectId, tableId) {
      return Array.from(mappingRules.values()).filter(rule => rule.tableId === tableId);
    },
    async getDictionaryMappingRule(_projectId, mappingRuleId) {
      return mappingRules.get(mappingRuleId) ?? null;
    },
    async updateDictionaryMappingRule(_projectId, mappingRuleId, patch: ProjectDictionaryMappingRulePatch) {
      const current = mappingRules.get(mappingRuleId);
      if (!current) return null;
      const next: ProjectDictionaryMappingRule = {
        ...current,
        scenarioId: patch.scenarioId === undefined ? current.scenarioId : patch.scenarioId ?? undefined,
        systemId: patch.systemId === undefined ? current.systemId : patch.systemId ?? undefined,
        tableId: patch.tableId === undefined ? current.tableId : patch.tableId ?? undefined,
        fieldId: patch.fieldId === undefined ? current.fieldId : patch.fieldId ?? undefined,
        status: patch.status ?? current.status,
        logicText: patch.logicText === undefined ? current.logicText : patch.logicText ?? undefined,
        convertedSql: patch.convertedSql === undefined ? current.convertedSql : patch.convertedSql ?? undefined,
        remark: patch.remark === undefined ? current.remark : patch.remark ?? undefined,
        sortOrder: patch.sortOrder ?? current.sortOrder,
        raw: patch.raw ?? current.raw,
      };
      mappingRules.set(mappingRuleId, next);
      return next;
    },
    async updateDictionaryMappingAction(_projectId, actionId, patch: ProjectDictionaryMappingActionPatch) {
      for (const rule of mappingRules.values()) {
        const action = rule.actions.find(item => item.id === actionId);
        if (!action) continue;
        const nextAction: ProjectDictionaryMappingAction = {
          ...action,
          actionType: patch.actionType ?? action.actionType,
          conditionText: patch.conditionText === undefined ? action.conditionText : patch.conditionText ?? undefined,
          expressionText: patch.expressionText === undefined ? action.expressionText : patch.expressionText ?? undefined,
          resultText: patch.resultText === undefined ? action.resultText : patch.resultText ?? undefined,
          remark: patch.remark === undefined ? action.remark : patch.remark ?? undefined,
          sortOrder: patch.sortOrder ?? action.sortOrder,
          raw: patch.raw ?? action.raw,
          sourceFieldIds: patch.sourceFieldIds ?? action.sourceFieldIds,
        };
        mappingRules.set(rule.id, { ...rule, actions: rule.actions.map(item => item.id === actionId ? nextAction : item) });
        return nextAction;
      }
      return null;
    },
    async replaceDictionaryMappingActions(_projectId, mappingRuleId, actions: ProjectDictionaryMappingActionInput[]) {
      const current = mappingRules.get(mappingRuleId);
      if (!current) return null;
      const now = "2026-08-20T00:02:00.000Z";
      const next: ProjectDictionaryMappingRule = {
        ...current,
        actions: actions.map((action, index) => ({
          id: action.id ?? `action-${index + 1}`,
          projectId: current.projectId,
          mappingRuleId,
          actionType: action.actionType,
          conditionText: action.conditionText ?? undefined,
          expressionText: action.expressionText ?? undefined,
          resultText: action.resultText ?? undefined,
          remark: action.remark ?? undefined,
          sortOrder: action.sortOrder ?? index,
          raw: action.raw,
          sourceFieldIds: action.sourceFieldIds ?? [],
          createdAt: now,
          updatedAt: now,
        })),
      };
      mappingRules.set(mappingRuleId, next);
      return next;
    },
    async replaceDictionaryMappingSourceFields(_projectId, mappingRuleId, sourceFields: ProjectDictionaryMappingSourceFieldInput[]) {
      const current = mappingRules.get(mappingRuleId);
      if (!current) return null;
      const now = "2026-08-20T00:02:00.000Z";
      const next: ProjectDictionaryMappingRule = {
        ...current,
        sourceFields: sourceFields.map((sourceField, index) => ({
          id: sourceField.id ?? `source-${index + 1}`,
          projectId: current.projectId,
          mappingRuleId,
          fieldId: sourceField.fieldId ?? undefined,
          refPath: sourceField.refPath,
          alias: sourceField.alias ?? undefined,
          role: sourceField.role ?? undefined,
          remark: sourceField.remark ?? undefined,
          sortOrder: sourceField.sortOrder ?? index,
          raw: sourceField.raw,
          createdAt: now,
          updatedAt: now,
        })),
      };
      mappingRules.set(mappingRuleId, next);
      return next;
    },
    async validateDictionaryMappingTable(projectId, tableId): Promise<ProjectDictionaryMappingValidation> {
      const rules = Array.from(mappingRules.values()).filter(rule => rule.tableId === tableId);
      return {
        projectId,
        tableId,
        totalRules: rules.length,
        completeRules: rules.filter(rule => rule.status === "complete").length,
        invalidRules: 0,
        unableToConvertRules: 0,
        missingSourceFieldRules: rules.filter(rule => rule.sourceFields.length === 0).length,
        missingSqlRules: rules.filter(rule => !rule.convertedSql).length,
        issues: [],
      };
    },
    async listDictionaryMappingTempTables(_projectId, tableId) {
      return tempTables.filter(tempTable => tempTable.targetTableId === tableId);
    },
    async replaceDictionaryMappingTempTables(projectId, tableId, inputs: ProjectDictionaryMappingTempTableInput[]) {
      const now = "2026-08-20T00:02:00.000Z";
      tempTables = inputs.map((input, tableIndex) => ({
        id: input.id ?? `temp-${tableIndex + 1}`,
        projectId,
        targetTableId: tableId,
        tableName: input.tableName,
        tableCn: input.tableCn ?? undefined,
        logicText: input.logicText ?? undefined,
        convertedSql: input.convertedSql ?? undefined,
        remark: input.remark ?? undefined,
        sortOrder: input.sortOrder ?? tableIndex,
        raw: input.raw,
        fields: (input.fields ?? []).map((field, fieldIndex) => ({
          id: field.id ?? `temp-field-${tableIndex + 1}-${fieldIndex + 1}`,
          projectId,
          tempTableId: input.id ?? `temp-${tableIndex + 1}`,
          fieldName: field.fieldName,
          fieldCn: field.fieldCn ?? undefined,
          fieldType: field.fieldType ?? undefined,
          fieldLength: field.fieldLength ?? undefined,
          logicText: field.logicText ?? undefined,
          convertedSql: field.convertedSql ?? undefined,
          remark: field.remark ?? undefined,
          sortOrder: field.sortOrder ?? fieldIndex,
          raw: field.raw,
          createdAt: now,
          updatedAt: now,
        })),
        createdAt: now,
        updatedAt: now,
      }));
      return tempTables;
    },
  };
}

function makeDeps(projectManagement: ProjectManagementRepo) {
  return {
    elements: {},
    relations: {},
    paths: {},
    signals: {},
    qa: {},
    annotations: {},
    adapters: [],
    aiDir: "/tmp",
    projectManagement,
  } as never;
}

describe("MCP project-management tools", () => {
  it("lets AI read the canonical project description directly", async () => {
    const repo = makeProjectManagementRepo();
    await repo.createModuleItem("capital-bank-ybt", {
      moduleKey: "description",
      title: "项目说明",
      content: { html: "<h3>银保通</h3><p>银行保险项目</p>" },
    });
    const server = buildMcpServer(makeDeps(repo));
    const getDescription = tool(server, "project_management_get_description");

    const result = JSON.parse(textOf(await getDescription.handler({
      project_id: "capital-bank-ybt",
    }))) as { html: string; text: string };

    expect(result.html).toContain("银保通");
    expect(result.text).toBe("银保通\n银行保险项目");
  });

  it("updates the canonical project description through MCP", async () => {
    const repo = makeProjectManagementRepo();
    const server = buildMcpServer(makeDeps(repo));
    const updateDescription = tool(server, "project_management_update_description");
    const getDescription = tool(server, "project_management_get_description");

    expect(updateDescription.inputSchema.safeParse({
      project_id: "capital-bank-ybt",
      html: "<h2>二代 SAFE</h2><p>数据治理项目</p>",
    }).success).toBe(true);

    const updated = JSON.parse(textOf(await updateDescription.handler({
      project_id: "capital-bank-ybt",
      html: "<h2>二代 SAFE</h2><p>数据治理项目</p>",
    }))) as { html: string; text: string };
    const readBack = JSON.parse(textOf(await getDescription.handler({
      project_id: "capital-bank-ybt",
    }))) as { html: string; text: string };

    expect(updated.html).toContain("二代 SAFE");
    expect(updated.text).toBe("二代 SAFE\n数据治理项目");
    expect(readBack).toMatchObject(updated);
  });

  it("registers module CRUD tools and writes through the project-management repo", async () => {
    const server = buildMcpServer(makeDeps(makeProjectManagementRepo()));
    const create = tool(server, "project_management_create_item");
    const update = tool(server, "project_management_update_item");
    const list = tool(server, "project_management_list_items");

    expect(create.inputSchema.safeParse({
      project_id: "capital-bank-ybt",
      module_key: "workflow" satisfies ProjectManagementModuleKey,
      title: "源系统抽数",
      content: { original: { steps: [] } },
    }).success).toBe(true);

    const created = JSON.parse(textOf(await create.handler({
      project_id: "capital-bank-ybt",
      module_key: "workflow",
      title: "源系统抽数",
      content: { original: { steps: [] } },
    }))) as { item: ProjectModuleItem };

    await update.handler({
      project_id: "capital-bank-ybt",
      item_id: created.item.id,
      title: "源系统自动抽数",
    });

    const listed = JSON.parse(textOf(await list.handler({
      project_id: "capital-bank-ybt",
      module_key: "workflow",
    }))) as ProjectModuleItem[];

    expect(listed).toHaveLength(1);
    expect(listed[0].title).toBe("源系统自动抽数");
  });

  it("provides dedicated project-todo CRUD tools with UI-compatible fields", async () => {
    const server = buildMcpServer(makeDeps(makeProjectManagementRepo()));
    const create = tool(server, "project_todo_create");
    const list = tool(server, "project_todo_list");
    const get = tool(server, "project_todo_get");
    const update = tool(server, "project_todo_update");
    const remove = tool(server, "project_todo_delete");

    expect(create.inputSchema.safeParse({
      project_id: "capital-bank-ybt",
      title: "核对抽取结果",
      status: "doing",
      owner: "Rich",
      priority: "高",
      due_at: "2026-08-30",
      description: "对比临时表和目标表数据。",
    }).success).toBe(true);

    const created = JSON.parse(textOf(await create.handler({
      project_id: "capital-bank-ybt",
      title: "核对抽取结果",
      status: "doing",
      owner: "Rich",
      priority: "高",
      due_at: "2026-08-30",
      description: "对比临时表和目标表数据。",
    }))) as { todo: ProjectModuleItem };
    expect(created.todo.content.original).toMatchObject({ status: "doing", owner: "Rich", dueAt: "2026-08-30" });

    const listed = JSON.parse(textOf(await list.handler({ project_id: "capital-bank-ybt", status: "doing" }))) as ProjectModuleItem[];
    expect(listed).toHaveLength(1);
    const fetched = JSON.parse(textOf(await get.handler({ project_id: "capital-bank-ybt", todo_id: created.todo.id }))) as ProjectModuleItem;
    expect(fetched.title).toBe("核对抽取结果");

    const updated = JSON.parse(textOf(await update.handler({
      project_id: "capital-bank-ybt",
      todo_id: created.todo.id,
      status: "done",
      owner: null,
    }))) as { todo: ProjectModuleItem };
    expect(updated.todo.content.original).toMatchObject({ status: "done", owner: "", priority: "高" });

    const removed = JSON.parse(textOf(await remove.handler({ project_id: "capital-bank-ybt", todo_id: created.todo.id }))) as { ok: boolean };
    expect(removed.ok).toBe(true);
    const afterDelete = JSON.parse(textOf(await list.handler({ project_id: "capital-bank-ybt" }))) as ProjectModuleItem[];
    expect(afterDelete).toHaveLength(0);
  });

  it("exposes data-dictionary search and field detail tools", async () => {
    const server = buildMcpServer(makeDeps(makeProjectManagementRepo()));
    const search = tool(server, "project_dictionary_search_fields");
    const getField = tool(server, "project_dictionary_get_field");

    const searchResult = JSON.parse(textOf(await search.handler({
      project_id: "capital-bank-ybt",
      query: "处置本金",
      limit: 10,
    }))) as { results: ProjectDictionaryFieldHit[] };
    expect(searchResult.results[0].fieldName).toBe("G080009");

    const detail = JSON.parse(textOf(await getField.handler({
      project_id: "capital-bank-ybt",
      field_id: "field-1",
    }))) as ProjectDictionaryFieldDetail;
    expect(detail.fieldType).toBe("decimal");
    expect(detail.formatPattern).toBe("数字，精度20,2");
  });

  it("updates data-dictionary field metadata through MCP", async () => {
    const server = buildMcpServer(makeDeps(makeProjectManagementRepo()));
    const updateField = tool(server, "project_dictionary_update_field");
    const updated = JSON.parse(textOf(await updateField.handler({
      project_id: "capital-bank-ybt",
      field_id: "field-1",
      field_length: "24,2",
    }))) as { ok: boolean; field: ProjectDictionaryFieldDetail };

    expect(updated.ok).toBe(true);
    expect(updated.field.fieldLength).toBe("24,2");
  });

  it("updates table usage status and merges extra metadata through MCP", async () => {
    const server = buildMcpServer(makeDeps(makeProjectManagementRepo()));
    const updateTable = tool(server, "project_dictionary_update_table");
    expect(updateTable.inputSchema.safeParse({
      project_id: "vtb-二代safe",
      table_id: "table-1",
      table_cn: "不良资产处置明细",
      table_group: "监管报表",
      table_type: "报表表",
      usage_status: "使用",
      extra: { vtbWillReport: true },
    }).success).toBe(true);

    const updated = JSON.parse(textOf(await updateTable.handler({
      project_id: "vtb-二代safe",
      table_id: "table-1",
      table_cn: "不良资产处置明细",
      table_group: "监管报表",
      table_type: "报表表",
      usage_status: "使用",
      extra: { vtbWillReport: true },
    }))) as { ok: boolean; table: { tableCn?: string; tableGroup?: string; tableType?: string; usageStatus?: string; extra?: Record<string, unknown> } };
    expect(updated).toMatchObject({
      ok: true,
      table: { tableCn: "不良资产处置明细", tableGroup: "监管报表", tableType: "报表表", usageStatus: "使用", extra: { existingFlag: true, vtbWillReport: true } },
    });
  });

  it("exposes mapping-rule MCP tools", async () => {
    const server = buildMcpServer(makeDeps(makeProjectManagementRepo()));
    const listRules = tool(server, "project_dictionary_list_mapping_rules");
    const updateRule = tool(server, "project_dictionary_update_mapping_rule");
    const validateTable = tool(server, "project_dictionary_validate_mapping_table");
    const validateSql = tool(server, "project_dictionary_validate_mapping_sql");

    const listed = JSON.parse(textOf(await listRules.handler({
      project_id: "capital-bank-ybt",
      table_id: "table-1",
    }))) as { rules: ProjectDictionaryMappingRule[] };
    expect(listed.rules[0].id).toBe("mapping-1");
    expect(validateSql.inputSchema.safeParse({
      project_id: "capital-bank-ybt",
      table_id: "table-1",
      field_rules: [{ field_id: "field-1", logic: '{"op":"direct","source":"BLZCCZ.G080009"}' }],
    }).success).toBe(true);

    const updated = JSON.parse(textOf(await updateRule.handler({
      project_id: "capital-bank-ybt",
      mapping_rule_id: "mapping-1",
      status: "complete",
      converted_sql: "G080009",
    }))) as { rule: ProjectDictionaryMappingRule };
    expect(updated.rule.status).toBe("complete");
    expect(updated.rule.convertedSql).toBe("G080009");

    const validation = JSON.parse(textOf(await validateTable.handler({
      project_id: "capital-bank-ybt",
      table_id: "table-1",
    }))) as ProjectDictionaryMappingValidation;
    expect(validation.totalRules).toBe(1);
    expect(validation.completeRules).toBe(1);
  });

  it("replaces Mapping temporary tables and fields through MCP", async () => {
    const server = buildMcpServer(makeDeps(makeProjectManagementRepo()));
    const replace = tool(server, "project_dictionary_replace_mapping_temp_tables");
    expect(replace.inputSchema.safeParse({
      project_id: "capital-bank-ybt",
      table_id: "table-1",
      temp_tables: [{
        table_name: "tmp_transaction",
        converted_sql: "SELECT transaction_id, amount FROM source_transaction",
        fields: [{ field_name: "transaction_id", field_type: "varchar" }],
      }],
    }).success).toBe(true);

    const result = JSON.parse(textOf(await replace.handler({
      project_id: "capital-bank-ybt",
      table_id: "table-1",
      temp_tables: [{
        table_name: "tmp_transaction",
        converted_sql: "SELECT transaction_id, amount FROM source_transaction",
        fields: [{ field_name: "transaction_id", field_type: "varchar" }],
      }],
    }))) as { ok: boolean; temp_tables: ProjectDictionaryMappingTempTable[] };
    expect(result.ok).toBe(true);
    expect(result.temp_tables[0]?.tableName).toBe("tmp_transaction");
    expect(result.temp_tables[0]?.fields[0]?.fieldName).toBe("transaction_id");
  });
});
