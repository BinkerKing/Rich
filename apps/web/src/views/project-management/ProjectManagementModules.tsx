import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Code } from "@tiptap/extension-code";
import Underline from "@tiptap/extension-underline";
import { Color } from "@tiptap/extension-color";
import { FontFamily } from "@tiptap/extension-font-family";
import Highlight from "@tiptap/extension-highlight";
import Image from "@tiptap/extension-image";
import { Table } from "@tiptap/extension-table";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TableRow from "@tiptap/extension-table-row";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import type {
  DictionaryCaliberExpression,
  DictionaryCaliberJoin,
  DictionaryCaliberOrderExpression,
  DictionaryCaliberRule,
  DictionaryCaliberSelectLatest,
  DictionaryMappingJsonCondition,
  DictionaryMappingJsonRule,
  DictionaryMappingJsonRuleValue,
  Element,
} from "@ke/domain";
import { dictionaryJoinType } from "@ke/domain";
import {
  DictionaryFileSourceBlock,
  DictionaryStageSourceLinkBlock,
  dictionaryFieldDescription,
  sortDictionaryFieldsByTemplateOrder,
} from "./dictionary/DictionaryMetadata.js";
import {
  DictionaryResizableHeadCell,
  loadDictionaryColumnWidths,
  saveDictionaryColumnWidths,
  type DictionaryResizableColumn,
  useDictionaryResizableColumns,
} from "./dictionary/DictionaryResizableColumns.js";
import { collectDictionaryRuntimeParameters, isDictionaryRuntimeParameterName } from "./dictionary/runtimeParameters.js";
import {
  buildDictionaryCoalesceCastSql,
  buildDictionaryDateParseSql,
  buildDictionaryRandomSqlExpression,
  buildDictionarySplitPartSql,
  buildDictionarySubstringMarkerSql,
  formatDictionaryLimitSql,
  formatDictionarySqlLiteral,
  stripDictionarySqlQuotes,
} from "./dictionary/sqlDialectExpressions.js";
import {
  decodeDictionaryTextFile,
  getDictionaryFileParseConfig,
  normalizeDictionaryTextEncoding,
  parseDictionaryUploadedTestFile,
} from "./dictionary/testFileParsing.js";
import { DictionaryTestDataPanel } from "./dictionary/DictionaryTestDataPanel.js";
import {
  buildDictionaryCaliberSql,
  buildDictionaryLogicRefCandidates,
  convertDictionaryMappingRuleToSql,
  dictionaryRuntimeParamName,
  dictionaryCaliberTableName,
  dictionaryStoredSqlConversion,
  findNextDictionaryLogicRefMatch,
  formatDictionarySqlForDisplay,
  formatDictionaryCaliberTable,
  formatDictionaryJoinType,
  getDictionarySourceRefChinese,
  getDictionarySourceRefEnglish,
  getDictionarySourceRefSqlName,
  normalizeDictionaryRefKey,
  normalizeDictionaryJsonOp,
  parseDictionaryCaliberJsonRuleStrict,
  parseDictionaryJsonRule,
  parseDictionaryJsonRuleStrict,
  sanitizeDictionarySqlIdentifier,
  type DictionaryMappingRule,
  type DictionarySourceRef,
  type DictionarySqlConversion,
  type DictionarySqlDialect,
} from "./dictionary/sqlRuleEngine.js";
import {
  api,
  type ProjectDictionaryEntityExtractionPrepareResult,
  type ProjectDictionaryRectification,
  type ProjectDictionaryRectificationInput,
  type ProjectDictionaryEntitySchemaStatusResult,
  type ProjectDictionaryExtractionValidationIssue,
  type ProjectDictionaryFieldDetail,
  type ProjectDictionaryFieldHit,
  type ProjectDictionaryMappingSqlValidationResult,
  type ProjectDictionaryMappingTempFieldInput,
  type ProjectDictionaryMappingTempTable,
  type ProjectDictionaryMappingTempTableInput,
  type ProjectDictionarySystem,
  type ProjectDictionaryTable,
  type ProjectDictionaryTestFileMeta,
  type ProjectManagementModuleKey,
  type ProjectManagementSummary,
  type ProjectModuleItem,
} from "../../api/client.js";
export {
  PROJECT_MANAGEMENT_SECTIONS,
  ProjectManagementSearchBar,
  type ProjectManagementSection,
} from "./ProjectManagementNavigation.js";

type DictionaryView = "field-design" | "mapping" | "temp-table" | "relations" | "test-data" | "table-info";
type DictionaryPropertyKind = "fieldDetail" | "tableDetail" | "systemDetail" | "description" | "codeValue" | "formatPattern" | "mappingLogic" | "mappingCaliber" | "sourceRefs" | "generic";

type DictionaryPropertyPayload = {
  kind: DictionaryPropertyKind;
  title: string;
  subtitle?: string;
  value: string;
  remark?: string;
  system?: ProjectDictionarySystem;
  table?: ProjectDictionaryTable;
  field?: ProjectDictionaryFieldHit;
  refs?: DictionarySourceRef[];
  tableRefs?: DictionaryTableRef[];
  sqlConversion?: DictionarySqlConversion;
  sqlValidation?: ProjectDictionaryMappingSqlValidationResult["caliber"] | ProjectDictionaryMappingSqlValidationResult["fields"][number];
  sqlValidationBusy?: boolean;
};

type DictionaryMappingSqlValidationCacheEntry = {
  fingerprint: string;
  result: ProjectDictionaryMappingSqlValidationResult;
  message: string;
  validatedAt: string;
};

type DictionaryTableRef = {
  label: string;
  table?: ProjectDictionaryTable;
};

type DictionaryMappingJsonValue = DictionaryMappingJsonRuleValue;
type DictionaryCaliberJsonRule = DictionaryCaliberRule;

type DictionaryRectificationTarget = Pick<ProjectDictionaryRectificationInput, "entityType" | "entityId" | "propertyKey"> & {
  label: string;
  currentValue?: string;
};

type DictionaryTreeDragState =
  | { kind: "system"; id: string }
  | { kind: "table"; id: string; systemId: string };

type DictionaryWorkspaceState = {
  selectedSystemId: string;
  expandedSystemIds: string[];
  selectedTableId: string;
  openTableTitleIds: string[];
};

type DictionaryTreeDragEvent = {
  dataTransfer: DataTransfer;
  preventDefault: () => void;
};







function WorkflowEditor({
  projectId,
  draft,
  busy,
  onChange,
  onSave,
  onCancel,
}: {
  projectId: string;
  draft: Record<string, unknown>;
  busy: boolean;
  onChange: (next: Record<string, unknown>) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <ProjectModuleEditorShell title="编辑作业流程" busy={busy} onSave={onSave} onCancel={onCancel}>
      <div className="prj-pm-editor-grid">
        <ProjectTextField label="流程名称" value={textValue(draft, "title")} onChange={value => onChange({ ...draft, title: value })} />
        <ProjectTextField label="流程阶段" value={textValue(draft, "lane")} onChange={value => onChange({ ...draft, lane: value })} />
        <ProjectTextField label="时间节点" value={textValue(draft, "time")} onChange={value => onChange({ ...draft, time: value })} />
      </div>
      <ProjectField label="步骤说明">
        <ProjectRichTextEditor
          projectId={`${projectId}-workflow`}
          value={textValue(draft, "summaryHtml") || textValue(draft, "summary")}
          onChange={summaryHtml => onChange({ ...draft, summaryHtml, summary: htmlToPlainText(summaryHtml) })}
        />
      </ProjectField>
      <ProjectField label="检查项">
        <textarea value={stringList(draft.checks).join("\n")} onChange={event => onChange({ ...draft, checks: splitLines(event.target.value) })} />
      </ProjectField>
      <ProjectField label="注意事项">
        <textarea value={stringList(draft.warnings).join("\n")} onChange={event => onChange({ ...draft, warnings: splitLines(event.target.value) })} />
      </ProjectField>
      <ProjectField label="涉及服务器">
        <textarea value={JSON.stringify(recordValue(draft.serverNamesByEnv), null, 2)} onChange={event => onChange({ ...draft, serverNamesByEnv: parseJsonObject(event.target.value) })} />
      </ProjectField>
    </ProjectModuleEditorShell>
  );
}

function deploymentChecklistPlacement(item: Record<string, unknown>) {
  const placement = textValue(item, "placement");
  return placement === "middle" || placement === "after" ? placement : "before";
}

function deploymentChecklistStage(placement: string) {
  return placement === "middle" ? "步骤中检查" : placement === "after" ? "部署后验证" : "部署前检查";
}

