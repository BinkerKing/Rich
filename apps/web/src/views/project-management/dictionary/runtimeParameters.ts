import type { ProjectDictionaryFieldHit, ProjectDictionaryTable } from "../../../api/client.js";

export function isDictionaryRuntimeParameterName(name?: string): boolean {
  const text = name?.trim() || "";
  return Boolean(text && !/^(null|true|false|undefined)$/i.test(text));
}

function runtimeParameterName(value?: string): string {
  return value?.trim().match(/^:([A-Za-z_][\w$]*)$/)?.[1] || "";
}

function jsonObjectsInText(text: string): string[] {
  const blocks: string[] = [];
  for (let start = text.indexOf("{"); start >= 0; start = text.indexOf("{", start + 1)) {
    let depth = 0; let inString = false; let escaping = false;
    for (let index = start; index < text.length; index += 1) {
      const char = text[index];
      if (inString) { if (escaping) escaping = false; else if (char === "\\") escaping = true; else if (char === "\"") inString = false; continue; }
      if (char === "\"") inString = true;
      else if (char === "{") depth += 1;
      else if (char === "}" && --depth === 0) { blocks.push(text.slice(start, index + 1)); break; }
    }
  }
  return Array.from(new Set(blocks));
}

function runtimeParametersInJson(value: unknown): string[] {
  const names = new Set<string>();
  const visit = (item: unknown) => {
    if (!item || typeof item !== "object") return;
    if (Array.isArray(item)) return void item.forEach(visit);
    const record = item as Record<string, unknown>;
    if (typeof record.source === "string") {
      const name = runtimeParameterName(record.source);
      if (isDictionaryRuntimeParameterName(name)) names.add(name);
    }
    if (typeof record.op === "string" && /^(param|runtime_context)$/i.test(record.op) && typeof record.name === "string" && isDictionaryRuntimeParameterName(record.name)) names.add(record.name.trim());
    Object.values(record).forEach(visit);
  };
  visit(value);
  return Array.from(names);
}

export function collectDictionaryRuntimeParameters(table: ProjectDictionaryTable | undefined, fields: ProjectDictionaryFieldHit[]): string[] {
  const names = new Set<string>();
  const collect = (text?: string) => {
    const raw = text?.trim() || "";
    for (const match of raw.matchAll(/(^|[^\w$"']):([A-Za-z_][\w$]*)\b/g)) if (isDictionaryRuntimeParameterName(match[2])) names.add(match[2]);
    for (const match of raw.matchAll(/(^|[^\w$"'])(?:参数|入参)[.\s:：]+([A-Za-z_][\w$]*)\b/g)) if (match[2]) names.add(match[2]);
    for (const match of raw.matchAll(/(^|[^\w$"'])(?:param|params|runtime|runtime_context)[.:：]+([A-Za-z_][\w$]*)\b/gi)) if (match[2]) names.add(match[2]);
    jsonObjectsInText(raw).forEach(block => { try { runtimeParametersInJson(JSON.parse(block)).forEach(name => names.add(name)); } catch { /* validation reports malformed rules */ } });
  };
  collect(table?.caliber);
  fields.forEach(field => collect(field.acquireLogic));
  return Array.from(names).sort((a, b) => a.localeCompare(b));
}
