import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Bug screenshot capture", () => {
  it("waits for the Codex dialog to be hidden before capturing the Rich view", () => {
    const source = readFileSync(new URL("../../web/src/views/project-management/deliverables/DeliverableCodexWorkbench.tsx", import.meta.url), "utf8");
    const css = readFileSync(new URL("../../web/src/views/project-management/deliverables/DeliverableCodexWorkbench.css", import.meta.url), "utf8");
    expect(source).toContain("setCapturingCurrentView(true)");
    expect(source).toContain("requestAnimationFrame(() => requestAnimationFrame(() => resolve()))");
    expect(source).toContain("captureCurrentView");
    expect(css).toContain(".deliverable-codex-backdrop.is-capturing-current-view { display:none; }");
  });
});