export function DeploymentStepEditor({
  projectId,
  draft,
  busy,
  onChange,
  onSave,
  onCancel,
}: {
  projectId: string;
  draft: Record<string, unknown>;
  busy: boolean;
  onChange: (next: Record<string, unknown>) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <article className="deployment-detail-card deployment-edit-card">
      <div className="step-head deployment-edit-head">
        <div className="deployment-module-fields">
          <input value={textValue(draft, "phase") || textValue(draft, "title")} onChange={event => onChange({ ...draft, phase: event.target.value, title: event.target.value })} aria-label="区块名称" />
          <textarea value={textValue(draft, "target")} onChange={event => onChange({ ...draft, target: event.target.value })} aria-label="区块说明" placeholder="区块说明" />
        </div>
      </div>

      <section className="deployment-edit-section">
        <div className="deployment-edit-section-head">
          <h4>基础信息</h4>
        </div>
        <div className="deployment-module-fields deployment-module-meta-fields">
          <input value={textValue(draft, "release")} onChange={event => onChange({ ...draft, release: event.target.value })} aria-label="部署版本" placeholder="部署版本，例如：首次部署" />
          <input value={deploymentSheetOf(draft)} onChange={event => onChange({ ...draft, sheetName: event.target.value, version: event.target.value })} aria-label="Sheet 名称" placeholder="Sheet / Title 名称" />
          <input value={textValue(draft, "environment")} onChange={event => onChange({ ...draft, environment: event.target.value })} aria-label="环境" placeholder="环境" />
        </div>
      </section>

      <section className="deployment-edit-section">
        <div className="deployment-edit-section-head">
          <h4>执行步骤</h4>
        </div>
        <ProjectRichTextEditor
          projectId={`${projectId}-deployment`}
          value={textValue(draft, "executionHtml") || textValue(draft, "executionText")}
          onChange={executionHtml => onChange({ ...draft, executionHtml, executionText: htmlToPlainText(executionHtml) })}
        />
        <label className="deployment-check-editor-label">
          <span>可勾选检查项（部署前检查 / 部署后验证）</span>
        <textarea
          className="deployment-check-textarea"
          value={arrayRecords(draft.checklist).map(item => {
            const placement = deploymentChecklistPlacement(item);
            const prefix = placement === "middle" ? "[中]" : placement === "after" ? "[后]" : "[前]";
            return `${prefix} ${truthy(item.done) ? "x" : " "} ${textValue(item, "label")}`;
          }).join("\n")}
          onChange={event => onChange({ ...draft, checklist: splitLines(event.target.value).map(row => {
            const placement = row.match(/^\[(前|中|后)\]\s*/)?.[1] === "中" ? "middle" : row.match(/^\[(前|中|后)\]\s*/)?.[1] === "后" ? "after" : "before";
            const value = row.replace(/^\[(前|中|后)\]\s*/, "");
            return { placement, stage: deploymentChecklistStage(placement), done: value.trim().toLowerCase().startsWith("x "), label: value.replace(/^[x ]\s+/i, "") };
          }) })}
        />
        </label>
      </section>

      <section className="deployment-edit-section">
        <div className="deployment-edit-section-head">
          <h4>关联服务器</h4>
        </div>
        <textarea className="deployment-check-textarea" value={JSON.stringify(recordValue(draft.serverIdsByEnv), null, 2)} onChange={event => onChange({ ...draft, serverIdsByEnv: parseJsonObject(event.target.value) })} />
      </section>

      <footer className="deployment-editor-actions">
        <button type="button" className="prj-btn-link" onClick={onCancel} disabled={busy}>取消</button>
        <button type="button" className="prj-btn-primary" onClick={onSave} disabled={busy}>{busy ? "保存中..." : "保存"}</button>
      </footer>
    </article>
  );
}

export function CodeVersionsEditor({
  projectId,
  draft,
  busy,
  onChange,
  onSave,
  onCancel,
}: {
  projectId: string;
  draft: Record<string, unknown>;
  busy: boolean;
  onChange: (next: Record<string, unknown>) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const versions = arrayRecords(draft.versions);
  const updateVersion = (index: number, patch: Record<string, unknown>) => {
    onChange({ ...draft, versions: versions.map((version, i) => i === index ? { ...version, ...patch } : version) });
  };
  return (
    <ProjectModuleEditorShell title="编辑版本控制" busy={busy} onSave={onSave} onCancel={onCancel}>
      <ProjectTextField label="应用名称" value={textValue(draft, "name") || textValue(draft, "title")} onChange={value => onChange({ ...draft, name: value, title: value })} />
      <ProjectField label="应用说明">
        <ProjectRichTextEditor projectId={`${projectId}-code-app`} value={textValue(draft, "description")} onChange={description => onChange({ ...draft, description })} />
      </ProjectField>
      <div className="prj-pm-editor-list">
        {versions.map((version, index) => (
          <section key={textValue(version, "id") || index}>
            <header>
              <strong>版本 {index + 1}</strong>
              <button type="button" className="prj-btn-link prj-btn-danger" onClick={() => onChange({ ...draft, versions: versions.filter((_, i) => i !== index) })}>删除</button>
            </header>
            <div className="prj-pm-editor-grid">
              <ProjectTextField label="版本号" value={textValue(version, "versionNo")} onChange={value => updateVersion(index, { versionNo: value })} />
              <ProjectTextField label="计划发布时间" value={textValue(version, "plannedReleaseAt")} onChange={value => updateVersion(index, { plannedReleaseAt: value })} />
              <ProjectTextField label="实际发布时间" value={textValue(version, "actualReleaseAt")} onChange={value => updateVersion(index, { actualReleaseAt: value })} />
              <ProjectTextField label="计划上线时间" value={textValue(version, "plannedOnlineAt")} onChange={value => updateVersion(index, { plannedOnlineAt: value })} />
              <ProjectTextField label="实际上线时间" value={textValue(version, "actualOnlineAt")} onChange={value => updateVersion(index, { actualOnlineAt: value })} />
              <ProjectTextField label="关联文件夹" value={textValue(version, "folderPath")} onChange={value => updateVersion(index, { folderPath: value })} />
            </div>
            <ProjectField label="升级路线">
              <textarea value={textValue(version, "upgradePath")} onChange={event => updateVersion(index, { upgradePath: event.target.value })} />
            </ProjectField>
            <ProjectField label="升级内容">
              <ProjectRichTextEditor projectId={`${projectId}-code-version-${index}`} value={textValue(version, "upgradeContent")} onChange={upgradeContent => updateVersion(index, { upgradeContent })} />
            </ProjectField>
          </section>
        ))}
      </div>
      <button
        type="button"
        className="prj-btn-link"
        onClick={() => onChange({ ...draft, versions: [...versions, { id: `version-${Date.now()}`, versionNo: "V1.0.0" }] })}>
        新增版本
      </button>
    </ProjectModuleEditorShell>
  );
}



export function CodeVersionCard({ version, index }: { version: Record<string, unknown>; index: number }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <section className={`prj-pm-code-version${expanded ? " is-expanded" : ""}`}>
      <button type="button" className="prj-pm-code-version__toggle" onClick={() => setExpanded(value => !value)} aria-expanded={expanded}>
        <span>{String(index + 1).padStart(2, "0")}</span>
        <strong>{textValue(version, "versionNo") || `版本 ${index + 1}`}</strong>
        <i aria-hidden="true">{expanded ? "⌃" : "⌄"}</i>
      </button>
      {expanded && <div className="prj-pm-code-version__body">
        <div className="prj-pm-code-version__dates">
          <VersionDate label="计划发布时间" value={textValue(version, "plannedReleaseAt")} />
          <VersionDate label="实际发布时间" value={textValue(version, "actualReleaseAt")} />
          <VersionDate label="计划上线时间" value={textValue(version, "plannedOnlineAt")} />
          <VersionDate label="实际上线时间" value={textValue(version, "actualOnlineAt")} />
        </div>
        <VersionTextBlock title="关联文件夹" value={textValue(version, "folderPath")} />
        <VersionTextBlock title="升级路线" value={textValue(version, "upgradePath")} />
        <VersionTextBlock title="升级内容" value={textValue(version, "upgradeContent")} important />
      </div>}
    </section>
  );
}

type TodoStatus = "todo" | "doing" | "done";

export function TodoEditor({
  projectId,
  draft,
  busy,
  onChange,
  onSave,
  onCancel,
}: {
  projectId: string;
  draft: { title: string; owner: string; priority: string; dueAt: string; description: string; status: TodoStatus };
  busy: boolean;
  onChange: (next: { title: string; owner: string; priority: string; dueAt: string; description: string; status: TodoStatus }) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="prj-pm-todos__editor">
      <header>
        <h3>编辑代办</h3>
        <div>
          <button type="button" className="prj-btn-link" onClick={onCancel} disabled={busy}>取消</button>
          <button type="button" className="prj-btn-primary" onClick={onSave} disabled={busy}>保存</button>
        </div>
      </header>
      <label>
        <span>标题</span>
        <input value={draft.title} onChange={event => onChange({ ...draft, title: event.target.value })} />
      </label>
      <div className="prj-pm-todos__editor-grid">
        <label>
          <span>状态</span>
          <select value={draft.status} onChange={event => onChange({ ...draft, status: event.target.value as TodoStatus })}>
            <option value="todo">待处理</option>
            <option value="doing">处理中</option>
            <option value="done">已完成</option>
          </select>
        </label>
        <label>
          <span>负责人</span>
          <input value={draft.owner} onChange={event => onChange({ ...draft, owner: event.target.value })} />
        </label>
        <label>
          <span>优先级</span>
          <input value={draft.priority} onChange={event => onChange({ ...draft, priority: event.target.value })} />
        </label>
        <label>
          <span>截止时间</span>
          <input value={draft.dueAt} onChange={event => onChange({ ...draft, dueAt: event.target.value })} />
        </label>
      </div>
      <label>
        <span>事项说明</span>
        <ProjectRichTextEditor projectId={`${projectId}-todo`} value={draft.description} onChange={description => onChange({ ...draft, description })} />
      </label>
    </div>
  );
}

