import type {
  ProjectDictionaryFieldHit,
  ProjectDictionaryTable,
  ProjectManagementModuleKey,
  ProjectManagementSearchDestination,
} from "./ProjectManagementRepo.js";

export function projectManagementSearchDestination(input: {
  moduleKey: ProjectManagementModuleKey;
  entityType: string;
  entityId: string;
  systemId?: string;
  tableId?: string;
}): ProjectManagementSearchDestination {
  if (input.entityType === "dictionaryField") {
    return {
      section: "dictionary",
      entityType: "dictionaryField",
      entityId: input.entityId,
      systemId: input.systemId,
      tableId: input.tableId,
    };
  }
  if (input.entityType === "dictionaryTable") {
    return {
      section: "dictionary",
      entityType: "dictionaryTable",
      entityId: input.entityId,
      systemId: input.systemId,
      tableId: input.entityId,
    };
  }
  return {
    section: input.moduleKey,
    entityType: input.moduleKey === "folder" && input.entityType === "moduleItem" ? "folderEntry" : input.entityType,
    entityId: input.entityId,
  };
}

/** Default global field search is identity-only; mapping and prose belong to dedicated opt-in search profiles. */
export function dictionaryFieldMatchesOwnContent(field: ProjectDictionaryFieldHit, query: string): boolean {
  return includesQuery(query, [
    field.fieldName,
    field.fieldCn,
  ]);
}

export function dictionaryTableMatchesOwnContent(table: ProjectDictionaryTable, query: string): boolean {
  return includesQuery(query, [
    table.tableName,
    table.tableCn,
  ]);
}

export function dictionaryTableSearchScore(table: ProjectDictionaryTable, query: string): number {
  const normalizedQuery = query.trim().toLowerCase();
  if (table.tableName.toLowerCase() === normalizedQuery) return 100;
  if (table.tableCn?.toLowerCase() === normalizedQuery) return 96;
  return 72;
}

function includesQuery(query: string, values: Array<string | undefined>): boolean {
  const normalizedQuery = query.trim().toLowerCase();
  return values.some(value => value?.toLowerCase().includes(normalizedQuery));
}
