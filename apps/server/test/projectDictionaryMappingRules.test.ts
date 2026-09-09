import { describe, expect, it } from "vitest";
import {
  collectDictionaryExtractionConditionRefs,
  collectDictionaryExtractionValueRefs,
  parseDictionaryExtractionJsonRule,
  validateDictionaryExtractionJsonRule,
} from "../src/modules/project-dictionary/sql-engine/mappingRules.js";
import { dictionaryTableMappingStatus } from "../src/repos/ProjectManagementRepo.js";

describe("project dictionary mapping rules", () => {
  it("only marks a table as mapped when it has at least one effective mapping rule", () => {
    expect(dictionaryTableMappingStatus(false, 0)).toBe("否");
    expect(dictionaryTableMappingStatus(true, 0)).toBe("待补充");
    expect(dictionaryTableMappingStatus(false, 1)).toBe("是");
    expect(dictionaryTableMappingStatus(true, 1)).toBe("是");
  });

  it("normalizes direct runtime references into param rules", () => {
    expect(parseDictionaryExtractionJsonRule('{"op":"direct","source":":reportDate"}')).toMatchObject({ op: "param", name: "reportDate" });
  });

  it("reports malformed rules without a database connection", () => {
    expect(validateDictionaryExtractionJsonRule({ op: "substring_marker", source: "Transaction.code" }))
      .toEqual(expect.arrayContaining([expect.stringContaining("marker"), expect.stringContaining("length")]));
  });

  it("collects source references recursively for join-aware validation", () => {
    expect(collectDictionaryExtractionValueRefs({ op: "concat", sources: ["Transaction.code", "Customer.enName"] }))
      .toEqual(["Transaction.code", "Customer.enName"]);
    expect(collectDictionaryExtractionConditionRefs({ and: [{ source: "Transaction.customerCode", eq: { source: "Customer.bankCustomerCode" } }] }))
      .toEqual(["Transaction.customerCode", "Customer.bankCustomerCode"]);
  });
});
