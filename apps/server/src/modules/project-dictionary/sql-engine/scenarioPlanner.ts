import type { ProjectDictionaryFieldDetail, ProjectDictionaryTable } from "../../../repos/ProjectManagementRepo.js";
import { dictionaryEntityString } from "../test-data/entityRows.js";

export type DictionaryExtractionScenarioVariant = {
  title: string;
  table: ProjectDictionaryTable;
  fields: ProjectDictionaryFieldDetail[];
  remark?: string;
};

export function deriveDictionaryExtractionTableCaliberFromFields(
  fields: ProjectDictionaryFieldDetail[],
): string | undefined {
  const scenarios = new Map<string, { title: string; caliber: string; remark?: string }>();
  for (const field of fields) {
    for (const piece of splitDictionaryExtractionScenarioTexts(field.acquireLogic)) {
      const caliber = extractDictionaryExtractionScenarioCaliber(piece);
      if (!isDictionaryExtractionCaliberJson(caliber)) continue;
      const title = extractDictionaryExtractionScenarioTitle(piece) || "场景1";
      const key = normalizeDictionaryExtractionScenarioKey(title) || "scenario_1";
      if (scenarios.has(key)) continue;
      scenarios.set(key, {
        title,
        caliber,
        remark: extractDictionaryExtractionScenarioRemark(piece) || undefined,
      });
    }
  }
  const sorted = Array.from(scenarios.values())
    .sort((left, right) => dictionaryExtractionScenarioSortWeight(left.title) - dictionaryExtractionScenarioSortWeight(right.title));
  if (sorted.length === 0) return undefined;
  if (sorted.length === 1) return sorted[0]?.caliber;
  return sorted.map(scenario => [
    scenario.title,
    `口径：${scenario.caliber}`,
    scenario.remark ? `备注：${scenario.remark}` : "",
  ].filter(Boolean).join("\n")).join("\n\n");
}

export function buildDictionaryExtractionScenarioVariants(
  table: ProjectDictionaryTable,
  fields: ProjectDictionaryFieldDetail[],
): DictionaryExtractionScenarioVariant[] {
  const tablePieces = splitDictionaryExtractionScenarioTexts(table.caliber);
  const fieldPieces = fields.map(field => ({
    field,
    pieces: splitDictionaryExtractionScenarioTexts(field.acquireLogic),
  }));
  const scenarioTitles = new Map<string, string>();
  for (const piece of tablePieces) {
    const title = extractDictionaryExtractionScenarioTitle(piece);
    if (!title) continue;
    const key = normalizeDictionaryExtractionScenarioKey(title);
    if (key && !scenarioTitles.has(key)) scenarioTitles.set(key, title);
  }
  for (const item of fieldPieces) {
    for (const piece of item.pieces) {
      const title = extractDictionaryExtractionScenarioTitle(piece);
      if (!title) continue;
      const key = normalizeDictionaryExtractionScenarioKey(title);
      if (key && !scenarioTitles.has(key)) scenarioTitles.set(key, title);
    }
  }
  if (scenarioTitles.size <= 1) {
    const piece = tablePieces[0];
    const title = piece ? extractDictionaryExtractionScenarioTitle(piece) || "场景1" : "场景1";
    const caliber = piece ? extractDictionaryExtractionScenarioCaliber(piece) : "";
    const remark = piece ? extractDictionaryExtractionScenarioRemark(piece) : "";
    return [{
      title,
      table: caliber ? { ...table, caliber } : table,
      fields: fields.map(field => dictionaryEntityString(field.acquireLogic).trim()
        ? field
        : { ...field, acquireLogic: '{"op":"null"}' }),
      remark,
    }];
  }

  return Array.from(scenarioTitles.entries())
    .map(([key, title]) => {
      const tablePiece = findDictionaryExtractionScenarioPiece(tablePieces, key);
      const caliber = tablePiece
        ? extractDictionaryExtractionScenarioCaliber(tablePiece)
        : "";
      const remark = tablePiece ? extractDictionaryExtractionScenarioRemark(tablePiece) : "";
      const scenarioFields = fieldPieces.map(({ field, pieces }) => {
        const scenarioPiece = findDictionaryExtractionScenarioPiece(pieces, key);
        if (scenarioPiece) {
          return { ...field, acquireLogic: extractDictionaryExtractionScenarioLogic(scenarioPiece) };
        }
        const hasExplicitScenario = pieces.some(piece => extractDictionaryExtractionScenarioTitle(piece));
        return hasExplicitScenario || !dictionaryEntityString(field.acquireLogic).trim()
          ? { ...field, acquireLogic: '{"op":"null"}' }
          : field;
      });
      return {
        title,
        table: tablePiece ? { ...table, caliber } : table,
        fields: scenarioFields,
        remark,
      };
    })
    .sort((left, right) => dictionaryExtractionScenarioSortWeight(left.title) - dictionaryExtractionScenarioSortWeight(right.title));
}

