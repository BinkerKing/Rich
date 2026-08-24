import { Fragment } from "react";
import type { ProjectDictionaryFieldHit, ProjectDictionaryTable } from "../../../api/client.js";

type DictionaryFileSourceSpec = {
  fileNamePattern?: string;
  filePath?: string;
  encoding?: string;
  delimiter?: string;
  recordFormat?: string;
  headerRule?: string;
  importRule?: string;
};

type DictionaryStageSourceLink = {
  sourceFile?: string;
  sourceTableId?: string;
  sourceLinkStatus?: string;
};

type DictionarySourceFileFieldSpec = {
  parseMode?: string;
  delimiterOrLayout?: string;
  fieldPosition?: string;
  sourceFile?: string;
  stageField?: string;
};

function dictionarySourceFileFieldSpec(field: ProjectDictionaryFieldHit): DictionarySourceFileFieldSpec | null {
  const candidate = field.extra?.sourceFileField;
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return null;
  const source = candidate as Record<string, unknown>;
  const spec: DictionarySourceFileFieldSpec = {};
  for (const key of ["parseMode", "delimiterOrLayout", "fieldPosition", "sourceFile", "stageField"] as const) {
    if (typeof source[key] === "string" && source[key].trim()) spec[key] = source[key].trim();
  }
  return Object.keys(spec).length > 0 ? spec : null;
}

export function dictionaryFieldDescription(field: ProjectDictionaryFieldHit): string | undefined {
  const spec = dictionarySourceFileFieldSpec(field);
  if (!spec) return field.description;
  const parts = [
    spec.sourceFile ? `源文件：${spec.sourceFile}` : "源文件字段",
    `解析方式：${spec.parseMode || "待确认"}`,
    `分隔/定长规则：${spec.delimiterOrLayout || "待确认"}`,
    `字段序号：${field.sourceFieldOrder ?? spec.fieldPosition ?? "待确认"}`,
  ];
  if (spec.stageField) parts.push(`对应贴源字段：${spec.stageField}`);
  return parts.join("；");
}

export function sortDictionaryFieldsByTemplateOrder(fields: ProjectDictionaryFieldHit[]): ProjectDictionaryFieldHit[] {
  return fields.map((field, index) => ({ field, index })).sort((a, b) => {
    const aIsSource = a.field.systemCode === "SAFE_SOURCE" || a.field.carrierKind === "file";
    const bIsSource = b.field.systemCode === "SAFE_SOURCE" || b.field.carrierKind === "file";
    const aOrder = aIsSource ? a.field.sourceFieldOrder ?? a.field.fieldOrder : a.field.fieldOrder ?? a.field.sourceFieldOrder;
    const bOrder = bIsSource ? b.field.sourceFieldOrder ?? b.field.fieldOrder : b.field.fieldOrder ?? b.field.sourceFieldOrder;
    const aHasOrder = typeof aOrder === "number" && Number.isFinite(aOrder);
    const bHasOrder = typeof bOrder === "number" && Number.isFinite(bOrder);
    if (aHasOrder && bHasOrder && aOrder !== bOrder) return aOrder - bOrder;
    if (aHasOrder !== bHasOrder) return aHasOrder ? -1 : 1;
    return a.index - b.index;
  }).map(item => item.field);
}

function dictionaryFileSourceSpec(table: ProjectDictionaryTable): DictionaryFileSourceSpec | null {
  const candidate = table.extra?.fileSource;
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return null;
  const record = candidate as Record<string, unknown>;
  const spec: DictionaryFileSourceSpec = {};
  for (const key of ["fileNamePattern", "filePath", "encoding", "delimiter", "recordFormat", "headerRule", "importRule"] as const) {
    if (typeof record[key] === "string" && record[key].trim()) spec[key] = record[key].trim();
  }
  return Object.keys(spec).length > 0 ? spec : null;
}

export function DictionaryFileSourceBlock({ table }: { table: ProjectDictionaryTable }) {
  const spec = dictionaryFileSourceSpec(table);
  if (!spec) return null;
  const rows: Array<[string, string | undefined]> = [["文件名规则", spec.fileNamePattern], ["文件路径", spec.filePath], ["记录格式", spec.recordFormat], ["分隔规则", spec.delimiter], ["文件编码", spec.encoding], ["表头规则", spec.headerRule], ["导入规则", spec.importRule]];
  return <section className="prj-pm-dict-field-popover__section is-file-source"><header><strong>文件规则</strong><span>{table.tableName}</span></header><div className="prj-pm-dict-table-detail-grid">{rows.filter(([, value]) => value).map(([label, value]) => <Fragment key={label}><span>{label}</span><strong>{value}</strong></Fragment>)}</div></section>;
}

function dictionaryStageSourceLink(table: ProjectDictionaryTable): DictionaryStageSourceLink | null {
  const record = table.extra;
  if (!record) return null;
  const link: DictionaryStageSourceLink = {};
  for (const key of ["sourceFile", "sourceTableId", "sourceLinkStatus"] as const) {
    if (typeof record[key] === "string" && record[key].trim()) link[key] = record[key].trim();
  }
  return Object.keys(link).length > 0 ? link : null;
}

export function DictionaryStageSourceLinkBlock({ table }: { table: ProjectDictionaryTable }) {
  const link = dictionaryStageSourceLink(table);
  if (!link) return null;
  const status = link.sourceLinkStatus === "pending-file-etl-verification" ? "待文件/ETL核验" : link.sourceLinkStatus;
  return <section className="prj-pm-dict-field-popover__section is-file-source"><header><strong>关联源文件</strong><span>{table.tableName}</span></header><div className="prj-pm-dict-table-detail-grid"><span>源文件</span><strong>{link.sourceFile || "待确认"}</strong><span>源文件元</span><code>{link.sourceTableId || "待确认"}</code><span>关联状态</span><strong>{status || "待确认"}</strong></div></section>;
}
