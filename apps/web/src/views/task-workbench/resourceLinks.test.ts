import { describe, expect, it } from "vitest";
import { resourceLink } from "./resourceLinks.js";

describe("workbench resource navigation", () => {
  it("opens existing local paths without downloading and preserves reserved characters", () => {
    const link = resourceLink("/tmp/材料 #1?/报告.pdf")!;
    const fileUrl = new URL(link).searchParams.get("url")!;
    expect(new URL(fileUrl).protocol).toBe("file:");
    expect(decodeURIComponent(new URL(fileUrl).pathname)).toBe("/tmp/材料 #1?/报告.pdf");
    expect(link).not.toContain("/download");
    expect(resourceLink("file:///tmp/report.pdf")).toBe(resourceLink("/tmp/report.pdf"));
  });
  it("opens web references but never treats arbitrary text or scripts as navigation", () => {
    expect(resourceLink("https://svn.example/repo")).toBe("https://svn.example/repo");
    expect(resourceLink("javascript:alert(1)")).toBeUndefined();
    expect(resourceLink("postgresql://localhost/project")).toBeUndefined();
    expect(resourceLink("")).toBeUndefined();
  });
});
