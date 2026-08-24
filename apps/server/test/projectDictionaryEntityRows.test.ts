import { describe, expect, it } from "vitest";
import {
  clampDictionaryEntityPage,
  clampDictionaryEntityPageSize,
  resolveDictionaryEntityColumnName,
} from "../src/modules/project-dictionary/test-data/entityRows.js";
import type { ProjectDictionaryFieldDetail } from "../src/repos/ProjectManagementRepo.js";

describe("project dictionary entity rows", () => {
  it("normalizes paging boundaries", () => {
    expect(clampDictionaryEntityPage(-2)).toBe(1);
    expect(clampDictionaryEntityPage("3")).toBe(3);
    expect(clampDictionaryEntityPageSize(2)).toBe(10);
    expect(clampDictionaryEntityPageSize(1000)).toBe(500);
  });

  it("matches camel-case fields to physical snake-case columns", () => {
    const field = { fieldName: "customerCode", fieldCn: "客户编码", extra: {} } as ProjectDictionaryFieldDetail;
    expect(resolveDictionaryEntityColumnName(field, [{ columnName: "customer_code", dataType: "text" }])).toBe("customer_code");
  });
});