export function TodoDetail({ todo, onEdit, onDelete }: { todo: ProjectModuleItem; onEdit: () => void; onDelete: () => void }) {
  const original = recordValue(todo.content.original);
  const status = normalizeTodoStatus(original);
  const fields = [
    ["状态", status === "done" ? "已完成" : status === "doing" ? "处理中" : "待处理"],
    ["负责人", textValue(original, "owner")],
    ["优先级", textValue(original, "priority")],
    ["截止时间", textValue(original, "dueAt") || textValue(original, "deadline")],
  ].filter(([, value]) => value);

  return (
    <article>
      <header>
        <div>
          <p>待办详情</p>
          <h3>{todo.title}</h3>
        </div>
        <div className="prj-pm-todos__detail-actions">
          <span>{status === "done" ? "Done" : status === "doing" ? "Doing" : "Todo"}</span>
          <button type="button" className="prj-btn-link" onClick={onEdit}>编辑</button>
          <button type="button" className="prj-btn-link prj-btn-danger" onClick={onDelete}>删除</button>
        </div>
      </header>
      {fields.length > 0 && (
        <dl className="prj-pm-todos__fields">
          {fields.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      )}
      <VersionTextBlock title="事项说明" value={textValue(original, "description") || textValue(original, "content")} />
      <VersionTextBlock title="处理结果" value={textValue(original, "result")} important />
    </article>
  );
}

export function ProjectModuleEditorShell({
  title,
  busy,
  children,
  onSave,
  onCancel,
}: {
  title: string;
  busy: boolean;
  children: ReactNode;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="prj-pm-module-editor">
      <header>
        <h3>{title}</h3>
        <div>
          <button type="button" className="prj-btn-link" onClick={onCancel} disabled={busy}>取消</button>
          <button type="button" className="prj-btn-primary" onClick={onSave} disabled={busy}>保存</button>
        </div>
      </header>
      {children}
    </div>
  );
}

export function ProjectField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="prj-pm-editor-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function ProjectTextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <ProjectField label={label}>
      <input value={value} onChange={event => onChange(event.target.value)} />
    </ProjectField>
  );
}

type RichToolbarIconName =
  | "undo" | "redo" | "paragraph" | "heading-one" | "heading-two" | "heading-three" | "bold" | "italic" | "underline" | "strike"
  | "text-color" | "highlight" | "align-left" | "align-center" | "align-right" | "bullet-list" | "ordered-list"
  | "quote" | "code" | "link" | "image" | "table" | "clear" | "more";

const RICH_TEXT_COLORS = ["#1f2937", "#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899", "#ffffff"];
const RICH_HIGHLIGHT_COLORS = ["#fff3b0", "#fee2e2", "#ffedd5", "#fef3c7", "#dcfce7", "#cffafe", "#dbeafe", "#ede9fe", "#fce7f3", "#e5e7eb"];
const RICH_TOOLBAR_ITEM_COUNT = 25;
const RICH_FONT_SIZES = [12, 14, 16, 18, 20, 24, 28, 32];

function RichToolbarIcon({ name }: { name: RichToolbarIconName }) {
  const common = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  switch (name) {
    case "undo": return <svg {...common}><path d="M9 7 4 12l5 5"/><path d="M20 18a8 8 0 0 0-8-8H4"/></svg>;
    case "redo": return <svg {...common}><path d="m15 7 5 5-5 5"/><path d="M4 18a8 8 0 0 1 8-8h8"/></svg>;
    case "paragraph": return <svg {...common}><path d="M5 5h14M5 10h10M5 15h14M5 20h10"/></svg>;
    case "heading-one": return <svg {...common}><path d="M5 5v14M13 5v14M5 12h8M18 8l2-2v13"/></svg>;
    case "heading-two": return <svg {...common}><path d="M5 5v14M13 5v14M5 12h8M18 8a2 2 0 1 1 4 0c0 3-4 4-4 7h4"/></svg>;
    case "heading-three": return <svg {...common}><path d="M5 5v14M13 5v14M5 12h8M18 7h2a2 2 0 0 1 0 4h-2M18 11h2a2 2 0 0 1 0 4h-2"/></svg>;
    case "bold": return <svg {...common}><path d="M7 5h6a4 4 0 0 1 0 8H7zM7 13h7a4 4 0 0 1 0 8H7z"/></svg>;
    case "italic": return <svg {...common}><path d="M15 4 9 20M7 4h10M7 20h10"/></svg>;
    case "underline": return <svg {...common}><path d="M7 4v6a5 5 0 0 0 10 0V4M5 20h14"/></svg>;
    case "strike": return <svg {...common}><path d="M5 12h14M8 6a5 3 0 0 1 8 1M16 18a5 3 0 0 1-8-1"/></svg>;
    case "text-color": return <svg {...common}><path d="m7 17 5-12 5 12M9 13h6M5 21h14"/></svg>;
    case "highlight": return <svg {...common}><path d="m14 4 6 6M5 19l8-8 4 4-8 8H5zM4 22h16"/></svg>;
    case "align-left": return <svg {...common}><path d="M4 6h16M4 10h11M4 14h16M4 18h11"/></svg>;
    case "align-center": return <svg {...common}><path d="M4 6h16M7 10h10M4 14h16M7 18h10"/></svg>;
    case "align-right": return <svg {...common}><path d="M4 6h16M9 10h11M4 14h16M9 18h11"/></svg>;
    case "bullet-list": return <svg {...common}><path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4" cy="6" r="1" fill="currentColor"/><circle cx="4" cy="12" r="1" fill="currentColor"/><circle cx="4" cy="18" r="1" fill="currentColor"/></svg>;
    case "ordered-list": return <svg {...common}><path d="M10 6h10M10 12h10M10 18h10M4 5h1v2M4 11h1v2M4 17h2l-2 2h2"/></svg>;
    case "quote": return <svg {...common}><path d="M8 10H5a3 3 0 0 0 3 8v-4H5v-4h3zM19 10h-3a3 3 0 0 0 3 8v-4h-3v-4h3z"/></svg>;
    case "code": return <svg {...common}><path d="m8 8-4 4 4 4M16 8l4 4-4 4M14 5l-4 14"/></svg>;
    case "link": return <svg {...common}><path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1.1-1.1"/></svg>;
    case "image": return <svg {...common}><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="m21 15-5-5L5 20"/></svg>;
    case "table": return <svg {...common}><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M9 4v16M15 4v16"/></svg>;
    case "clear": return <svg {...common}><path d="m5 5 14 14M19 5 5 19"/><path d="M8 5h8M8 19h8"/></svg>;
    case "more": return <svg {...common}><circle cx="5" cy="12" r="1.25" fill="currentColor"/><circle cx="12" cy="12" r="1.25" fill="currentColor"/><circle cx="19" cy="12" r="1.25" fill="currentColor"/></svg>;
  }
}

function RichToolbarButton({ icon, label, onClick, active = false }: { icon: RichToolbarIconName; label: string; onClick: () => void; active?: boolean }) {
  return <button type="button" className={active ? "is-active" : ""} title={label} aria-label={label} aria-pressed={active} onMouseDown={event => event.preventDefault()} onClick={onClick}><RichToolbarIcon name={icon}/></button>;
}

const TiptapTextStyle = TextStyle.extend({
  addAttributes() {
    return {
      fontSize: {
        default: null,
        parseHTML: element => element.style.fontSize || null,
        renderHTML: attributes => attributes.fontSize ? { style: `font-size: ${attributes.fontSize}` } : {},
      },
    };
  },
});

// Inline code is used for method and field names in project documentation. The
// stock code mark excludes every other mark, which made its colour, font and
// size impossible to edit alongside surrounding Chinese text.
const RichInlineCode = Code.extend({ excludes: "" });

