import type { ProjectDictionaryFieldHit, ProjectDictionaryTable } from "../../../api/client.js";

type DictionaryUploadedRow = {
  lineNumber: number;
  values: Record<string, unknown>;
  rawColumns: unknown[];
  extraColumns: unknown[];
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function getDictionaryFileParseConfig(table?: ProjectDictionaryTable): { encoding: string; delimiter: string } {
  const testData = record(table?.extra?.testData);
  const fileSource = record(table?.extra?.fileSource);
  const onegenSourceFile = record(table?.extra?.onegenSourceFile);
  const encoding = [testData.encoding, fileSource.encoding, onegenSourceFile.encoding]
    .find(value => typeof value === "string" && value.trim());
  const delimiter = [testData.delimiter, fileSource.delimiter, onegenSourceFile.delimiter]
    .find(value => typeof value === "string" && value.length > 0);
  return {
    encoding: normalizeDictionaryTextEncoding(typeof encoding === "string" ? encoding : "utf-8"),
    delimiter: normalizeDictionaryDelimiter(typeof delimiter === "string" ? delimiter : defaultDictionaryDelimiter(table)),
  };
}

function defaultDictionaryDelimiter(table?: ProjectDictionaryTable): string {
  return table?.fileType?.toLowerCase() === "csv" ? "," : "|";
}

export function normalizeDictionaryTextEncoding(value: string): string {
  const raw = value.trim().toLowerCase();
  if (!raw) return "utf-8";
  if (/utf[-_ ]?16le|unicode little/.test(raw)) return "utf-16le";
  if (/utf[-_ ]?16be|unicode big/.test(raw)) return "utf-16be";
  if (/utf[-_ ]?16|charset\.forname\("unicode"\)|unicode/.test(raw)) return "utf-16le";
  if (/gbk|gb2312|gb18030/.test(raw)) return "gb18030";
  if (/ascii|utf[-_ ]?8/.test(raw)) return "utf-8";
  return value.trim();
}

export function normalizeDictionaryDelimiter(value: string): string {
  if (value === "\\t" || value.toLowerCase() === "tab") return "\t";
  if (value === "\\|") return "|";
  if (value === "\\n") return "\n";
  return value;
}

export function decodeDictionaryTextFile(buffer: ArrayBuffer, encoding: string): string {
  try {
    return new TextDecoder(encoding).decode(buffer).replace(/^\uFEFF/, "");
  } catch {
    return new TextDecoder("utf-8").decode(buffer).replace(/^\uFEFF/, "");
  }
}

export function parseDictionaryUploadedTestFile(text: string, fields: ProjectDictionaryFieldHit[], delimiter: string): DictionaryUploadedRow[] {
  const usableFields = fields.slice(0, 200);
  return text.split(/\r\n|\n|\r/).filter(line => line.length > 0).map((line, index) => {
    const columns = splitDictionaryTestDataLine(line, delimiter);
    return {
      lineNumber: index + 1,
      values: Object.fromEntries(usableFields.map((field, fieldIndex) => [field.fieldName, columns[fieldIndex] ?? ""])),
      rawColumns: columns,
      extraColumns: columns.slice(usableFields.length),
    };
  });
}

function splitDictionaryTestDataLine(line: string, delimiter: string): string[] {
  if (!delimiter) return [line];
  return delimiter === "," ? splitCsvLine(line) : line.split(delimiter);
}

function splitCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === "\"" && quoted && next === "\"") { current += "\""; index += 1; }
    else if (char === "\"") quoted = !quoted;
    else if (char === "," && !quoted) { values.push(current); current = ""; }
    else current += char;
  }
  values.push(current);
  return values;
}
