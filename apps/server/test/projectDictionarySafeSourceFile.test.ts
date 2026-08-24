import { describe, expect, it } from "vitest";
import { parseSafeSourceFile } from "../src/modules/project-dictionary/safe/sourceFileIngestion.js";

describe("SAFE source-file ingestion", () => {
  it("preserves UTF-16 rows, trailing empty columns, and extra-column diagnostics", () => {
    const result = parseSafeSourceFile({
      sourceFilePath: "/fixtures/AIF2.TXT",
      sourceFileName: "AIF2.TXT",
      buffer: Buffer.from("\uFEFFcustomer-1|account-1|\ncustomer-2|account-2|unexpected\n", "utf16le"),
      fields: [{ fieldName: "customerId" }, { fieldName: "accountId" }],
      importedAt: "2026-08-24T00:00:00.000Z",
      sampleLimit: 50,
    });

    expect(result.recordCount).toBe(2);
    expect(result.rows[0]).toMatchObject({
      columnCount: 3,
      values: { customerId: "customer-1", accountId: "account-1" },
      extraColumns: [""],
    });
    expect(result.rows[1]).toMatchObject({ extraColumns: ["unexpected"] });
    expect(result.columnCountIssues).toEqual([
      expect.objectContaining({ columnCount: 3, recordCount: 2 }),
    ]);
  });
});