export function ProjectRichTextEditor({
  value,
  projectId,
  onChange,
}: {
  value: string;
  projectId: string;
  onChange: (value: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const onChangeRef = useRef(onChange);
  const latestHtmlRef = useRef(value);
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const toolbarMainRef = useRef<HTMLDivElement | null>(null);
  const lastToolbarWidthRef = useRef(0);
  const [colorMenu, setColorMenu] = useState<"text" | "highlight" | null>(null);
  const [moreMenu, setMoreMenu] = useState(false);
  const [fontSize, setFontSize] = useState(16);
  const [toolbarWidth, setToolbarWidth] = useState(0);
  const [visibleToolbarItems, setVisibleToolbarItems] = useState(RICH_TOOLBAR_ITEM_COUNT);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  useLayoutEffect(() => {
    const toolbar = toolbarMainRef.current;
    if (!toolbarWidth || !toolbar || toolbar.scrollWidth <= toolbar.clientWidth) return;
    setVisibleToolbarItems(count => Math.max(1, count - 1));
  }, [toolbarWidth, visibleToolbarItems]);
  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: { levels: [1, 2, 3] }, code: false }), RichInlineCode, Underline, TiptapTextStyle, Color, FontFamily, Highlight.configure({ multicolor: true }), TextAlign.configure({ types: ["heading", "paragraph"] }), Image.configure({ allowBase64: false }), Table.configure({ resizable: true }), TableRow, TableHeader, TableCell],
    content: value || "",
    editorProps: { attributes: { class: "prj-pm-rich-surface workflow-rich-content" } },
    onUpdate: ({ editor: nextEditor }) => {
      latestHtmlRef.current = nextEditor.getHTML();
      onChangeRef.current(latestHtmlRef.current);
    },
    onBlur: ({ editor: nextEditor }) => { latestHtmlRef.current = nextEditor.getHTML(); onChangeRef.current(latestHtmlRef.current); },
  });

  useEffect(() => {
    const toolbar = toolbarRef.current;
    if (!toolbar) return;
    const update = () => {
      const nextWidth = Math.round(toolbar.getBoundingClientRect().width);
      if (nextWidth === lastToolbarWidthRef.current) return;
      lastToolbarWidthRef.current = nextWidth;
      setVisibleToolbarItems(RICH_TOOLBAR_ITEM_COUNT);
      setToolbarWidth(nextWidth);
    };
    const observer = new ResizeObserver(update);
    observer.observe(toolbar);
    update();
    return () => observer.disconnect();
  }, [editor]);

  useEffect(() => {
    if (!colorMenu) return;
    const closeOnOutsidePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const colorControl = target.closest(".prj-pm-rich-color-control");
      if (!colorControl || !toolbarRef.current?.contains(colorControl)) setColorMenu(null);
    };
    document.addEventListener("pointerdown", closeOnOutsidePointerDown);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointerDown);
  }, [colorMenu]);

  useEffect(() => {
    if (editor && !editor.isFocused && value !== editor.getHTML()) editor.commands.setContent(value || "", { emitUpdate: false });
  }, [editor, value]);

  useEffect(() => {
    if (!editor) return;
    const syncFontSize = () => {
      const parsed = Number.parseInt(String(editor.getAttributes("textStyle").fontSize ?? "16"), 10);
      setFontSize(RICH_FONT_SIZES.includes(parsed) ? parsed : 16);
    };
    editor.on("selectionUpdate", syncFontSize);
    editor.on("transaction", syncFontSize);
    syncFontSize();
    return () => {
      editor.off("selectionUpdate", syncFontSize);
      editor.off("transaction", syncFontSize);
    };
  }, [editor]);

  const setColor = (kind: "text" | "highlight", color: string) => {
    const chain = editor?.chain().focus();
    if (kind === "text") chain?.setColor(color).run();
    else chain?.toggleHighlight({ color }).run();
    setColorMenu(null);
  };
  const insertLink = () => {
    const href = window.prompt("请输入链接地址");
    if (href?.trim()) editor?.chain().focus().extendMarkRange("link").setLink({ href: href.trim() }).run();
  };
  const toggleBoldUniformly = () => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    let hasText = false;
    let allBold = true;
    editor.state.doc.nodesBetween(from, to, node => {
      if (!node.isText || !node.text) return;
      hasText = true;
      if (!node.marks.some(mark => mark.type.name === "bold")) allBold = false;
    });
    const chain = editor.chain().focus();
    if (hasText && !allBold) chain.setBold().run();
    else chain.toggleBold().run();
  };
  const selectCurrentTextBlock = () => {
    const { empty, from } = editor.state.selection;
    if (!empty) return;
    const $from = editor.state.doc.resolve(from);
    let depth = $from.depth;
    while (depth > 0 && !$from.node(depth).isTextblock) depth -= 1;
    if (depth > 0) editor.commands.setTextSelection({ from: $from.start(depth), to: $from.end(depth) });
  };
  const applyTextStyle = (attributes: { fontSize: string }) => {
    selectCurrentTextBlock();
    editor.chain().focus().setMark("textStyle", attributes).run();
  };
  const applyFontFamily = (fontFamily: string) => {
    selectCurrentTextBlock();
    editor.chain().focus().setFontFamily(fontFamily).run();
  };
  const changeFontSize = (direction: -1 | 1) => {
    const currentIndex = RICH_FONT_SIZES.indexOf(fontSize);
    const nextIndex = Math.min(RICH_FONT_SIZES.length - 1, Math.max(0, currentIndex + direction));
    const nextSize = RICH_FONT_SIZES[nextIndex];
    if (nextSize === fontSize) return;
    applyTextStyle({ fontSize: `${nextSize}px` });
    setFontSize(nextSize);
  };
  const uploadAndInsert = async (files: File[]) => {
    if (files.length === 0) return;
    const uploaded = await api.uploadAttachments(`pm-${projectId}`, files);
    for (const file of uploaded) editor?.chain().focus().setImage({ src: file.src, alt: file.name }).run();
  };

  if (!editor) return null;

  const toolbarItems = [
    { key: "undo", node: <RichToolbarButton icon="undo" label="撤销" onClick={() => editor.chain().focus().undo().run()}/> },
    { key: "redo", node: <RichToolbarButton icon="redo" label="重做" onClick={() => editor.chain().focus().redo().run()}/> },
    { key: "style", node: <select className="prj-pm-rich-toolbar__select is-style" aria-label="段落样式" value={editor.isActive("heading", { level: 1 }) ? "h1" : editor.isActive("heading", { level: 2 }) ? "h2" : editor.isActive("heading", { level: 3 }) ? "h3" : "p"} onChange={event => { const next = event.target.value; if (next === "p") editor.chain().focus().setParagraph().run(); else editor.chain().focus().toggleHeading({ level: Number(next.slice(1)) as 1 | 2 | 3 }).run(); }}><option value="p">正文</option><option value="h1">一级标题</option><option value="h2">二级标题</option><option value="h3">三级标题</option></select> },
    { key: "heading-one", node: <RichToolbarButton icon="heading-one" label="一级标题" active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}/> },
    { key: "heading-two", node: <RichToolbarButton icon="heading-two" label="二级标题" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}/> },
    { key: "heading-three", node: <RichToolbarButton icon="heading-three" label="三级标题" active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}/> },
    { key: "font", node: <select className="prj-pm-rich-toolbar__select" aria-label="字体" defaultValue="'PingFang SC', sans-serif" onChange={event => applyFontFamily(event.target.value)}><option value="'PingFang SC', 'Microsoft YaHei', Arial, sans-serif">苹方 / 微软雅黑</option><option value="'Songti SC', SimSun, 'Times New Roman', serif">宋体 / Songti SC</option><option value="'Kaiti SC', KaiTi, STKaiti, serif">楷体 / Kaiti SC</option><option value="STFangsong, FangSong, serif">仿宋</option><option value="Arial, 'Microsoft YaHei', 'PingFang SC', sans-serif">Arial（中英无衬线）</option><option value="Georgia, 'Songti SC', SimSun, serif">Georgia（中英衬线）</option><option value="Menlo, Consolas, 'PingFang SC', monospace">Menlo / Consolas（等宽）</option></select> },
    { key: "size", node: <span className="prj-pm-rich-font-size" aria-label="字号（未选中文本时调整当前段落）"><button type="button" aria-label="减小字体" title="减小字体（未选中文本时调整当前段落）" disabled={fontSize === RICH_FONT_SIZES[0]} onMouseDown={event => event.preventDefault()} onClick={() => changeFontSize(-1)}>−</button><output aria-live="polite">{fontSize}</output><button type="button" aria-label="增大字体" title="增大字体（未选中文本时调整当前段落）" disabled={fontSize === RICH_FONT_SIZES[RICH_FONT_SIZES.length - 1]} onMouseDown={event => event.preventDefault()} onClick={() => changeFontSize(1)}>+</button></span> },
    { key: "bold", node: <RichToolbarButton icon="bold" label="加粗" active={editor.isActive("bold")} onClick={toggleBoldUniformly}/> },
    { key: "italic", node: <RichToolbarButton icon="italic" label="斜体" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}/> },
    { key: "underline", node: <RichToolbarButton icon="underline" label="下划线" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}/> },
    { key: "strike", node: <RichToolbarButton icon="strike" label="删除线" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}/> },
    { key: "text-color", node: <span className="prj-pm-rich-color-control"><button type="button" className={colorMenu === "text" ? "is-active" : ""} title="字体颜色" aria-label="字体颜色" aria-expanded={colorMenu === "text"} onMouseDown={event => event.preventDefault()} onClick={() => setColorMenu(colorMenu === "text" ? null : "text")}><RichToolbarIcon name="text-color"/><i className="is-text"/></button>{colorMenu === "text" && <ColorPalette label="字体颜色" colors={RICH_TEXT_COLORS} onSelect={color => setColor("text", color)}/>}</span> },
    { key: "highlight", node: <span className="prj-pm-rich-color-control"><button type="button" className={colorMenu === "highlight" ? "is-active" : ""} title="文字底色" aria-label="文字底色" aria-expanded={colorMenu === "highlight"} onMouseDown={event => event.preventDefault()} onClick={() => setColorMenu(colorMenu === "highlight" ? null : "highlight")}><RichToolbarIcon name="highlight"/><i className="is-highlight"/></button>{colorMenu === "highlight" && <ColorPalette label="文字底色" colors={RICH_HIGHLIGHT_COLORS} onSelect={color => setColor("highlight", color)}/>}</span> },
    { key: "align-left", node: <RichToolbarButton icon="align-left" label="左对齐" active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()}/> },
    { key: "align-center", node: <RichToolbarButton icon="align-center" label="居中对齐" active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()}/> },
    { key: "align-right", node: <RichToolbarButton icon="align-right" label="右对齐" active={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()}/> },
    { key: "bullet-list", node: <RichToolbarButton icon="bullet-list" label="无序列表" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}/> },
    { key: "ordered-list", node: <RichToolbarButton icon="ordered-list" label="有序列表" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}/> },
    { key: "quote", node: <RichToolbarButton icon="quote" label="引用" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}/> },
    { key: "code", node: <RichToolbarButton icon="code" label="代码块" active={editor.isActive("codeBlock")} onClick={() => editor.chain().focus().toggleCodeBlock().run()}/> },
    { key: "link", node: <RichToolbarButton icon="link" label="插入链接" onClick={insertLink}/> },
    { key: "image", node: <RichToolbarButton icon="image" label="插入图片" onClick={() => fileRef.current?.click()}/> },
    { key: "table", node: <RichToolbarButton icon="table" label="插入表格" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}/> },
    { key: "clear", node: <RichToolbarButton icon="clear" label="清除格式" onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}/> },
  ];
  const visibleItems = toolbarItems.slice(0, visibleToolbarItems);
  const overflowItems = toolbarItems.slice(visibleToolbarItems);

  return (
    <div className="prj-pm-rich-editor">
      <div ref={toolbarRef} className="prj-pm-rich-toolbar">
        <div ref={toolbarMainRef} className={`prj-pm-rich-toolbar__main${colorMenu ? " is-color-menu-open" : ""}`}>
          {visibleItems.map(item => <span key={item.key} className="prj-pm-rich-toolbar__item">{item.node}</span>)}
          {overflowItems.length > 0 && <span className="prj-pm-rich-toolbar__more"><RichToolbarButton icon="more" label="更多编辑功能" active={moreMenu} onClick={() => { setMoreMenu(open => !open); setColorMenu(null); }}/></span>}
        </div>
        {moreMenu && overflowItems.length > 0 && <div className="prj-pm-rich-toolbar__more-menu" role="menu" aria-label="更多编辑功能">
          {overflowItems.map(item => <span key={item.key} className="prj-pm-rich-toolbar__item">{item.node}</span>)}
        </div>}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          onChange={event => {
            const files = Array.from(event.target.files ?? []);
            event.currentTarget.value = "";
            void uploadAndInsert(files);
          }}
        />
      </div>
      <EditorContent
        editor={editor}
        className="prj-pm-rich-content"
        onPaste={event => {
          const pastedImages = Array.from(event.clipboardData.items).flatMap(item => {
            if (!item.type.startsWith("image/")) return [];
            const file = item.getAsFile();
            return file ? [file] : [];
          });
          if (!pastedImages.length) return;
          event.preventDefault();
          void uploadAndInsert(pastedImages);
        }}
      />
    </div>
  );
}

