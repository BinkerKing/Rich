import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadManual, manualToPromptFragment, appendLearnedRules } from "../src/ai/manuals.js";

let dir: string;

const SAMPLE = `# Test AI

## Role
The role text here.
Multiple lines.

## Default Style
- bullet one
- bullet two

## Pitfalls
- don't X

## Learned Rules
（占位）
`;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "ke-manuals-"));
  writeFileSync(join(dir, "test.md"), SAMPLE);
});

describe("loadManual", () => {
  it("parses all sections", async () => {
    const m = await loadManual(dir, "test");
    expect(m).not.toBeNull();
    expect(m!.role).toContain("The role text here");
    expect(m!.role).toContain("Multiple lines");
    expect(m!.defaultStyle).toContain("bullet one");
    expect(m!.pitfalls).toContain("don't X");
    expect(m!.learnedRules).toContain("（占位）");
  });

  it("returns null for missing file", async () => {
    const m = await loadManual(dir, "nope");
    expect(m).toBeNull();
  });
});

describe("manualToPromptFragment", () => {
  it("includes role/style/pitfalls", async () => {
    const m = await loadManual(dir, "test");
    const frag = manualToPromptFragment(m!);
    expect(frag).toContain("[AI 说明书 · test]");
    expect(frag).toContain("你的角色");
    expect(frag).toContain("The role text here");
    expect(frag).toContain("默认风格");
    expect(frag).toContain("必须避免");
  });

  it("excludes Learned Rules when only placeholder text present", async () => {
    const m = await loadManual(dir, "test");
    const frag = manualToPromptFragment(m!);
    expect(frag).not.toContain("已沉淀经验");
  });

  it("includes Learned Rules when populated", async () => {
    writeFileSync(join(dir, "test.md"), SAMPLE.replace("（占位）", "- be concise (2026-05-16)"));
    const m = await loadManual(dir, "test");
    const frag = manualToPromptFragment(m!);
    expect(frag).toContain("已沉淀经验");
    expect(frag).toContain("be concise");
  });
});

describe("appendLearnedRules", () => {
  it("replaces placeholder with first rule", async () => {
    const res = await appendLearnedRules(dir, "test", [{ text: "rule alpha", date: "2026-05-16" }]);
    expect(res.added).toBe(1);
    const md = readFileSync(join(dir, "test.md"), "utf8");
    expect(md).toContain("- rule alpha (2026-05-16)");
    expect(md).not.toContain("（占位）");
  });

  it("appends to existing rules", async () => {
    await appendLearnedRules(dir, "test", [{ text: "rule alpha", date: "2026-05-16" }]);
    const res = await appendLearnedRules(dir, "test", [{ text: "rule beta", date: "2026-05-17" }]);
    expect(res.added).toBe(1);
    const md = readFileSync(join(dir, "test.md"), "utf8");
    expect(md).toContain("rule alpha");
    expect(md).toContain("rule beta");
  });

  it("skips duplicates by text match", async () => {
    await appendLearnedRules(dir, "test", [{ text: "rule alpha", date: "2026-05-16" }]);
    const res = await appendLearnedRules(dir, "test", [
      { text: "rule alpha", date: "2026-05-17" },
      { text: "rule new", date: "2026-05-17" },
    ]);
    expect(res.added).toBe(1);
    expect(res.skipped).toBe(1);
  });

  it("preserves other sections", async () => {
    await appendLearnedRules(dir, "test", [{ text: "rule alpha", date: "2026-05-16" }]);
    const md = readFileSync(join(dir, "test.md"), "utf8");
    expect(md).toContain("## Role");
    expect(md).toContain("The role text here");
    expect(md).toContain("## Pitfalls");
    expect(md).toContain("don't X");
  });
});
