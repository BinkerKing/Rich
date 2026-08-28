import { describe, expect, it } from "vitest";
import {
  dictionaryFieldMatchesOwnContent,
  dictionaryTableMatchesOwnContent,
  projectManagementSearchDestination,
} from "../src/repos/projectManagementSearch.js";

describe("project-management search destinations", () => {
  it("maps a dictionary field to its table and system focus context", () => {
    expect(projectManagementSearchDestination({
      moduleKey: "dictionary", entityType: "dictionaryField", entityId: "field-1", systemId: "system-1", tableId: "table-1",
    })).toEqual({ section: "dictionary", entityType: "dictionaryField", entityId: "field-1", systemId: "system-1", tableId: "table-1" });
  });

  it("maps a folder module record to a file focus target", () => {
    expect(projectManagementSearchDestination({ moduleKey: "folder", entityType: "moduleItem", entityId: "entry-1" }))
      .toEqual({ section: "folder", entityType: "folderEntry", entityId: "entry-1" });
  });

  it("maps a dictionary table to the table focus target", () => {
    expect(projectManagementSearchDestination({
      moduleKey: "dictionary", entityType: "dictionaryTable", entityId: "table-1", systemId: "system-1",
    })).toEqual({ section: "dictionary", entityType: "dictionaryTable", entityId: "table-1", systemId: "system-1", tableId: "table-1" });
  });

  it("keeps table-name matches on the table instead of expanding every field", () => {
    const field = { id: "field-1", fieldName: "customerCode", tableName: "Customer", description: "客户相关说明", score: 0 };
    const table = { id: "table-1", tableName: "Customer", description: "客户交易信息", fieldCount: 3 };
    expect(dictionaryTableMatchesOwnContent(table, "Customer")).toBe(true);
    expect(dictionaryTableMatchesOwnContent(table, "客户")).toBe(false);
    expect(dictionaryFieldMatchesOwnContent(field, "Customer")).toBe(true);
    expect(dictionaryFieldMatchesOwnContent(field, "customerCode")).toBe(true);
    expect(dictionaryFieldMatchesOwnContent({ ...field, fieldName: "debtorCode", fieldCn: "债务人代码" }, "客户")).toBe(false);
  });

  it("safely falls back to the owning module for new record types", () => {
    expect(projectManagementSearchDestination({ moduleKey: "workflow", entityType: "workflowStep", entityId: "step-1" }))
      .toEqual({ section: "workflow", entityType: "workflowStep", entityId: "step-1" });
  });
});