function ColorPalette({ label, colors, onSelect }: { label: string; colors: string[]; onSelect: (color: string) => void }) {
  return <span className="prj-pm-rich-color-palette" role="dialog" aria-label={label}>
    {colors.map(color => <button key={color} type="button" title={color} aria-label={`${label} ${color}`} className="prj-pm-rich-color-swatch" style={{ backgroundColor: color }} onClick={() => onSelect(color)}/>) }
    <label className="prj-pm-rich-color-custom" title="自定义颜色" aria-label={`自定义${label}`}><input type="color" defaultValue={colors[0]} onChange={event => onSelect(event.target.value)}/></label>
  </span>;
}

export function normalizeTodoStatus(value: Record<string, unknown>): TodoStatus {
  const status = textValue(value, "status").toLowerCase();
  if (["done", "closed", "finished", "completed", "已完成", "完成"].includes(status)) return "done";
  if (["doing", "active", "progress", "in_progress", "进行中", "处理中"].includes(status)) return "doing";
  return "todo";
}

function VersionDate({ label, value }: { label: string; value?: string }) {
  return (
    <div className={value ? "" : "is-empty"}>
      <span>{label}</span>
      <strong>{value || "未设置"}</strong>
    </div>
  );
}

function VersionTextBlock({ title, value, important = false }: { title: string; value?: string; important?: boolean }) {
  if (!value) return null;
  return (
    <div className={`prj-pm-code-version__text${important ? " is-important" : ""}`}>
      <b>{title}</b>
      {looksLikeHtml(value) ? <div className="workflow-rich-content" dangerouslySetInnerHTML={{ __html: value }} /> : <p>{value}</p>}
    </div>
  );
}

export function MonitoringCard({ item, index }: { item: Record<string, unknown>; index: number }) {
  return (
    <section className="prj-pm-monitor-card">
      <header>
        <span>{String(index + 1).padStart(2, "0")}</span>
        <strong>{textValue(item, "name") || `监控事项 ${index + 1}`}</strong>
      </header>
      <MonitoringTextBlock title="关注内容" value={textValue(item, "detail")} />
      <MonitoringTextBlock title="检查方式" value={textValue(item, "check")} tone="check" />
    </section>
  );
}

function MonitoringTextBlock({ title, value, tone = "default" }: { title: string; value?: string; tone?: "default" | "check" }) {
  if (!value) return null;
  return (
    <div className={`prj-pm-monitor-card__block is-${tone}`}>
      <b>{title}</b>
      {looksLikeHtml(value) ? <div className="workflow-rich-content" dangerouslySetInnerHTML={{ __html: value }} /> : <p>{value}</p>}
    </div>
  );
}

export type WorkflowModalType = "overview" | "servers" | "tasks" | "scenarios" | "notes" | "create";

export function WorkflowModal({
  projectId,
  modal,
  editing,
  draft,
  busy,
  onEdit,
  onDraftChange,
  onSave,
  onCancel,
  onClose,
}: {
  projectId: string;
  modal: { item: ProjectModuleItem; type: WorkflowModalType };
  editing: boolean;
  draft: Record<string, unknown>;
  busy: boolean;
  onEdit: () => void;
  onDraftChange: (next: Record<string, unknown>) => void;
  onSave: () => void;
  onCancel: () => void;
  onClose: () => void;
}) {
  const original = recordValue(modal.item.content.original);
  const title = textValue(original, "title") || modal.item.title;
  const modalTitle = workflowModalTitle(modal.type);
  return (
    <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="detail-modal workflow-detail-modal">
        <header>
          <div>
            <span>{modalTitle}</span>
            <h3>{title}</h3>
          </div>
          <div className="detail-modal-actions">
            {!editing && modal.type !== "create" && <button type="button" onClick={onEdit}>编辑</button>}
            <button type="button" onClick={onClose}>关闭</button>
          </div>
        </header>
        {editing ? (
          <WorkflowEditor
            projectId={projectId}
            draft={draft}
            busy={busy}
            onChange={onDraftChange}
            onSave={onSave}
            onCancel={onCancel}
          />
        ) : (
          <WorkflowModalBody type={modal.type} item={modal.item} />
        )}
      </section>
    </div>
  );
}

