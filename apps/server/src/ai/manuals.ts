import { readFile } from "node:fs/promises";
import { join } from "node:path";

export interface AIManual {
  name: string;
  role: string;
  defaultStyle: string;
  pitfalls: string;
  learnedRules: string;
  /** Full raw markdown, for cases that want to include everything verbatim. */
  raw: string;
}

const SECTION_HEADINGS: Record<keyof Pick<AIManual, "role" | "defaultStyle" | "pitfalls" | "learnedRules">, string[]> = {
  role: ["## Role"],
  defaultStyle: ["## Default Style"],
  pitfalls: ["## Pitfalls"],
  learnedRules: ["## Learned Rules"],
};

/**
 * Parse a manual markdown file into named sections.
 * Returns null if the file doesn't exist.
 */
export async function loadManual(aiDir: string, name: string): Promise<AIManual | null> {
  let raw: string;
  try {
    raw = await readFile(join(aiDir, `${name}.md`), "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
  return {
    name,
    raw,
    role: extractSection(raw, SECTION_HEADINGS.role),
    defaultStyle: extractSection(raw, SECTION_HEADINGS.defaultStyle),
    pitfalls: extractSection(raw, SECTION_HEADINGS.pitfalls),
    learnedRules: extractSection(raw, SECTION_HEADINGS.learnedRules),
  };
}

function extractSection(md: string, headings: string[]): string {
  const lines = md.split("\n");
  let inSection = false;
  const out: string[] = [];
  for (const line of lines) {
    if (headings.some(h => line.trim() === h)) {
      inSection = true;
      continue;
    }
    if (inSection && line.startsWith("## ")) {
      break; // next section starts
    }
    if (inSection) out.push(line);
  }
  return out.join("\n").trim();
}

/**
 * Format a manual as a markdown block ready to be prepended to a task prompt.
 * Excludes Learned Rules if empty (placeholder text) to keep prompts lean.
 */
export function manualToPromptFragment(m: AIManual): string {
  const isPlaceholder = (s: string) => /^（.*）$/.test(s.trim());
  const sections: string[] = [];
  if (m.role) sections.push(`## 你的角色\n${m.role}`);
  if (m.defaultStyle) sections.push(`## 默认风格\n${m.defaultStyle}`);
  if (m.pitfalls) sections.push(`## 必须避免\n${m.pitfalls}`);
  if (m.learnedRules && !isPlaceholder(m.learnedRules)) {
    sections.push(`## 已沉淀经验（按时间从旧到新）\n${m.learnedRules}`);
  }
  return sections.length > 0
    ? `[AI 说明书 · ${m.name}]\n\n${sections.join("\n\n")}\n\n---\n\n`
    : "";
}

/**
 * Append a new Learned Rules entry. Always writes back with timestamp.
 * Idempotent on identical rule text.
 */
export async function appendLearnedRules(
  aiDir: string,
  name: string,
  newRules: { text: string; date: string }[],
): Promise<{ added: number; skipped: number }> {
  const { readFile, writeFile } = await import("node:fs/promises");
  const path = join(aiDir, `${name}.md`);
  const md = await readFile(path, "utf8");
  const existing = extractSection(md, SECTION_HEADINGS.learnedRules);
  const isPlaceholder = /^（.*）$/.test(existing.trim());
  let added = 0;
  let skipped = 0;
  const toAdd: string[] = [];
  for (const rule of newRules) {
    const formatted = `- ${rule.text} (${rule.date})`;
    if (existing.includes(rule.text)) { skipped++; continue; }
    toAdd.push(formatted);
    added++;
  }
  if (toAdd.length === 0) return { added: 0, skipped };
  const newContent = isPlaceholder ? toAdd.join("\n") : `${existing}\n${toAdd.join("\n")}`;
  const updated = replaceSection(md, SECTION_HEADINGS.learnedRules, newContent);
  await writeFile(path, updated);
  return { added, skipped };
}

function replaceSection(md: string, headings: string[], newBody: string): string {
  const lines = md.split("\n");
  const out: string[] = [];
  let inSection = false;
  let injected = false;
  for (const line of lines) {
    if (headings.some(h => line.trim() === h)) {
      out.push(line);
      out.push("");
      out.push(newBody);
      inSection = true;
      injected = true;
      continue;
    }
    if (inSection && line.startsWith("## ")) {
      inSection = false;
      out.push("");
      out.push(line);
      continue;
    }
    if (!inSection) out.push(line);
  }
  if (!injected) {
    // Section didn't exist; append it.
    out.push("");
    out.push(headings[0]);
    out.push("");
    out.push(newBody);
  }
  return out.join("\n");
}
