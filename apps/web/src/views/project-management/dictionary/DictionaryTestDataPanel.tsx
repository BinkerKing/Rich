import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import * as XLSX from "xlsx";
import {
  api,
  type ProjectDictionaryEntityExtractionPrepareResult,
  type ProjectDictionaryEntitySchemaStatusResult,
  type ProjectDictionaryExtractionValidationIssue,
  type ProjectDictionaryFieldHit,
  type ProjectDictionaryTable,
  type ProjectDictionaryTestFileMeta,
} from "../../../api/client.js";
import {
  DictionaryResizableHeadCell,
  loadDictionaryColumnWidths,
  saveDictionaryColumnWidths,
  type DictionaryResizableColumn,
  useDictionaryResizableColumns,
} from "./DictionaryResizableColumns.js";
import { collectDictionaryRuntimeParameters, isDictionaryRuntimeParameterName } from "./runtimeParameters.js";
import {
  decodeDictionaryTextFile,
  getDictionaryFileParseConfig,
  normalizeDictionaryTextEncoding,
  parseDictionaryUploadedTestFile,
} from "./testFileParsing.js";

type DictionaryImportedTestData = {
  rows?: Array<{ lineNumber?: number; values?: Record<string, unknown>; rawColumns?: unknown[]; extraColumns?: unknown[] }>;
};

type DictionaryUploadedTestFile = {
  file?: File;
  fileName: string;
  fileSize: number;
  text: string;
  preview: string;
  encoding: string;
  delimiter: string;
  parsedRows?: DictionaryImportedTestData["rows"];
  savedAt?: string;
  downloadUrl?: string;
};

type DictionaryUploadStatus = { tone: "info" | "success" | "error"; message: string };

type DictionaryTestDataFeedback = {
  mappingSignature?: string;
  uploadStatus: DictionaryUploadStatus | null;
  extractionIssues: ProjectDictionaryExtractionValidationIssue[];
  extractionJobId?: string;
  extractionPrepare?: DictionaryExtractionPrepareState;
  extractionRunStatus?: DictionaryUploadStatus | null;
  runtimeParams?: Record<string, string>;
};

type DictionaryExtractionPrepareState = {
  status: "idle" | "ready" | "invalid";
  prepare?: ProjectDictionaryEntityExtractionPrepareResult;
};

type DictionaryTestDataRowView = {
  id: string;
  indexLabel: string;
  values: string[];
};

