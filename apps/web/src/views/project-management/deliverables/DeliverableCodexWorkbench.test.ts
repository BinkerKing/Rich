import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("DeliverableCodexWorkbench", () => {
  it("creates an immutable-mode conversation and provides archive rather than a tab close action", () => {
    const source = readFileSync(new URL("./DeliverableCodexWorkbench.tsx", import.meta.url), "utf8");
    expect(source).toContain('type Mode = "free" | "task" | "bug"');
    expect(source).toContain('onClick={() => void archive()}');
    expect(source).toContain('setCreating(true)');
    expect(source).not.toContain("关闭会话");
  });
});
