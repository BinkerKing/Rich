import { describe, expect, it } from "vitest";
import { dictionaryCaliberTableName, dictionaryJoinType, parseDictionaryCaliberRule } from "../src/index.js";

describe("project dictionary caliber domain", () => {
  it("preserves a structured join as a first-class dataset rule", () => {
    const rule = parseDictionaryCaliberRule(JSON.stringify({
      op: "dataset",
      from: { table: "TransactionTab", alias: "transaction" },
      joins: [{
        type: "left",
        table: { table: "Customer", alias: "customer" },
        on: { eq: [{ source: "TransactionTab.customerCode" }, { source: "Customer.bankCustomerCode" }] },
      }],
    }));

    expect(rule?.joins?.[0]).toMatchObject({ type: "left", table: { table: "Customer", alias: "customer" } });
    expect(dictionaryCaliberTableName(rule?.joins?.[0]?.table)).toBe("Customer");
  });

  it("rejects non-dataset JSON without treating it as a caliber", () => {
    expect(parseDictionaryCaliberRule('{"op":"map"}')).toBeNull();
    expect(parseDictionaryCaliberRule("ordinary description")).toBeNull();
  });

  it("normalizes join types independently from SQL rendering", () => {
    expect(dictionaryJoinType("left_join")).toBe("LEFT");
    expect(dictionaryJoinType("INNER")).toBe("INNER");
    expect(dictionaryJoinType("unknown")).toBe("LEFT");
  });
});
