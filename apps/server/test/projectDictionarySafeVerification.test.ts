import { describe, expect, it } from "vitest";
import { verifySafeDictionarySnapshot } from "../src/modules/project-dictionary/safe/verification.js";

describe("SAFE dictionary verification", () => {
  it("accepts the confirmed source, stage, middle, and mapping baseline", () => {
    const result = verifySafeDictionarySnapshot({
      systems: ["SAFE_SOURCE", "SAFE_STAGE", "SAFE_MIDDLE"],
      tablesBySystem: {
        SAFE_SOURCE: ["AIF2.TXT", "BLN2.TXT", "CIF2.TXT", "TRN2.TXT"],
        SAFE_STAGE: ["AifTab", "BlnTab", "CifTab", "TransactionTab"],
        SAFE_MIDDLE: ["BopTransaction"],
      },
      sourceStageLinkCount: 90,
      publishedMappingCount: 803,
      verifiedMappingCount: 174,
      intermediateMappingCount: 1,
    });

    expect(result).toEqual({ ok: true, issues: [] });
  });

  it("reports missing evidence instead of treating an incomplete SAFE chain as valid", () => {
    const result = verifySafeDictionarySnapshot({
      systems: ["SAFE_SOURCE", "SAFE_STAGE"],
      tablesBySystem: { SAFE_SOURCE: ["AIF2.TXT"], SAFE_STAGE: ["AifTab"] },
      sourceStageLinkCount: 0,
      publishedMappingCount: 0,
      verifiedMappingCount: 0,
      intermediateMappingCount: 0,
    });

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.stringContaining("SAFE_MIDDLE"),
      expect.stringContaining("源文件到贴源层"),
      expect.stringContaining("中间层"),
    ]));
  });
});