export function DictionaryTestDataPanel({ projectId, table, fields, storageKey }: { projectId: string; table?: ProjectDictionaryTable; fields: ProjectDictionaryFieldHit[]; storageKey: string }) {
  const visibleFields = useMemo(() => fields, [fields]);
  const parseConfig = useMemo(() => getDictionaryFileParseConfig(table), [table]);
  const dataSourceKind = getDictionaryTestDataSourceKind(table);
  const isFileSource = table?.tableType === "源文件";
  const isCodeTable = table?.tableType === "码值表";
  const supportsTestFileUpload = isFileSource || isCodeTable;
  const supportsMappingExtraction = !isFileSource && !isCodeTable;
  const usesDatabaseEntity = Boolean(table?.id);
  // 表签切换时 fields 会短暂保留上一张表或为空；此时不能用错误的字段集合覆盖当前表的抽取缓存。
  const currentTableId = table?.id;
  const isCurrentTableFieldSetReady = Boolean(currentTableId)
    && visibleFields.length > 0
    && visibleFields.every(field => field.tableId === currentTableId);
  const runtimeParamNames = useMemo(() => collectDictionaryRuntimeParameters(table, visibleFields), [table, visibleFields]);
  const mappingRuntimeSignature = useMemo(() => [
    table?.id ?? "",
    table?.caliber ?? "",
    ...visibleFields.map(field => `${field.id}:${field.acquireLogic ?? ""}`),
  ].join("|"), [table?.id, table?.caliber, visibleFields]);
  const initialFeedback = useMemo(
    () => loadDictionaryTestDataFeedback(storageKey, mappingRuntimeSignature),
    [mappingRuntimeSignature, storageKey],
  );
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<DictionaryUploadedTestFile | null>(null);
  const [uploadedDraftRows, setUploadedDraftRows] = useState<DictionaryImportedTestData["rows"] | null>(null);
  const [syncedRows, setSyncedRows] = useState<DictionaryImportedTestData["rows"] | null>(null);
  const [uploadError, setUploadError] = useState("");
  const [uploadStatus, setUploadStatus] = useState<DictionaryUploadStatus | null>(initialFeedback.uploadStatus);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [entityBusy, setEntityBusy] = useState<"create" | "write" | "prepareExtract" | "extract" | null>(null);
  const [entitySchemaStatus, setEntitySchemaStatus] = useState<ProjectDictionaryEntitySchemaStatusResult | null>(null);
  const [extractionIssues, setExtractionIssues] = useState<ProjectDictionaryExtractionValidationIssue[]>(initialFeedback.extractionIssues);
  const [activeExtractionJobId, setActiveExtractionJobId] = useState(initialFeedback.extractionJobId ?? "");
  const [extractionRunStatus, setExtractionRunStatus] = useState<DictionaryUploadStatus | null>(initialFeedback.extractionRunStatus ?? null);
  const [queryBusy, setQueryBusy] = useState(false);
  const [queryError, setQueryError] = useState("");
  const [databaseRows, setDatabaseRows] = useState<Array<{ lineNumber: number; values: Record<string, unknown> }>>([]);
  const [databaseTotal, setDatabaseTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageJumpDraft, setPageJumpDraft] = useState("1");
  const [pageSize, setPageSize] = useState(50);
  const [searchFieldId, setSearchFieldId] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [appliedSearch, setAppliedSearch] = useState<{ fieldId: string; value: string }>({ fieldId: "", value: "" });
  const [runtimeParams, setRuntimeParams] = useState<Record<string, string>>(initialFeedback.runtimeParams ?? {});
  const [extractionPrepare, setExtractionPrepare] = useState<DictionaryExtractionPrepareState>(initialFeedback.extractionPrepare ?? { status: "idle" });
  const [isExtractionDetailsCollapsed, setIsExtractionDetailsCollapsed] = useState(false);
  const activeRuntimeParamNames = useMemo(() => Array.from(new Set([
    ...runtimeParamNames,
    ...(extractionPrepare.prepare?.runtimeParamNames ?? []),
  ])).filter(isDictionaryRuntimeParameterName).sort((a, b) => a.localeCompare(b)), [extractionPrepare.prepare?.runtimeParamNames, runtimeParamNames]);
  const runtimeParamTypes = extractionPrepare.prepare?.runtimeParamTypes ?? {};
  const hasCollapsibleExtractionDetails = usesDatabaseEntity && supportsMappingExtraction && extractionPrepare.status !== "idle";
  const columns = useMemo<DictionaryResizableColumn[]>(() => [
    { id: "index", label: "#", width: 42, minWidth: 38 },
    ...visibleFields.map(field => ({
      id: field.id,
      label: field.fieldName || "-",
      width: 168,
      minWidth: 96,
    })),
  ], [visibleFields]);
  const columnResize = useDictionaryResizableColumns(storageKey, columns, loadDictionaryColumnWidths, saveDictionaryColumnWidths);
  const fieldSchemaSignature = useMemo(() => visibleFields.map(field => [
    field.id,
    field.fieldName,
    field.fieldType,
    field.fieldLength,
    field.formatPattern,
  ].join(":")).join("|"), [visibleFields]);
  const restoredFileTableKeyRef = useRef("");

  useEffect(() => {
    setIsExtractionDetailsCollapsed(false);
  }, [table?.id]);

  const rememberFeedback = useCallback((
    nextStatus: DictionaryUploadStatus | null,
    nextIssues: ProjectDictionaryExtractionValidationIssue[] = [],
    nextJobId = "",
    nextPrepare: DictionaryExtractionPrepareState = extractionPrepare,
    nextRunStatus: DictionaryUploadStatus | null = extractionRunStatus,
    nextRuntimeParams: Record<string, string> = runtimeParams,
  ) => {
    setUploadStatus(nextStatus);
    setExtractionIssues(nextIssues);
    setActiveExtractionJobId(nextJobId);
    setExtractionPrepare(nextPrepare);
    setExtractionRunStatus(nextRunStatus);
    saveDictionaryTestDataFeedback(storageKey, {
      mappingSignature: mappingRuntimeSignature,
      uploadStatus: nextStatus,
      extractionIssues: nextIssues,
      extractionJobId: nextJobId || undefined,
      extractionPrepare: nextPrepare,
      extractionRunStatus: nextRunStatus,
      runtimeParams: nextRuntimeParams,
    });
  }, [extractionPrepare, extractionRunStatus, mappingRuntimeSignature, runtimeParams, storageKey]);

  const rememberRunFeedback = useCallback((
    nextRunStatus: DictionaryUploadStatus | null,
    nextIssues: ProjectDictionaryExtractionValidationIssue[] = extractionIssues,
    nextJobId = activeExtractionJobId,
  ) => {
    setExtractionRunStatus(nextRunStatus);
    setExtractionIssues(nextIssues);
    setActiveExtractionJobId(nextJobId);
    saveDictionaryTestDataFeedback(storageKey, {
      mappingSignature: mappingRuntimeSignature,
      uploadStatus,
      extractionIssues: nextIssues,
      extractionJobId: nextJobId || undefined,
      extractionPrepare,
      extractionRunStatus: nextRunStatus,
      runtimeParams,
    });
  }, [activeExtractionJobId, extractionIssues, extractionPrepare, mappingRuntimeSignature, runtimeParams, storageKey, uploadStatus]);

  useLayoutEffect(() => {
    if (!isCurrentTableFieldSetReady) return;
    const feedback = loadDictionaryTestDataFeedback(storageKey, mappingRuntimeSignature);
    setPage(1);
    setSearchFieldId("");
    setSearchDraft("");
    setAppliedSearch({ fieldId: "", value: "" });
    setDatabaseRows([]);
    setDatabaseTotal(0);
    setQueryError("");
    setEntitySchemaStatus(null);
    setUploadStatus(feedback.uploadStatus);
    setExtractionIssues(feedback.extractionIssues);
    setActiveExtractionJobId(feedback.extractionJobId ?? "");
    setRuntimeParams(feedback.runtimeParams ?? {});
    setExtractionPrepare(feedback.extractionPrepare ?? { status: "idle" });
    setExtractionRunStatus(feedback.extractionRunStatus ?? null);
  }, [dataSourceKind, isCurrentTableFieldSetReady, mappingRuntimeSignature, storageKey, table?.id]);

  useEffect(() => {
    if (!isCurrentTableFieldSetReady) return;
    setRuntimeParams(current => {
      const next: Record<string, string> = {};
      activeRuntimeParamNames.forEach(name => { next[name] = current[name] ?? ""; });
      saveDictionaryTestDataFeedback(storageKey, {
        mappingSignature: mappingRuntimeSignature,
        uploadStatus,
        extractionIssues,
        extractionJobId: activeExtractionJobId || undefined,
        extractionPrepare,
        extractionRunStatus,
        runtimeParams: next,
      });
      return next;
    });
  }, [activeExtractionJobId, activeRuntimeParamNames, extractionIssues, extractionPrepare, extractionRunStatus, isCurrentTableFieldSetReady, mappingRuntimeSignature, storageKey, uploadStatus]);

  useEffect(() => {
    if (!table?.id || !activeExtractionJobId) return undefined;
    let cancelled = false;
    let timer: number | undefined;
    const poll = async () => {
      try {
        const job = await api.getProjectDictionaryEntityExtractionJob(projectId, table.id, activeExtractionJobId);
        if (cancelled) return;
        if (job.status === "running") {
          saveDictionaryTestDataFeedback(storageKey, {
            mappingSignature: mappingRuntimeSignature,
            uploadStatus,
            extractionIssues,
            extractionJobId: job.id,
            extractionPrepare,
            extractionRunStatus: { tone: "info", message: job.message || "后台抽取中" },
            runtimeParams,
          });
          setExtractionRunStatus({ tone: "info", message: job.message || "后台抽取中" });
          timer = window.setTimeout(poll, 2000);
          return;
        }
        if (job.status === "success" && job.result) {
          const nextIssues = job.result.validationIssues ?? [];
          rememberRunFeedback({ tone: nextIssues.length ? "error" : "success", message: job.result.message }, nextIssues, "");
          setPage(1);
          setAppliedSearch(current => ({ ...current }));
          return;
        }
        rememberRunFeedback({ tone: "error", message: job.error || job.message || "后台抽取失败" }, [], "");
      } catch (errorValue) {
        if (cancelled) return;
        rememberRunFeedback({ tone: "error", message: errorValue instanceof Error ? errorValue.message : String(errorValue) }, [], "");
      }
    };
    void poll();
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [activeExtractionJobId, extractionIssues, extractionPrepare, mappingRuntimeSignature, projectId, rememberRunFeedback, runtimeParams, storageKey, table?.id, uploadStatus]);

  useEffect(() => {
    setUploadOpen(false);
  }, [table?.id]);

  useEffect(() => {
    let cancelled = false;
    const tableId = table?.id;
    const tableKey = `${projectId}:${tableId ?? ""}`;
    if (restoredFileTableKeyRef.current === tableKey) return () => { cancelled = true; };
    restoredFileTableKeyRef.current = tableKey;
    setUploadedFile(null);
    setUploadedDraftRows(null);
    setSyncedRows(null);
    setUploadError("");
    setEntityBusy(null);
    if (!tableId || dataSourceKind !== "file") return () => { cancelled = true; };
    void restoreDictionaryUploadedTestFile(projectId, tableId, parseConfig)
      .then(file => {
        if (cancelled || !file) return;
        const parsed = parseDictionaryUploadedTestFile(file.text, visibleFields, file.delimiter);
        setUploadedFile(file);
        setUploadedDraftRows(null);
        setSyncedRows(parsed);
        rememberFeedback({ tone: "success", message: `已恢复上次上传文件，并同步 ${parsed.length} 行到测试数据表格` });
      })
      .catch(errorValue => {
        if (cancelled) return;
        setUploadError(errorValue instanceof Error ? errorValue.message : String(errorValue));
      });
    return () => { cancelled = true; };
  }, [projectId, table?.id, dataSourceKind, parseConfig, rememberFeedback, visibleFields]);

  useEffect(() => {
    let cancelled = false;
    if (!table?.id || !usesDatabaseEntity || visibleFields.length === 0) return () => { cancelled = true; };
    setQueryBusy(true);
    setQueryError("");
    void api.inspectProjectDictionaryEntitySchema(projectId, table.id).then(status => {
      if (cancelled) return;
      setEntitySchemaStatus(status);
      if (!status.tableExists || !status.schemaSynced) {
        setDatabaseRows([]);
        setDatabaseTotal(0);
        return null;
      }
      return api.queryProjectDictionaryEntityTestData(projectId, table.id, {
        page,
        pageSize,
        searchFieldId: appliedSearch.value ? appliedSearch.fieldId : undefined,
        search: appliedSearch.value || undefined,
      });
    }).then(result => {
      if (cancelled || !result) return;
      setDatabaseRows(result.rows);
      setDatabaseTotal(result.total);
    }).catch(errorValue => {
      if (cancelled) return;
      setDatabaseRows([]);
      setDatabaseTotal(0);
      setEntitySchemaStatus(null);
      setQueryError(errorValue instanceof Error ? errorValue.message : String(errorValue));
    }).finally(() => {
      if (!cancelled) setQueryBusy(false);
    });
    return () => { cancelled = true; };
  }, [projectId, table?.id, usesDatabaseEntity, visibleFields.length, fieldSchemaSignature, page, pageSize, appliedSearch]);

  const activeRows = syncedRows ?? [];
  const hasUploadedDraftRows = Boolean(uploadedDraftRows?.length);
  const filteredFileRows = useMemo(() => {
    if (dataSourceKind !== "file") return [];
    const searchText = appliedSearch.value.trim().toLowerCase();
    if (!searchText) return activeRows;
    const field = visibleFields.find(item => item.id === appliedSearch.fieldId);
    if (!field) return activeRows;
    return activeRows.filter(row => stringifyTestDataValue(row.values?.[field.fieldName]).toLowerCase().includes(searchText));
  }, [activeRows, appliedSearch, dataSourceKind, visibleFields]);
  const totalRows = usesDatabaseEntity ? databaseTotal : filteredFileRows.length;
  const maxPage = Math.max(1, Math.ceil(totalRows / pageSize));
  useEffect(() => {
    if (page > maxPage) setPage(maxPage);
  }, [maxPage, page]);
  useEffect(() => {
    setPageJumpDraft(String(page));
  }, [page]);
  const pagedFileRows = dataSourceKind === "file" ? filteredFileRows.slice((page - 1) * pageSize, page * pageSize) : [];
  const rows: DictionaryTestDataRowView[] = usesDatabaseEntity
    ? databaseRows.map((row, rowIndex) => ({
      id: `database-${row.lineNumber ?? rowIndex + 1}`,
      indexLabel: String(row.lineNumber ?? (page - 1) * pageSize + rowIndex + 1),
      values: visibleFields.map(field => stringifyTestDataValue(row.values?.[field.fieldName])),
    }))
    : pagedFileRows.map((row, rowIndex) => ({
      id: `imported-${row.lineNumber ?? rowIndex + 1}`,
      indexLabel: String(row.lineNumber ?? rowIndex + 1),
      values: visibleFields.map(field => stringifyTestDataValue(row.values?.[field.fieldName])),
    }));
  const canSearch = Boolean(searchDraft.trim() && searchFieldId);
  const visibleExtractionIssues = supportsMappingExtraction ? extractionIssues : [];
  const extractionIssueFieldKeys = useMemo(() => new Set(visibleExtractionIssues.flatMap(issue => [
    issue.fieldId,
    issue.fieldName,
  ].filter(Boolean))), [visibleExtractionIssues]);
  const missingRuntimeParamNames = activeRuntimeParamNames.filter(name => !runtimeParams[name]?.trim());
  const prepareMappingExtraction = useCallback(async () => {
    if (!table?.id) return;
    setEntityBusy("prepareExtract");
    const preparingState: DictionaryExtractionPrepareState = { status: "idle" };
    rememberFeedback({ tone: "info", message: "正在创建抽取存储过程" }, [], "", preparingState, extractionRunStatus, runtimeParams);
    try {
      const prepare = await api.prepareProjectDictionaryEntityExtractionSql(projectId, table.id, { runtimeParams });
      const fieldIssues = prepare.validationIssues ?? [];
      if (!prepare.ready) {
        const nextPrepare: DictionaryExtractionPrepareState = { status: "invalid", prepare };
        rememberFeedback({ tone: "error", message: prepare.message }, fieldIssues, "", nextPrepare, extractionRunStatus, runtimeParams);
        return;
      }
      const nextPrepare: DictionaryExtractionPrepareState = { status: "ready", prepare };
      rememberFeedback({
        tone: fieldIssues.length ? "error" : "success",
        message: fieldIssues.length
          ? `存储过程创建完成，发现 ${fieldIssues.length} 个字段抽取问题，问题字段将按 NULL 或默认值抽取`
          : "存储过程创建完成",
      }, fieldIssues, "", nextPrepare, extractionRunStatus, runtimeParams);
    } catch (errorValue) {
      const nextPrepare: DictionaryExtractionPrepareState = { status: "invalid" };
      rememberFeedback({ tone: "error", message: errorValue instanceof Error ? errorValue.message : String(errorValue) }, [], "", nextPrepare, extractionRunStatus, runtimeParams);
    } finally {
      setEntityBusy(null);
    }
  }, [extractionRunStatus, projectId, rememberFeedback, runtimeParams, table?.id]);
  const runPreparedExtraction = useCallback(async () => {
    if (!table?.id) return;
    if (extractionPrepare.status !== "ready") {
      await prepareMappingExtraction();
      return;
    }
    if (missingRuntimeParamNames.length) {
      rememberRunFeedback({ tone: "error", message: `请先填写运行参数：${missingRuntimeParamNames.join("、")}` }, extractionIssues);
      return;
    }
    setEntityBusy("extract");
    rememberRunFeedback({ tone: "info", message: "正在执行抽取存储过程" }, extractionIssues);
    try {
      const job = await api.extractProjectDictionaryEntityTestData(projectId, table.id, { runtimeParams });
      rememberRunFeedback({ tone: "info", message: job.message || "后台抽取任务已启动" }, [], job.id);
    } catch (errorValue) {
      rememberRunFeedback({ tone: "error", message: errorValue instanceof Error ? errorValue.message : String(errorValue) }, []);
    } finally {
      setEntityBusy(null);
    }
  }, [
    extractionIssues,
    extractionPrepare.status,
    missingRuntimeParamNames,
    prepareMappingExtraction,
    projectId,
    rememberRunFeedback,
    runtimeParams,
    table?.id,
  ]);
  if (visibleFields.length === 0) {
    return <div className="prj-pm-dict__grid-empty">请选择左侧表后查看测试数据。</div>;
  }
  return (
    <div className="prj-pm-dict-test-table-wrap">
      <div
        className={`prj-pm-dict-test-summary ${hasCollapsibleExtractionDetails && isExtractionDetailsCollapsed ? "is-extraction-collapsed" : ""}`}
        onDoubleClick={() => {
          if (hasCollapsibleExtractionDetails) setIsExtractionDetailsCollapsed(current => !current);
        }}
        title={hasCollapsibleExtractionDetails ? "双击收起或展开存储过程与运行参数" : undefined}>
        <div className="prj-pm-dict-test-summary__meta">
          <strong>{dataSourceKind === "file" ? uploadedFile?.fileName || table?.tableName || "测试文件" : table?.tableName || "实体表"}</strong>
          <span>{dataSourceKind === "file" ? "文件数据" : "数据库实体表"}</span>
          <span>共 {totalRows} 行</span>
          <span>第 {page} / {maxPage} 页，展示 {rows.length} 行</span>
          {dataSourceKind === "file" ? <span>{[uploadedFile?.encoding || parseConfig.encoding, (uploadedFile?.delimiter || parseConfig.delimiter) ? `分隔符 ${uploadedFile?.delimiter || parseConfig.delimiter}` : ""].filter(Boolean).join(" / ")}</span> : null}
          {usesDatabaseEntity && entitySchemaStatus ? (
            <span className={`prj-pm-dict-test-summary__entity-state ${entitySchemaStatus.schemaSynced ? "is-ok" : "is-warn"}`}>
              {entitySchemaStatus.tableExists ? entitySchemaStatus.schemaSynced ? "实体表已创建，结构一致" : `实体表结构不一致 ${entitySchemaStatus.issues.length} 处` : "实体表未创建"}
            </span>
          ) : null}
          {hasUploadedDraftRows ? <span>待同步 {uploadedDraftRows?.length ?? 0} 行</span> : null}
          {uploadStatus ? <em className={`prj-pm-dict-test-summary__status is-${uploadStatus.tone}`}>{uploadStatus.message}</em> : null}
          {queryError ? <em className="prj-pm-dict-test-summary__status is-error">{queryError}</em> : null}
        </div>
        <div className="prj-pm-dict-test-summary__actions">
          {usesDatabaseEntity ? (
            <>
              <button
                type="button"
                onClick={async () => {
                  if (!table?.id) return;
                  setEntityBusy("create");
                  rememberFeedback(null, []);
                  try {
                    const result = await api.createProjectDictionaryEntityTable(projectId, table.id);
                    rememberFeedback({ tone: "success", message: result.message }, []);
                    setAppliedSearch(current => ({ ...current }));
                  } catch (errorValue) {
                    rememberFeedback({ tone: "error", message: errorValue instanceof Error ? errorValue.message : String(errorValue) }, []);
                  } finally {
                    setEntityBusy(null);
                  }
                }}
                disabled={!table?.id || Boolean(entityBusy)}>
                {entityBusy === "create" ? "更新中" : "更新实体表"}
              </button>
              {supportsMappingExtraction ? (
                <button
                  type="button"
                  className="is-primary"
                  onClick={prepareMappingExtraction}
                  disabled={!table?.id || Boolean(entityBusy) || Boolean(activeExtractionJobId)}>
                  {entityBusy === "prepareExtract" ? "准备中" : extractionPrepare.status === "ready" ? "重新准备" : "抽数准备"}
                </button>
              ) : null}
              <button type="button" className="is-primary" onClick={() => setAppliedSearch(current => ({ ...current }))} disabled={queryBusy}>
                {queryBusy ? "读取中" : "刷新数据"}
              </button>
            </>
          ) : null}
          {supportsTestFileUpload && hasUploadedDraftRows && uploadedDraftRows ? (
            <button
              type="button"
              className="is-primary"
              onClick={async () => {
                if (!table?.id) return;
                setEntityBusy("write");
                try {
                  const result = await api.replaceProjectDictionaryEntityTestData(projectId, table.id, uploadedDraftRows.map(row => row.values ?? {}));
                  setSyncedRows(uploadedDraftRows);
                  setUploadedDraftRows(null);
                  setAppliedSearch(current => ({ ...current }));
                  rememberFeedback({ tone: "success", message: result.message });
                } catch (errorValue) {
                  rememberFeedback({ tone: "error", message: errorValue instanceof Error ? errorValue.message : String(errorValue) });
                } finally {
                  setEntityBusy(null);
                }
              }}
              disabled={Boolean(entityBusy)}>
              同步到数据库
            </button>
          ) : null}
          {isCodeTable ? <button type="button" onClick={() => downloadDictionaryCodeTableTemplate(table, visibleFields)}>下载 Excel 模板</button> : null}
          {supportsTestFileUpload ? <button type="button" onClick={() => setUploadOpen(true)}>上传测试数据</button> : null}
        </div>
      </div>
      {hasCollapsibleExtractionDetails && !isExtractionDetailsCollapsed ? (
        <div className={`prj-pm-dict-test-prepared-sql is-${extractionPrepare.status}`}>
          <strong>{extractionPrepare.status === "ready" ? "存储过程创建完成" : "存储过程创建失败"}</strong>
          {extractionPrepare.prepare?.sql ? <pre>{extractionPrepare.prepare.sql}</pre> : null}
          {extractionPrepare.prepare?.caliber.error ? <span>{extractionPrepare.prepare.caliber.error}</span> : null}
          {extractionPrepare.prepare?.statementError ? <span>{extractionPrepare.prepare.statementError}</span> : null}
        </div>
      ) : null}
      {usesDatabaseEntity && supportsMappingExtraction && extractionPrepare.status === "ready" && !isExtractionDetailsCollapsed ? (
        <div className="prj-pm-dict-test-runtime-params">
          <div className="prj-pm-dict-test-runtime-params__row">
            <strong>运行参数</strong>
            <span className="prj-pm-dict-test-runtime-params__hint">
              {activeRuntimeParamNames.length ? "请填写运行参数后执行数据抽取" : "无需运行参数，可直接执行数据抽取"}
            </span>
              {activeRuntimeParamNames.map(name => (
              <label key={name} className="prj-pm-dict-test-runtime-params__field">
                <span>{name}{runtimeParamTypes[name] ? ` / ${runtimeParamTypes[name]}` : ""}</span>
                <input
                  type={dictionaryRuntimeParameterInputType(runtimeParamTypes[name])}
                  value={runtimeParams[name] ?? ""}
                  onChange={event => {
                    const value = event.target.value;
                    setRuntimeParams(current => {
                      const next = { ...current, [name]: value };
                      saveDictionaryTestDataFeedback(storageKey, {
                        mappingSignature: mappingRuntimeSignature,
                        uploadStatus,
                        extractionIssues,
                        extractionJobId: activeExtractionJobId || undefined,
                        extractionPrepare,
                        extractionRunStatus,
                        runtimeParams: next,
                      });
                      return next;
                    });
                  }}
                  placeholder={/date/i.test(name) ? "填写 YYYYMMDD，例如 20260825" : `填写 ${name}`}
                />
              </label>
            ))}
            <button
              type="button"
              className="is-primary is-extract prj-pm-dict-test-runtime-params__action"
              onClick={runPreparedExtraction}
              disabled={!table?.id || Boolean(entityBusy) || Boolean(activeExtractionJobId)}>
              {activeExtractionJobId ? "后台抽取中" : entityBusy === "extract" ? "执行中" : "数据抽取"}
            </button>
          </div>
          {extractionRunStatus ? (
            <div className={`prj-pm-dict-test-runtime-status is-${extractionRunStatus.tone}`}>
              {extractionRunStatus.message}
            </div>
          ) : null}
        </div>
      ) : null}
      {usesDatabaseEntity && entitySchemaStatus && entitySchemaStatus.issues.length ? (
        <div className="prj-pm-dict-test-entity-issues">
          <strong>实体表结构差异</strong>
          {entitySchemaStatus.issues.map(issue => (
            <span key={`${issue.kind}-${issue.columnName}-${issue.expectedType ?? ""}`}>
              {issue.message}
            </span>
          ))}
        </div>
      ) : null}
      {visibleExtractionIssues.length ? (
        <div className="prj-pm-dict-test-extraction-issues">
          <strong>抽取逻辑问题</strong>
          {visibleExtractionIssues.map(issue => (
            <span key={`${issue.kind}-${issue.fieldId}-${issue.message}`}>
              {[issue.fieldName, issue.fieldCn].filter(Boolean).join(" / ")}：{issue.message}
            </span>
          ))}
        </div>
      ) : null}
      <div className="prj-pm-dict-test-toolbar">
        <label>
          <span>搜索字段</span>
          <select value={searchFieldId} onChange={event => setSearchFieldId(event.target.value)}>
            <option value="">选择字段</option>
            {visibleFields.map(field => (
              <option key={field.id} value={field.id}>{field.fieldName}{field.fieldCn ? ` / ${field.fieldCn}` : ""}</option>
            ))}
          </select>
        </label>
        <label>
          <span>搜索内容</span>
          <input value={searchDraft} onChange={event => setSearchDraft(event.target.value)} placeholder="输入字段值关键字" />
        </label>
        <button type="button" className="is-primary" disabled={!canSearch} onClick={() => {
          setPage(1);
          setAppliedSearch({ fieldId: searchFieldId, value: searchDraft.trim() });
        }}>搜索</button>
        <button type="button" disabled={!appliedSearch.value} onClick={() => {
          setPage(1);
          setSearchDraft("");
          setAppliedSearch({ fieldId: "", value: "" });
        }}>清空</button>
        <label>
          <span>每页</span>
          <select value={pageSize} onChange={event => {
            setPage(1);
            setPageSize(Number(event.target.value));
          }}>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={200}>200</option>
          </select>
        </label>
        <button type="button" disabled={page <= 1 || queryBusy} onClick={() => setPage(current => Math.max(1, current - 1))}>上一页</button>
        <button type="button" disabled={page >= maxPage || queryBusy} onClick={() => setPage(current => current + 1)}>下一页</button>
        <label className="prj-pm-dict-test-toolbar__page-jump">
          <span>跳转</span>
          <input
            type="number"
            min={1}
            max={maxPage}
            value={pageJumpDraft}
            onChange={event => setPageJumpDraft(event.target.value)}
            onKeyDown={event => {
              if (event.key !== "Enter") return;
              const nextPage = Math.min(maxPage, Math.max(1, Math.floor(Number(pageJumpDraft) || page)));
              setPage(nextPage);
            }}
          />
        </label>
        <button type="button" disabled={queryBusy} onClick={() => {
          const nextPage = Math.min(maxPage, Math.max(1, Math.floor(Number(pageJumpDraft) || page)));
          setPage(nextPage);
        }}>跳转</button>
      </div>
      <div className="prj-pm-dict-test-table-scroll">
        <table className="prj-pm-dict-test-table">
          <colgroup>
            {columns.map(column => <col key={column.id} style={{ width: columnResize.columnWidth(column.id) }} />)}
          </colgroup>
          <thead>
            <tr>
              <th className="prj-pm-dict-test-table__row-head" style={{ width: columnResize.columnWidth("index"), minWidth: columnResize.columnWidth("index") }}>
                <div className="prj-pm-dict-resizable-head-cell">
                  #
                  <button
                    type="button"
                    className="prj-pm-dict-column-resizer"
                    aria-label="调整序号列宽"
                    title="拖拽调整列宽"
                    onPointerDown={event => columnResize.startResize(event, "index")}
                  />
                </div>
              </th>
              {visibleFields.map(field => (
                <th
                  key={field.id}
                  className={extractionIssueFieldKeys.has(field.id) || extractionIssueFieldKeys.has(field.fieldName) ? "has-extraction-issue" : ""}
                  style={{ width: columnResize.columnWidth(field.id), minWidth: columnResize.columnWidth(field.id) }}>
                  <strong>{[field.fieldName || "-", field.fieldCn].filter(Boolean).join(" / ")}</strong>
                  <span>{[field.fieldType, field.fieldLength, field.formatPattern].filter(Boolean).join(" / ") || field.fieldCn || "未维护类型"}</span>
                  <button
                    type="button"
                    className="prj-pm-dict-column-resizer"
                    aria-label={`调整${field.fieldName || "字段"}列宽`}
                    title="拖拽调整列宽"
                    onPointerDown={event => columnResize.startResize(event, field.id)}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.id}>
                <td className="prj-pm-dict-test-table__row-head" style={{ width: columnResize.columnWidth("index"), minWidth: columnResize.columnWidth("index") }}>{row.indexLabel}</td>
                {row.values.map((value, index) => {
                  const field = visibleFields[index];
                  const hasExtractionIssue = Boolean(field && (extractionIssueFieldKeys.has(field.id) || extractionIssueFieldKeys.has(field.fieldName)));
                  return (
                  <td
                    key={visibleFields[index]?.id ?? index}
                    className={[!value ? "is-null" : "", hasExtractionIssue ? "has-extraction-issue" : ""].filter(Boolean).join(" ")}
                    style={{ width: columnResize.columnWidth(visibleFields[index]?.id ?? ""), minWidth: columnResize.columnWidth(visibleFields[index]?.id ?? "") }}>
                    {value || "(NULL)"}
                  </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? (
          <div className="prj-pm-dict-test-table__empty">
            {isFileSource
              ? "文件类型表必须先更新实体表、上传并同步测试文件，才会展示测试数据。"
              : "数据库类型表必须配置实体库连接并存在对应实体表，才会展示测试数据。"}
          </div>
        ) : null}
      </div>
      {supportsTestFileUpload && uploadOpen && (
        <DictionaryTestFileUploadDialog
          tableName={table?.tableName || "测试文件"}
          config={parseConfig}
          format={isCodeTable ? "excel" : "text"}
          fields={visibleFields}
          uploadedFile={uploadedFile}
          error={uploadError}
          busy={uploadBusy}
          onClose={() => setUploadOpen(false)}
          onFileLoaded={async file => {
            if (!table?.id) {
              setUploadError("请先选择表元。");
              return;
            }
            setUploadBusy(true);
            try {
              const meta = await api.uploadProjectDictionaryTestFile(projectId, table.id, file.file);
              const savedFile = { ...file, fileName: meta.fileName, fileSize: meta.fileSize, savedAt: meta.uploadedAt, downloadUrl: meta.downloadUrl };
              setUploadedFile(savedFile);
              setUploadedDraftRows(null);
              setSyncedRows(null);
              setUploadError("");
              rememberFeedback({ tone: "info", message: "文件已上传到本地目录，请点击解析" });
            } catch (errorValue) {
              const message = errorValue instanceof Error ? errorValue.message : String(errorValue);
              setUploadError(message);
              rememberFeedback({ tone: "error", message });
            } finally {
              setUploadBusy(false);
            }
          }}
          status={uploadStatus}
          onError={message => {
            setUploadError(message);
            rememberFeedback(message ? { tone: "error", message } : null);
          }}
          onParse={() => {
            if (!uploadedFile) {
              setUploadError("请先选择测试文件。");
              const nextStatus: DictionaryUploadStatus = { tone: "error", message: "请先选择测试文件" };
              rememberFeedback(nextStatus);
              return;
            }
            const parsed = uploadedFile.parsedRows ?? parseDictionaryUploadedTestFile(uploadedFile.text, visibleFields, uploadedFile.delimiter);
            setUploadedDraftRows(parsed);
            setSyncedRows(null);
            setPage(1);
            setUploadError(parsed.length ? "" : "文件没有解析出可展示的数据。");
            const nextStatus: DictionaryUploadStatus = parsed.length
              ? { tone: "success", message: `解析成功，待同步 ${parsed.length} 行到数据库` }
              : { tone: "error", message: "文件没有解析出可展示的数据" };
            rememberFeedback(nextStatus);
          }}
        />
      )}
    </div>
  );
}

function downloadDictionaryCodeTableTemplate(table: ProjectDictionaryTable | undefined, fields: ProjectDictionaryFieldHit[]) {
  const worksheet = XLSX.utils.aoa_to_sheet([fields.map(field => field.fieldName)]);
  worksheet["!cols"] = fields.map(field => ({ wch: Math.max(12, field.fieldName.length + 2) }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "码值数据");
  XLSX.writeFile(workbook, `${table?.tableName || "码值表"}_测试数据模板.xlsx`);
}

function parseDictionaryExcelTestFile(buffer: ArrayBuffer, fields: ProjectDictionaryFieldHit[]): DictionaryImportedTestData["rows"] {
  const workbook = XLSX.read(buffer, { type: "array", cellText: false, cellDates: false });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("Excel 中没有可解析的工作表。");
  const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName]!, { header: 1, defval: "", raw: false });
  const headers = (rows[0] ?? []).map(value => String(value).trim());
  if (!headers.length) throw new Error("Excel 第一行必须是字段名。");
  const fieldIndexes = fields.map(field => headers.indexOf(field.fieldName));
  const missing = fields.filter((_, index) => fieldIndexes[index] < 0).map(field => field.fieldName);
  if (missing.length) throw new Error(`Excel 缺少字段列：${missing.join("、")}`);
  return rows.slice(1).filter(row => row.some(value => String(value).trim())).map((row, index) => ({
    lineNumber: index + 2,
    values: Object.fromEntries(fields.map((field, fieldIndex) => [field.fieldName, row[fieldIndexes[fieldIndex]!] ?? ""])),
    rawColumns: row,
    extraColumns: headers.reduce<unknown[]>((extra, _header, headerIndex) => {
      if (!fieldIndexes.includes(headerIndex)) extra.push(row[headerIndex] ?? "");
      return extra;
    }, []),
  }));
}

function formatDictionaryExcelPreview(rows: DictionaryImportedTestData["rows"], fields: ProjectDictionaryFieldHit[]) {
  const headers = fields.map(field => field.fieldName).join("\t");
  const body = (rows ?? []).slice(0, 80).map(row => fields.map(field => stringifyTestDataValue(row.values?.[field.fieldName])).join("\t"));
  return [headers, ...body].join("\n");
}

function dictionaryRuntimeParameterInputType(sqlType?: string): "date" | "number" | "text" {
  if (/\bdate\b/i.test(sqlType || "") && !/time/i.test(sqlType || "")) return "date";
  if (/\b(decimal|numeric|number|int|bigint|float|double)\b/i.test(sqlType || "")) return "number";
  return "text";
}

function DictionaryTestFileUploadDialog({
  tableName,
  config,
  format,
  fields,
  uploadedFile,
  error,
  busy,
  status,
  onClose,
  onFileLoaded,
  onError,
  onParse,
}: {
  tableName: string;
  config: { encoding: string; delimiter: string };
  format: "text" | "excel";
  fields: ProjectDictionaryFieldHit[];
  uploadedFile: DictionaryUploadedTestFile | null;
  error: string;
  busy: boolean;
  status: DictionaryUploadStatus | null;
  onClose: () => void;
  onFileLoaded: (file: DictionaryUploadedTestFile & { file: File }) => void | Promise<void>;
  onError: (message: string) => void;
  onParse: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const downloadUrl = useMemo(() => {
    if (!uploadedFile) return "";
    if (uploadedFile.downloadUrl) return uploadedFile.downloadUrl;
    const blob = uploadedFile.file ?? new Blob([uploadedFile.text], { type: "text/plain;charset=utf-8" });
    return URL.createObjectURL(blob);
  }, [uploadedFile]);

  useEffect(() => () => {
    if (downloadUrl && !uploadedFile?.downloadUrl) URL.revokeObjectURL(downloadUrl);
  }, [downloadUrl, uploadedFile?.downloadUrl]);

  const loadFile = async (file: File) => {
    try {
      const buffer = await file.arrayBuffer();
      if (format === "excel") {
        const parsedRows = parseDictionaryExcelTestFile(buffer, fields);
        await onFileLoaded({
          file,
          fileName: file.name,
          fileSize: file.size,
          text: "",
          preview: formatDictionaryExcelPreview(parsedRows, fields),
          encoding: "Excel",
          delimiter: "",
          parsedRows,
          savedAt: new Date().toISOString(),
        });
        return;
      }
      const encoding = normalizeDictionaryTextEncoding(config.encoding);
      const text = decodeDictionaryTextFile(buffer, encoding);
      await onFileLoaded({
        file,
        fileName: file.name,
        fileSize: file.size,
        text,
        preview: text.split(/\r\n|\n|\r/).slice(0, 80).join("\n"),
        encoding,
        delimiter: config.delimiter,
        savedAt: new Date().toISOString(),
      });
    } catch (errorValue) {
      onError(errorValue instanceof Error ? errorValue.message : String(errorValue));
    }
  };

  return createPortal(
    <div className="prj-pm-dict-upload-modal" role="dialog" aria-modal="true" aria-label="上传测试文件">
      <section>
        <header>
          <div>
            <strong>上传测试文件</strong>
            <span>{tableName}</span>
          </div>
          <button type="button" onClick={onClose}>关闭</button>
        </header>
        <div className="prj-pm-dict-upload-modal__actions">
          <input
            id="dictionary-test-file-input"
            ref={fileInputRef}
            type="file"
            accept={format === "excel" ? ".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : ".txt,.csv,.xml,text/plain,text/csv,text/xml,application/xml"}
            onChange={event => {
              const file = event.currentTarget.files?.[0];
              if (file) void loadFile(file);
            }}
          />
          <label htmlFor="dictionary-test-file-input" className={busy ? "is-disabled" : ""}>{busy ? "上传中" : "选择文件"}</label>
          <button type="button" disabled={!uploadedFile || busy} onClick={onParse}>解析</button>
          {uploadedFile && downloadUrl ? <a href={downloadUrl} download={uploadedFile.fileName}>下载原文件</a> : <span>下载原文件</span>}
        </div>
        <dl className="prj-pm-dict-upload-modal__meta">
          <dt>{format === "excel" ? "格式" : "字符集"}</dt><dd>{format === "excel" ? "Excel（首个工作表）" : normalizeDictionaryTextEncoding(config.encoding)}</dd>
          <dt>{format === "excel" ? "字段匹配" : "分隔符"}</dt><dd>{format === "excel" ? "首行字段名" : config.delimiter || "未配置"}</dd>
          <dt>文件</dt><dd>{uploadedFile ? `${uploadedFile.fileName} / ${formatFileSize(uploadedFile.fileSize)}` : "未选择"}</dd>
        </dl>
        {status && !error ? <p className={`prj-pm-dict-upload-modal__status is-${status.tone}`}>{status.message}</p> : null}
        {error ? <p className="prj-pm-dict-upload-modal__error">{error}</p> : null}
        <pre>{uploadedFile?.preview || "选择文件后在这里预览前 80 行内容。"}</pre>
      </section>
    </div>
    , document.body,
  );
}

function getDictionaryTestDataSourceKind(table?: ProjectDictionaryTable): "file" | "database" {
  const sourceKind = `${table?.sourceKind ?? ""}`.trim().toLowerCase();
  const fileType = `${table?.fileType ?? ""}`.trim().toLowerCase();
  if (/文件|file/.test(sourceKind)) return "file";
  if (fileType && fileType !== "-" && fileType !== "database") return "file";
  return "database";
}

async function restoreDictionaryUploadedTestFile(
  projectId: string,
  tableId: string,
  config: { encoding: string; delimiter: string },
): Promise<DictionaryUploadedTestFile | null> {
  const meta = await api.getProjectDictionaryTestFile(projectId, tableId);
  if (!meta) return null;
  const response = await fetch(meta.downloadUrl);
  if (!response.ok) throw new Error(`读取测试文件失败：${response.status}`);
  const text = decodeDictionaryTextFile(await response.arrayBuffer(), normalizeDictionaryTextEncoding(config.encoding));
  return dictionaryUploadedFileFromMeta(meta, text, config);
}

function dictionaryUploadedFileFromMeta(
  meta: ProjectDictionaryTestFileMeta,
  text: string,
  config: { encoding: string; delimiter: string },
): DictionaryUploadedTestFile {
  const encoding = normalizeDictionaryTextEncoding(config.encoding);
  return {
    fileName: meta.fileName,
    fileSize: meta.fileSize,
    text,
    preview: text.split(/\r\n|\n|\r/).slice(0, 80).join("\n"),
    encoding,
    delimiter: config.delimiter,
    savedAt: meta.uploadedAt,
    downloadUrl: meta.downloadUrl,
  };
}

function formatFileSize(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function stringifyTestDataValue(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function dictionaryTestDataFeedbackKey(storageKey: string) {
  return `rich-project-dictionary-test-data-feedback:${storageKey}`;
}

function loadDictionaryTestDataFeedback(storageKey: string, mappingSignature?: string): DictionaryTestDataFeedback {
  if (typeof window === "undefined") return { uploadStatus: null, extractionIssues: [] };
  try {
    const parsed = JSON.parse(window.localStorage.getItem(dictionaryTestDataFeedbackKey(storageKey)) ?? "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return { uploadStatus: null, extractionIssues: [] };
    const record = parsed as Record<string, unknown>;
    const statusRecord = record.uploadStatus && typeof record.uploadStatus === "object" && !Array.isArray(record.uploadStatus)
      ? record.uploadStatus as Record<string, unknown>
      : null;
    const uploadStatus = statusRecord && ["info", "success", "error"].includes(String(statusRecord.tone)) && typeof statusRecord.message === "string"
      ? { tone: statusRecord.tone as DictionaryUploadStatus["tone"], message: statusRecord.message }
      : null;
    const extractionIssues = Array.isArray(record.extractionIssues)
      ? record.extractionIssues.filter((issue): issue is ProjectDictionaryExtractionValidationIssue => Boolean(issue) && typeof issue === "object" && !Array.isArray(issue) && typeof (issue as ProjectDictionaryExtractionValidationIssue).fieldId === "string")
      : [];
    const extractionJobId = typeof record.extractionJobId === "string" ? record.extractionJobId : undefined;
    const prepareRecord = record.extractionPrepare && typeof record.extractionPrepare === "object" && !Array.isArray(record.extractionPrepare)
      ? record.extractionPrepare as DictionaryExtractionPrepareState
      : undefined;
    const extractionPrepare = prepareRecord && ["idle", "ready", "invalid"].includes(String(prepareRecord.status))
      ? prepareRecord
      : undefined;
    const runStatusRecord = record.extractionRunStatus && typeof record.extractionRunStatus === "object" && !Array.isArray(record.extractionRunStatus)
      ? record.extractionRunStatus as Record<string, unknown>
      : null;
    const extractionRunStatus = runStatusRecord && ["info", "success", "error"].includes(String(runStatusRecord.tone)) && typeof runStatusRecord.message === "string"
      ? { tone: runStatusRecord.tone as DictionaryUploadStatus["tone"], message: runStatusRecord.message }
      : null;
    const runtimeParams = record.runtimeParams && typeof record.runtimeParams === "object" && !Array.isArray(record.runtimeParams)
      ? Object.fromEntries(Object.entries(record.runtimeParams as Record<string, unknown>).filter(([, value]) => typeof value === "string")) as Record<string, string>
      : undefined;
    const isCurrentMapping = Boolean(mappingSignature) && record.mappingSignature === mappingSignature;
    if (!isCurrentMapping) {
      return { uploadStatus, extractionIssues: [], runtimeParams };
    }
    return { mappingSignature, uploadStatus, extractionIssues, extractionJobId, extractionPrepare, extractionRunStatus, runtimeParams };
  } catch {
    return { uploadStatus: null, extractionIssues: [] };
  }
}

function saveDictionaryTestDataFeedback(storageKey: string, feedback: DictionaryTestDataFeedback) {
  if (typeof window === "undefined") return;
  try {
    if (!feedback.uploadStatus
      && feedback.extractionIssues.length === 0
      && !feedback.extractionJobId
      && (!feedback.extractionPrepare || feedback.extractionPrepare.status === "idle")
      && !feedback.extractionRunStatus
      && (!feedback.runtimeParams || Object.keys(feedback.runtimeParams).length === 0)) {
      window.localStorage.removeItem(dictionaryTestDataFeedbackKey(storageKey));
      return;
    }
    window.localStorage.setItem(dictionaryTestDataFeedbackKey(storageKey), JSON.stringify(feedback));
  } catch {
    // Test-data feedback is a local UI memory; extraction itself is unaffected.
  }
}
