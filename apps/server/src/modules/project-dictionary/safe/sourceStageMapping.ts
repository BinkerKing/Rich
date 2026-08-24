export type SafeSourceTable = {
  fileName: string;
  stageTable: string | null;
  importStrategy: string;
  remark: string;
};

export type SafeSourceStageField = {
  sourceFile: string;
  sourceOrder: number;
  javaIndex: number;
  targetTable: string | null;
  targetField: string | null;
  cn: string;
  importLogic: string;
};

export type SafeStageAutoField = {
  targetTable: string;
  targetField: string;
  cn: string;
  importLogic: string;
};

const EXCLUDED_SOURCE_FILES = new Set(["REPORT.TXT"]);

/** Pure parser for the reviewed OneGen source-to-stage evidence document. */
export function parseSafeSourceStageDocument(markdown: string): {
  sourceTables: SafeSourceTable[];
  fields: SafeSourceStageField[];
  autoFields: SafeStageAutoField[];
} {
  return {
    sourceTables: parseSourceTables(markdown),
    fields: parseFieldMappings(markdown),
    autoFields: parseAutoFields(markdown),
  };
}

function parseSourceTables(markdown: string): SafeSourceTable[] {
  const section = between(markdown, "## 2. 源文件与贴源层表", "## 3.");
  return section
    .split("\n")
    .map(line => line.trim())
    .filter(line => line.startsWith("| `"))
    .map(splitMarkdownTableRow)
    .map(([fileName, , stageTable, importStrategy, remark]) => ({
      fileName: fileName.replace(/`/g, "").split("/")[0].trim(),
      stageTable: stageTable === "无" ? null : stageTable.replace(/`/g, ""),
      importStrategy,
      remark,
    }))
    .filter(table => !EXCLUDED_SOURCE_FILES.has(table.fileName));
}

function parseFieldMappings(markdown: string): SafeSourceStageField[] {
  const fields: SafeSourceStageField[] = [];
  const heading = /^## \d+\. `([^`]+)`.*? -> `([^`]+)`$/gm;
  const matches = [...markdown.matchAll(heading)];
  for (const [index, match] of matches.entries()) {
    const sourceFile = match[1].split(" ")[0];
    const nextStart = matches[index + 1]?.index ?? markdown.length;
    const section = markdown.slice(match.index, nextStart);
    for (const row of markdownRows(section)) {
      const [sourceOrderRaw, javaIndexRaw, targetRaw, cn, importLogic] = row;
      if (!sourceOrderRaw?.startsWith("第")) continue;
      const sourceOrder = Number(sourceOrderRaw.replace(/[^\d]/g, ""));
      const javaIndex = Number(javaIndexRaw.replace(/[^\d]/g, ""));
      const target = targetRaw.replace(/`/g, "");
      const [targetTable, targetField] = target === "无" ? [null, null] : splitTarget(target);
      fields.push({ sourceFile, sourceOrder, javaIndex, targetTable, targetField, cn, importLogic });
    }
  }
  return fields;
}

function parseAutoFields(markdown: string): SafeStageAutoField[] {
  const fields: SafeStageAutoField[] = [];
  const heading = /^## \d+\. `([^`]+)`.*? -> `([^`]+)`$/gm;
  const matches = [...markdown.matchAll(heading)];
  for (const [index, match] of matches.entries()) {
    const nextStart = matches[index + 1]?.index ?? markdown.length;
    const section = markdown.slice(match.index, nextStart);
    const autoStart = section.search(/贴源表自动\/|贴源表自动、|贴源表自动/);
    if (autoStart < 0) continue;
    const autoSection = section.slice(autoStart);
    for (const row of markdownRows(autoSection)) {
      const [targetRaw, cn, importLogic] = row;
      if (!targetRaw?.startsWith("`")) continue;
      const target = targetRaw.replace(/`/g, "");
      if (!target.includes(".")) continue;
      const [targetTable, targetField] = splitTarget(target);
      fields.push({ targetTable, targetField, cn, importLogic });
    }
  }
  return fields;
}

function markdownRows(section: string): string[][] {
  return section
    .split("\n")
    .map(line => line.trim())
    .filter(line => line.startsWith("|") && !line.includes("---"))
    .map(splitMarkdownTableRow);
}

function splitMarkdownTableRow(line: string): string[] {
  return line.replace(/^\|\s*/, "").replace(/\s*\|$/, "").split(/\s+\|\s+/).map(cell => cell.trim());
}

function splitTarget(value: string): [string, string] {
  const dot = value.indexOf(".");
  return [value.slice(0, dot), value.slice(dot + 1)];
}

function between(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start);
  if (startIndex < 0) return "";
  const endIndex = source.indexOf(end, startIndex + start.length);
  return source.slice(startIndex, endIndex < 0 ? source.length : endIndex);
}