function WorkflowModalBody({ type, item }: { type: WorkflowModalType; item: ProjectModuleItem }) {
  const original = recordValue(item.content.original);
  if (type === "servers") {
    const serverNamesByEnv = recordValue(original.serverNamesByEnv);
    return (
      <div className="workflow-list-editor">
        <div className="workflow-editor-head"><h4>涉及服务器</h4><p>按环境展示该流程节点涉及的服务器。</p></div>
        {Object.keys(serverNamesByEnv).length === 0 ? <div className="workflow-empty">还没有绑定服务器。</div> : (
          <div className="prj-pm-workflow-detail__env-grid">
            {Object.entries(serverNamesByEnv).map(([env, names]) => (
              <div key={env}>
                <span>{envLabel(env)}</span>
                {stringList(names).map(name => <p key={name}>{name}</p>)}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }
  if (type === "tasks") {
    const tasks = arrayRecords(original.tasks);
    return (
      <div className="workflow-list-editor">
        <div className="workflow-editor-head"><h4>定时与任务</h4><p>展示任务名称、调度时间和任务说明。</p></div>
        {tasks.length === 0 ? <div className="workflow-empty">还没有定时任务。</div> : (
          <ul>
            {tasks.map((task, index) => (
              <li key={`${textValue(task, "name")}-${index}`}>
                <strong>{textValue(task, "schedule") || "任务"}</strong>
                <div>
                  <b>{textValue(task, "name") || `任务 ${index + 1}`}</b>
                  <p>{textValue(task, "detail")}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }
  if (type === "scenarios") {
    const scenarios = stringList(original.scenarioIds);
    return (
      <div className="workflow-list-editor">
        <div className="workflow-editor-head"><h4>操作场景</h4><p>该流程节点可跳转或关联的操作场景。</p></div>
        {scenarios.length === 0 ? <div className="workflow-empty">还没有关联操作场景。</div> : (
          <ul>{scenarios.map(scenario => <li key={scenario}>{scenario}</li>)}</ul>
        )}
      </div>
    );
  }
  if (type === "notes") {
    const checks = stringList(original.checks);
    const warnings = stringList(original.warnings);
    return (
      <div className="workflow-list-editor">
        <div className="workflow-editor-head"><h4>检查与注意事项</h4><p>流程执行时需要确认的检查点和风险提示。</p></div>
        {checks.length === 0 && warnings.length === 0 ? <div className="workflow-empty">还没有注意事项。</div> : (
          <>
            {checks.length > 0 && <WorkflowList title="检查项" items={checks} />}
            {warnings.length > 0 && <WorkflowList title="注意事项" items={warnings} tone="warning" />}
          </>
        )}
      </div>
    );
  }
  return <WorkflowDetail item={item} />;
}

function workflowModalTitle(type: WorkflowModalType): string {
  if (type === "servers") return "涉及服务器";
  if (type === "tasks") return "定时与任务";
  if (type === "scenarios") return "操作场景";
  if (type === "notes") return "注意事项";
  if (type === "create") return "新增流程";
  return "流程说明";
}

function splitDeploymentExecutionHtml(html: string) {
  if (!html || typeof DOMParser === "undefined") return { before: html, after: "" };
  const document = new DOMParser().parseFromString(html, "text/html");
  const list = document.body.querySelector("ol, ul");
  if (!list || list.children.length < 2) return { before: html, after: "" };
  const splitAt = Math.ceil(list.children.length / 2);
  const beforeList = list.cloneNode(false) as HTMLElement;
  const afterList = list.cloneNode(false) as HTMLElement;
  Array.from(list.children).forEach((child, index) => (index < splitAt ? beforeList : afterList).append(child.cloneNode(true)));
  const before = document.createElement("div");
  const after = document.createElement("div");
  let passedList = false;
  Array.from(document.body.childNodes).forEach(node => {
    if (node === list) {
      before.append(beforeList);
      after.append(afterList);
      passedList = true;
    } else (passedList ? after : before).append(node.cloneNode(true));
  });
  return { before: before.innerHTML, after: after.innerHTML };
}

export function DeploymentStepDetail({ item, environments, onEdit, onToggleChecklist }: { item: ProjectModuleItem; environments?: ProjectModuleItem[]; onEdit?: () => void; onToggleChecklist?: (index: number) => void }) {
  const [serversOpen, setServersOpen] = useState(false);
  const original = recordValue(item.content.original);
  const checklist = arrayRecords(original.checklist);
  const steps = arrayRecords(original.steps);
  const serverIdsByEnv = recordValue(original.serverIdsByEnv);
  const serverIds = stringList(original.serverIds);
  const html = textValue(original, "executionHtml");
  const text = textValue(original, "executionText");
  const recordCount = textValue(original, "rowCount") || String(steps.length || 0);
  const countLabel = textValue(original, "sourceType") === "excel-sheet" ? "记录行" : "执行步骤";
  const serverGroups = deploymentServerGroups(original, environments ?? []);
  const serverCount = serverGroups.reduce((count, group) => count + group.servers.length, 0);
  const executionParts = splitDeploymentExecutionHtml(html);
  const checklistGroups = checklist.reduce<Array<{ placement: "before" | "middle" | "after"; title: string; rows: Array<{ row: Record<string, unknown>; index: number }> }>>((groups, row, index) => {
    const placementValue = textValue(row, "placement");
    const placement = placementValue === "middle" || placementValue === "after" ? placementValue : "before";
    const title = textValue(row, "stage") || (placement === "before" ? "部署前检查" : placement === "middle" ? "步骤中检查" : "部署后验证");
    const group = groups.find(entry => entry.placement === placement && entry.title === title);
    if (group) group.rows.push({ row, index });
    else groups.push({ placement, title, rows: [{ row, index }] });
    return groups;
  }, []);

  useEffect(() => {
    setServersOpen(false);
  }, [item.id]);

  return (
    <article className="deployment-detail-card">
      <header className="deployment-detail-head">
        <div>
          <span>{deploymentSheetOf(original)}</span>
          <h3>{textValue(original, "phase") || item.title}</h3>
          {textValue(original, "target") && <p>{textValue(original, "target")}</p>}
        </div>
        <div className="deployment-detail-counts">
          <strong>{recordCount}</strong>
          <span>{countLabel}</span>
        </div>
        <div className="deployment-title-actions">
          {onEdit && <button type="button" className="prj-btn-link" onClick={onEdit}>编辑</button>}
        </div>
      </header>

      {serverGroups.length > 0 && (
        <section className="deployment-meta-grid">
          <div className="deployment-server-list-card">
            <button type="button" className="deployment-detail-toggle" onClick={() => setServersOpen(open => !open)} aria-expanded={serversOpen}>
              <span>关联服务器</span>
              <small>{serverGroups.length} 个环境 · {serverCount} 台服务器</small>
              <i aria-hidden="true">{serversOpen ? "收起" : "展开"}</i>
            </button>
            {serversOpen && <div className="deployment-server-list">
              {serverGroups.map(group => (
                <section className="deployment-server-group" key={group.environmentId || group.environmentName}>
                  <h5>{group.environmentName}</h5>
                  {group.servers.map(server => (
                    <article key={`${group.environmentId}-${server.id || server.name}`}>
                      <div>
                        <b>{server.name || server.id || "未命名服务器"}</b>
                        {(server.module || server.role) && <small>{[server.module, server.role].filter(Boolean).join(" / ")}</small>}
                      </div>
                      {server.ip && <span className="deployment-server-address">{server.ip}{server.hostname ? ` · ${server.hostname}` : ""}</span>}
                    </article>
                  ))}
                </section>
              ))}
            </div>}
          </div>
        </section>
      )}

      <section className="deployment-detail-section deployment-execution-section">
        <h4>执行步骤</h4>
        <div className="deployment-execution-view workflow-rich-content">
          {checklistGroups.filter(group => group.placement === "before").map(group => <section className="deployment-execution-checklist" key={`before-${group.title}`}>
            <div className="deployment-execution-checklist-group">
                <h5>{group.title}</h5>
                {group.rows.map(({ row, index }) => (
                  <label key={`${textValue(row, "label")}-${index}`} className={`check${truthy(row.done) ? " is-done" : ""}`}>
                    <input type="checkbox" checked={truthy(row.done)} onChange={() => onToggleChecklist?.(index)} disabled={!onToggleChecklist} />
                  <span>{textValue(row, "label") || `检查项 ${index + 1}`}</span>
                </label>
                ))}
            </div>
          </section>)}
          <div className="deployment-execution-rich-content">
            {html ? <div dangerouslySetInnerHTML={{ __html: executionParts.before }} /> : text ? <p>{text}</p> : steps.length > 0 ? (
              <div className="prj-pm-deploy-detail__step-list">
                {steps.slice(0, Math.ceil(steps.length / 2)).map((step, index) => (
                  <div key={`${textValue(step, "action")}-${index}`}>
                    <b>{textValue(step, "action") || `步骤 ${index + 1}`}</b>
                    {textValue(step, "actor") && <span>{textValue(step, "actor")}</span>}
                    {textValue(step, "command") && <code>{textValue(step, "command")}</code>}
                    {textValue(step, "check") && <p>{textValue(step, "check")}</p>}
                  </div>
                ))}
              </div>
            ) : <p className="empty-note">暂无执行步骤。</p>}
          </div>
          {checklistGroups.filter(group => group.placement === "middle").map(group => <section className="deployment-execution-checklist" key={`middle-${group.title}`}>
            <div className="deployment-execution-checklist-group">
              <h5>{group.title}</h5>
              {group.rows.map(({ row, index }) => (
                <label key={`${textValue(row, "label")}-${index}`} className={`check${truthy(row.done) ? " is-done" : ""}`}>
                  <input type="checkbox" checked={truthy(row.done)} onChange={() => onToggleChecklist?.(index)} disabled={!onToggleChecklist} />
                  <span>{textValue(row, "label") || `检查项 ${index + 1}`}</span>
                </label>
              ))}
            </div>
          </section>)}
          {(html ? Boolean(executionParts.after) : steps.length > 1) && <div className="deployment-execution-rich-content">
            {html ? <div dangerouslySetInnerHTML={{ __html: executionParts.after }} /> : (
              <div className="prj-pm-deploy-detail__step-list">
                {steps.slice(Math.ceil(steps.length / 2)).map((step, index) => (
                  <div key={`${textValue(step, "action")}-${index}`}>
                    <b>{textValue(step, "action") || `步骤 ${Math.ceil(steps.length / 2) + index + 1}`}</b>
                    {textValue(step, "actor") && <span>{textValue(step, "actor")}</span>}
                    {textValue(step, "command") && <code>{textValue(step, "command")}</code>}
                    {textValue(step, "check") && <p>{textValue(step, "check")}</p>}
                  </div>
              ))}
              </div>
            )}
          </div>}
          {checklistGroups.filter(group => group.placement === "after").map(group => <section className="deployment-execution-checklist" key={`after-${group.title}`}>
            <div className="deployment-execution-checklist-group">
              <h5>{group.title}</h5>
              {group.rows.map(({ row, index }) => (
                <label key={`${textValue(row, "label")}-${index}`} className={`check${truthy(row.done) ? " is-done" : ""}`}>
                  <input type="checkbox" checked={truthy(row.done)} onChange={() => onToggleChecklist?.(index)} disabled={!onToggleChecklist} />
                  <span>{textValue(row, "label") || `检查项 ${index + 1}`}</span>
                </label>
              ))}
            </div>
          </section>)}
        </div>
      </section>
    </article>
  );
}

export function EnvironmentModuleCard({
  module,
  index = 0,
  environmentName,
  onServerClick,
}: {
  module: Record<string, unknown>;
  index?: number;
  environmentName?: string;
  onServerClick?: (server: Record<string, unknown>) => void;
}) {
  const servers = arrayRecords(module.servers);
  return (
    <article className="module-card env-module-card" style={{ "--env-module-accent": envModuleAccent(index) } as CSSProperties}>
      <header className="module-head">
        <div className="env-module-read-title">
          <strong>{textValue(module, "name") || "未命名模块"}</strong>
          {environmentName && <small>{environmentName}</small>}
          {textValue(module, "note") && <small>{textValue(module, "note")}</small>}
        </div>
        <div className="env-card-actions">
          <span>{servers.length}</span>
        </div>
      </header>
      <div className="env-inline-list">
        {servers.map(server => (
          <EnvironmentServerCard
            key={textValue(server, "id") || textValue(server, "name")}
            server={server}
            onClick={() => onServerClick?.(server)}
          />
        ))}
      </div>
    </article>
  );
}

function EnvironmentServerCard({ server, onClick }: { server: Record<string, unknown>; onClick?: () => void }) {
  const credentials = arrayRecords(server.credentials);
  const links = arrayRecords(server.links);
  return (
    <button type="button" className={`server env-server-card role-${roleClass(textValue(server, "role"))}`} onClick={onClick}>
      <div className="server-row">
        <div>
          <strong>{textValue(server, "name") || "未命名服务器"}</strong>
          <span className="role">{textValue(server, "role") || "服务器"}</span>
        </div>
        {textValue(server, "ip") && <code>{textValue(server, "ip")}</code>}
      </div>
      {textValue(server, "hostname") && <pre>{textValue(server, "hostname")}</pre>}
      {textValue(server, "os") && <pre>{textValue(server, "os")}</pre>}
      {textValue(server, "note") && <p>{textValue(server, "note")}</p>}
      {credentials.length > 0 && (
        <div className="prj-pm-env-server__meta">
          <b>凭证</b>
          {credentials.map((credential, index) => (
            <span key={`${textValue(credential, "account")}-${index}`}>
              {textValue(credential, "label") || "凭证"}：{textValue(credential, "account") || "-"}
            </span>
          ))}
        </div>
      )}
      {links.length > 0 && (
        <div className="prj-pm-env-server__meta">
          <b>连接</b>
          {links.map((link, index) => <span key={index}>{flattenInline(link)}</span>)}
        </div>
      )}
    </button>
  );
}

export function EnvironmentServerDetailModal({
  server,
  module,
  environment,
  onClose,
}: {
  server: Record<string, unknown>;
  module: Record<string, unknown>;
  environment: string;
  onClose: () => void;
}) {
  const credentials = arrayRecords(server.credentials);
  const links = arrayRecords(server.links);
  const fields = [
    ["所属环境", environment],
    ["所属模块", textValue(module, "name")],
    ["服务器名称", textValue(server, "name")],
    ["服务器角色", textValue(server, "role")],
    ["IP / 端口", textValue(server, "ip")],
    ["主机名", textValue(server, "hostname")],
    ["系统/软件", textValue(server, "os")],
    ["备注", textValue(server, "note")],
  ].filter(([, value]) => value);
  return (
    <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="detail-modal env-server-detail-modal">
        <header>
          <div>
            <span>{environment} · {textValue(module, "name") || "服务器模块"}</span>
            <h3>{textValue(server, "name") || "未命名服务器"}</h3>
          </div>
          <div className="detail-modal-actions">
            <button type="button" onClick={onClose}>关闭</button>
          </div>
        </header>
        <div className="env-server-detail-body">
          <dl className="env-server-detail-grid">
            {fields.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          {credentials.length > 0 && (
            <section>
              <h4>凭证信息</h4>
              <div className="env-server-detail-list">
                {credentials.map((credential, index) => (
                  <article key={`${textValue(credential, "account")}-${index}`}>
                    <strong>{textValue(credential, "label") || `凭证 ${index + 1}`}</strong>
                    <span>{textValue(credential, "account") || "-"}</span>
                    {textValue(credential, "secret") && <code>{textValue(credential, "secret")}</code>}
                    {textValue(credential, "note") && <p>{textValue(credential, "note")}</p>}
                  </article>
                ))}
              </div>
            </section>
          )}
          {links.length > 0 && (
            <section>
              <h4>连接信息</h4>
              <div className="env-server-detail-list">
                {links.map((link, index) => <article key={index}><p>{flattenInline(link)}</p></article>)}
              </div>
            </section>
          )}
        </div>
      </section>
    </div>
  );
}

export function ScenarioDetail({ scenario, groupTitle, projectId }: { scenario: Record<string, unknown>; groupTitle?: string; projectId: string }) {
  const steps = stringList(scenario.steps);
  const stepHtmls = stringList(scenario.stepHtmls);
  const checks = stringList(scenario.checks);
  const warnings = stringList(scenario.warnings);
  const stepImages = recordValue(scenario.stepImages);

  return (
    <div className="scenario-detail-inner">
      <header className="scenario-detail-head">
        <div>
          <div className="scenario-head-kicker">
            <p className="scenario-group-line">{groupTitle || textValue(scenario, "groupId") || "场景手册"}</p>
            {textValue(scenario, "sceneNo") && <span className="scenario-badge">{textValue(scenario, "sceneNo")}</span>}
          </div>
          <h3>{textValue(scenario, "title") || "未命名场景"}</h3>
        </div>
        <div className="scenario-head-actions">
          <span className="scenario-count">{steps.length} 步 · {checks.length} 检查点</span>
        </div>
      </header>

      <section className="scenario-summary-grid">
        <ScenarioBlock title="场景" text={textValue(scenario, "goal")} important />
        <ScenarioBlock title="入口" text={textValue(scenario, "entry")} />
      </section>

      {steps.length > 0 && (
        <section className="scenario-process">
          <div className="field-head"><label>操作步骤</label></div>
          <div className="scenario-step-list">
            {steps.map((step, index) => {
              const images = imageRecords(stepImages[String(index)]);
              return (
                <section key={`${step.slice(0, 20)}-${index}`} className="scenario-step">
                  <div className="step-side">
                    <div className="step-number">{String(index + 1).padStart(2, "0")}</div>
                  </div>
                  <div className="step-body">
                    {stepHtmls[index] ? (
                      <div className="step-text workflow-rich-content" dangerouslySetInnerHTML={{ __html: stepHtmls[index] }} />
                    ) : (
                      <p className="step-text">{step}</p>
                    )}
                    {images.length > 0 && (
                      <div className="image-grid step-image-grid">
                        {images.map((image, imageIndex) => {
                          const src = scenarioImageSrc(projectId, textValue(image, "src"));
                          return (
                            <figure key={`${textValue(image, "name")}-${imageIndex}`}>
                              <button type="button" className="image-preview-button" onClick={() => window.open(src, "_blank")}>
                                <img src={src} alt={textValue(image, "name") || `步骤 ${index + 1} 截图`} loading="lazy" />
                              </button>
                            </figure>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        </section>
      )}

      <div className="scenario-detail-grid">
        {checks.length > 0 && <ScenarioList title="检查项" items={checks} />}
        {warnings.length > 0 && <ScenarioList title="注意事项" items={warnings} tone="warning" />}
      </div>
    </div>
  );
}

function ScenarioBlock({ title, text, important = false }: { title: string; text?: string; important?: boolean }) {
  if (!text) return null;
  return (
    <section className={`scenario-summary-box${important ? " is-important" : ""}`}>
      <label>{title}</label>
      <div className="scenario-summary-text scenario-multiline">{text}</div>
    </section>
  );
}

function ScenarioList({ title, items, tone = "default" }: { title: string; items: string[]; tone?: "default" | "warning" }) {
  return (
    <section className={`scenario-field is-${tone}`}>
      <div className="field-head"><label>{title}</label></div>
      <ul>
        {items.map(item => <li key={item}>{item}</li>)}
      </ul>
    </section>
  );
}

function WorkflowDetail({ item, onEdit }: { item: ProjectModuleItem; onEdit?: () => void }) {
  const original = recordValue(item.content.original);
  const tasks = arrayValue(original.tasks);
  const checks = stringList(original.checks);
  const warnings = stringList(original.warnings);
  const scenarios = stringList(original.scenarioIds);
  const serverNamesByEnv = recordValue(original.serverNamesByEnv);

  return (
    <article className="prj-pm-workflow-detail">
      <header>
        <div>
          <p>{textValue(original, "lane") || item.subtitle || "作业流程"}</p>
          <h3>{item.title}</h3>
        </div>
        <div className="prj-pm-inline-actions">
          {textValue(original, "time") && <span>{textValue(original, "time")}</span>}
          {onEdit && <button type="button" className="prj-btn-link" onClick={onEdit}>编辑</button>}
        </div>
      </header>

      <WorkflowBlock title="步骤说明" html={textValue(original, "summaryHtml")} text={textValue(original, "summary")} important />

      {tasks.length > 0 && (
        <section className="prj-pm-workflow-detail__block">
          <strong>定时与任务</strong>
          <div className="prj-pm-workflow-detail__task-grid">
            {tasks.map((task, index) => {
              const row = recordValue(task);
              return (
                <div key={`${textValue(row, "name")}-${index}`}>
                  <span>{textValue(row, "schedule") || "任务"}</span>
                  <b>{textValue(row, "name") || `任务 ${index + 1}`}</b>
                  <p>{textValue(row, "detail")}</p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {Object.keys(serverNamesByEnv).length > 0 && (
        <section className="prj-pm-workflow-detail__block">
          <strong>涉及服务器</strong>
          <div className="prj-pm-workflow-detail__env-grid">
            {Object.entries(serverNamesByEnv).map(([env, names]) => (
              <div key={env}>
                <span>{envLabel(env)}</span>
                {stringList(names).map(name => <p key={name}>{name}</p>)}
              </div>
            ))}
          </div>
        </section>
      )}

      {checks.length > 0 && <WorkflowList title="检查项" items={checks} />}
      {warnings.length > 0 && <WorkflowList title="注意事项" items={warnings} tone="warning" />}
      {scenarios.length > 0 && <WorkflowList title="关联场景" items={scenarios} />}
    </article>
  );
}

function WorkflowBlock({ title, text, html, important = false }: { title: string; text?: string; html?: string; important?: boolean }) {
  if (!text && !html) return null;
  return (
    <section className={`prj-pm-workflow-detail__block${important ? " is-important" : ""}`}>
      <strong>{title}</strong>
      {html ? <p dangerouslySetInnerHTML={{ __html: html }} /> : <p>{text}</p>}
    </section>
  );
}

function WorkflowList({ title, items, tone = "default" }: { title: string; items: string[]; tone?: "default" | "warning" }) {
  return (
    <section className={`prj-pm-workflow-detail__block is-${tone}`}>
      <strong>{title}</strong>
      <ul>
        {items.map(item => <li key={item}>{item}</li>)}
      </ul>
    </section>
  );
}



export function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function arrayRecords(value: unknown): Array<Record<string, unknown>> {
  return arrayValue(value).map(recordValue).filter(record => Object.keys(record).length > 0);
}

export function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(item => typeof item === "string" ? item : "").filter(Boolean);
}

function stringListFromImages(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(item => textValue(item, "name") || textValue(item, "src")).filter(Boolean);
}

function imageRecords(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return [];
  return value
    .map(item => {
      if (typeof item === "string") return { name: item, src: item };
      return recordValue(item);
    })
    .filter(item => textValue(item, "src") || textValue(item, "name"));
}

function scenarioImageSrc(projectId: string, src: string): string {
  const filename = src.split("/").pop() || src;
  return `/api/project-management/${encodeURIComponent(projectId)}/assets/scenario-images/${encodeURIComponent(filename)}`;
}

export function scenarioMarkerClass(markerColor: string): string {
  const normalized = markerColor.trim().toLowerCase();
  if (["red", "green", "blue", "yellow", "purple"].includes(normalized)) return `marker-${normalized}`;
  return "";
}

export function getScenarios(group?: ProjectModuleItem): Array<Record<string, unknown>> {
  const original = recordValue(group?.content.original);
  const scenarios = arrayValue(original.scenarios);
  return scenarios.map(recordValue).filter(scenario => Object.keys(scenario).length > 0);
}

export function scenarioToDraft(scenario: Record<string, unknown>) {
  return {
    id: textValue(scenario, "id"),
    sceneNo: textValue(scenario, "sceneNo"),
    title: textValue(scenario, "title"),
    goal: textValue(scenario, "goal"),
    entry: textValue(scenario, "entry"),
    stepsText: stringList(scenario.steps).join("\n"),
    checksText: stringList(scenario.checks).join("\n"),
    tipsText: stringList(scenario.tips).join("\n"),
    imagesText: stringListFromImages(scenario.images).join("\n"),
  };
}

export function splitLines(value: string): string[] {
  return value.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
}

export function textValue(value: unknown, key: string): string {
  const record = recordValue(value);
  const raw = record[key];
  if (typeof raw === "string") return raw.trim();
  if (typeof raw === "number" || typeof raw === "boolean") return String(raw);
  return "";
}

function htmlToPlainText(html: string): string {
  if (!html) return "";
  const node = document.createElement("div");
  node.innerHTML = html;
  return node.textContent?.trim() ?? "";
}

function looksLikeHtml(value: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

function parseJsonObject(value: string): Record<string, unknown> {
  try {
    return recordValue(JSON.parse(value));
  } catch {
    return {};
  }
}

export function parseJsonArray(value: string): Array<Record<string, unknown>> {
  try {
    return arrayRecords(JSON.parse(value));
  } catch {
    return [];
  }
}

function envModuleAccent(index: number): string {
  const colors = ["#8ffef7", "#93c5fd", "#f7c76b", "#4ade80", "#a78bfa", "#fb7185", "#38bdf8", "#f59e0b"];
  return colors[index % colors.length];
}

type DeploymentServerSummary = {
  id: string;
  name: string;
  role: string;
  ip: string;
  hostname: string;
  module: string;
};

function deploymentServerGroups(original: Record<string, unknown>, environments: ProjectModuleItem[]): Array<{
  environmentId: string;
  environmentName: string;
  servers: DeploymentServerSummary[];
}> {
  const index = new Map<string, { environmentId: string; environmentName: string; server: DeploymentServerSummary }>();
  for (const envItem of environments) {
    const envOriginal = recordValue(envItem.content.original);
    const environmentId = textValue(envOriginal, "id") || envItem.id;
    const environmentName = textValue(envOriginal, "name") || envItem.title || envLabel(environmentId);
    for (const module of arrayRecords(envOriginal.modules)) {
      const moduleName = textValue(module, "name");
      for (const server of arrayRecords(module.servers)) {
        const summary = {
          id: textValue(server, "id") || textValue(server, "name"),
          name: textValue(server, "name"),
          role: textValue(server, "role"),
          ip: textValue(server, "ip"),
          hostname: textValue(server, "hostname"),
          module: moduleName,
        };
        for (const key of [summary.id, summary.name].filter(Boolean)) {
          index.set(`${environmentId}:${key}`, { environmentId, environmentName, server: summary });
          index.set(`${envLabel(environmentId)}:${key}`, { environmentId, environmentName, server: summary });
          index.set(`${environmentName}:${key}`, { environmentId, environmentName, server: summary });
          index.set(key, { environmentId, environmentName, server: summary });
        }
      }
    }
  }

  const rawByEnv = recordValue(original.serverIdsByEnv);
  const groups: Array<{ environmentId: string; environmentName: string; servers: DeploymentServerSummary[] }> = [];
  if (Object.keys(rawByEnv).length > 0) {
    for (const [envId, ids] of Object.entries(rawByEnv)) {
      const servers = stringList(ids).map(id => {
        const hit = index.get(`${envId}:${id}`) || index.get(`${envLabel(envId)}:${id}`) || index.get(id);
        return hit?.server ?? { id, name: id, role: "", ip: "", hostname: "", module: "" };
      });
      if (servers.length > 0) {
        const firstHit = stringList(ids).map(id => index.get(`${envId}:${id}`) || index.get(id)).find(Boolean);
        groups.push({ environmentId: envId, environmentName: firstHit?.environmentName || envLabel(envId) || envId, servers });
      }
    }
    return groups;
  }

  const ids = stringList(original.serverIds);
  if (ids.length === 0) return [];
  const envId = textValue(original, "environment");
  const servers = ids.map(id => {
    const hit = index.get(`${envId}:${id}`) || index.get(`${envLabel(envId)}:${id}`) || index.get(id);
    return hit?.server ?? { id, name: id, role: "", ip: "", hostname: "", module: "" };
  });
  const firstHit = ids.map(id => index.get(`${envId}:${id}`) || index.get(id)).find(Boolean);
  return [{ environmentId: envId, environmentName: firstHit?.environmentName || envLabel(envId) || "关联服务器", servers }];
}

export function deploymentSheetOf(value: Record<string, unknown>): string {
  return textValue(value, "sheetName") || textValue(value, "version") || "未命名版本";
}







export function dictionaryMappingSqlValidationKey(projectId: string, tableId: string, scenarioKey: string) {
  return `rich-project-dictionary-mapping-sql-validation:${projectId}:${tableId}:${scenarioKey}`;
}

export function loadDictionaryMappingSqlValidation(storageKey: string): DictionaryMappingSqlValidationCacheEntry | null {
  if (typeof window === "undefined") return null;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey) ?? "null") as DictionaryMappingSqlValidationCacheEntry | null;
    if (!parsed || typeof parsed !== "object" || !parsed.fingerprint || !parsed.result) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveDictionaryMappingSqlValidation(storageKey: string, entry: DictionaryMappingSqlValidationCacheEntry | null) {
  if (typeof window === "undefined" || !storageKey) return;
  try {
    if (!entry) {
      window.localStorage.removeItem(storageKey);
      return;
    }
    window.localStorage.setItem(storageKey, JSON.stringify(entry));
  } catch {
    // SQL validation records are local UI memory; validation itself is unaffected.
  }
}



function envLabel(value: string): string {
  if (value === "prod") return "生产环境";
  if (value === "sit") return "测试环境";
  if (value === "uat") return "UAT";
  return value;
}

function roleClass(value: string): string {
  if (value.includes("数据库")) return "db";
  if (value.includes("前置")) return "front";
  if (value.includes("VIP") || value.includes("虚拟")) return "vip";
  if (value.includes("路由")) return "route";
  return "app";
}

function flattenInline(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(flattenInline).filter(Boolean).join(" / ");
  if (typeof value === "object") return Object.values(value as Record<string, unknown>).map(flattenInline).filter(Boolean).join(" / ");
  return "";
}

function truthy(value: unknown): boolean {
  return value === true || value === "true" || value === "1" || value === 1;
}

function doneCount(rows: Array<Record<string, unknown>>): number {
  return rows.filter(row => truthy(row.done)).length;
}

export function ProjectModulePlaceholder({
  title,
  moduleKey,
  summary,
}: {
  title: string;
  moduleKey: ProjectManagementModuleKey;
  summary: ProjectManagementSummary | null;
}) {
  const count = summary?.modules.find(module => module.key === moduleKey)?.count ?? 0;
  return (
    <section className="prj-pm-shell">
      <p className="prj-pm-eyebrow">Project Management Module</p>
      <h3>{title}</h3>
      <p>这个模块会迁移为 Rich 原生数据模块，数据进入数据库，并同步到项目管理统一搜索。</p>
      <div className="prj-pm-shell__meta">
        <span><b>{count}</b> 当前记录</span>
        <span>下一批接入旧工具数据导入和编辑界面</span>
      </div>
    </section>
  );
}
