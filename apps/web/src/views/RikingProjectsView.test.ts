import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("RikingProjectsView", () => {
  it("groups services, applications, and mini programs in collapsible sections", () => {
    const source = readFileSync(new URL("./RikingProjectsView.tsx", import.meta.url), "utf8");
    const css = readFileSync(new URL("./RikingProjectsView.css", import.meta.url), "utf8");

    expect(source).toContain('const [collapsedGroups, setCollapsedGroups]');
    expect(source).toContain('label: "服务"');
    expect(source).toContain('label: "应用"');
    expect(source).toContain(">小工具</strong>");
    expect(source).toContain('aria-expanded={!collapsedGroups[group.id]}');
    expect(css).toContain(".rkp-project-group-toggle");
  });
});
