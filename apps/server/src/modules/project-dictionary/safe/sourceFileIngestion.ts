export type SafeSourceField = {
  fieldName: string;
};

export type SafeParsedTestData = {
  sourceFilePath: string;
  sourceFileName: string;
  importedAt: string;
  encoding: "UTF-16LE";
  delimiter: "|";
  recordCount: number;
  sampleLimit: number;
  sampleCount: number;
  expectedFieldCount: number;
  columnCounts: Record<string, number>;
  columnCountIssues: Array<{ columnCount: number; recordCount: number; note: string }>;
  rows: Array<{
    lineNumber: number;
    columnCount: number;
    rawColumns: string[];
    values: Record<string, string>;
    extraColumns: string[];
  }>;
};

/**
 * Parses the confirmed OneGen source-file format without performing I/O or
 * writing project data. Java's `split("\\|", -1)` behavior is preserved by
 * JavaScript's string split for trailing empty values.
 */
export function parseSafeSourceFile(input: {
  sourceFilePath: string;
  sourceFileName: string;
  buffer: Buffer;
  fields: SafeSourceField[];
  importedAt: string;
  sampleLimit: number;
}): SafeParsedTestData {
  const text = input.buffer.toString("utf16le").replace(/^\uFEFF/, "");
  const lines = text.split(/\r?\n/).filter(line => line.length > 0);
  const columnCounts = new Map<number, number>();
  const rows: SafeParsedTestData["rows"] = [];

  for (const [index, line] of lines.entries()) {
    const columns = line.split("|");
    columnCounts.set(columns.length, (columnCounts.get(columns.length) ?? 0) + 1);
    if (rows.length >= input.sampleLimit) continue;
    const values: Record<string, string> = {};
    input.fields.forEach((field, fieldIndex) => {
      values[field.fieldName] = columns[fieldIndex] ?? "";
    });
    rows.push({
      lineNumber: index + 1,
      columnCount: columns.length,
      rawColumns: columns,
      values,
      extraColumns: columns.slice(input.fields.length),
    });
  }

  const columnCountIssues = [...columnCounts.entries()]
    .filter(([columnCount]) => columnCount !== input.fields.length)
    .map(([columnCount, recordCount]) => ({
      columnCount,
      recordCount,
      note: columnCount > input.fields.length
        ? "文件列数多于已确认字段数，超出部分记录在 extraColumns。"
        : "文件列数少于已确认字段数，缺失字段按空值展示。",
    }));

  return {
    sourceFilePath: input.sourceFilePath,
    sourceFileName: input.sourceFileName,
    importedAt: input.importedAt,
    encoding: "UTF-16LE",
    delimiter: "|",
    recordCount: lines.length,
    sampleLimit: input.sampleLimit,
    sampleCount: rows.length,
    expectedFieldCount: input.fields.length,
    columnCounts: Object.fromEntries([...columnCounts.entries()].map(([key, value]) => [String(key), value])),
    columnCountIssues,
    rows,
  };
}
