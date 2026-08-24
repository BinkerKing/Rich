import { describe, expect, it } from "vitest";
import {
  collectDictionaryExtractionConditionRefs,
  collectDictionaryExtractionValueRefs,
  parseDictionaryExtractionJsonRule,
  validateDictionaryExtractionJsonRule,
} from "../src/modules/project-dictionary/sql-engine/mappingRules.js";

describe("project dictionary mapping rules", () => {
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
