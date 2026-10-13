import { z } from "zod";
import type { McpOperationRepo } from "../../repos/McpOperationRepo.js";
import type {
  ProjectDictionaryFieldPatch,
  ProjectDictionarySystemPatch,
  ProjectDictionaryTablePatch,
  ProjectManagementRepo,
} from "../../repos/ProjectManagementRepo.js";
import { RichMcpError } from "../registry/errors.js";
import { richSuccess } from "../registry/response.js";
import type { RichToolRegistry } from "../registry/toolRegistry.js";
import { executeSafeWrite } from "../registry/writeSafety.js";
import { richContextSchema, richOptionsSchema } from "./schemas.js";

const dictionaryPatchSchema = z.object({
  type: z.string().nullable().optional(),
  assetLayer: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  tableName: z.string().optional(),
  tableCn: z.string().nullable().optional(),
  tableGroup: z.string().nullable().optional(),
  dataLayer: z.string().nullable().optional(),
  tableType: z.string().nullable().optional(),
  sourceKind: z.enum(["文件", "数据库"]).nullable().optional(),
  fileType: z.enum(["txt", "xml", "csv", "excel"]).nullable().optional(),
  hasMapping: z.boolean().optional(),
  usageStatus: z.string().nullable().optional(),
  verificationStatus: z.enum(["未验证", "已验证", "待整改", "外部SQL验证无误", "Mapping逻辑核对一致", "双跑核对无误"]).nullable().optional(),
  verificationRemark: z.string().nullable().optional(),
  fieldCn: z.string().nullable().optional(),
  fieldType: z.string().nullable().optional(),
  fieldLength: z.string().nullable().optional(),
  formatPattern: z.string().nullable().optional(),
  caliber: z.string().nullable().optional(),
  remark: z.string().nullable().optional(),
}).optional();

export function registerDictionaryTools(
  registry: RichToolRegistry,
  dictionary: ProjectManagementRepo,
  operationRepo?: McpOperationRepo,
): void {
  registry.register({
    name: "rich_dictionary_manage",
    title: "Manage project dictionary",
    description: "List project dictionary systems, tables, or fields and update a known system, table, or field with write verification.",
    category: "manage",
    inputSchema: z.object({
      action: z.enum(["list_systems", "list_tables", "list_fields", "get_field", "update_system", "update_table", "update_field"]),
      projectId: z.string().min(1),
      id: z.string().min(1).optional(),
      systemId: z.string().min(1).optional(),
      tableId: z.string().min(1).optional(),
      input: dictionaryPatchSchema,
      context: richContextSchema,
      options: richOptionsSchema,
    }).superRefine((input, issues) => {
      if ((input.action === "list_fields") && !input.tableId) issues.addIssue({ code: "custom", path: ["tableId"], message: "tableId is required." });
      if ((input.action === "get_field" || input.action.startsWith("update_")) && !input.id) issues.addIssue({ code: "custom", path: ["id"], message: "id is required." });
      if (input.action.startsWith("update_") && !input.input) issues.addIssue({ code: "custom", path: ["input"], message: "input is required." });
    }),
    annotations: { readOnly: false, destructive: false, idempotent: true },
    examples: [
      { description: "List tables in a project.", input: { action: "list_tables", projectId: "project-rich" } },
      { description: "Mark a table as verified.", input: { action: "update_table", projectId: "project-rich", id: "table-1", input: { verificationStatus: "已验证" }, context: { requestId: "verify-table-1" } } },
    ],
    verification: "Writes are verified by reading the updated dictionary entity from the repository.",
    handler: async ({ action, projectId, id, systemId, tableId, input, context, options }) => {
      if (action === "list_systems") {
        const systems = await dictionary.listDictionarySystems(projectId);
        return richSuccess("rich_dictionary_manage", { systems }, { refs: systems.map(system => ({ type: "dictionarySystem", id: system.id, label: system.name })) });
      }
      if (action === "list_tables") {
        const tables = await dictionary.listDictionaryTables(projectId, systemId);
        return richSuccess("rich_dictionary_manage", { tables }, { refs: tables.map(table => ({ type: "dictionaryTable", id: table.id, label: table.tableName })) });
      }
      if (action === "list_fields") {
        const fields = await dictionary.listDictionaryFields(projectId, tableId!);
        return richSuccess("rich_dictionary_manage", { fields }, { refs: fields.map(field => ({ type: "dictionaryField", id: field.id, label: field.fieldName })) });
      }
      if (action === "get_field") {
        const field = await dictionary.getDictionaryField(projectId, id!);
        if (!field) throw new RichMcpError("NOT_FOUND", `Dictionary field ${id} was not found.`);
        return richSuccess("rich_dictionary_manage", { field }, { refs: [{ type: "dictionaryField", id: field.id, label: field.fieldName }] });
      }

      const resource = action.replace("update_", "dictionary");
      return executeSafeWrite({
        toolName: "rich_dictionary_manage",
        operationRepo,
        context,
        options,
        inputForHash: { action, projectId, id, input },
        changes: [{ operation: "update", resource, id }],
        execute: async () => {
          const entity = action === "update_system"
            ? await dictionary.updateDictionarySystem(projectId, id!, input! as ProjectDictionarySystemPatch)
            : action === "update_table"
              ? await dictionary.updateDictionaryTable(projectId, id!, input! as ProjectDictionaryTablePatch)
              : await dictionary.updateDictionaryField(projectId, id!, input! as ProjectDictionaryFieldPatch);
          if (!entity) throw new RichMcpError("NOT_FOUND", `Dictionary entity ${id} was not found.`);
          return { entity };
        },
        verify: async () => {
          const found = action === "update_system"
            ? (await dictionary.listDictionarySystems(projectId)).some(item => item.id === id)
            : action === "update_table"
              ? (await dictionary.listDictionaryTables(projectId)).some(item => item.id === id)
              : Boolean(await dictionary.getDictionaryField(projectId, id!));
          return { status: found ? "verified" : "failed", details: "Dictionary entity was read back after update." };
        },
        refs: result => [{ type: resource, id: id!, label: "name" in result.entity ? String(result.entity.name) : undefined }],
      });
    },
  });
}