export function formatDictionaryExtractionScenarioSqlComment(
  variant: DictionaryExtractionScenarioVariant | undefined,
  index: number,
): string {
  const title = variant?.title || `场景${index + 1}`;
  const lines = [`-- ${title}`];
  const remarkLines = dictionaryEntityString(variant?.remark)
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);
  for (const line of remarkLines) {
    lines.push(line.startsWith("备注") ? `-- ${line}` : `-- 备注：${line}`);
  }
  return lines.join("\n");
}

function findDictionaryExtractionScenarioPiece(pieces: string[], key: string): string | undefined {
  return pieces.find(piece => normalizeDictionaryExtractionScenarioKey(extractDictionaryExtractionScenarioTitle(piece)) === key);
}

function splitDictionaryExtractionScenarioTexts(value: unknown): string[] {
  const text = dictionaryEntityString(value);
  if (!text) return [];
  if (text.trim().startsWith("{")) return [text.trim()];
  const pieces = text.split(/(?=场景\s*\d+)/g).map(item => item.trim()).filter(Boolean);
  return pieces.length ? pieces : [text.trim()];
}

function extractDictionaryExtractionScenarioTitle(text: string): string {
  const firstLine = text.split(/\r?\n/).map(line => line.trim()).find(Boolean) || "";
  const match = firstLine.match(/^(场景\s*\d+)(?:[：:\s]+(.+))?$/);
  if (!match) return "";
  const suffix = dictionaryEntityString(match[2]);
  return suffix ? `${match[1]} ${suffix}` : match[1] || "";
}

function normalizeDictionaryExtractionScenarioKey(title: string): string {
  const match = dictionaryEntityString(title).match(/^场景\s*(\d+)/);
  return match ? `scenario_${Number(match[1])}` : normalizeDictionaryExtractionKey(title);
}

function dictionaryExtractionScenarioSortWeight(title: string): number {
  const match = dictionaryEntityString(title).match(/^场景\s*(\d+)/);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

function extractDictionaryExtractionScenarioCaliber(text: string): string {
  const trimmed = text.trim();
  if (isDictionaryExtractionCaliberJson(trimmed)) return trimmed;
  return extractDictionaryExtractionLabeledBlock(
    text,
    /^(口径|标准口径|口径JSON|标准口径JSON|取数范围描述|业务口径|口径说明)[：:]\s*(.*)$/,
    /^(场景\s*\d+|逻辑|规则|逻辑\/规则|加工逻辑|取数逻辑|条件|结果|数据表mapping|表别名|数据字段|mapping|备注|SQL转换)[：:]?/i,
  );
}

function extractDictionaryExtractionLabeledBlock(text: string, startRegex: RegExp, stopRegex: RegExp): string {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index]?.match(startRegex);
    if (!match) continue;
    const inlineValue = dictionaryEntityString(match[2]);
    if (inlineValue) {
      if (inlineValue.startsWith("{")) {
        return collectDictionaryExtractionJsonBlock([inlineValue, ...lines.slice(index + 1)], 0) || inlineValue;
      }
      return inlineValue;
    }
    const blockLines: string[] = [];
    for (let nextIndex = index + 1; nextIndex < lines.length; nextIndex += 1) {
      const line = lines[nextIndex] ?? "";
      if (!blockLines.length && line.startsWith("{")) {
        return collectDictionaryExtractionJsonBlock(lines, nextIndex);
      }
      if (stopRegex.test(line)) break;
      blockLines.push(line);
    }
    return blockLines.join("\n").trim();
  }
  return "";
}

