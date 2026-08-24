import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import type {
  DictionaryCaliberExpression,
  DictionaryCaliberJoin,
  DictionaryCaliberOrderExpression,
  DictionaryCaliberRule,
  DictionaryCaliberSelectLatest,
  DictionaryMappingJsonCondition,
  DictionaryMappingJsonRule,
  DictionaryMappingJsonRuleValue,
} from "@ke/domain";
import {
  DictionaryFileSourceBlock,
  DictionaryStageSourceLinkBlock,
  dictionaryFieldDescription,
} from "./DictionaryMetadata.js";
import {
  DictionaryResizableHeadCell,
  loadDictionaryColumnWidths,
  saveDictionaryColumnWidths,
  type DictionaryResizableColumn,
  useDictionaryResizableColumns,
} from "./DictionaryResizableColumns.js";
import {
  buildDictionaryCaliberSql,
  buildDictionaryLogicRefCandidates,
  convertDictionaryMappingRuleToSql,
  dictionaryCaliberTableName,
  dictionaryRuntimeParamName,
  findNextDictionaryLogicRefMatch,
  formatDictionaryCaliberTable,
  formatDictionaryJoinType,
  formatDictionarySqlForDisplay,
  getDictionarySourceRefChinese,
  getDictionarySourceRefEnglish,
  normalizeDictionaryJsonOp,
  normalizeDictionaryRefKey,
  parseDictionaryCaliberJsonRuleStrict,
  parseDictionaryJsonRule,
  parseDictionaryJsonRuleStrict,
  type DictionaryMappingRule,
  type DictionarySourceRef,
  type DictionarySqlConversion,
  type DictionarySqlDialect,
} from "./sqlRuleEngine.js";
import {
  api,
  type ProjectDictionaryFieldDetail,
  type ProjectDictionaryFieldHit,
  type ProjectDictionaryMappingSqlValidationResult,
  type ProjectDictionaryMappingTempFieldInput,
  type ProjectDictionaryMappingTempTable,
  type ProjectDictionaryMappingTempTableInput,
  type ProjectDictionaryRectification,
  type ProjectDictionaryRectificationInput,
  type ProjectDictionarySystem,
  type ProjectDictionaryTable,
} from "../../../api/client.js";
import {
  arrayValue,
  dictionaryMappingSqlValidationKey,
  loadDictionaryMappingSqlValidation,
  recordValue,
  saveDictionaryMappingSqlValidation,
} from "../ProjectManagementModules.js";
import { getDictionarySystemSqlDialect } from "./DictionarySystemPanels.js";
import {
  DictionarySourceRefTag,
  DictionaryTableRefTag,
  type DictionaryTableRef,
} from "./DictionaryReferenceTags.js";
import {
  renderDictionaryCaliberLogic,
  renderDictionaryLogicWithRefs,
} from "./DictionaryLogicRenderer.js";

type DictionaryView = "field-design" | "mapping" | "temp-table" | "relations" | "test-data" | "table-info";
type DictionaryPropertyKind = "fieldDetail" | "tableDetail" | "systemDetail" | "description" | "codeValue" | "formatPattern" | "mappingLogic" | "mappingCaliber" | "sourceRefs" | "generic";
type DictionaryMappingJsonValue = DictionaryMappingJsonRuleValue;
type DictionaryCaliberJsonRule = DictionaryCaliberRule;
type DictionaryRectificationTarget = Pick<ProjectDictionaryRectificationInput, "entityType" | "entityId" | "propertyKey"> & { label: string; currentValue?: string };
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


