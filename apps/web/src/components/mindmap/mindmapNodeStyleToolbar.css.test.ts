import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("./mindmapNodeStyleToolbar.css", import.meta.url), "utf8");

describe("mindmap node style toolbar appearance", () => {
  it("uses a larger gray editor with a bright outline", () => {
    expect(css).toMatch(/padding:\s*11px/);
    expect(css).toMatch(/background:\s*#374151/);
    expect(css).toMatch(/border:\s*2px solid #38bdf8/);
    expect(css).toMatch(/width:\s*40px;\s*height:\s*38px/);
  });
});
