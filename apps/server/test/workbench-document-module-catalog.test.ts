import { describe, expect, it } from "vitest";
import { listWorkbenchModules, validateWorkbenchModule } from "../src/workbench-document/moduleCatalog.js";

describe("workbench document module catalog", () => {
  it("exposes the predefined question list with validated rows", () => {
    expect(listWorkbenchModules()).toEqual([{ key: "question_list", label: "问题清单" }]);
    expect(validateWorkbenchModule({
      key: "question_list",
      rows: [{ id: "q1", question: "谁负责审批？", status: "open" }],
    })).toEqual({
      key: "question_list",
      rows: [{ id: "q1", question: "谁负责审批？", status: "open" }],
    });
  });

  it("rejects an unknown module or invalid question list row", () => {
    expect(() => validateWorkbenchModule({ key: "made_up", rows: [] })).toThrow("未知工作台模块");
    expect(() => validateWorkbenchModule({ key: "question_list", rows: [{ id: "q1", question: "", status: "open" }] })).toThrow();
    expect(() => validateWorkbenchModule({ key: "question_list", rows: [{ id: "q1", question: "问题", status: "unknown" }] })).toThrow();
  });
});