function collectDictionaryExtractionJsonBlock(lines: string[], startIndex: number): string {
  const collected: string[] = [];
  let depth = 0;
  let started = false;
  for (let index = startIndex; index < lines.length; index += 1) {
    const line = lines[index]?.trim() ?? "";
    if (!started && !line.startsWith("{")) break;
    started = true;
    collected.push(line);
    let inString = false;
    let escaped = false;
    for (const char of line) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === "\"") {
        inString = !inString;
        continue;
      }
      if (inString) continue;
      if (char === "{") depth += 1;
      if (char === "}") depth -= 1;
    }
    if (started && depth <= 0) break;
  }
  return collected.join("\n").trim();
}

function extractDictionaryExtractionScenarioLogic(text: string): string {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const logicLines: string[] = [];
  let inLogicBlock = false;
  for (const line of lines) {
    const logicMatch = line.match(/^(逻辑|规则|逻辑\/规则|加工逻辑|取数逻辑|条件|结果)[：:]\s*(.*)$/);
    if (logicMatch) {
      inLogicBlock = true;
      if (logicMatch[2]) logicLines.push(logicMatch[2].trim());
      continue;
    }
    if (inLogicBlock) {
      if (/^(场景\s*\d+|口径|标准口径|口径JSON|标准口径JSON|取数范围描述|业务口径|口径说明|数据表mapping|表别名|数据字段|mapping|备注|SQL转换)[：:]?/i.test(line)) break;
      logicLines.push(line);
    }
  }
  if (logicLines.length) return logicLines.join("\n").trim();
  return lines
    .filter(line => !/^场景\s*\d+/.test(line))
    .filter(line => !/^(口径|标准口径|口径JSON|标准口径JSON|取数范围描述|业务口径|口径说明|数据表mapping|表别名|数据字段|mapping|备注|SQL转换)[：:]?/i.test(line))
    .join("\n")
    .trim();
}

function extractDictionaryExtractionScenarioRemark(text: string): string {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const remarkLines: string[] = [];
  let inRemarkBlock = false;
  for (const line of lines) {
    const remarkMatch = line.match(/^备注[：:]\s*(.*)$/);
    if (remarkMatch) {
      inRemarkBlock = true;
      if (remarkMatch[1]) remarkLines.push(remarkMatch[1].trim());
      continue;
    }
    if (!inRemarkBlock) continue;
    if (/^(场景\s*\d+|逻辑|规则|逻辑\/规则|加工逻辑|取数逻辑|条件|结果|口径|标准口径|口径JSON|标准口径JSON|取数范围描述|业务口径|口径说明|数据表mapping|表别名|数据字段|mapping|SQL转换)[：:]?/i.test(line)) break;
    remarkLines.push(line);
  }
  return remarkLines.join("\n").trim();
}

function isDictionaryExtractionCaliberJson(text: string): boolean {
  if (!text.startsWith("{")) return false;
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") return false;
    const op = dictionaryEntityString(parsed.op).toLowerCase();
    return ["full_extract", "dataset", "query_scope", "scope"].includes(op)
      || "from" in parsed
      || "joins" in parsed
      || "where" in parsed
      || "group_by" in parsed
      || "order_by" in parsed
      || "limit" in parsed
      || "select_latest" in parsed
      || "union_all" in parsed;
  } catch {
    return false;
  }
}

function normalizeDictionaryExtractionKey(value: unknown): string {
  return dictionaryEntityString(value).replace(/[\\s_.'"`\\[\\]-]/g, "").toLowerCase();
}