export function DictionaryFieldGrid({
  fields,
  loading,
  storageKey,
  selectedFieldId,
  onSelectField,
  onInspectProperty,
  rectificationIndex,
  onRectify,
}: {
  fields: ProjectDictionaryFieldHit[];
  loading: boolean;
  storageKey: string;
  selectedFieldId: string;
  onSelectField: (fieldId: string) => void;
  onInspectProperty: (payload: DictionaryPropertyPayload) => void;
  rectificationIndex: Map<string, ProjectDictionaryRectification>;
  onRectify: (event: ReactMouseEvent<HTMLElement>, target: DictionaryRectificationTarget) => void;
}) {
  useEffect(() => {
    if (!selectedFieldId) return;
    const frame = window.requestAnimationFrame(() => {
      const row = document.querySelector(`[data-dict-field-id="${CSS.escape(selectedFieldId)}"]`);
      row?.scrollIntoView({ block: "center", inline: "nearest" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [fields, selectedFieldId]);

  const inspectField = (field: ProjectDictionaryFieldHit) => {
    onInspectProperty({
      kind: "fieldDetail",
      title: "字段详情",
      subtitle: `${field.tableCn || field.tableName || "字段"} / ${field.fieldName}`,
      value: [field.description, field.codeValue, field.remark].filter(Boolean).join("\n"),
      field,
    });
  };
  const cellClass = (field: ProjectDictionaryFieldHit, propertyKey: string) => {
    const record = rectificationIndex.get(`field:${field.id}:${propertyKey}`);
    if (record?.status === "verified") return "";
    return record ? `is-rectification-${record.status}` : "";
  };
  const target = (field: ProjectDictionaryFieldHit, propertyKey: string, label: string, currentValue?: string): DictionaryRectificationTarget => ({
    entityType: "field",
    entityId: field.id,
    propertyKey,
    label: `字段：${field.fieldName}${field.fieldCn ? ` / ${field.fieldCn}` : ""} · ${label}`,
    currentValue,
  });
  const columns = useMemo<DictionaryResizableColumn[]>(() => [
    { id: "index", label: "", width: 46, minWidth: 38 },
    { id: "fieldName", label: "英文名", width: 170, minWidth: 120 },
    { id: "fieldCn", label: "中文名", width: 180, minWidth: 120 },
    { id: "fieldType", label: "类型", width: 96, minWidth: 72 },
    { id: "fieldLength", label: "长度", width: 76, minWidth: 62 },
    { id: "formatPattern", label: "格式", width: 140, minWidth: 92 },
    { id: "description", label: "字段说明", width: 320, minWidth: 160 },
    { id: "codeValue", label: "码值说明", width: 280, minWidth: 140 },
    { id: "remark", label: "备注", width: 220, minWidth: 120 },
  ], []);
  const columnResize = useDictionaryResizableColumns(storageKey, columns, loadDictionaryColumnWidths, saveDictionaryColumnWidths);
  const gridStyle = useMemo(() => ({
    "--dict-grid-c1": `${columnResize.columnWidth("index")}px`,
    "--dict-grid-c2": `${columnResize.columnWidth("fieldName")}px`,
    "--dict-grid-c3": `${columnResize.columnWidth("fieldCn")}px`,
    "--dict-grid-c4": `${columnResize.columnWidth("fieldType")}px`,
    "--dict-grid-c5": `${columnResize.columnWidth("fieldLength")}px`,
    "--dict-grid-c6": `${columnResize.columnWidth("formatPattern")}px`,
    "--dict-grid-c7": `${columnResize.columnWidth("description")}px`,
    "--dict-grid-c8": `${columnResize.columnWidth("codeValue")}px`,
    "--dict-grid-c9": `${columnResize.columnWidth("remark")}px`,
    "--dict-grid-width": `${columnResize.totalWidth}px`,
  }) as CSSProperties, [columnResize]);

  return (
    <div className="prj-pm-dict__grid-wrap">
      <div className="prj-pm-dict__grid" style={gridStyle}>
        <div className="prj-pm-dict__grid-head">
          {columns.map(column => (
            <DictionaryResizableHeadCell key={column.id} column={column} onResizeStart={columnResize.startResize} />
          ))}
        </div>
        {!loading && fields.length === 0 && (
          <div className="prj-pm-dict__grid-empty">暂无字段数据。</div>
        )}
        {fields.map((field, index) => (
          <button
            key={field.id}
            type="button"
            data-dict-field-id={field.id}
            className={`prj-pm-dict__grid-row${selectedFieldId === field.id ? " is-active" : ""}`}
            onClick={() => {
              onSelectField(field.id);
              inspectField(field);
            }}
            onContextMenu={event => onRectify(event, target(field, "entity", "字段", field.fieldName))}>
            <span>{index + 1}</span>
            <strong className={cellClass(field, "field_name")} onContextMenu={event => onRectify(event, target(field, "field_name", "英文名", field.fieldName))}>{field.fieldName || "-"}</strong>
            <strong className={cellClass(field, "field_cn")} onContextMenu={event => onRectify(event, target(field, "field_cn", "中文名", field.fieldCn))}>{field.fieldCn || "-"}</strong>
            <span className={cellClass(field, "field_type")} onContextMenu={event => onRectify(event, target(field, "field_type", "类型", field.fieldType))}>{field.fieldType || "-"}</span>
            <span className={cellClass(field, "field_length")} onContextMenu={event => onRectify(event, target(field, "field_length", "长度", field.fieldLength))}>{field.fieldLength || "-"}</span>
            <span className={cellClass(field, "format_pattern")} onContextMenu={event => onRectify(event, target(field, "format_pattern", "格式", field.formatPattern))}>{compactText(field.formatPattern)}</span>
            <span className={cellClass(field, "description")} onContextMenu={event => onRectify(event, target(field, "description", "字段说明", dictionaryFieldDescription(field)))}>{compactText(dictionaryFieldDescription(field))}</span>
            <span className={cellClass(field, "code_value")} onContextMenu={event => onRectify(event, target(field, "code_value", "码值说明", field.codeValue))}>{formatCodeValueSummary(field)}</span>
            <span className={cellClass(field, "remark")} onContextMenu={event => onRectify(event, target(field, "remark", "备注", field.remark))}>{compactText(field.remark)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function DictionaryMappingPanel({
  projectId,
  system,
  table,
  fields,
  allFields,
  onInspectProperty,
  onOpenFieldRef,
  onOpenTableRef,
  rectificationIndex,
  onRectify,
}: {
  projectId: string;
  system?: ProjectDictionarySystem;
  table?: ProjectDictionaryTable;
  fields: ProjectDictionaryFieldHit[];
  allFields: ProjectDictionaryFieldHit[];
  onInspectProperty: (payload: DictionaryPropertyPayload) => void;
  onOpenFieldRef: (field: ProjectDictionaryFieldHit) => void;
  onOpenTableRef: (tableId: string) => void;
  rectificationIndex: Map<string, ProjectDictionaryRectification>;
  onRectify: (event: ReactMouseEvent<HTMLElement>, target: DictionaryRectificationTarget) => void;
}) {
  const sqlDialect = getDictionarySystemSqlDialect(system);
  const fieldRefIndex = useMemo(() => buildDictionaryFieldRefIndex(allFields), [allFields]);
  const tableRefIndex = useMemo(() => buildDictionaryTableRefIndex(table, allFields), [table, allFields]);
  const scenarios = useMemo(() => buildDictionaryMappingScenarios(table, fields, fieldRefIndex), [table, fields, fieldRefIndex]);
  const [activeScenarioKey, setActiveScenarioKey] = useState("");
  const [sqlValidation, setSqlValidation] = useState<ProjectDictionaryMappingSqlValidationResult | null>(null);
  const [sqlValidationBusy, setSqlValidationBusy] = useState(false);
  const [sqlValidationMessage, setSqlValidationMessage] = useState("");
  const autoSqlValidationKeyRef = useRef("");
  const activeScenario = scenarios.find(scenario => scenario.key === activeScenarioKey) ?? scenarios[0];
  const activeSqlValidationCacheKey = useMemo(
    () => table && activeScenario ? dictionaryMappingSqlValidationKey(projectId, table.id, activeScenario.key) : "",
    [activeScenario, projectId, table],
  );
  const activeSqlValidationFingerprint = useMemo(
    () => activeScenario ? dictionaryMappingSqlValidationFingerprint(activeScenario) : "",
    [activeScenario],
  );
  const activeCaliber = useMemo(
    () => activeScenario ? buildDictionaryCaliberView(activeScenario.caliber, fieldRefIndex, tableRefIndex, sqlDialect) : null,
    [activeScenario, fieldRefIndex, tableRefIndex, sqlDialect],
  );
  const mappingColumns = useMemo<DictionaryResizableColumn[]>(() => [
    { id: "index", label: "", width: 42, minWidth: 38 },
    { id: "fieldName", label: "字段名", width: 150, minWidth: 110 },
    { id: "fieldCn", label: "中文名", width: 150, minWidth: 110 },
    { id: "logic", label: "逻辑", width: 640, minWidth: 240 },
    { id: "sql", label: "SQL转换", width: 420, minWidth: 220 },
    { id: "remark", label: "备注", width: 220, minWidth: 120 },
  ], []);
  const mappingColumnResize = useDictionaryResizableColumns(
    `dictionary-mapping-table:${table?.id || "empty"}`,
    mappingColumns,
    loadDictionaryColumnWidths,
    saveDictionaryColumnWidths,
  );
  const mappingTableStyle = useMemo(() => ({
    "--dict-map-c1": `${mappingColumnResize.columnWidth("index")}px`,
    "--dict-map-c2": `${mappingColumnResize.columnWidth("fieldName")}px`,
    "--dict-map-c3": `${mappingColumnResize.columnWidth("fieldCn")}px`,
    "--dict-map-c4": `${mappingColumnResize.columnWidth("logic")}px`,
    "--dict-map-c5": `${mappingColumnResize.columnWidth("sql")}px`,
    "--dict-map-c6": `${mappingColumnResize.columnWidth("remark")}px`,
    "--dict-map-width": `${mappingColumnResize.totalWidth}px`,
  }) as CSSProperties, [mappingColumnResize]);

  useEffect(() => {
    if (scenarios.length === 0) {
      setActiveScenarioKey("");
      return;
    }
    setActiveScenarioKey(current => scenarios.some(scenario => scenario.key === current) ? current : scenarios[0].key);
  }, [scenarios]);

  useEffect(() => {
    if (!activeSqlValidationCacheKey || !activeSqlValidationFingerprint) {
      setSqlValidation(null);
      setSqlValidationMessage("");
      return;
    }
    const cached = loadDictionaryMappingSqlValidation(activeSqlValidationCacheKey);
    if (cached?.fingerprint === activeSqlValidationFingerprint) {
      setSqlValidation(cached.result);
      setSqlValidationMessage(cached.message || cached.result.message);
      return;
    }
    if (cached) saveDictionaryMappingSqlValidation(activeSqlValidationCacheKey, null);
    setSqlValidation(null);
    setSqlValidationMessage("");
  }, [activeSqlValidationCacheKey, activeSqlValidationFingerprint]);

  const validateSql = useCallback(async () => {
    if (!table || !activeScenario) return;
    setSqlValidationBusy(true);
    setSqlValidationMessage("");
    try {
      const result = await api.validateProjectDictionaryMappingSql(projectId, table.id, {
        caliber: activeScenario.caliber,
        fieldRules: activeScenario.rules.map(rule => ({ fieldId: rule.field.id, logic: rule.logic })),
      });
      setSqlValidation(result);
      setSqlValidationMessage(result.message);
      saveDictionaryMappingSqlValidation(activeSqlValidationCacheKey, {
        fingerprint: activeSqlValidationFingerprint,
        result,
        message: result.message,
        validatedAt: new Date().toISOString(),
      });
    } catch (errorValue) {
      setSqlValidation(null);
      setSqlValidationMessage(errorValue instanceof Error ? errorValue.message : String(errorValue));
    } finally {
      setSqlValidationBusy(false);
    }
  }, [activeScenario, activeSqlValidationCacheKey, activeSqlValidationFingerprint, projectId, table]);

  useEffect(() => {
    if (!table || !activeScenario || !activeSqlValidationCacheKey || !activeSqlValidationFingerprint) return;
    if (sqlValidation || sqlValidationBusy) return;
    const autoKey = `${activeSqlValidationCacheKey}:${activeSqlValidationFingerprint}`;
    if (autoSqlValidationKeyRef.current === autoKey) return;
    autoSqlValidationKeyRef.current = autoKey;
    void validateSql();
  }, [
    activeScenario,
    activeSqlValidationCacheKey,
    activeSqlValidationFingerprint,
    sqlValidation,
    sqlValidationBusy,
    table,
    validateSql,
  ]);

  const validationByFieldAndLogic = useMemo(() => {
    const map = new Map<string, NonNullable<ProjectDictionaryMappingSqlValidationResult["fields"]>[number]>();
    sqlValidation?.fields.forEach(item => {
      if (!item.logicFingerprint) return;
      map.set(dictionaryMappingRuleValidationKey(item.fieldId, item.logicFingerprint), item);
    });
    return map;
  }, [sqlValidation]);

  return (
    <div className="prj-pm-dict-mapping">
      {scenarios.length === 0 ? (
        <div className="prj-pm-dict__grid-empty">当前表暂未维护 Mapping 场景。</div>
      ) : (
        <>
          <div className="prj-pm-dict-mapping__scenario-tabs" role="tablist" aria-label="Mapping 场景">
            {scenarios.map(scenario => (
              <button
                key={scenario.key}
                type="button"
                role="tab"
                aria-selected={activeScenario?.key === scenario.key}
                className={activeScenario?.key === scenario.key ? "is-active" : ""}
                onClick={() => setActiveScenarioKey(scenario.key)}>
                <strong>{scenario.title}</strong>
              </button>
            ))}
          </div>
          {activeScenario && (
            <section className="prj-pm-dict-mapping__scenario" key={activeScenario.key}>
              <details className="prj-pm-dict-mapping__caliber" open>
                <summary>
                  <span>口径</span>
                  <em>{activeScenario.title}</em>
                  <button
                    type="button"
                    className="prj-pm-dict-mapping__validate-btn"
                    onClick={event => {
                      event.preventDefault();
                      event.stopPropagation();
                      void validateSql();
                    }}
                    disabled={sqlValidationBusy}>
                    {sqlValidationBusy ? "验证中" : "验证SQL"}
                  </button>
                  {sqlValidationMessage ? (
                    <small className={`prj-pm-dict-mapping__validate-message${sqlValidation?.ok ? " is-ok" : " is-error"}`}>
                      {sqlValidationMessage}
                    </small>
                  ) : null}
                </summary>
                {activeCaliber ? (
                  <DictionaryCaliberSummaryRow
                    caliber={activeCaliber}
                    validation={sqlValidation?.caliber}
                    sourceKind={sqlValidation?.sourceKind}
                    validationBusy={sqlValidationBusy}
                    rawText={activeScenario.caliber}
                    onOpenFieldRef={onOpenFieldRef}
                    onOpenTableRef={onOpenTableRef}
                    onOpenDetail={() => onInspectProperty({
                      kind: "mappingCaliber",
                      title: "口径详情",
                      subtitle: activeScenario.title,
                      value: activeScenario.caliber,
                      remark: buildDictionaryCaliberDisplayRemark(activeCaliber.rule?.remark, activeScenario.caliber),
                      refs: activeCaliber.fieldRefs,
                      tableRefs: activeCaliber.tableRefs,
                      sqlConversion: activeCaliber.conversion,
                      sqlValidation: sqlValidation?.caliber,
                      sqlValidationBusy,
                    })}
                  />
                ) : (
                  <p>{activeScenario.caliber}</p>
                )}
              </details>
              <div className="prj-pm-dict-mapping-table-wrap">
                <table className="prj-pm-dict-mapping-table" style={mappingTableStyle}>
                  <thead>
                    <tr className="prj-pm-dict-mapping-table__head">
                      {mappingColumns.map(column => (
                        <th key={column.id}>
                          <DictionaryResizableHeadCell column={column} onResizeStart={mappingColumnResize.startResize} />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {activeScenario.rules.map((rule, index) => {
                      const sqlConversion = convertDictionaryMappingRuleToSql(rule, sqlDialect);
                      const sqlValidationField = validationByFieldAndLogic.get(dictionaryMappingRuleValidationKey(
                        rule.field.id,
                        dictionaryMappingRuleLogicFingerprint(rule.logic),
                      ));
                      const tableRemark = rule.remark?.trim() || "";
                      const detailRemark = buildDictionaryMappingDisplayRemark(rule);
                      const mappingRectification = rectificationIndex.get(`mapping:${rule.field.id}:${activeScenario.key}`)
                        ?? rectificationIndex.get(`mapping:${rule.field.id}:logic`);
                      return (
                        <tr
                          key={`${activeScenario.key}-${rule.field.id}-${index}`}
                          className="prj-pm-dict-mapping-table__row"
                          tabIndex={0}
                          onContextMenu={event => onRectify(event, {
                            entityType: "mapping",
                            entityId: rule.field.id,
                            propertyKey: activeScenario.key,
                            label: `Mapping：${rule.field.fieldName}${rule.field.fieldCn ? ` / ${rule.field.fieldCn}` : ""} · ${activeScenario.title}`,
                            currentValue: rule.logic,
                          })}
                          onClick={() => {
                            onInspectProperty({
                              kind: "mappingLogic",
                              title: "涉及字段 + 逻辑",
                              subtitle: `${rule.field.fieldName} ${rule.field.fieldCn || ""}`.trim(),
                              value: rule.logic,
                              remark: detailRemark,
                              field: rule.field,
                              refs: rule.sourceRefs,
                              sqlConversion,
                              sqlValidation: sqlValidationField,
                              sqlValidationBusy,
                            });
                          }}
                          onKeyDown={event => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              onInspectProperty({
                                kind: "mappingLogic",
                                title: "涉及字段 + 逻辑",
                                subtitle: `${rule.field.fieldName} ${rule.field.fieldCn || ""}`.trim(),
                                value: rule.logic,
                                remark: detailRemark,
                                field: rule.field,
                                refs: rule.sourceRefs,
                                sqlConversion,
                                sqlValidation: sqlValidationField,
                                sqlValidationBusy,
                              });
                            }
                          }}>
                          <td>{index + 1}</td>
                          <td><strong>{rule.field.fieldName || "-"}</strong></td>
                          <td><strong>{rule.field.fieldCn || "-"}</strong></td>
                          <td className={`prj-pm-dict-mapping-table__text${mappingRectification && mappingRectification.status !== "verified" ? ` is-rectification-${mappingRectification.status}` : ""}`}>
                            {renderDictionaryLogicWithRefs(rule.logic, rule.sourceRefs, onOpenFieldRef)}
                          </td>
                          <td>
                            <DictionarySqlConversionBadge conversion={sqlConversion} validation={sqlValidationField} validationBusy={sqlValidationBusy} sourceKind={sqlValidation?.sourceKind} />
                          </td>
                          <td className="prj-pm-dict-mapping-table__remark">{tableRemark || "-"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

type DictionaryCaliberView = {
  conversion: DictionarySqlConversion;
  fieldRefs: DictionarySourceRef[];
  tableRefs: DictionaryTableRef[];
  rule?: DictionaryCaliberJsonRule;
};

function DictionaryCaliberSummaryRow({
  caliber,
  validation,
  sourceKind,
  validationBusy,
  rawText,
  onOpenFieldRef,
  onOpenTableRef,
  onOpenDetail,
}: {
  caliber: DictionaryCaliberView;
  validation?: ProjectDictionaryMappingSqlValidationResult["caliber"];
  sourceKind?: ProjectDictionaryMappingSqlValidationResult["sourceKind"];
  validationBusy?: boolean;
  rawText: string;
  onOpenFieldRef: (field: ProjectDictionaryFieldHit) => void;
  onOpenTableRef: (tableId: string) => void;
  onOpenDetail: () => void;
}) {
  const statusLabel = caliber.conversion.status === "complete" ? "可转换" : caliber.conversion.status === "invalid" ? "规则不标准" : "无法转换";
  const validationError = validation?.status === "invalid" ? validation.error : "";
  const sqlSummary = sourceKind === "file"
    ? validation?.sql
      ? `${validation.sql}${validationError ? `\n\n文件验证错误：${validationError}` : ""}`
      : validationBusy
        ? "正在验证上传文件、解析配置和字段映射..."
      : validationError
        ? `${caliber.conversion.reason || statusLabel}\n\n文件验证错误：${validationError}`
        : "待验证文件"
    : validation?.sql
      ? `${formatDictionarySqlForDisplay(validation.sql)}${validationError ? `\n\n数据库报错：${validationError}` : ""}`
      : validationBusy
        ? "正在通过后端生成并验证数据库可执行 SQL..."
      : validationError
        ? `${caliber.conversion.reason || statusLabel}\n\n数据库报错：${validationError}`
        : caliber.conversion.status === "invalid"
          ? caliber.conversion.reason || statusLabel
          : "待验证SQL";
  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpenDetail();
    }
  };
  return (
    <div
      className="prj-pm-dict-mapping__caliber-row"
      role="button"
      tabIndex={0}
      onClick={onOpenDetail}
      onKeyDown={handleKeyDown}>
      <section className={`prj-pm-dict-mapping__caliber-summary-logic${caliber.rule ? "" : " is-invalid"}`}>
        <strong>逻辑</strong>
        {caliber.rule ? (
          renderDictionaryCaliberLogic(caliber.rule, caliber.fieldRefs, caliber.tableRefs, onOpenFieldRef, onOpenTableRef)
        ) : (
          <pre className="prj-pm-dict-logic-invalid">{compactText(rawText) || "-"}</pre>
        )}
      </section>
      <section className={`prj-pm-dict-mapping__caliber-summary-sql is-${validationError ? "invalid" : caliber.conversion.status}`}>
        <strong>{sourceKind === "file" ? "文件来源验证" : "SQL转换"}</strong>
        <pre>{sqlSummary}</pre>
      </section>
    </div>
  );
}

function DictionaryCaliberDetail({
  caliber,
  validation,
  validationBusy,
  rawText,
  onOpenFieldRef,
  onOpenTableRef,
}: {
  caliber: DictionaryCaliberView;
  validation?: ProjectDictionaryMappingSqlValidationResult["caliber"];
  validationBusy?: boolean;
  rawText: string;
  onOpenFieldRef: (field: ProjectDictionaryFieldHit) => void;
  onOpenTableRef: (tableId: string) => void;
}) {
  const sqlStatusLabel = caliber.conversion.status === "complete" ? "完成" : caliber.conversion.status === "invalid" ? "规则不标准" : "无法转换";
  const validationError = validation?.status === "invalid" ? validation.error : "";
  return (
    <div className="prj-pm-dict-mapping__caliber-body">
      <section className="prj-pm-dict-field-popover__section is-table-refs">
        <header>
          <strong>涉及表</strong>
          <span>{caliber.tableRefs.length} 张表</span>
        </header>
        {caliber.tableRefs.length > 0 ? (
          <p className="prj-pm-dict-mapping__caliber-tags">
            {caliber.tableRefs.map(table => (
              <DictionaryTableRefTag key={table.label} refItem={table} onOpenTableRef={onOpenTableRef}>
                {table.label}
              </DictionaryTableRefTag>
            ))}
          </p>
        ) : (
          <p>暂无涉及表</p>
        )}
      </section>
      <section className="prj-pm-dict-field-popover__section is-source-refs">
        <header>
          <strong>涉及字段</strong>
          <span>{caliber.fieldRefs.length} 个字段</span>
        </header>
        <DictionarySourceRefsTable refs={caliber.fieldRefs} onOpenFieldRef={onOpenFieldRef} />
      </section>
      <section className={`prj-pm-dict-field-popover__section is-logic${caliber.rule ? "" : " is-invalid"}`}>
        <header>
          <strong>逻辑</strong>
          <span>{caliber.rule ? "标准口径" : "规则不标准"}</span>
        </header>
        {caliber.rule ? (
          renderDictionaryCaliberLogic(caliber.rule, caliber.fieldRefs, caliber.tableRefs, onOpenFieldRef, onOpenTableRef)
        ) : (
          <pre className="prj-pm-dict-logic-invalid">{rawText || "当前场景暂未维护独立业务口径。"}</pre>
        )}
      </section>
      {buildDictionaryCaliberDisplayRemark(caliber.rule?.remark, rawText) ? (
        <section className="prj-pm-dict-field-popover__section is-remark">
          <header>
            <strong>备注</strong>
            <span>口径备注</span>
          </header>
          <p>{buildDictionaryCaliberDisplayRemark(caliber.rule?.remark, rawText)}</p>
        </section>
      ) : null}
      <section className={`prj-pm-dict-field-popover__section is-sql is-${validationError ? "invalid" : caliber.conversion.status}`}>
        <header>
          <strong>SQL转换</strong>
          <span>{validationBusy && !validation ? "验证中" : validationError ? "数据库验证失败" : validation?.sql ? sqlStatusLabel : "待验证"}</span>
        </header>
        {validation?.sql ? (
          <pre>
            {formatDictionarySqlForDisplay(validation.sql)}
            {validationError ? `\n\n数据库报错：${validationError}` : ""}
          </pre>
        ) : (
          <p>
            {validationBusy ? "正在通过后端生成并验证数据库可执行 SQL。" : caliber.conversion.status === "invalid" ? caliber.conversion.reason || "当前口径还不能通过标准规则稳定转换出 SQL。" : "请先验证 SQL，系统会以数据库可执行 SQL 为准。"}
            {validationError ? `；数据库报错：${validationError}` : ""}
          </p>
        )}
      </section>
    </div>
  );
}

type DictionaryTempTableDraft = ProjectDictionaryMappingTempTableInput & {
  fields: ProjectDictionaryMappingTempFieldInput[];
};

export function DictionaryTempTablePanel({
  projectId,
  table,
  tempTables,
  onSaved,
}: {
  projectId: string;
  table?: ProjectDictionaryTable;
  tempTables: ProjectDictionaryMappingTempTable[];
  onSaved: (tempTables: ProjectDictionaryMappingTempTable[]) => void;
}) {
  const [drafts, setDrafts] = useState<DictionaryTempTableDraft[]>(() => dictionaryTempTablesToDrafts(tempTables));
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    setDrafts(dictionaryTempTablesToDrafts(tempTables));
    setStatus("");
  }, [table?.id, tempTables]);

  const patchTable = (tableIndex: number, patch: Partial<DictionaryTempTableDraft>) => {
    setDrafts(current => current.map((item, index) => index === tableIndex ? { ...item, ...patch } : item));
  };
  const patchField = (tableIndex: number, fieldIndex: number, patch: Partial<ProjectDictionaryMappingTempFieldInput>) => {
    setDrafts(current => current.map((item, index) => index === tableIndex
      ? { ...item, fields: item.fields.map((field, nextIndex) => nextIndex === fieldIndex ? { ...field, ...patch } : field) }
      : item));
  };
  const addTempTable = () => {
    setDrafts(current => [...current, createDictionaryTempTableDraft(current.length, table)]);
  };
  const removeTempTable = (tableIndex: number) => {
    setDrafts(current => current.filter((_, index) => index !== tableIndex));
  };
  const addTempField = (tableIndex: number) => {
    setDrafts(current => current.map((item, index) => index === tableIndex
      ? { ...item, fields: [...item.fields, createDictionaryTempFieldDraft(item.fields.length)] }
      : item));
  };
  const removeTempField = (tableIndex: number, fieldIndex: number) => {
    setDrafts(current => current.map((item, index) => index === tableIndex
      ? { ...item, fields: item.fields.filter((_, nextIndex) => nextIndex !== fieldIndex) }
      : item));
  };
  const saveTempTables = async () => {
    if (!table?.id) return;
    const normalized = normalizeDictionaryTempTableDrafts(drafts);
    const firstMissingTable = normalized.find(item => !item.tableName.trim());
    const firstMissingField = normalized.flatMap(item => item.fields ?? []).find(field => !field.fieldName.trim());
    if (firstMissingTable) {
      setStatus("临时表英文名不能为空。");
      return;
    }
    if (firstMissingField) {
      setStatus("临时字段英文名不能为空。");
      return;
    }
    setBusy(true);
    setStatus("");
    try {
      const saved = await api.replaceProjectDictionaryMappingTempTables(projectId, table.id, normalized);
      onSaved(saved);
      setStatus(`已保存 ${saved.length} 张临时表。`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  if (!table) {
    return <div className="prj-pm-dict-temp__empty">请选择一张表后维护临时表。</div>;
  }

  return (
    <div className="prj-pm-dict-temp">
      <header className="prj-pm-dict-temp__toolbar">
        <div>
          <strong>临时表</strong>
          <span>仅供 {table.tableCn || table.tableName} 的 Mapping 使用</span>
        </div>
        <div>
          <button type="button" onClick={addTempTable}>新增临时表</button>
          <button type="button" className="is-primary" onClick={saveTempTables} disabled={busy}>
            {busy ? "保存中" : "保存临时表"}
          </button>
        </div>
      </header>
      {status && <p className={`prj-pm-dict-temp__status${/失败|错误|不能为空|failed|error/i.test(status) ? " is-error" : ""}`}>{status}</p>}
      {drafts.length === 0 ? (
        <div className="prj-pm-dict-temp__empty">当前表暂未配置临时表。复杂 Mapping 需要中间结果时，可以先新增一张临时表。</div>
      ) : (
        drafts.map((draft, tableIndex) => (
          <section className="prj-pm-dict-temp__card" key={draft.id || `temp-table-${tableIndex}`}>
            <div className="prj-pm-dict-temp__card-head">
              <strong>{ensureDictionaryTempTableLabel(draft.tableCn || draft.tableName || `临时表${tableIndex + 1}`)}</strong>
              <button type="button" onClick={() => removeTempTable(tableIndex)}>删除临时表</button>
            </div>
            <div className="prj-pm-dict-temp__form">
              <label>
                <span>英文名</span>
                <input value={draft.tableName} onChange={event => patchTable(tableIndex, { tableName: event.target.value })} placeholder="tmp_transaction_base" />
              </label>
              <label>
                <span>中文名</span>
                <input value={draft.tableCn ?? ""} onChange={event => patchTable(tableIndex, { tableCn: event.target.value })} placeholder="[临时表]交易基础数据" />
              </label>
              <label>
                <span>逻辑</span>
                <textarea value={draft.logicText ?? ""} onChange={event => patchTable(tableIndex, { logicText: event.target.value })} placeholder='{"op":"full_extract","from":"TRN2.TXT"}' />
              </label>
              <label>
                <span>SQL转换</span>
                <textarea value={draft.convertedSql ?? ""} onChange={event => patchTable(tableIndex, { convertedSql: event.target.value })} placeholder="FROM TRN2.TXT" />
              </label>
              <label className="is-wide">
                <span>备注</span>
                <textarea value={draft.remark ?? ""} onChange={event => patchTable(tableIndex, { remark: event.target.value })} placeholder="说明这张临时表的用途、来源和使用边界" />
              </label>
            </div>
            <div className="prj-pm-dict-temp__field-toolbar">
              <strong>临时字段</strong>
              <button type="button" onClick={() => addTempField(tableIndex)}>新增字段</button>
            </div>
            <div className="prj-pm-dict-temp__field-table">
              <div className="prj-pm-dict-temp__field-head">
                <span>英文名</span>
                <span>中文名</span>
                <span>类型</span>
                <span>长度</span>
                <span>逻辑</span>
                <span>SQL</span>
                <span>备注</span>
                <span />
              </div>
              {draft.fields.length === 0 ? (
                <p>暂无字段。</p>
              ) : draft.fields.map((field, fieldIndex) => (
                <div className="prj-pm-dict-temp__field-row" key={field.id || `temp-field-${fieldIndex}`}>
                  <input value={field.fieldName} onChange={event => patchField(tableIndex, fieldIndex, { fieldName: event.target.value })} placeholder="field_name" />
                  <input value={field.fieldCn ?? ""} onChange={event => patchField(tableIndex, fieldIndex, { fieldCn: event.target.value })} placeholder="字段中文名" />
                  <input value={field.fieldType ?? ""} onChange={event => patchField(tableIndex, fieldIndex, { fieldType: event.target.value })} placeholder="varchar" />
                  <input value={field.fieldLength ?? ""} onChange={event => patchField(tableIndex, fieldIndex, { fieldLength: event.target.value })} placeholder="100" />
                  <textarea value={field.logicText ?? ""} onChange={event => patchField(tableIndex, fieldIndex, { logicText: event.target.value })} placeholder='{"op":"direct","source":"TRN2.TXT.reference_number"}' />
                  <textarea value={field.convertedSql ?? ""} onChange={event => patchField(tableIndex, fieldIndex, { convertedSql: event.target.value })} placeholder="TRN2.TXT.reference_number AS fieldName" />
                  <textarea value={field.remark ?? ""} onChange={event => patchField(tableIndex, fieldIndex, { remark: event.target.value })} placeholder="备注" />
                  <button type="button" onClick={() => removeTempField(tableIndex, fieldIndex)}>删除</button>
                </div>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

function getDictionaryCaliberLogicSummary(rule: DictionaryCaliberJsonRule): string {
  const from = dictionaryCaliberTableName(rule.from);
  const isFullExtract = rule.op === "full_extract" || rule.op === "全表抽取";
  if (isFullExtract && from) return `全表抽取 ${from}`;
  const parts = [
    from ? `从 ${from} 抽取` : "",
    rule.joins?.length ? `关联 ${rule.joins.length} 张表` : "",
    rule.where ? "按条件过滤" : "",
    rule.group_by?.length ? "分组汇总" : "",
    rule.order_by?.length ? "排序" : "",
    rule.limit ? `限制 ${rule.limit} 行` : "",
  ].filter(Boolean);
  return parts.join(" / ");
}

export function DictionaryPropertyViewer({
  payload,
  onClose,
  onOpenFieldRef,
  onOpenTableRef,
}: {
  payload: DictionaryPropertyPayload | null;
  onClose: () => void;
  onOpenFieldRef: (field: ProjectDictionaryFieldHit) => void;
  onOpenTableRef: (tableId: string) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [size, setSize] = useState(() => {
    try {
      const saved = window.localStorage.getItem("rich-dictionary-property-viewer-size");
      if (saved) {
        const parsed = JSON.parse(saved) as { width?: number; height?: number };
        return {
          width: clampNumber(parsed.width ?? 520, 360, 920),
          height: clampNumber(parsed.height ?? 360, 190, 720),
        };
      }
    } catch {
      // Non-critical preference; fall through to default.
    }
    return { width: 520, height: 360 };
  });

  const rememberSize = () => {
    const node = ref.current;
    if (!node || collapsed) return;
    const next = {
      width: clampNumber(Math.round(node.offsetWidth), 360, 920),
      height: clampNumber(Math.round(node.offsetHeight), 190, 720),
    };
    setSize(next);
    try {
      window.localStorage.setItem("rich-dictionary-property-viewer-size", JSON.stringify(next));
    } catch {
      // Size memory can safely fail in restricted storage modes.
    }
  };

  const startResize = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (collapsed) return;
    event.preventDefault();
    const startX = event.clientX;
    const startY = event.clientY;
    const startWidth = size.width;
    const startHeight = size.height;

    const onMove = (moveEvent: PointerEvent) => {
      const next = {
        width: clampNumber(startWidth + startX - moveEvent.clientX, 360, 920),
        height: clampNumber(startHeight + startY - moveEvent.clientY, 190, 720),
      };
      setSize(next);
    };

    const onUp = (upEvent: PointerEvent) => {
      const next = {
        width: clampNumber(startWidth + startX - upEvent.clientX, 360, 920),
        height: clampNumber(startHeight + startY - upEvent.clientY, 190, 720),
      };
      setSize(next);
      try {
        window.localStorage.setItem("rich-dictionary-property-viewer-size", JSON.stringify(next));
      } catch {
        // Size memory can safely fail in restricted storage modes.
      }
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  if (!payload) return null;

  const subject = getDictionaryPropertySubject(payload);

  return (
    <aside
      ref={ref}
      className={`prj-pm-dict-property-viewer${collapsed ? " is-collapsed" : ""}`}
      style={collapsed ? undefined : { width: size.width, height: size.height }}
      onPointerUp={rememberSize}>
      {!collapsed && (
        <button
          type="button"
          className="prj-pm-dict-property-viewer__resize"
          aria-label="调整悬浮框大小"
          title="拖拽调整大小"
          onPointerDown={startResize}
        />
      )}
      <header className="prj-pm-dict-property-viewer__header">
        <div className="prj-pm-dict-property-viewer__identity">
          <div className="prj-pm-dict-property-viewer__title-line">
            <strong>{subject}</strong>
            {payload.field && (
              <div className="prj-pm-dict-property-viewer__meta" aria-label="字段属性">
                {payload.field.fieldType && <em className="is-type">{payload.field.fieldType}</em>}
                {payload.field.fieldLength && <em className="is-length">长度 {payload.field.fieldLength}</em>}
                {payload.field.formatPattern && <em className="is-format">格式 {payload.field.formatPattern}</em>}
              </div>
            )}
          </div>
          <span>{payload.title}</span>
        </div>
        <div className="prj-pm-dict-property-viewer__actions">
          <button type="button" onClick={() => setCollapsed(value => !value)}>
            {collapsed ? "展开" : "收起"}
          </button>
          <button type="button" onClick={onClose}>关闭</button>
        </div>
      </header>
      {!collapsed && (
        <div className="prj-pm-dict-property-viewer__body">
          <DictionaryPropertyContent payload={payload} onOpenFieldRef={onOpenFieldRef} onOpenTableRef={onOpenTableRef} />
        </div>
      )}
    </aside>
  );
}

function getDictionaryPropertySubject(payload: DictionaryPropertyPayload) {
  if (payload.field) {
    return [payload.field.fieldName, payload.field.fieldCn].filter(Boolean).join(" · ");
  }
  if (payload.table) {
    return [payload.table.tableName, payload.table.tableCn].filter(Boolean).join(" · ");
  }
  if (payload.system) {
    return [payload.system.code, payload.system.name].filter(Boolean).join(" · ");
  }
  return payload.subtitle || payload.title;
}

function DictionaryPropertyContent({
  payload,
  onOpenFieldRef,
  onOpenTableRef,
}: {
  payload: DictionaryPropertyPayload;
  onOpenFieldRef: (field: ProjectDictionaryFieldHit) => void;
  onOpenTableRef: (tableId: string) => void;
}) {
  if (payload.kind === "fieldDetail" && payload.field) {
    return <DictionaryFieldPropertyContent field={payload.field} />;
  }

  if (payload.kind === "tableDetail" && payload.table) {
    return <DictionaryTablePropertyContent table={payload.table} />;
  }

  if (payload.kind === "systemDetail" && payload.system) {
    return <DictionarySystemPropertyContent system={payload.system} />;
  }

  if (payload.kind === "codeValue") {
    const rows = parseCodeValueRows(payload.value);
    if (rows.length > 0) {
      return (
        <table className="prj-pm-dict-code-table">
          <thead>
            <tr>
              <th>值</th>
              <th>说明</th>
              <th>备注</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${row.value}-${index}`}>
                <td>{row.value}</td>
                <td>{row.description}</td>
                <td>{row.remark || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }
  }

  if (payload.kind === "sourceRefs") {
    const refs: DictionarySourceRef[] = payload.refs?.length
      ? payload.refs
      : payload.value.split(/\n+/).filter(Boolean).map(label => ({ label }));
    return <DictionarySourceRefsTable refs={refs} onOpenFieldRef={onOpenFieldRef} />;
  }

  if (payload.kind === "mappingLogic") {
    return (
      <div className="prj-pm-dict-property-viewer__logic">
        {payload.refs?.length ? <DictionarySourceRefsTable refs={payload.refs} onOpenFieldRef={onOpenFieldRef} /> : null}
        <pre>{renderDictionaryLogicWithRefs(payload.value || "-", payload.refs ?? [], onOpenFieldRef)}</pre>
        {payload.sqlConversion ? (
          <section className={`prj-pm-dict-field-popover__section is-sql is-${payload.sqlValidation?.status === "invalid" ? "invalid" : payload.sqlConversion.status}`}>
            <header>
              <strong>SQL转换</strong>
              <span>{payload.sqlValidationBusy && !payload.sqlValidation ? "验证中" : payload.sqlValidation?.status === "invalid" ? "数据库验证失败" : payload.sqlValidation?.sql ? "完成" : payload.sqlConversion.status === "invalid" ? "规则不标准" : "待验证"}</span>
            </header>
            {payload.sqlValidation?.sql ? (
              <pre>
                {formatDictionarySqlForDisplay(payload.sqlValidation.sql)}
                {payload.sqlValidation?.status === "invalid" && payload.sqlValidation.error ? `\n\n数据库报错：${payload.sqlValidation.error}` : ""}
              </pre>
            ) : (
              <p>
                {payload.sqlValidationBusy ? "正在通过后端生成并验证数据库可执行 SQL。" : payload.sqlConversion.reason || "请先验证 SQL，系统会以数据库可执行 SQL 为准。"}
                {payload.sqlValidation?.status === "invalid" && payload.sqlValidation.error ? `；数据库报错：${payload.sqlValidation.error}` : ""}
              </p>
            )}
          </section>
        ) : null}
        {payload.remark?.trim() ? (
          <section className="prj-pm-dict-field-popover__section is-remark">
            <header>
              <strong>备注</strong>
              <span>{payload.subtitle || payload.title}</span>
            </header>
            <p>{payload.remark}</p>
          </section>
        ) : null}
      </div>
    );
  }

  if (payload.kind === "mappingCaliber") {
    const caliber = buildDictionaryCaliberView(
      payload.value,
      buildDictionaryFieldRefIndex((payload.refs ?? []).map(ref => ref.field).filter((field): field is ProjectDictionaryFieldHit => Boolean(field))),
    );
    const detail: DictionaryCaliberView = {
      ...caliber,
      fieldRefs: payload.refs ?? caliber.fieldRefs,
      tableRefs: payload.tableRefs ?? caliber.tableRefs,
      conversion: payload.sqlConversion ?? caliber.conversion,
    };
    return (
      <div className="prj-pm-dict-property-viewer__logic">
        <DictionaryCaliberDetail
          caliber={detail}
          validation={payload.sqlValidation as ProjectDictionaryMappingSqlValidationResult["caliber"] | undefined}
          validationBusy={payload.sqlValidationBusy}
          rawText={payload.value}
          onOpenFieldRef={onOpenFieldRef}
          onOpenTableRef={onOpenTableRef}
        />
      </div>
    );
  }

  return <div className="prj-pm-dict-property-viewer__text">{payload.value || "-"}</div>;
}

function DictionarySourceRefsTable({
  refs,
  onOpenFieldRef,
}: {
  refs: DictionarySourceRef[];
  onOpenFieldRef: (field: ProjectDictionaryFieldHit) => void;
}) {
  if (refs.length === 0) {
    return <em className="prj-pm-dict-property-viewer__empty">暂无涉及字段</em>;
  }
  return (
    <table className="prj-pm-dict-source-ref-table">
      <thead>
        <tr>
          <th>英文库.表.字段</th>
          <th>中文说明</th>
        </tr>
      </thead>
      <tbody>
        {refs.map((ref, index) => (
          <tr key={`${ref.label}-${index}`}>
            <td>
              <DictionarySourceRefTag refItem={ref} onOpenFieldRef={onOpenFieldRef}>
                {getDictionarySourceRefEnglish(ref)}
              </DictionarySourceRefTag>
            </td>
            <td>{getDictionarySourceRefChinese(ref)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}


function DictionarySqlConversionBadge({
  conversion,
  validation,
  validationBusy,
  sourceKind,
}: {
  conversion: DictionarySqlConversion;
  validation?: ProjectDictionaryMappingSqlValidationResult["fields"][number];
  validationBusy?: boolean;
  sourceKind?: ProjectDictionaryMappingSqlValidationResult["sourceKind"];
}) {
  const validationError = validation?.status === "invalid" ? validation.error : "";
  if (sourceKind === "file") {
    if (validationBusy) return <span className="prj-pm-dict-sql-conversion is-blocked">正在验证上传文件与字段映射</span>;
    return <span className={`prj-pm-dict-sql-conversion ${validationError ? "is-invalid" : validation?.status === "valid" ? "is-complete" : "is-blocked"}`}>
      {validationError ? `文件映射错误：${validationError}` : validation?.status === "valid" ? "文件映射已验证" : "待验证文件"}
    </span>;
  }
  if (validation?.sql) {
    return (
      <code className={`prj-pm-dict-sql-conversion ${validationError ? "is-invalid" : "is-complete"}`}>
        {formatDictionarySqlForDisplay(validation.sql)}
        {validationError ? `\n\n数据库报错：${validationError}` : ""}
      </code>
    );
  }
  if (validationBusy) {
    return <span className="prj-pm-dict-sql-conversion is-blocked">正在通过后端生成并验证数据库可执行 SQL</span>;
  }
  return (
    <span className={`prj-pm-dict-sql-conversion ${validationError || conversion.status === "invalid" ? "is-invalid" : "is-blocked"}`}>
      {validationError ? `${conversion.reason || "无法转换"}；数据库报错：${validationError}` : conversion.status === "invalid" ? conversion.reason || "规则不标准" : "待验证SQL"}
    </span>
  );
}


function buildDictionaryCaliberView(
  caliberText: string,
  fieldRefIndex: Map<string, ProjectDictionaryFieldHit>,
  tableRefIndex: Map<string, ProjectDictionaryTable> = new Map(),
  dialect: DictionarySqlDialect = "postgresql",
): DictionaryCaliberView {
  const parsed = parseDictionaryCaliberJsonRuleStrict(caliberText);
  if (!parsed.rule) {
    return {
      conversion: parsed.error
        ? { status: "invalid", reason: `规则不标准：${parsed.error}` }
        : { status: "invalid", reason: "规则不标准：口径必须填写标准 JSON" },
      fieldRefs: [],
      tableRefs: [],
    };
  }
  const fieldRefs = bindDictionarySourceRefs(extractDictionaryCaliberSourceRefs(parsed.rule), fieldRefIndex);
  const tableRefs = bindDictionaryTableRefs(extractDictionaryCaliberTableRefs(parsed.rule), tableRefIndex);
  const sql = buildDictionaryCaliberSql(parsed.rule, fieldRefs, dialect);
  return {
    conversion: sql ? { status: "complete", sql } : { status: "blocked", reason: "JSON口径无法转换：缺少 FROM 或条件不完整" },
    fieldRefs,
    tableRefs,
    rule: parsed.rule,
  };
}


function DictionaryFieldPropertyContent({ field }: { field: ProjectDictionaryFieldHit }) {
  const codeRows = getDictionaryCodeItems(field);
  return (
    <div className="prj-pm-dict-field-popover">
      <section className="prj-pm-dict-field-popover__section is-description">
        <header>
          <strong>字段说明</strong>
          <span>{field.tableCn || field.tableName || "字段元"}</span>
        </header>
        <p>{dictionaryFieldDescription(field) || "暂无字段说明。"}</p>
      </section>

      {codeRows.length > 0 ? (
        <section className="prj-pm-dict-field-popover__section is-code">
          <header>
            <strong>{field.codeSetName || "码值说明"}</strong>
            <span>{field.fieldName}</span>
          </header>
          <table className="prj-pm-dict-code-table">
            <thead>
              <tr>
                <th>值</th>
                <th>说明</th>
                <th>备注</th>
              </tr>
            </thead>
            <tbody>
              {codeRows.map((row, index) => (
                <tr key={`${row.value}-${index}`}>
                  <td>{row.value}</td>
                  <td>{row.description}</td>
                  <td>{row.remark || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      {field.remark?.trim() ? (
        <section className="prj-pm-dict-field-popover__section is-remark">
          <header>
            <strong>备注</strong>
            <span>{field.fieldName}</span>
          </header>
          <p>{field.remark}</p>
        </section>
      ) : null}
    </div>
  );
}

function DictionaryTablePropertyContent({ table }: { table: ProjectDictionaryTable }) {
  return (
    <div className="prj-pm-dict-field-popover">
      <section className="prj-pm-dict-field-popover__section is-description">
        <header>
          <strong>表信息</strong>
          <span>{table.tableName}</span>
        </header>
        <div className="prj-pm-dict-table-detail-grid">
          <span>中文名</span><strong>{table.tableCn || "-"}</strong>
          <span>英文名</span><code>{table.tableName}</code>
          <span>分组</span><strong>{table.tableGroup || "未分组"}</strong>
          <span>数据层级</span><strong>{table.dataLayer || "源表层"}</strong>
          <span>载体类型</span><strong>{table.sourceKind || "数据库"}</strong>
          <span>文件类型</span><strong>{table.fileType || "-"}</strong>
          <span>是否使用</span><strong>{table.usageStatus || "待确认"}</strong>
          <span>字段数</span><strong>{table.fieldCount}</strong>
        </div>
      </section>
      <DictionaryFileSourceBlock table={table} />
      <DictionaryStageSourceLinkBlock table={table} />
      {table.description?.trim() ? (
        <section className="prj-pm-dict-field-popover__section is-code">
          <header>
            <strong>表说明</strong>
            <span>{table.tableCn || table.tableName}</span>
          </header>
          <p>{table.description}</p>
        </section>
      ) : null}
      {table.caliber?.trim() ? (
        <section className="prj-pm-dict-field-popover__section is-remark">
          <header>
            <strong>表口径</strong>
            <span>{table.tableCn || table.tableName}</span>
          </header>
          <p>{table.caliber}</p>
        </section>
      ) : null}
    </div>
  );
}

function DictionarySystemPropertyContent({ system }: { system: ProjectDictionarySystem }) {
  return (
    <div className="prj-pm-dict-field-popover">
      <section className="prj-pm-dict-field-popover__section is-description">
        <header>
          <strong>库信息</strong>
          <span>{system.code}</span>
        </header>
        <div className="prj-pm-dict-table-detail-grid">
          <span>库编码</span><code>{system.code}</code>
          <span>库名称</span><strong>{system.name || "-"}</strong>
          <span>系统类型</span><strong>{system.type || "source system"}</strong>
          <span>资产层级</span><strong>{system.assetLayer || "mapping layer"}</strong>
          <span>表数量</span><strong>{system.tableCount}</strong>
          <span>字段数量</span><strong>{system.fieldCount}</strong>
        </div>
      </section>
    </div>
  );
}

export function DictionaryRelationsPanel({ fields }: { fields: ProjectDictionaryFieldHit[] }) {
  const rows = fields
    .filter(field => field.mappedTable || field.mappedField)
    .map(field => ({
      id: field.id,
      target: [field.tableName, field.fieldName].filter(Boolean).join("."),
      source: [field.mappedTable, field.mappedField].filter(Boolean).join("."),
      name: field.fieldCn || field.fieldName,
    }));
  return (
    <div className="prj-pm-dict-subview">
      <section className="prj-pm-dict-subview-card is-wide">
        <strong>Mapping 关联关系</strong>
        <div className="prj-pm-dict-relation-list">
          {rows.length ? rows.map(row => (
            <article key={row.id}>
              <span>{row.source || "未维护来源"}</span>
              <em>→</em>
              <b>{row.target}</b>
              <small>{row.name}</small>
            </article>
          )) : <p>暂无可展示的 Mapping 关联关系。</p>}
        </div>
      </section>
    </div>
  );
}

type DictionaryImportedTestData = {
  sourceFilePath?: string;
  sourceFileName?: string;
  encoding?: string;
  delimiter?: string;
  recordCount?: number;
  sampleCount?: number;
  expectedFieldCount?: number;
  columnCounts?: Record<string, number>;
  columnCountIssues?: Array<{ columnCount?: number; recordCount?: number; note?: string }>;
  rows?: Array<{ lineNumber?: number; values?: Record<string, unknown>; rawColumns?: unknown[]; extraColumns?: unknown[] }>;
};


export function DictionaryTableInfoPanel({ table, fields }: { table?: ProjectDictionaryTable; fields: ProjectDictionaryFieldHit[] }) {
  if (!table) {
    return <div className="prj-pm-dict__grid-empty">请选择左侧表后查看表说明。</div>;
  }
  const typeStats = Array.from(fields.reduce((map, field) => {
    const type = field.fieldType || "未维护";
    map.set(type, (map.get(type) ?? 0) + 1);
    return map;
  }, new Map<string, number>())).sort((a, b) => b[1] - a[1]);

  return (
    <div className="prj-pm-dict-table-info">
      <section className="prj-pm-dict-table-info__hero">
        <span>Table Meta</span>
        <h3>{table.tableCn || table.tableName}</h3>
        <p>{table.tableName}</p>
      </section>

      <section className="prj-pm-dict-table-info__grid">
        <article>
          <span>分组</span>
          <strong>{table.tableGroup || "未分组"}</strong>
        </article>
        <article>
          <span>数据层级</span>
          <strong>{table.dataLayer || "源表层"}</strong>
        </article>
        <article>
          <span>载体类型</span>
          <strong>{table.sourceKind || "数据库"}</strong>
        </article>
        <article>
          <span>文件类型</span>
          <strong>{table.fileType || "-"}</strong>
        </article>
        <article>
          <span>是否使用</span>
          <strong>{table.usageStatus || "待确认"}</strong>
        </article>
        <article>
          <span>字段数量</span>
          <strong>{table.fieldCount || fields.length}</strong>
        </article>
      </section>

      <section className="prj-pm-dict-table-info__section">
        <header>
          <strong>表说明</strong>
          <span>{table.tableName}</span>
        </header>
        <p>{table.description || "暂无表说明。"}</p>
      </section>

      <section className="prj-pm-dict-table-info__section is-caliber">
        <header>
          <strong>表口径</strong>
          <span>{table.tableCn || table.tableName}</span>
        </header>
        <p>{table.caliber || "暂无表口径。"}</p>
      </section>

      <DictionaryFileSourceBlock table={table} />
      <DictionaryStageSourceLinkBlock table={table} />

      <section className="prj-pm-dict-table-info__section">
        <header>
          <strong>字段类型摘要</strong>
          <span>{typeStats.length} 类</span>
        </header>
        <div className="prj-pm-dict-table-info__chips">
          {typeStats.length ? typeStats.map(([type, count]) => (
            <span key={type}><em>{type}</em><strong>{count}</strong></span>
          )) : <p>暂无字段类型信息。</p>}
        </div>
      </section>
    </div>
  );
}

function DictionaryFieldInspector({ field }: { field: ProjectDictionaryFieldDetail | null }) {
  if (!field) {
    return (
      <>
        <header><strong>字段详情</strong></header>
        <div className="prj-pm-empty">点击搜索结果后，这里展示字段口径、码值、校验规则和 Mapping 加工逻辑。</div>
      </>
    );
  }

  const mapping = [field.mappedTable, field.mappedField, field.mappedFieldCn].filter(Boolean).join(" / ");
  return (
    <div className="prj-pm-dict-detail">
      <header>
        <strong>{field.fieldCn || field.fieldName}</strong>
        <code>{field.fieldName}</code>
      </header>
      <div className="prj-pm-dict-detail__meta">
        {field.fieldType && <span>{field.fieldType}</span>}
        {field.fieldLength && <span>长度 {field.fieldLength}</span>}
        {field.formatPattern && <span>格式 {field.formatPattern}</span>}
        {field.tableDataLayer && <span>{field.tableDataLayer}</span>}
        {field.tableSourceKind && <span>{field.tableSourceKind}</span>}
        {field.primaryKey && <span>主键</span>}
        {field.required && <span>必填</span>}
        {field.nullable && <span>可空 {field.nullable}</span>}
      </div>
      <DictionaryDetailBlock title="所属位置" value={[field.systemName, field.tableCn || field.tableName].filter(Boolean).join(" / ")} />
      <DictionaryDetailBlock title="字段说明" value={field.description} />
      <DictionaryDetailBlock title="格式要求" value={field.formatPattern} />
      <DictionaryDetailBlock title="表口径" value={field.tableCaliber || field.tableDescription} />
      <DictionaryDetailBlock title="取数与加工逻辑" value={field.acquireLogic} important />
      <DictionaryDetailBlock title="映射目标" value={mapping} />
      <DictionaryDetailBlock title="校验规则" value={field.validationRule} />
      <DictionaryCodeValueBlock field={field} />
      <DictionaryDetailBlock title="数据来源" value={field.dataSource} />
      <DictionaryDetailBlock title="备注" value={field.remark} />
    </div>
  );
}

function DictionaryCodeValueBlock({ field }: { field: ProjectDictionaryFieldHit }) {
  const rows = getDictionaryCodeItems(field);
  if (rows.length === 0) {
    return <DictionaryDetailBlock title="码值说明" value={field.codeValue} />;
  }
  return (
    <section className="prj-pm-dict-detail__block is-important">
      <strong>{field.codeSetName || "码值说明"}</strong>
      <table className="prj-pm-dict-code-table">
        <thead>
          <tr>
            <th>值</th>
            <th>说明</th>
            <th>备注</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row.value}-${index}`}>
              <td>{row.value}</td>
              <td>{row.description}</td>
              <td>{row.remark || "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function compactText(value?: string): string {
  const text = value?.replace(/\s+/g, " ").trim();
  if (!text) return "-";
  return text.length > 120 ? `${text.slice(0, 120)}...` : text;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}

function formatCodeValueSummary(field: ProjectDictionaryFieldHit): string {
  const rows = getDictionaryCodeItems(field);
  if (rows.length > 0) return `${rows.length} 项码值`;
  return compactText(field.codeValue);
}

function getDictionaryCodeItems(field: ProjectDictionaryFieldHit): Array<{ value: string; description: string; remark?: string; sortOrder?: number }> {
  if (field.codeItems?.length) return field.codeItems;
  return parseCodeValueRows(field.codeValue ?? "");
}

function parseCodeValueRows(value: string): Array<{ value: string; description: string; remark?: string; sortOrder?: number }> {
  const lines = value
    .replace(/\r/g, "\n")
    .replace(/[；;]/g, "\n")
    .replace(/(?<!\d)[,，](?=\s*(?:[A-Za-z]?\d{1,8}[A-Za-z]?|[YN是否])\s*(?:[:：=、.．）)、\-\s]|=>|->|→))/g, "\n")
    .replace(/(?:^|\s)(?=([A-Za-z]?\d{1,8}[A-Za-z]?|[YN是否])\s*(?:[:：=、.．）)、]|=>|->|→)\s*)/g, "\n")
    .split(/\n+/)
    .map(line => line.trim())
    .filter(Boolean);
  const rows = lines
    .map((line, index) => {
      const compact = line.replace(/^[（(]\s*/, "").replace(/\s*[）)]$/, "").trim();
      const match = compact.match(/^([A-Za-z]?\d{1,8}[A-Za-z]?|[YN是否])\s*(?:[:：=、.．）)、]|=>|->|→|\s+|表示|代表|为)\s*(.+)$/);
      if (!match) return null;
      const description = match[2].replace(/^[-—:：=、.．）)、\s]+/, "").trim();
      if (!description) return null;
      return { value: match[1].trim(), description, sortOrder: index + 1 };
    })
    .filter((row): row is { value: string; description: string; sortOrder: number } => Boolean(row));
  const seen = new Set<string>();
  return rows.filter(row => {
    const key = `${row.value}\u0000${row.description}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

type DictionaryMappingScenario = {
  key: string;
  title: string;
  caliber: string;
  rules: DictionaryMappingRule[];
};

function buildDictionaryMappingScenarios(
  table: ProjectDictionaryTable | undefined,
  fields: ProjectDictionaryFieldHit[],
  fieldRefIndex: Map<string, ProjectDictionaryFieldHit>,
): DictionaryMappingScenario[] {
  const groups = new Map<string, DictionaryMappingScenario>();
  fields.forEach(field => {
    if (!hasDictionaryMappingEvidence(field)) return;
    const pieces = splitMappingScenarioTexts(field.acquireLogic);
    pieces.forEach((piece, index) => {
      const title = extractMappingScenarioTitle(piece, index);
      const key = normalizeMappingScenarioKey(title);
      const current = groups.get(key) ?? {
        key,
        title,
        caliber: extractMappingCaliber(piece) || table?.caliber || table?.description || "当前场景暂未维护独立业务口径。",
        rules: [],
      };
      if (!groups.has(key)) groups.set(key, current);
      current.rules.push({
        field,
        logic: extractMappingRuleLogic(piece) || "按涉及字段直取或按规则生成目标字段。",
        convertedSql: extractMappingConvertedSql(piece),
        remark: extractMappingRemark(piece),
        sourceRefs: bindDictionarySourceRefs(extractMappingSourceRefs(field, piece), fieldRefIndex),
      });
    });
  });
  return Array.from(groups.values()).sort((a, b) => scenarioSortWeight(a.title) - scenarioSortWeight(b.title));
}

function dictionaryMappingSqlValidationFingerprint(scenario: DictionaryMappingScenario): string {
  return stableDictionaryJsonStringify({
    version: 6,
    caliber: scenario.caliber,
    rules: scenario.rules.map(rule => ({
      fieldId: rule.field.id,
      fieldName: rule.field.fieldName,
      logic: rule.logic,
    })),
  });
}

function dictionaryMappingRuleLogicFingerprint(logic: string): string {
  return logic.trim();
}

function dictionaryMappingRuleValidationKey(fieldId: string, logicFingerprint: string): string {
  return `${fieldId}\n${logicFingerprint}`;
}

function buildDictionaryMappingDisplayRemark(rule: DictionaryMappingRule): string {
  return appendDictionaryLogicJsonToRemark(rule.remark, rule.logic);
}

function buildDictionaryCaliberDisplayRemark(remark: string | undefined, caliberText: string): string {
  return appendDictionaryLogicJsonToRemark(remark, caliberText);
}

function appendDictionaryLogicJsonToRemark(remark: string | undefined, logicText: string): string {
  const logicJson = formatDictionaryLogicJsonForDisplay(logicText);
  return [remark?.trim(), logicJson ? `标准逻辑JSON：\n${logicJson}` : ""].filter(Boolean).join("\n\n");
}

function formatDictionaryLogicJsonForDisplay(logicText: string): string {
  const text = logicText.trim();
  if (!text.startsWith("{")) return "";
  try {
    return JSON.stringify(JSON.parse(text) as unknown, null, 2);
  } catch {
    return text;
  }
}

function stableDictionaryJsonStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(item => stableDictionaryJsonStringify(item)).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${stableDictionaryJsonStringify(record[key])}`).join(",")}}`;
}

export function collectDictionaryMappingRefLabels(table: ProjectDictionaryTable | undefined, fields: ProjectDictionaryFieldHit[]): string[] {
  const refs = new Set<string>();
  fields.forEach(field => {
    if (!hasDictionaryMappingEvidence(field)) return;
    splitMappingScenarioTexts(field.acquireLogic).forEach(piece => {
      extractMappingSourceRefs(
        {
          ...field,
          tableName: field.tableName || table?.tableName,
          tableCn: field.tableCn || table?.tableCn,
        },
        piece,
      ).forEach(ref => refs.add(ref));
    });
  });
  return Array.from(refs).slice(0, 300);
}

function hasDictionaryMappingEvidence(field: ProjectDictionaryFieldHit): boolean {
  return Boolean(field.acquireLogic?.trim() || field.mappedTable?.trim() || field.mappedField?.trim());
}

function splitMappingScenarioTexts(value?: string): string[] {
  const text = value?.trim();
  if (!text) return [""];
  const pieces = text.split(/(?=场景\s*\d+)/g).map(item => item.trim()).filter(Boolean);
  return pieces.length ? pieces : [text];
}

function extractMappingScenarioTitle(text: string, index: number): string {
  const firstLine = text.split(/\r?\n/).map(line => line.trim()).find(Boolean);
  const match = firstLine?.match(/^(场景\s*\d+)(?:[：:：\s-]*(.*))?$/);
  if (match) return [match[1].replace(/\s+/g, ""), match[2]].filter(Boolean).join(" ");
  return `场景${index + 1}`;
}

function normalizeMappingScenarioKey(title: string): string {
  return title.replace(/\s+/g, "").toLowerCase();
}

function scenarioSortWeight(title: string): number {
  const match = title.match(/场景\s*(\d+)/);
  return match ? Number(match[1]) : 9999;
}

function extractMappingCaliber(text: string): string {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const line = lines.find(item => /^(取数范围描述|业务口径|口径说明)[：:]/.test(item));
  return line?.replace(/^(取数范围描述|业务口径|口径说明)[：:]\s*/, "").trim() || "";
}

function extractMappingRuleLogic(text: string): string {
  const lines = text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);
  const explicitLogic = lines
    .filter(line => /^(逻辑|规则|逻辑\/规则|加工逻辑|取数逻辑|条件|结果)[：:]/.test(line))
    .map(line => line.replace(/^(逻辑|规则|逻辑\/规则|加工逻辑|取数逻辑|条件|结果)[：:]\s*/, ""))
    .join("\n");
  if (explicitLogic) return explicitLogic;
  const mappingExpr = extractMappingLineValue(text, "mapping");
  if (mappingExpr && isMappingExpression(mappingExpr)) return `结果：${mappingExpr}`;
  if (mappingExpr) return `直取：${mappingExpr}`;
  return lines
    .filter(line =>
      !/^场景\s*\d+/.test(line)
      && !/^(取数范围描述|业务口径|口径说明|数据表mapping|表别名|数据字段|备注)[：:]?/.test(line)
      && !/^mapping[：:]/i.test(line))
    .join("\n");
}

function extractMappingConvertedSql(text: string): string {
  return extractMappingLineValue(text, "SQL转换");
}

function extractMappingRemark(text: string): string {
  return extractMappingBlockValue(text, "备注");
}

function extractMappingSourceRefs(field: ProjectDictionaryFieldHit, logicText: string): string[] {
  const refs = new Set<string>();
  const tableName = extractMappingLineValue(logicText, "数据表mapping") || field.mappedTable || field.tableName;
  extractDictionaryJsonSourceRefs(logicText).forEach(ref => {
    if (isMeaningfulDictionarySourceRef(ref)) refs.add(ref);
  });
  for (const match of logicText.matchAll(/\{([^}]+)\}/g)) {
    const normalized = normalizeSourceFieldToken(match[1]);
    if (isMeaningfulDictionarySourceRef(normalized)) refs.add(normalized);
  }
  const sourceFieldText = [extractMappingLineValue(logicText, "mapping"), field.mappedField].filter(Boolean).join("、");
  extractFieldRefsFromExpression(sourceFieldText).forEach(ref => {
    if (isMeaningfulDictionarySourceRef(ref)) refs.add(ref);
  });
  splitMappingTokens(sourceFieldText).forEach(token => {
    const normalized = normalizeSourceFieldToken(token);
    if (!isMeaningfulDictionarySourceRef(normalized)) return;
    const ref = normalized.includes(".") ? normalized : [tableName, normalized].filter(Boolean).join(".");
    if (isMeaningfulDictionarySourceRef(ref)) refs.add(ref);
  });
  return Array.from(refs).slice(0, 8);
}

function extractDictionaryJsonSourceRefs(logicText: string): string[] {
  const rule = parseDictionaryJsonRule(logicText);
  if (!rule) return [];
  const refs = new Set<string>();
  const visit = (value: unknown, key = "") => {
    if (value === null || value === undefined) return;
    if (typeof value === "string") {
      if (key === "source" || key === "sources" || key === "group_by" || key === "order_by") {
        const normalized = normalizeSourceFieldToken(value);
        if (normalized) refs.add(normalized);
      }
      for (const match of value.matchAll(/\{([^}]+)\}/g)) {
        const normalized = normalizeSourceFieldToken(match[1]);
        if (normalized) refs.add(normalized);
      }
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(item => visit(item, key));
      return;
    }
    if (typeof value === "object") {
      Object.entries(value as Record<string, unknown>).forEach(([nextKey, nextValue]) => visit(nextValue, nextKey));
    }
  };
  visit(rule);
  return Array.from(refs);
}

function extractDictionaryCaliberSourceRefs(rule: DictionaryCaliberJsonRule): string[] {
  const refs = new Set<string>();
  const visit = (value: unknown, key = "") => {
    if (value === null || value === undefined) return;
    if (typeof value === "string") {
      if (key === "source") {
        const normalized = normalizeSourceFieldToken(value);
        if (normalized) refs.add(normalized);
      }
      for (const match of value.matchAll(/\{([^}]+)\}/g)) {
        const normalized = normalizeSourceFieldToken(match[1]);
        if (normalized) refs.add(normalized);
      }
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(item => visit(item, key));
      return;
    }
    if (typeof value === "object") {
      Object.entries(value as Record<string, unknown>).forEach(([nextKey, nextValue]) => visit(nextValue, nextKey));
    }
  };
  visit(rule);
  return Array.from(refs);
}

function extractDictionaryCaliberTableRefs(rule: DictionaryCaliberJsonRule): string[] {
  const refs = new Set<string>();
  const from = dictionaryCaliberTableName(rule.from);
  if (from) refs.add(from);
  (rule.joins ?? []).forEach(join => {
    const table = dictionaryCaliberTableName(join.table);
    if (table) refs.add(table);
  });
  return Array.from(refs);
}

function bindDictionaryTableRefs(refs: string[], tableRefIndex: Map<string, ProjectDictionaryTable>): DictionaryTableRef[] {
  return refs.map(label => {
    const table = findDictionaryTableByRef(label, tableRefIndex);
    return table ? { label, table } : { label };
  });
}

function findDictionaryTableByRef(label: string, tableRefIndex: Map<string, ProjectDictionaryTable>): ProjectDictionaryTable | undefined {
  const direct = tableRefIndex.get(normalizeDictionaryRefKey(label));
  if (direct) return direct;
  const tableName = label.split(/\s+/)[0] || label;
  const byTableName = tableRefIndex.get(normalizeDictionaryRefKey(tableName));
  if (byTableName) return byTableName;
  const parts = label.split(".").map(part => part.trim()).filter(Boolean);
  for (let start = 0; start < parts.length; start += 1) {
    const match = tableRefIndex.get(normalizeDictionaryRefKey(parts.slice(start).join(".")));
    if (match) return match;
  }
  return tableRefIndex.get(normalizeDictionaryRefKey(parts.at(-1) ?? ""));
}

function dictionaryTempTablesToDrafts(tempTables: ProjectDictionaryMappingTempTable[]): DictionaryTempTableDraft[] {
  return tempTables
    .slice()
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map(table => ({
      id: table.id,
      tableName: table.tableName,
      tableCn: table.tableCn,
      logicText: table.logicText,
      convertedSql: table.convertedSql,
      remark: table.remark,
      sortOrder: table.sortOrder,
      raw: table.raw,
      fields: table.fields
        .slice()
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
        .map(field => ({
          id: field.id,
          fieldName: field.fieldName,
          fieldCn: field.fieldCn,
          fieldType: field.fieldType,
          fieldLength: field.fieldLength,
          logicText: field.logicText,
          convertedSql: field.convertedSql,
          remark: field.remark,
          sortOrder: field.sortOrder,
          raw: field.raw,
        })),
    }));
}

function createDictionaryTempTableDraft(index: number, table?: ProjectDictionaryTable): DictionaryTempTableDraft {
  const baseName = table?.tableName ? `tmp_${table.tableName}` : "tmp_mapping";
  return {
    tableName: `${baseName}_${index + 1}`,
    tableCn: `[临时表]${table?.tableCn || table?.tableName || `临时表${index + 1}`}`,
    logicText: "",
    convertedSql: "",
    remark: "",
    sortOrder: index,
    raw: {},
    fields: [createDictionaryTempFieldDraft(0)],
  };
}

function createDictionaryTempFieldDraft(index: number): ProjectDictionaryMappingTempFieldInput {
  return {
    fieldName: `field_${index + 1}`,
    fieldCn: "",
    fieldType: "varchar",
    fieldLength: "100",
    logicText: "",
    convertedSql: "",
    remark: "",
    sortOrder: index,
    raw: {},
  };
}

function normalizeDictionaryTempTableDrafts(drafts: DictionaryTempTableDraft[]): ProjectDictionaryMappingTempTableInput[] {
  return drafts.map((draft, tableIndex) => ({
    id: draft.id,
    tableName: draft.tableName.trim(),
    tableCn: ensureDictionaryTempTableLabel((draft.tableCn || draft.tableName).trim()),
    logicText: draft.logicText?.trim() || null,
    convertedSql: draft.convertedSql?.trim() || null,
    remark: draft.remark?.trim() || null,
    sortOrder: tableIndex,
    raw: draft.raw ?? {},
    fields: draft.fields.map((field, fieldIndex) => ({
      id: field.id,
      fieldName: field.fieldName.trim(),
      fieldCn: field.fieldCn?.trim() || null,
      fieldType: field.fieldType?.trim() || null,
      fieldLength: field.fieldLength?.trim() || null,
      logicText: field.logicText?.trim() || null,
      convertedSql: field.convertedSql?.trim() || null,
      remark: field.remark?.trim() || null,
      sortOrder: fieldIndex,
      raw: field.raw ?? {},
    })),
  }));
}

function ensureDictionaryTempTableLabel(value: string): string {
  const text = value.trim();
  if (!text) return "[临时表]未命名临时表";
  return /^\s*[\[【]临时表[\]】]/.test(text) ? text : `[临时表]${text}`;
}

export function dictionaryTempTablesToFieldHits(
  system: ProjectDictionarySystem | undefined,
  targetTable: ProjectDictionaryTable | undefined,
  tempTables: ProjectDictionaryMappingTempTable[],
): ProjectDictionaryFieldHit[] {
  return tempTables.flatMap(tempTable => tempTable.fields.map((field, index) => ({
    id: field.id,
    systemId: system?.id,
    systemName: system?.name,
    systemCode: system?.code,
    tableId: targetTable?.id,
    tableName: tempTable.tableName,
    tableCn: ensureDictionaryTempTableLabel(tempTable.tableCn || tempTable.tableName),
    fieldName: field.fieldName,
    fieldCn: field.fieldCn,
    fieldType: field.fieldType,
    fieldLength: field.fieldLength,
    fieldOrder: field.sortOrder ?? index,
    description: field.logicText,
    acquireLogic: field.logicText,
    mappedTable: tempTable.tableName,
    mappedField: field.fieldName,
    remark: field.remark,
    extra: {
      ...(field.raw ?? {}),
      isTempTable: true,
      tempTableId: tempTable.id,
      tempTableName: tempTable.tableName,
      tempTableCn: tempTable.tableCn,
      targetTableId: targetTable?.id,
      targetTableName: targetTable?.tableName,
    },
    score: 0,
  })));
}

export function isDictionaryTempField(field?: ProjectDictionaryFieldHit): boolean {
  return Boolean(field?.extra?.isTempTable);
}

function buildDictionaryTableRefIndex(table: ProjectDictionaryTable | undefined, fields: ProjectDictionaryFieldHit[]): Map<string, ProjectDictionaryTable> {
  const index = new Map<string, ProjectDictionaryTable>();
  const addTable = (item: ProjectDictionaryTable | undefined, extraKeys: string[] = []) => {
    if (!item?.id) return;
    [item.tableName, item.tableCn, ...extraKeys].forEach(key => {
      const normalized = normalizeDictionaryRefKey(key);
      if (normalized && !index.has(normalized)) index.set(normalized, item);
    });
  };
  addTable(table);
  fields.forEach(field => {
    if (!field.tableId || !field.tableName) return;
    const item: ProjectDictionaryTable = {
      id: isDictionaryTempField(field) && typeof field.extra?.tempTableId === "string" ? field.extra.tempTableId : field.tableId,
      systemId: field.systemId,
      tableName: field.tableName,
      tableCn: field.tableCn || field.tableName,
      extra: isDictionaryTempField(field) ? {
        isTempTable: true,
        tempTableId: field.extra?.tempTableId,
        targetTableId: field.extra?.targetTableId,
      } : undefined,
      fieldCount: 0,
    };
    addTable(item, [
      [field.systemCode, field.tableName].filter(Boolean).join("."),
      [field.systemName, field.tableCn || field.tableName].filter(Boolean).join("."),
    ]);
  });
  return index;
}

function buildDictionaryFieldRefIndex(fields: ProjectDictionaryFieldHit[]): Map<string, ProjectDictionaryFieldHit> {
  const index = new Map<string, ProjectDictionaryFieldHit>();
  const fieldNameCounts = new Map<string, number>();
  fields.forEach(field => {
    const fieldKey = normalizeDictionaryRefKey(field.fieldName);
    if (fieldKey) fieldNameCounts.set(fieldKey, (fieldNameCounts.get(fieldKey) ?? 0) + 1);
  });

  fields.forEach(field => {
    const addKey = (key?: string) => {
      const normalized = normalizeDictionaryRefKey(key);
      if (normalized && !index.has(normalized)) index.set(normalized, field);
    };
    const keys = [
      [field.tableName, field.fieldName].filter(Boolean).join("."),
      [field.tableCn, field.fieldName].filter(Boolean).join("."),
      [field.systemCode, field.tableName, field.fieldName].filter(Boolean).join("."),
      [field.systemName, field.tableCn, field.fieldName].filter(Boolean).join("."),
      [field.tableName, field.fieldCn].filter(Boolean).join("."),
      [field.tableCn, field.fieldCn].filter(Boolean).join("."),
      [field.tableName, field.mappedField].filter(Boolean).join("."),
      [field.tableCn, field.mappedField].filter(Boolean).join("."),
      [field.systemCode, field.tableName, field.mappedField].filter(Boolean).join("."),
      [field.systemName, field.tableCn, field.mappedField].filter(Boolean).join("."),
    ];
    keys.forEach(addKey);

    const fieldKey = normalizeDictionaryRefKey(field.fieldName);
    if (fieldKey && fieldNameCounts.get(fieldKey) === 1 && !index.has(fieldKey)) {
      index.set(fieldKey, field);
    }
  });

  return index;
}

function bindDictionarySourceRefs(refs: string[], fieldRefIndex: Map<string, ProjectDictionaryFieldHit>): DictionarySourceRef[] {
  return refs.map(label => {
    const field = findDictionaryFieldByRef(label, fieldRefIndex);
    return field ? { label, field } : { label };
  });
}



function findDictionaryFieldByRef(ref: string, fieldRefIndex: Map<string, ProjectDictionaryFieldHit>): ProjectDictionaryFieldHit | undefined {
  const normalized = normalizeDictionaryRefKey(ref);
  if (!normalized) return undefined;
  const direct = fieldRefIndex.get(normalized);
  if (direct) return direct;
  const parts = normalized.split(".").filter(Boolean);
  if (parts.length <= 1) return fieldRefIndex.get(parts[0] ?? "");
  for (let start = 1; start < parts.length - 1; start += 1) {
    const sliced = parts.slice(start).join(".");
    const match = fieldRefIndex.get(sliced);
    if (match) return match;
  }
  return undefined;
}


function extractMappingLineValue(text: string, label: string): string {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = text.match(new RegExp(`${escaped}[：:]\\s*([^\\n\\r]+)`));
  return match?.[1]?.trim() || "";
}

function extractMappingBlockValue(text: string, label: string): string {
  const lines = text.replace(/\r/g, "\n").split("\n");
  const labelPattern = new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[：:]\\s*(.*)$`);
  const stopPattern = /^(场景\s*\d+|取数范围描述|业务口径|口径说明|数据表mapping|表别名|数据字段|mapping|逻辑|规则|逻辑\/规则|加工逻辑|取数逻辑|条件|结果|SQL转换)[：:]/i;
  const startIndex = lines.findIndex(line => labelPattern.test(line.trim()));
  if (startIndex < 0) return "";
  const first = lines[startIndex].trim().replace(labelPattern, "$1").trim();
  const values = first ? [first] : [];
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();
    if (trimmed && stopPattern.test(trimmed)) break;
    values.push(line.trimEnd());
  }
  return values.join("\n").trim();
}

function splitMappingTokens(value: string): string[] {
  return value.split(/[、,，;；\n\r]+/).map(item => item.trim()).filter(Boolean);
}

function normalizeSourceFieldToken(value: string): string {
  const text = value.replace(/^[-—]+|[-—]+$/g, "").replace(/^["'`]+|["'`]+$/g, "").trim();
  if (!isMeaningfulDictionarySourceRef(text)) return "";
  if (dictionaryRuntimeParamName(text)) return text;
  if (isQualifiedDictionarySourceRef(text)) return text;
  const parts = text.split(/[-－:：]/).map(item => item.trim()).filter(Boolean);
  return parts.at(-1) || text;
}

function extractFieldRefsFromExpression(value: string): string[] {
  const matches = value.match(/[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)+/g) || [];
  return Array.from(new Set(matches.filter(isMeaningfulDictionarySourceRef)));
}

function isMeaningfulDictionarySourceRef(value?: string): boolean {
  const text = value?.trim().replace(/^["'`]+|["'`]+$/g, "") ?? "";
  if (!text) return false;
  if (/^(无|否|不涉及|直取|null|NULL|nil|undefined|true|false|-)$/.test(text)) return false;
  if (/^\d+(?:\.\d+)?$/.test(text)) return false;
  if (/^[{}\[\]:,]+$/.test(text)) return false;
  if (dictionaryRuntimeParamName(text)) return true;
  if (/^(case|when|then|else|end|as|cast|split_part|substr|substring|concat|decode|nvl|coalesce|if|and|or|not)$/i.test(text)) return false;
  if (/^[A-Za-z_][\w$]*$/.test(text) && /^(op|type|length|source|expr|sql|to|when|else|if|then)$/i.test(text)) return false;
  return /^[A-Za-z_][\w$]*$/.test(text) || isQualifiedDictionarySourceRef(text);
}

function isQualifiedDictionarySourceRef(value: string): boolean {
  return /^[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)+$/.test(value);
}

function isMappingExpression(value: string): boolean {
  return /[()|+\-*=\/<>]|\b(case|when|then|else|substr|concat|decode|nvl|coalesce|if)\b/i.test(value);
}

function dictionaryViewTitle(view: DictionaryView, query: string, table?: ProjectDictionaryTable): string {
  if (query) return "搜索结果";
  if (view === "mapping") return "Mapping";
  if (view === "temp-table") return "临时表";
  if (view === "relations") return "关联关系";
  if (view === "test-data") return "测试数据";
  if (view === "table-info") return "表说明";
  return table?.tableCn || table?.tableName || "字段设计";
}

function dictionaryViewSubtitle(
  view: DictionaryView,
  query: string,
  table: ProjectDictionaryTable | undefined,
  fieldCount: number,
): string {
  if (query) return `命中 ${fieldCount} 个字段`;
  if (view === "mapping") return "按业务场景分组查看口径、字段抓取逻辑和涉及字段。";
  if (view === "temp-table") return "维护仅供当前表 Mapping 使用的中间临时表和临时字段。";
  if (view === "relations") return "展示目标字段与来源表、来源字段之间的 Mapping 关系。";
  if (view === "test-data") return "根据字段类型、长度、码值生成便于校验的测试数据样例。";
  if (view === "table-info") return "展示当前表元的分组、层级、载体、说明和口径。";
  return table?.description || table?.caliber || "选择左侧表后展示字段 Mapping 明细。";
}

function dictionaryViewCount(view: DictionaryView, fieldCount: number): string {
  if (view === "field-design") return `${fieldCount} 字段`;
  if (view === "temp-table") return "临时配置";
  if (view === "relations") return `${fieldCount} 关系`;
  if (view === "test-data") return "12 行样例";
  if (view === "table-info") return "表属性";
  return `${fieldCount} 字段`;
}

function sampleDictionaryValue(field: ProjectDictionaryFieldHit, index: number): string {
  const codeItems = getDictionaryCodeItems(field);
  const codeItem = codeItems[index % Math.max(codeItems.length, 1)];
  if (codeItem?.value) return codeItem.value;
  const code = field.codeValue?.match(/[A-Za-z]?\d{1,6}[A-Za-z]?/)?.[0];
  if (code) return index === 0 ? code : `${code}_${String(index + 1).padStart(2, "0")}`;
  const type = `${field.fieldType || ""}${field.fieldLength || ""}`;
  if (/time|datetime|timestamp|时间/i.test(type)) return `2026-08-${String(index + 1).padStart(2, "0")} 09:30:00`;
  if (/日期|date/i.test(type)) return `2026-08-${String(index + 1).padStart(2, "0")}`;
  if (/int|number|decimal|numeric|float|double|数值|金额|数量|order/i.test(type)) return String(index + 1);
  const prefix = field.fieldName.replace(/[^A-Za-z0-9]/g, "").slice(0, 6) || "VAL";
  return `${prefix}${String(index + 1).padStart(3, "0")}`;
}

export function dictionaryRectificationStatusLabel(status: ProjectDictionaryRectification["status"]): string {
  if (status === "open") return "待整改";
  if (status === "fixed") return "已修复，待复核";
  if (status === "verified") return "已验证";
  return "已取消";
}

export function dictionaryPropertyLabel(propertyKey: string): string {
  const labels: Record<string, string> = {
    entity: "整体元信息",
    field_name: "英文名",
    field_cn: "中文名",
    field_type: "类型",
    field_length: "长度",
    format_pattern: "格式",
    description: "字段说明",
    code_value: "码值说明",
    remark: "备注",
    logic: "Mapping 逻辑",
  };
  return labels[propertyKey] || propertyKey;
}

function DictionaryDetailBlock({ title, value, important = false }: { title: string; value?: string; important?: boolean }) {
  const text = value?.trim();
  if (!text) return null;
  return (
    <section className={`prj-pm-dict-detail__block${important ? " is-important" : ""}`}>
      <strong>{title}</strong>
      <p>{text}</p>
    </section>
  );
}

function getDictionaryImportedTestData(table?: ProjectDictionaryTable): DictionaryImportedTestData | undefined {
  const testData = recordValue(table?.extra?.testData);
  const rows = arrayValue(testData.rows);
  if (!rows.length) return undefined;
  return {
    sourceFilePath: typeof testData.sourceFilePath === "string" ? testData.sourceFilePath : undefined,
    sourceFileName: typeof testData.sourceFileName === "string" ? testData.sourceFileName : undefined,
    encoding: typeof testData.encoding === "string" ? testData.encoding : undefined,
    delimiter: typeof testData.delimiter === "string" ? testData.delimiter : undefined,
    recordCount: typeof testData.recordCount === "number" ? testData.recordCount : undefined,
    sampleCount: typeof testData.sampleCount === "number" ? testData.sampleCount : undefined,
    expectedFieldCount: typeof testData.expectedFieldCount === "number" ? testData.expectedFieldCount : undefined,
    columnCounts: recordValue(testData.columnCounts) as Record<string, number>,
    columnCountIssues: arrayValue(testData.columnCountIssues) as DictionaryImportedTestData["columnCountIssues"],
    rows: rows.map(row => {
      const item = recordValue(row);
      return {
        lineNumber: typeof item.lineNumber === "number" ? item.lineNumber : undefined,
        values: recordValue(item.values),
        rawColumns: arrayValue(item.rawColumns),
        extraColumns: arrayValue(item.extraColumns),
      };
    }),
  };
}
