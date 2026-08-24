import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  api,
  type ProjectDictionarySystem,
  type ProjectDictionaryTable,
} from "../../../api/client.js";
import {
  DictionaryResizableHeadCell,
  loadDictionaryColumnWidths,
  saveDictionaryColumnWidths,
  type DictionaryResizableColumn,
  useDictionaryResizableColumns,
} from "./DictionaryResizableColumns.js";
import type { DictionarySqlDialect } from "./sqlRuleEngine.js";

export function DictionarySystemTitleRail({
  systems,
  selectedSystemId,
  selectedTableId,
  pinnedSystemIds,
  onSelect,
  onTogglePin,
}: {
  systems: ProjectDictionarySystem[];
  selectedSystemId: string;
  selectedTableId: string;
  pinnedSystemIds: string[];
  onSelect: (systemId: string) => void;
  onTogglePin: (systemId: string) => void;
}) {
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  useEffect(() => {
    buttonRefs.current[selectedSystemId]?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [selectedSystemId, systems]);

  if (systems.length === 0) return null;
  return (
    <div className="prj-pm-dict-table-rail is-system-rail" aria-label="已打开数据库">
      {systems.map(system => {
        const pinned = pinnedSystemIds.includes(system.id);
        const active = selectedSystemId === system.id && !selectedTableId;
        const context = selectedSystemId === system.id && Boolean(selectedTableId);
        return (
          <button
            key={system.id}
            ref={node => { buttonRefs.current[system.id] = node; }}
            type="button"
            className={[
              "prj-pm-dict-table-rail__title",
              "is-system-title",
              active ? "is-active" : "",
              context ? "is-context" : "",
              pinned ? "is-pinned" : "",
            ].filter(Boolean).join(" ")}
            title="单击切换到该库，双击钉住或取消钉住"
            onClick={() => onSelect(system.id)}
            onDoubleClick={() => onTogglePin(system.id)}>
            <strong>{system.code || system.name}</strong>
          </button>
        );
      })}
    </div>
  );
}

export function DictionaryTableTitleRail({
  tables,
  selectedTableId,
  pinnedTableIds,
  onSelect,
  onTogglePin,
  onClose,
}: {
  tables: ProjectDictionaryTable[];
  selectedTableId: string;
  pinnedTableIds: string[];
  onSelect: (tableId: string) => void;
  onTogglePin: (tableId: string) => void;
  onClose: (tableId: string) => void;
}) {
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  useEffect(() => {
    buttonRefs.current[selectedTableId]?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [selectedTableId, tables]);

  if (tables.length === 0) return null;
  return (
    <div className="prj-pm-dict-table-rail" aria-label="已打开数据表">
      {tables.map(table => {
        const pinned = pinnedTableIds.includes(table.id);
        const active = selectedTableId === table.id;
        return (
          <div className="prj-pm-dict-table-rail__title-wrap" key={table.id}>
            <button
              ref={node => { buttonRefs.current[table.id] = node; }}
              type="button"
              className={[
                "prj-pm-dict-table-rail__title",
                active ? "is-active" : "",
                pinned ? "is-pinned" : "",
              ].filter(Boolean).join(" ")}
              title="单击切换到该表，双击钉住或取消钉住"
              onClick={() => onSelect(table.id)}
              onDoubleClick={() => onTogglePin(table.id)}>
              <strong>{table.tableCn || table.tableName}</strong>
              <code>{table.tableName}</code>
            </button>
            <button
              type="button"
              className="prj-pm-dict-table-rail__close"
              aria-label={`关闭表：${table.tableCn || table.tableName}`}
              title="关闭表"
              onClick={(event) => {
                event.stopPropagation();
                onClose(table.id);
              }}>
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function DictionarySystemOverview({
  projectId,
  system,
  tables,
  dictionary,
  onSystemSaved,
  onInspectTable,
  onOpenTable,
}: {
  projectId: string;
  system?: ProjectDictionarySystem;
  tables: ProjectDictionaryTable[];
  dictionary: { systems: number; tables: number; fields: number };
  onSystemSaved: (system: ProjectDictionarySystem) => void;
  onInspectTable: (table: ProjectDictionaryTable) => void;
  onOpenTable: (tableId: string) => void;
}) {
  const columns = useMemo<DictionaryResizableColumn[]>(() => [
    { id: "index", label: "序号", width: 58, minWidth: 52 },
    { id: "tableCn", label: "中文表名", width: 180, minWidth: 120 },
    { id: "tableName", label: "英文表名", width: 170, minWidth: 130 },
    { id: "dataLayer", label: "数据层级", width: 120, minWidth: 86 },
    { id: "sourceKind", label: "载体类型", width: 110, minWidth: 82 },
    { id: "fileType", label: "文件类型", width: 96, minWidth: 78 },
    { id: "usageStatus", label: "是否使用", width: 96, minWidth: 76 },
    { id: "fieldCount", label: "字段数", width: 78, minWidth: 64 },
    { id: "description", label: "说明", width: 320, minWidth: 180 },
    { id: "caliber", label: "口径", width: 360, minWidth: 180 },
  ], []);
  const columnResize = useDictionaryResizableColumns(`dictionary-system-table-summary:${system?.id || "empty"}`, columns, loadDictionaryColumnWidths, saveDictionaryColumnWidths);
  const indexColumnWidth = Math.max(columnResize.columnWidth("index"), 58);
  const gridStyle = useMemo(() => ({
    "--dict-summary-c1": `${indexColumnWidth}px`,
    "--dict-summary-c2": `${columnResize.columnWidth("tableCn")}px`,
    "--dict-summary-c3": `${columnResize.columnWidth("tableName")}px`,
    "--dict-summary-c4": `${columnResize.columnWidth("dataLayer")}px`,
    "--dict-summary-c5": `${columnResize.columnWidth("sourceKind")}px`,
    "--dict-summary-c6": `${columnResize.columnWidth("fileType")}px`,
    "--dict-summary-c7": `${columnResize.columnWidth("usageStatus")}px`,
    "--dict-summary-c8": `${columnResize.columnWidth("fieldCount")}px`,
    "--dict-summary-c9": `${columnResize.columnWidth("description")}px`,
    "--dict-summary-c10": `${columnResize.columnWidth("caliber")}px`,
    "--dict-summary-width": `${columnResize.totalWidth + indexColumnWidth - columnResize.columnWidth("index")}px`,
  }) as CSSProperties, [columnResize, indexColumnWidth]);
  if (!system) {
    return <div className="prj-pm-empty">请选择左侧系统。</div>;
  }
  return (
    <div className="prj-pm-dict-system-overview">
      <section className="prj-pm-dict-system-hero">
        <span>Database / Mapping Source</span>
        <h3>{system.code || system.name}</h3>
        <p>{system.name || "首都银行一表通 Mapping 数据字典"}</p>
      </section>
      <div className="prj-pm-dict-system-cards">
        <article>
          <span>系统类型</span>
          <strong>{system.type || "source system"}</strong>
        </article>
        <article>
          <span>资产层级</span>
          <strong>{system.assetLayer || "mapping layer"}</strong>
        </article>
        <article>
          <span>表数量</span>
          <strong>{dictionary.tables}</strong>
        </article>
        <article>
          <span>字段数量</span>
          <strong>{dictionary.fields}</strong>
        </article>
      </div>
      <DictionarySystemDatabaseConfig projectId={projectId} system={system} onSystemSaved={onSystemSaved} />
      <section className="prj-pm-dict-system-table-summary">
        <header>
          <strong>表清单摘要</strong>
          <span>单击查看表详情，双击打开表</span>
        </header>
        <div className="prj-pm-dict-system-table-summary__table" style={gridStyle}>
          <div className="prj-pm-dict-system-table-summary__head">
            {columns.map(column => (
              <DictionaryResizableHeadCell key={column.id} column={column} onResizeStart={columnResize.startResize} />
            ))}
          </div>
          {tables.map((table, index) => (
            <button
              key={table.id}
              type="button"
              className="prj-pm-dict-system-table-summary__row"
              onClick={() => onInspectTable(table)}
              onDoubleClick={() => onOpenTable(table.id)}>
              <span>{index + 1}</span>
              <strong>{table.tableCn || table.tableName}</strong>
              <code>{table.tableName}</code>
              <span>{table.dataLayer || "源表层"}</span>
              <span>{table.sourceKind || "数据库"}</span>
              <span>{table.fileType || "-"}</span>
              <span>{table.usageStatus || "待确认"}</span>
              <em>{table.fieldCount}</em>
              <span>{compactText(table.description)}</span>
              <span>{compactText(table.caliber)}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

type DictionarySystemDbDraft = {
  dbType: "" | "postgresql" | "sqlserver";
  host: string;
  port: string;
  database: string;
  schema: string;
  username: string;
  password: string;
  secretRef: string;
  ssl: boolean;
  entitySyncPolicy: "metadata_only" | "create_schema_allowed" | "create_table_allowed" | "insert_test_data_allowed" | "readonly";
};

const DICTIONARY_DB_TYPE_LABELS: Record<"postgresql" | "sqlserver", string> = {
  postgresql: "PostgreSQL",
  sqlserver: "SQL Server",
};

function DictionarySystemDatabaseConfig({
  projectId,
  system,
  onSystemSaved,
}: {
  projectId: string;
  system: ProjectDictionarySystem;
  onSystemSaved: (system: ProjectDictionarySystem) => void;
}) {
  const [draft, setDraft] = useState<DictionarySystemDbDraft>(() => dictionarySystemDbDraftFromSystem(system));
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    setDraft(dictionarySystemDbDraftFromSystem(system));
    setStatus(null);
  }, [system.id, system.extra]);

  const setField = <K extends keyof DictionarySystemDbDraft>(key: K, value: DictionarySystemDbDraft[K]) => {
    setDraft(current => ({ ...current, [key]: value }));
  };

  const save = async () => {
    setSaving(true);
    setStatus(null);
    try {
      const extra = dictionarySystemDbExtraFromDraft(system, draft);
      const nextSystem = await api.updateProjectDictionarySystem(projectId, system.id, { extra });
      onSystemSaved(nextSystem);
      setStatus({ tone: "success", text: "数据库配置已保存" });
    } catch (errorValue) {
      setStatus({ tone: "error", text: errorValue instanceof Error ? errorValue.message : String(errorValue) });
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    setTesting(true);
    setStatus(null);
    try {
      const result = await api.testProjectDictionarySystemConnection(projectId, system.id, {
        extra: dictionarySystemDbExtraFromDraft(system, draft),
      });
      const schemaText = result.schema ? ` / Schema：${result.schema}${result.schemaExists === false ? " 不存在" : " 可用"}` : "";
      setStatus({ tone: result.schemaExists === false ? "error" : "success", text: `${result.message}（${DICTIONARY_DB_TYPE_LABELS[result.dialect]}：${result.database}${schemaText}）` });
    } catch (errorValue) {
      setStatus({ tone: "error", text: errorValue instanceof Error ? errorValue.message : String(errorValue) });
    } finally {
      setTesting(false);
    }
  };

  return (
    <section className="prj-pm-dict-db-config">
      <header>
        <div>
          <strong>实体库配置</strong>
          <span>首轮支持 PostgreSQL / SQL Server，SQL 组装会按这里的方言生成。</span>
        </div>
        <div className="prj-pm-dict-db-config__actions">
          <button type="button" onClick={testConnection} disabled={saving || testing}>{testing ? "测试中" : "测试连接"}</button>
          <button type="button" onClick={save} disabled={saving || testing}>{saving ? "保存中" : "保存配置"}</button>
        </div>
      </header>
      <div className="prj-pm-dict-db-config__grid">
        <label>
          <span>数据库类型</span>
          <select value={draft.dbType} onChange={event => setField("dbType", event.target.value as DictionarySystemDbDraft["dbType"])}>
            <option value="">未配置</option>
            <option value="postgresql">{DICTIONARY_DB_TYPE_LABELS.postgresql}</option>
            <option value="sqlserver">{DICTIONARY_DB_TYPE_LABELS.sqlserver}</option>
          </select>
        </label>
        <label>
          <span>Host</span>
          <input value={draft.host} onChange={event => setField("host", event.target.value)} placeholder="127.0.0.1" />
        </label>
        <label>
          <span>Port</span>
          <input value={draft.port} onChange={event => setField("port", event.target.value.replace(/[^\d]/g, ""))} placeholder={draft.dbType === "sqlserver" ? "1433" : "5432"} />
        </label>
        <label>
          <span>Database</span>
          <input value={draft.database} onChange={event => setField("database", event.target.value)} placeholder="database" />
        </label>
        <label>
          <span>Schema</span>
          <input value={draft.schema} onChange={event => setField("schema", event.target.value)} placeholder={draft.dbType === "sqlserver" ? "dbo" : "public"} />
        </label>
        <label>
          <span>Username</span>
          <input value={draft.username} onChange={event => setField("username", event.target.value)} placeholder="user" />
        </label>
        <label>
          <span>Password</span>
          <input type="password" value={draft.password} onChange={event => setField("password", event.target.value)} placeholder="数据库密码" autoComplete="new-password" />
        </label>
        <label>
          <span>Secret Ref</span>
          <input value={draft.secretRef} onChange={event => setField("secretRef", event.target.value)} placeholder="环境变量或密钥引用" />
        </label>
        <label>
          <span>同步策略</span>
          <select value={draft.entitySyncPolicy} onChange={event => setField("entitySyncPolicy", event.target.value as DictionarySystemDbDraft["entitySyncPolicy"])}>
            <option value="metadata_only">只维护元数据</option>
            <option value="create_schema_allowed">允许创建 Schema</option>
            <option value="create_table_allowed">允许创建实体表</option>
            <option value="insert_test_data_allowed">允许写入测试数据</option>
            <option value="readonly">只读连接</option>
          </select>
        </label>
        <label className="is-checkbox">
          <input type="checkbox" checked={draft.ssl} onChange={event => setField("ssl", event.target.checked)} />
          <span>SSL</span>
        </label>
      </div>
      {status ? <p className={`prj-pm-dict-db-config__status is-${status.tone}`}>{status.text}</p> : null}
    </section>
  );
}

function dictionarySystemDbExtraFromDraft(system: ProjectDictionarySystem, draft: DictionarySystemDbDraft): Record<string, unknown> {
  return {
    ...(system.extra ?? {}),
    dbType: draft.dbType || undefined,
    sqlDialect: draft.dbType || undefined,
    entitySyncPolicy: draft.entitySyncPolicy,
    connection: {
      host: draft.host.trim() || undefined,
      port: draft.port.trim() ? Number(draft.port.trim()) : undefined,
      database: draft.database.trim() || undefined,
      schema: draft.schema.trim() || undefined,
      username: draft.username.trim() || undefined,
      password: draft.password || undefined,
      secretRef: draft.secretRef.trim() || undefined,
      ssl: draft.ssl,
    },
  };
}

function dictionarySystemDbDraftFromSystem(system: ProjectDictionarySystem): DictionarySystemDbDraft {
  const connection = system.connection ?? dictionaryRecord(system.extra?.connection);
  const dbType = system.dbType === "postgresql" || system.dbType === "sqlserver" ? system.dbType : "";
  const rawPolicy = typeof system.extra?.entitySyncPolicy === "string" ? system.extra.entitySyncPolicy : system.entitySyncPolicy;
  const entitySyncPolicy = rawPolicy === "create_schema_allowed" || rawPolicy === "create_table_allowed" || rawPolicy === "insert_test_data_allowed" || rawPolicy === "readonly" || rawPolicy === "metadata_only"
    ? rawPolicy
    : "metadata_only";
  return {
    dbType,
    host: dictionaryString(connection?.host),
    port: connection?.port ? String(connection.port) : "",
    database: dictionaryString(connection?.database),
    schema: dictionaryString(connection?.schema),
    username: dictionaryString(connection?.username),
    password: dictionaryString(connection?.password),
    secretRef: dictionaryString(connection?.secretRef),
    ssl: Boolean(connection?.ssl),
    entitySyncPolicy,
  };
}

function dictionaryRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function dictionaryString(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

export function getDictionarySystemSqlDialect(system?: ProjectDictionarySystem): DictionarySqlDialect {
  if (system?.sqlDialect === "sqlserver" || system?.dbType === "sqlserver") return "sqlserver";
  return "postgresql";
}

function compactText(value?: string): string {
  return value?.replace(/\s+/g, " ").trim() || "";
}
