import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import type { Element } from "@ke/domain";
import {
  api,
  type ProjectDictionaryFieldDetail,
  type ProjectDictionaryFieldHit,
  type ProjectDictionarySystem,
  type ProjectDictionaryTable,
  type ProjectManagementModuleKey,
  type ProjectManagementSearchHit,
  type ProjectManagementSummary,
  type ProjectModuleItem,
} from "../../api/client.js";

export type ProjectManagementSection = ProjectManagementModuleKey;

export const PROJECT_MANAGEMENT_SECTIONS: Array<{
  id: ProjectManagementSection;
  label: string;
  icon: string;
}> = [
  { id: "dictionary", label: "数据字典", icon: "▦" },
  { id: "workflow", label: "作业流程", icon: "⇄" },
  { id: "scenarios", label: "场景手册", icon: "▤" },
  { id: "environments", label: "环境配置", icon: "◎" },
  { id: "deploymentSteps", label: "部署步骤", icon: "☑" },
  { id: "monitoring", label: "监控预警", icon: "⌁" },
  { id: "codeVersions", label: "代码版本", icon: "⌘" },
  { id: "todos", label: "项目代办", icon: "✓" },
  { id: "folder", label: "文件夹", icon: "▣" },
];

const MODULE_LABELS = new Map(PROJECT_MANAGEMENT_SECTIONS.map(section => [section.id, section.label]));
type DictionaryView = "field-design" | "mapping" | "relations" | "test-data" | "table-info";
type DictionaryPropertyKind = "fieldDetail" | "tableDetail" | "systemDetail" | "description" | "codeValue" | "formatPattern" | "mappingLogic" | "sourceRefs" | "generic";

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
  sqlConversion?: DictionarySqlConversion;
};

type DictionarySourceRef = {
  label: string;
  field?: ProjectDictionaryFieldHit;
};

type DictionarySqlConversion = {
  status: "complete" | "blocked";
  sql?: string;
  reason?: string;
};

type DictionaryTreeDragState =
  | { kind: "system"; id: string }
  | { kind: "table"; id: string; systemId: string };

type DictionaryTreeDragEvent = {
  dataTransfer: DataTransfer;
  preventDefault: () => void;
};

type DictionaryResizableColumn = {
  id: string;
  label: string;
  width: number;
  minWidth?: number;
};

function useDictionaryResizableColumns(storageKey: string, columns: DictionaryResizableColumn[]) {
  const defaultWidths = useMemo(() => Object.fromEntries(columns.map(column => [column.id, column.width])), [columns]);
  const minWidths = useMemo(() => Object.fromEntries(columns.map(column => [column.id, column.minWidth ?? 48])), [columns]);
  const [widths, setWidths] = useState<Record<string, number>>(() => loadDictionaryColumnWidths(storageKey, defaultWidths));

  useEffect(() => {
    setWidths(loadDictionaryColumnWidths(storageKey, defaultWidths));
  }, [defaultWidths, storageKey]);

  const startResize = (event: ReactPointerEvent<HTMLElement>, columnId: string) => {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startWidth = widths[columnId] ?? defaultWidths[columnId] ?? 120;
    const minWidth = minWidths[columnId] ?? 48;

    const onMove = (moveEvent: PointerEvent) => {
      const nextWidth = Math.max(minWidth, Math.round(startWidth + moveEvent.clientX - startX));
      setWidths(current => ({ ...current, [columnId]: nextWidth }));
    };
    const onUp = (upEvent: PointerEvent) => {
      const nextWidth = Math.max(minWidth, Math.round(startWidth + upEvent.clientX - startX));
      setWidths(current => {
        const next = { ...current, [columnId]: nextWidth };
        saveDictionaryColumnWidths(storageKey, next);
        return next;
      });
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  const columnWidth = (columnId: string) => widths[columnId] ?? defaultWidths[columnId] ?? 120;
  const totalWidth = columns.reduce((sum, column) => sum + columnWidth(column.id), 0);
  return { columnWidth, startResize, totalWidth };
}

function DictionaryResizableHeadCell({
  column,
  onResizeStart,
}: {
  column: DictionaryResizableColumn;
  onResizeStart: (event: ReactPointerEvent<HTMLButtonElement>, columnId: string) => void;
}) {
  return (
    <span className="prj-pm-dict-resizable-head-cell">
      {column.label}
      <button
        type="button"
        className="prj-pm-dict-column-resizer"
        aria-label={`调整${column.label || "序号"}列宽`}
        title="拖拽调整列宽"
        onClick={event => event.stopPropagation()}
        onPointerDown={event => onResizeStart(event, column.id)}
      />
    </span>
  );
}

export function ProjectManagementSearchBar({
  projectId,
  onJump,
  autoFocusSignal,
}: {
  projectId: string;
  onJump: (section: ProjectManagementSection) => void;
  autoFocusSignal?: number;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProjectManagementSearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!autoFocusSignal) return;
    window.setTimeout(() => inputRef.current?.focus(), 60);
  }, [autoFocusSignal]);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void api.searchProjectManagement(projectId, query, 12)
        .then(next => {
          if (cancelled) return;
          setResults(next.results);
          setOpen(query.trim().length > 0);
        })
        .catch(() => {
          if (cancelled) return;
          setResults([]);
          setOpen(false);
        });
    }, 160);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [projectId, query]);

  return (
    <div className="prj-pm-global-search">
      <label>
        <span>全局搜索</span>
        <input
          ref={inputRef}
          value={query}
          onChange={event => setQuery(event.target.value)}
          onFocus={() => setOpen(query.trim().length > 0)}
          placeholder="搜索字段、表、口径、码值、流程、场景、部署步骤..."
        />
      </label>
      {open && (
        <div className="prj-pm-global-search__results">
          {results.length === 0 ? (
            <div className="prj-pm-global-search__empty">没有命中内容</div>
          ) : results.map(hit => (
            <button
              key={hit.id}
              type="button"
              onClick={() => {
                onJump(hit.moduleKey);
                setOpen(false);
              }}>
              <span>{MODULE_LABELS.get(hit.moduleKey) || hit.moduleKey}</span>
              <strong>{hit.title}</strong>
              {hit.subtitle && <small>{hit.subtitle}</small>}
              {hit.excerpt && <p>{hit.excerpt}</p>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function DictionarySection({ project, summary }: { project: Element; summary: ProjectManagementSummary | null }) {
  const [systems, setSystems] = useState<ProjectDictionarySystem[]>([]);
  const [selectedSystemId, setSelectedSystemId] = useState<string>("");
  const [expandedSystemIds, setExpandedSystemIds] = useState<string[]>([]);
  const [tables, setTables] = useState<ProjectDictionaryTable[]>([]);
  const [tableTrees, setTableTrees] = useState<Record<string, ProjectDictionaryTable[]>>({});
  const [selectedTableId, setSelectedTableId] = useState<string>("");
  const [activeView, setActiveView] = useState<DictionaryView>("field-design");
  const [query, setQuery] = useState("");
  const [tableFields, setTableFields] = useState<ProjectDictionaryFieldHit[]>([]);
  const [mappingRefFields, setMappingRefFields] = useState<ProjectDictionaryFieldHit[]>([]);
  const [results, setResults] = useState<ProjectDictionaryFieldHit[]>([]);
  const [selectedFieldId, setSelectedFieldId] = useState<string>("");
  const [propertyViewer, setPropertyViewer] = useState<DictionaryPropertyPayload | null>(null);
  const [tableCache, setTableCache] = useState<Record<string, ProjectDictionaryTable>>({});
  const [pinnedSystemIds, setPinnedSystemIds] = useState<string[]>(() => loadPinnedDictionarySystems(project.id));
  const [pinnedTableIds, setPinnedTableIds] = useState<string[]>(() => loadPinnedDictionaryTables(project.id));
  const [systemOrderIds, setSystemOrderIds] = useState<string[]>(() => loadDictionarySystemOrder(project.id));
  const [tableOrderBySystem, setTableOrderBySystem] = useState<Record<string, string[]>>(() => loadDictionaryTableOrder(project.id));
  const [treeDrag, setTreeDrag] = useState<DictionaryTreeDragState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    void api.listProjectDictionarySystems(project.id)
      .then(next => {
        if (cancelled) return;
        const rememberedOrder = loadDictionarySystemOrder(project.id);
        const orderedNext = applyDictionaryItemOrder(next, rememberedOrder);
        setSystems(next);
        setTableTrees({});
        setSelectedSystemId(current => current || orderedNext[0]?.id || "");
        setExpandedSystemIds(current => current.length > 0 ? current : orderedNext[0]?.id ? [orderedNext[0].id] : []);
      })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)); });
    return () => { cancelled = true; };
  }, [project.id, refreshKey]);

  useEffect(() => {
    setPinnedSystemIds(loadPinnedDictionarySystems(project.id));
    setPinnedTableIds(loadPinnedDictionaryTables(project.id));
    setSystemOrderIds(loadDictionarySystemOrder(project.id));
    setTableOrderBySystem(loadDictionaryTableOrder(project.id));
  }, [project.id]);

  useEffect(() => {
    let cancelled = false;
    void api.listProjectDictionaryTables(project.id, selectedSystemId || undefined)
      .then(next => {
        if (cancelled) return;
        setTables(next);
        setTableTrees(current => ({ ...current, [selectedSystemId]: next }));
        setTableCache(current => {
          const merged = { ...current };
          next.forEach(table => { merged[table.id] = table; });
          return merged;
        });
        setSelectedTableId(current => current && next.some(table => table.id === current) ? current : "");
      })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)); });
    return () => { cancelled = true; };
  }, [project.id, refreshKey, selectedSystemId]);

  useEffect(() => {
    let cancelled = false;
    const unloadedSystemIds = expandedSystemIds.filter(systemId => systemId && systemId !== selectedSystemId);
    if (unloadedSystemIds.length === 0) return () => { cancelled = true; };
    void Promise.all(unloadedSystemIds.map(async systemId => ({
      systemId,
      tables: await api.listProjectDictionaryTables(project.id, systemId),
    })))
      .then(next => {
        if (cancelled) return;
        setTableTrees(current => ({
          ...current,
          ...Object.fromEntries(next.map(item => [item.systemId, item.tables])),
        }));
        setTableCache(current => {
          const merged = { ...current };
          next.forEach(item => item.tables.forEach(table => { merged[table.id] = table; }));
          return merged;
        });
      })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)); });
    return () => { cancelled = true; };
  }, [expandedSystemIds, project.id, refreshKey, selectedSystemId]);

  useEffect(() => {
    if (systems.length === 0) return;
    setPinnedSystemIds(current => {
      const validIds = new Set(systems.map(system => system.id));
      const next = current.filter(id => validIds.has(id));
      if (next.length !== current.length) savePinnedDictionarySystems(project.id, next);
      return next;
    });
  }, [project.id, systems]);

  useEffect(() => {
    let cancelled = false;
    if (!query.trim()) {
      setResults([]);
      setLoading(false);
      return () => { cancelled = true; };
    }
    setLoading(true);
    const timer = window.setTimeout(() => {
      void api.searchProjectDictionaryFields(project.id, query, 40)
        .then(next => { if (!cancelled) setResults(next.results); })
        .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)); })
        .finally(() => { if (!cancelled) setLoading(false); });
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [project.id, query, refreshKey]);

  useEffect(() => {
    if (!selectedTableId) {
      setTableFields([]);
      setMappingRefFields([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void api.listProjectDictionaryFields(project.id, selectedTableId)
      .then(next => {
        if (cancelled) return;
        setTableFields(next);
        setSelectedFieldId(current => next.some(field => field.id === current) ? current : next[0]?.id || "");
      })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [project.id, refreshKey, selectedTableId]);

  const dictionary = summary?.dictionary ?? { systems: 0, tables: 0, fields: 0 };
  const orderedSystems = useMemo(() => applyDictionaryItemOrder(systems, systemOrderIds), [systems, systemOrderIds]);
  const orderedTables = useMemo(
    () => applyDictionaryItemOrder(tables, tableOrderBySystem[selectedSystemId] ?? []),
    [selectedSystemId, tableOrderBySystem, tables],
  );
  const selectedSystem = orderedSystems.find(system => system.id === selectedSystemId);
  const selectedTable = orderedTables.find(table => table.id === selectedTableId) ?? tableCache[selectedTableId];

  useEffect(() => {
    let cancelled = false;
    const refs = collectDictionaryMappingRefLabels(selectedTable, tableFields);
    if (refs.length === 0) {
      setMappingRefFields(tableFields);
      return () => { cancelled = true; };
    }
    void api.resolveProjectDictionaryFieldRefs(project.id, refs)
      .then(next => {
        if (cancelled) return;
        const byId = new Map<string, ProjectDictionaryFieldHit>();
        tableFields.forEach(field => byId.set(field.id, field));
        next.forEach(field => byId.set(field.id, field));
        setMappingRefFields(Array.from(byId.values()));
      })
      .catch(e => {
        if (!cancelled) {
          setMappingRefFields(tableFields);
          setError(e instanceof Error ? e.message : String(e));
        }
      });
    return () => { cancelled = true; };
  }, [project.id, selectedTable, tableFields]);

  const titleSystems = useMemo(() => {
    const byId = new Map(orderedSystems.map(system => [system.id, system]));
    const pinned = pinnedSystemIds.map(id => byId.get(id)).filter((system): system is ProjectDictionarySystem => Boolean(system));
    if (selectedSystem && !selectedTable && !pinned.some(system => system.id === selectedSystem.id)) {
      return [...pinned, selectedSystem];
    }
    return pinned;
  }, [orderedSystems, pinnedSystemIds, selectedSystem, selectedTable]);
  const titleTables = useMemo(() => {
    const byId = new Map([...Object.values(tableCache), ...orderedTables].map(table => [table.id, table] as const));
    const ids = [...pinnedTableIds];
    if (selectedTableId) ids.push(selectedTableId);
    const seen = new Set<string>();
    return ids.flatMap(id => {
      if (seen.has(id)) return [];
      seen.add(id);
      const table = byId.get(id);
      return table ? [table] : [];
    });
  }, [orderedTables, pinnedTableIds, selectedTableId, tableCache]);
  const openTable = (tableId: string) => {
    const table = Object.values(tableTrees).flat().find(item => item.id === tableId)
      ?? tables.find(item => item.id === tableId)
      ?? tableCache[tableId];
    if (table) {
      setTableCache(current => current[table.id] ? current : { ...current, [table.id]: table });
      if (table.systemId) setSelectedSystemId(table.systemId);
    }
    setSelectedTableId(tableId);
    setQuery("");
  };
  const visibleFields = query.trim()
    ? results
    : tableFields;
  const refreshDictionary = () => {
    setError(null);
    setRefreshKey(current => current + 1);
  };
  const openSystem = (systemId: string) => {
    setSelectedSystemId(systemId);
    setExpandedSystemIds(current => current.includes(systemId) ? current : [...current, systemId]);
    setSelectedTableId("");
    setSelectedFieldId("");
    setQuery("");
  };
  const toggleSystemExpanded = (systemId: string) => {
    setExpandedSystemIds(current => current.includes(systemId)
      ? current.filter(id => id !== systemId)
      : [...current, systemId]);
  };
  const handleSystemClick = (system: ProjectDictionarySystem) => {
    setSelectedSystemId(system.id);
    toggleSystemExpanded(system.id);
    setSelectedTableId("");
    setSelectedFieldId("");
    setQuery("");
    inspectSystem(system);
  };
  const togglePinnedSystem = (systemId: string) => {
    setPinnedSystemIds(current => {
      const next = current.includes(systemId)
        ? current.filter(id => id !== systemId)
        : [...current, systemId];
      savePinnedDictionarySystems(project.id, next);
      return next;
    });
  };
  const togglePinnedTable = (tableId: string) => {
    setPinnedTableIds(current => {
      const next = current.includes(tableId)
        ? current.filter(id => id !== tableId)
        : [...current, tableId];
      savePinnedDictionaryTables(project.id, next);
      return next;
    });
  };
  const inspectSystem = (system: ProjectDictionarySystem) => {
    setPropertyViewer({
      kind: "systemDetail",
      title: "库详情",
      subtitle: system.name || system.code,
      value: [system.code, system.name, system.type, system.assetLayer].filter(Boolean).join("\n"),
      system,
    });
  };
  const inspectTable = (table: ProjectDictionaryTable) => {
    setPropertyViewer({
      kind: "tableDetail",
      title: "表详情",
      subtitle: `${table.tableCn || table.tableName} / ${table.tableName}`,
      value: [table.description, table.caliber].filter(Boolean).join("\n"),
      table,
    });
  };
  const openLinkedDictionaryField = (field: ProjectDictionaryFieldHit) => {
    if (field.systemId) setSelectedSystemId(field.systemId);
    if (field.tableId) {
      const tableId = field.tableId;
      if (field.tableName || field.tableCn) {
        setTableCache(current => current[tableId]
          ? current
          : {
              ...current,
              [tableId]: {
                id: tableId,
                systemId: field.systemId || selectedSystemId,
                tableName: field.tableName || "",
                tableCn: field.tableCn || field.tableName || "",
                description: "",
                tableType: "",
                carrierType: "",
                dataLayer: "",
                caliber: "",
                fieldCount: 0,
              },
            });
      }
      setSelectedTableId(tableId);
    }
    setActiveView("field-design");
    setSelectedFieldId(field.id);
    setQuery("");
    setPropertyViewer({
      kind: "fieldDetail",
      title: "字段详情",
      subtitle: `${field.tableCn || field.tableName || "字段"} / ${field.fieldName}`,
      value: [field.description, field.codeValue, field.remark].filter(Boolean).join("\n"),
      field,
    });
  };
  const getTreeTables = (systemId: string) => applyDictionaryItemOrder(
    tableTrees[systemId] ?? (selectedSystemId === systemId ? orderedTables : []),
    tableOrderBySystem[systemId] ?? [],
  );
  const startTreeDrag = (event: DictionaryTreeDragEvent, next: DictionaryTreeDragState) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", next.id);
    setTreeDrag(next);
  };
  const allowTreeDrop = (event: DictionaryTreeDragEvent, target: DictionaryTreeDragState) => {
    if (!treeDrag || treeDrag.kind !== target.kind) return;
    if (treeDrag.kind === "table" && (target.kind !== "table" || treeDrag.systemId !== target.systemId)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  };
  const dropSystem = (event: DictionaryTreeDragEvent, targetSystemId: string) => {
    if (treeDrag?.kind !== "system") return;
    event.preventDefault();
    const next = reorderDictionaryIds(orderedSystems.map(system => system.id), treeDrag.id, targetSystemId);
    setSystemOrderIds(next);
    saveDictionarySystemOrder(project.id, next);
    setTreeDrag(null);
  };
  const dropTable = (event: DictionaryTreeDragEvent, systemId: string, targetTableId: string) => {
    if (treeDrag?.kind !== "table" || treeDrag.systemId !== systemId) return;
    event.preventDefault();
    const next = reorderDictionaryIds(getTreeTables(systemId).map(table => table.id), treeDrag.id, targetTableId);
    setTableOrderBySystem(current => {
      const merged = { ...current, [systemId]: next };
      saveDictionaryTableOrder(project.id, merged);
      return merged;
    });
    setTreeDrag(null);
  };

  return (
    <div className="prj-pm-dict prj-pm-dict-workbench">
      {error && <div className="prj-pm-error">{error}</div>}

      <div className="prj-pm-dict__layout no-inspector">
        <aside className="prj-pm-dict__systems">
          {systems.length === 0 ? (
            <div className="prj-pm-empty">还没有导入首都银行一表通 Mapping 数据。</div>
          ) : (
            orderedSystems.map(system => (
              <div
                className={`prj-pm-dict__tree-group${treeDrag?.kind === "system" && treeDrag.id === system.id ? " is-dragging" : ""}`}
                key={system.id}
                draggable
                onDragStart={event => startTreeDrag(event, { kind: "system", id: system.id })}
                onDragOver={event => allowTreeDrop(event, { kind: "system", id: system.id })}
                onDrop={event => dropSystem(event, system.id)}
                onDragEnd={() => setTreeDrag(null)}>
                <button
                  type="button"
                  className={`prj-pm-dict__system${selectedSystemId === system.id ? " is-active" : ""}`}
                  onClick={() => handleSystemClick(system)}>
                  <span>{expandedSystemIds.includes(system.id) ? "▾" : "▸"}</span>
                  <b>{system.code || system.name}</b>
                  <small>{system.assetLayer || system.type || "mapping"}</small>
                  <em>{system.tableCount} / {system.fieldCount}</em>
                </button>
                {expandedSystemIds.includes(system.id) && (
                  <div className="prj-pm-dict__table-tree">
                    {getTreeTables(system.id).map(table => (
                      <button
                        key={table.id}
                        type="button"
                        className={[
                          selectedTableId === table.id ? "is-active" : "",
                          treeDrag?.kind === "table" && treeDrag.id === table.id ? "is-dragging" : "",
                        ].filter(Boolean).join(" ")}
                        draggable
                        onDragStart={event => {
                          event.stopPropagation();
                          startTreeDrag(event, { kind: "table", id: table.id, systemId: system.id });
                        }}
                        onDragOver={event => allowTreeDrop(event, { kind: "table", id: table.id, systemId: system.id })}
                        onDrop={event => {
                          if (treeDrag?.kind !== "table") return;
                          event.stopPropagation();
                          dropTable(event, system.id, table.id);
                        }}
                        onDragEnd={() => setTreeDrag(null)}
                        onClick={() => openTable(table.id)}>
                        <span>{table.tableCn || table.tableName}</span>
                        <code>{table.tableName}</code>
                        <em>{table.fieldCount}</em>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </aside>

        <section className={[
          "prj-pm-dict__workspace",
          !query.trim() && !selectedTable ? "is-system-overview" : "",
          titleTables.length > 0 || titleSystems.length > 0 ? "has-table-rail" : "",
          titleTables.length > 0 && titleSystems.length > 0 ? "has-system-and-table-rail" : "",
        ].filter(Boolean).join(" ")}>
          {!query.trim() && !selectedTable ? (
            <>
              <div className="prj-pm-dict-title-rail-combo">
                <DictionarySystemTitleRail
                  systems={titleSystems}
                  selectedSystemId={selectedSystemId}
                  selectedTableId={selectedTableId}
                  pinnedSystemIds={pinnedSystemIds}
                  onSelect={(systemId) => {
                    const system = orderedSystems.find(item => item.id === systemId);
                    openSystem(systemId);
                    if (system) inspectSystem(system);
                  }}
                  onTogglePin={togglePinnedSystem}
                />
                <DictionaryTableTitleRail
                  tables={titleTables}
                  selectedTableId={selectedTableId}
                  pinnedTableIds={pinnedTableIds}
                  onSelect={openTable}
                  onTogglePin={togglePinnedTable}
                />
                <button type="button" className="prj-pm-dict-refresh" aria-label={loading ? "刷新中" : "刷新"} title={loading ? "刷新中" : "刷新"} onClick={refreshDictionary} disabled={loading}>↻</button>
              </div>
              <DictionarySystemOverview
                system={selectedSystem}
                tables={orderedTables}
                dictionary={dictionary}
                onInspectTable={inspectTable}
                onOpenTable={openTable}
              />
            </>
          ) : (
            <>
              <div className="prj-pm-dict-title-rail-combo">
                <DictionarySystemTitleRail
                  systems={titleSystems}
                  selectedSystemId={selectedSystemId}
                  selectedTableId={selectedTableId}
                  pinnedSystemIds={pinnedSystemIds}
                  onSelect={(systemId) => {
                    const system = orderedSystems.find(item => item.id === systemId);
                    openSystem(systemId);
                    if (system) inspectSystem(system);
                  }}
                  onTogglePin={togglePinnedSystem}
                />
                <DictionaryTableTitleRail
                  tables={titleTables}
                  selectedTableId={selectedTableId}
                  pinnedTableIds={pinnedTableIds}
                  onSelect={openTable}
                  onTogglePin={togglePinnedTable}
                />
                <button type="button" className="prj-pm-dict-refresh" aria-label={loading ? "刷新中" : "刷新"} title={loading ? "刷新中" : "刷新"} onClick={refreshDictionary} disabled={loading}>↻</button>
              </div>
              <div className="prj-pm-dict__tabs">
                <button type="button" className={activeView === "field-design" ? "is-active" : ""} onClick={() => setActiveView("field-design")}>字段设计</button>
                <button type="button" className={activeView === "mapping" ? "is-active" : ""} onClick={() => setActiveView("mapping")}>Mapping</button>
                <button type="button" className={activeView === "relations" ? "is-active" : ""} onClick={() => setActiveView("relations")}>关联关系</button>
                <button type="button" className={activeView === "test-data" ? "is-active" : ""} onClick={() => setActiveView("test-data")}>测试数据</button>
                <button type="button" className={activeView === "table-info" ? "is-active" : ""} onClick={() => setActiveView("table-info")}>表说明</button>
              </div>
              {activeView === "field-design" && (
                <DictionaryFieldGrid
                  fields={visibleFields}
                  loading={loading}
                  storageKey={`dictionary-field-grid:${project.id}:${selectedTableId || "search"}`}
                  selectedFieldId={selectedFieldId}
                  onSelectField={setSelectedFieldId}
                  onInspectProperty={setPropertyViewer}
                />
              )}
              {activeView === "mapping" && (
                <DictionaryMappingPanel
                  table={selectedTable}
                  fields={visibleFields}
                  allFields={mappingRefFields}
                  onInspectProperty={setPropertyViewer}
                  onOpenFieldRef={openLinkedDictionaryField}
                />
              )}
              {activeView === "relations" && <DictionaryRelationsPanel fields={visibleFields} />}
              {activeView === "test-data" && <DictionaryTestDataPanel table={selectedTable} fields={visibleFields} storageKey={`dictionary-test-data:${project.id}:${selectedTableId || "search"}`} />}
              {activeView === "table-info" && <DictionaryTableInfoPanel table={selectedTable} fields={visibleFields} />}
            </>
          )}
        </section>

      </div>
      <DictionaryPropertyViewer
        payload={propertyViewer}
        onClose={() => setPropertyViewer(null)}
        onOpenFieldRef={openLinkedDictionaryField}
      />
    </div>
  );
}

export function WorkflowSection({ project, summary }: { project: Element; summary: ProjectManagementSummary | null }) {
  const [items, setItems] = useState<ProjectModuleItem[]>([]);
  const [modal, setModal] = useState<{ item: ProjectModuleItem; type: WorkflowModalType } | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void api.listProjectManagementModuleItems(project.id, "workflow")
      .then(next => {
        if (cancelled) return;
        setItems(next);
      })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)); });
    return () => { cancelled = true; };
  }, [project.id]);

  const count = summary?.modules.find(module => module.key === "workflow")?.count ?? items.length;
  const beginEdit = (item: ProjectModuleItem) => {
    const original = recordValue(item.content.original);
    setDraft({ ...original, title: textValue(original, "title") || item.title });
    setModal({ item, type: "overview" });
    setEditing(true);
  };
  const save = async () => {
    if (!modal) return;
    const selectedOriginal = recordValue(modal.item.content.original);
    const title = textValue(draft, "title") || modal.item.title;
    setBusy(true);
    setError(null);
    try {
      await api.updateProjectManagementModuleItem(project.id, modal.item.id, {
        title,
        subtitle: textValue(draft, "lane") || modal.item.subtitle,
        content: { ...modal.item.content, original: { ...selectedOriginal, ...draft, title } },
      });
      const next = await api.listProjectManagementModuleItems(project.id, "workflow");
      setItems(next);
      setEditing(false);
      setModal(current => {
        if (!current) return null;
        const updated = next.find(item => item.id === current.item.id);
        return updated ? { ...current, item: updated } : null;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const createWorkflow = async () => {
    setBusy(true);
    setError(null);
    try {
      const created = await api.createProjectManagementModuleItem(project.id, "workflow", {
        title: "新流程节点",
        subtitle: "未分组",
        sortOrder: items.length,
        content: {
          sourceKey: "operationFlow",
          original: {
            id: `workflow-${Date.now()}`,
            title: "新流程节点",
            lane: "未分组",
            time: "",
            summary: "",
            summaryHtml: "",
            tasks: [],
            checks: [],
            warnings: [],
            scenarioIds: [],
            serverNamesByEnv: {},
          },
        },
      });
      const next = await api.listProjectManagementModuleItems(project.id, "workflow");
      setItems(next);
      setModal({ item: created, type: "overview" });
      setDraft(recordValue(created.content.original));
      setEditing(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="workflow prj-pm-legacy-skin">
      <section className="panel flow-intro">
        <div>
          <span className="flow-kicker">Operation Flow</span>
          <h3>一表通作业流程</h3>
          <p>围绕抽数、报送区加工、报文生成、可信区跑批、检查预警和上线运维的完整作业链路。</p>
        </div>
        <div className="flow-summary">
          <strong>{count}</strong>
          <span>流程节点</span>
        </div>
        <div className="flow-controls">
          <button type="button" className="flow-add" onClick={() => void createWorkflow()} disabled={busy}>{busy ? "处理中..." : "+ 新增流程"}</button>
        </div>
      </section>

      {error && <div className="prj-pm-error">{error}</div>}

      {items.length === 0 ? <div className="workflow-empty">还没有作业流程数据。</div> : (
        <div className="workflow-rail">
          {items.map((item, index) => {
            const original = recordValue(item.content.original);
            const tasks = arrayRecords(original.tasks);
            const serverCount = Object.values(recordValue(original.serverNamesByEnv)).reduce<number>((sum, value) => sum + stringList(value).length, 0);
            const scenarioCount = stringList(original.scenarioIds).length;
            const notesCount = stringList(original.checks).length + stringList(original.warnings).length;
            const summaryHtml = textValue(original, "summaryHtml");
            const summaryText = textValue(original, "summary");
            return (
              <article className="workflow-step" key={item.id}>
                <button type="button" className="workflow-order" aria-label={`流程 ${index + 1}`}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <i>↕</i>
                </button>
                <div className="workflow-step-main">
                  <div className="workflow-step-meta">
                    <span>{textValue(original, "lane") || item.subtitle || "未分组"}</span>
                    {textValue(original, "time") && <time>{textValue(original, "time")}</time>}
                  </div>
                  <button type="button" className="workflow-title" onClick={() => setModal({ item, type: "overview" })}>
                    {textValue(original, "title") || item.title}
                  </button>
                  {summaryHtml ? (
                    <div className="workflow-summary workflow-rich-content" dangerouslySetInnerHTML={{ __html: summaryHtml }} />
                  ) : (
                    <p className="workflow-summary">{summaryText}</p>
                  )}
                </div>
                <div className="workflow-actions">
                  <button type="button" onClick={() => setModal({ item, type: "servers" })}><span>涉及服务器</span><strong>{serverCount}</strong></button>
                  <button type="button" onClick={() => setModal({ item, type: "tasks" })}><span>定时与任务</span><strong>{tasks.length}</strong></button>
                  <button type="button" onClick={() => setModal({ item, type: "scenarios" })}><span>操作场景</span><strong>{scenarioCount}</strong></button>
                  <button type="button" onClick={() => setModal({ item, type: "notes" })}><span>注意事项</span><strong>{notesCount}</strong></button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {modal?.item && (
        <WorkflowModal
          projectId={project.id}
          modal={modal}
          editing={editing}
          draft={draft}
          busy={busy}
          onEdit={() => beginEdit(modal.item)}
          onDraftChange={setDraft}
          onSave={() => void save()}
          onClose={() => {
            setModal(null);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      )}
    </div>
  );
}

export function ScenariosSection({ project, summary }: { project: Element; summary: ProjectManagementSummary | null }) {
  const [groups, setGroups] = useState<ProjectModuleItem[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [selectedScenarioId, setSelectedScenarioId] = useState("");
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftScenarios, setDraftScenarios] = useState<ScenarioDraft[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = () => api.listProjectManagementModuleItems(project.id, "scenarios").then(next => {
    setGroups(next);
    const firstGroup = next[0];
    const firstScenario = getScenarios(firstGroup)[0];
    setSelectedGroupId(current => current || firstGroup?.id || "");
    setSelectedScenarioId(current => current || textValue(firstScenario, "id"));
  });

  useEffect(() => {
    let cancelled = false;
    void reload()
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)); });
    return () => { cancelled = true; };
  }, [project.id]);

  const selectedGroup = groups.find(group => group.id === selectedGroupId) ?? groups[0];
  const selectedGroupOriginal = recordValue(selectedGroup?.content.original);
  const scenarios = getScenarios(selectedGroup);
  const selectedScenario = scenarios.find(scenario => textValue(scenario, "id") === selectedScenarioId) ?? scenarios[0];
  const count = groups.reduce((sum, group) => sum + getScenarios(group).length, 0);
  const groupCount = summary?.modules.find(module => module.key === "scenarios")?.count ?? groups.length;
  const beginEdit = (group: ProjectModuleItem) => {
    setSelectedGroupId(group.id);
    setDraftTitle(group.title);
    setDraftScenarios(getScenarios(group).map(scenarioToDraft));
    setEditing(true);
  };
  const createGroup = async () => {
    setBusy(true);
    setError(null);
    try {
      const created = await api.createProjectManagementModuleItem(project.id, "scenarios", {
        title: "新场景分组",
        sortOrder: groups.length,
        content: { sourceKey: "scenarioGroups", original: { id: `scenario-group-${Date.now()}`, title: "新场景分组", scenarios: [] } },
      });
      await reload();
      beginEdit(created);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const deleteGroup = async () => {
    if (!selectedGroup || !window.confirm(`删除场景分组「${selectedGroup.title}」？`)) return;
    setBusy(true);
    setError(null);
    try {
      await api.deleteProjectManagementModuleItem(project.id, selectedGroup.id);
      await reload();
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const saveGroup = async () => {
    if (!selectedGroup) return;
    const title = draftTitle.trim() || "未命名分组";
    setBusy(true);
    setError(null);
    try {
      const scenariosPayload = draftScenarios.map((scenario, index) => ({
        ...scenario,
        id: scenario.id || `scenario-${Date.now()}-${index}`,
        sceneNo: scenario.sceneNo || `场景${index + 1}`,
        steps: splitLines(scenario.stepsText),
        checks: splitLines(scenario.checksText),
        tips: splitLines(scenario.tipsText),
        images: splitLines(scenario.imagesText).map(name => ({ name })),
      }));
      await api.updateProjectManagementModuleItem(project.id, selectedGroup.id, {
        title,
        content: {
          ...selectedGroup.content,
          original: {
            ...selectedGroupOriginal,
            title,
            scenarios: scenariosPayload,
          },
        },
      });
      await reload();
      setSelectedScenarioId(scenariosPayload[0]?.id || "");
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="prj-pm-scenarios prj-pm-scenarios-skin">
      {error && <div className="prj-pm-error">{error}</div>}
      <section className="scenario-toolbar">
        <div className={`scenario-tabs${editing ? " is-editing" : ""}`}>
          {groups.map(group => {
            const groupScenarios = getScenarios(group);
            const isActive = selectedGroup?.id === group.id;
            return editing ? (
              <div key={group.id} className={`scenario-group-pill${isActive ? " is-active" : ""}`}>
                <button
                  type="button"
                  className="scenario-group-switch"
                  aria-label={`切换到 ${group.title}`}
                  onClick={() => {
                    setSelectedGroupId(group.id);
                    setSelectedScenarioId(textValue(groupScenarios[0], "id"));
                    beginEdit(group);
                  }}
                />
                <span>{group.title}</span>
                <strong>{groupScenarios.length}</strong>
              </div>
            ) : (
              <button
                key={group.id}
                type="button"
                className={`scenario-group-title${isActive ? " is-active" : ""}`}
                onClick={() => {
                  setSelectedGroupId(group.id);
                  setSelectedScenarioId(textValue(groupScenarios[0], "id"));
                }}>
                {group.title}
              </button>
            );
          })}
          {editing && <button type="button" className="scenario-group-add" onClick={() => void createGroup()} disabled={busy}>+ 新增分组</button>}
        </div>
        <div className="scenario-toolbar-meta">
          <span>{groupCount} 分组</span>
          <span>{count} 场景</span>
          {selectedGroup && !editing && <button type="button" className="scenario-edit-toggle" onClick={() => beginEdit(selectedGroup)}>编辑</button>}
          {selectedGroup && editing && <button type="button" className="scenario-edit-toggle is-saving" onClick={() => void saveGroup()} disabled={busy}>保存</button>}
          {selectedGroup && editing && <button type="button" className="scenario-edit-toggle is-danger" onClick={() => void deleteGroup()} disabled={busy}>删除分组</button>}
        </div>
      </section>

      <section className="scenario-workbench">
        <aside className="scenario-index">
          {groups.map(group => {
            const groupScenarios = getScenarios(group);
            const isOpen = selectedGroup?.id === group.id;
            return (
              <div key={group.id} className="scenario-index-group">
                <button
                  type="button"
                  className={`scenario-index-title${isOpen ? " is-active" : ""}`}
                  onClick={() => {
                    setSelectedGroupId(group.id);
                    setSelectedScenarioId(textValue(groupScenarios[0], "id"));
                  }}>
                  <strong>{group.title}</strong>
                  <span>{groupScenarios.length}</span>
                </button>
                <div className="scenario-index-list">
                  {editing && isOpen && (
                    <button
                      type="button"
                      className="scenario-add-item"
                      onClick={() => onAddDraftScenario(draftScenarios, setDraftScenarios)}>
                      + 新增场景
                    </button>
                  )}
                  {groupScenarios.map(scenario => {
                    const scenarioId = textValue(scenario, "id") || textValue(scenario, "title");
                    const markerClass = scenarioMarkerClass(textValue(scenario, "markerColor"));
                    return (
                      <button
                        key={scenarioId}
                        type="button"
                        className={`scenario-index-item${markerClass ? ` has-marker ${markerClass}` : ""}${scenarioId === textValue(selectedScenario, "id") ? " is-active" : ""}`}
                        onClick={() => {
                          setSelectedGroupId(group.id);
                          setSelectedScenarioId(scenarioId);
                        }}>
                        <span>{textValue(scenario, "sceneNo") || "场景"}</span>
                        <strong>{textValue(scenario, "title") || "未命名场景"}</strong>
                      </button>
                    );
                  })}
                  {groupScenarios.length === 0 && <p className="empty-note">暂无场景</p>}
                </div>
              </div>
            );
          })}
        </aside>

        <article className="scenario-detail">
          {selectedGroup && editing ? (
            <ScenarioGroupEditor
              title={draftTitle}
              scenarios={draftScenarios}
              busy={busy}
              onTitleChange={setDraftTitle}
              onScenariosChange={setDraftScenarios}
              onSave={() => void saveGroup()}
              onCancel={() => setEditing(false)}
            />
          ) : selectedScenario ? <ScenarioDetail scenario={selectedScenario} groupTitle={selectedGroup?.title} projectId={project.id} /> : (
            <div className="scenario-empty-detail">还没有场景手册数据。</div>
          )}
        </article>
      </section>
    </div>
  );
}

interface ScenarioDraft {
  id: string;
  sceneNo: string;
  title: string;
  goal: string;
  entry: string;
  stepsText: string;
  checksText: string;
  tipsText: string;
  imagesText: string;
}

function onAddDraftScenario(scenarios: ScenarioDraft[], onScenariosChange: (items: ScenarioDraft[]) => void) {
  onScenariosChange([...scenarios, {
    id: `scenario-${Date.now()}`,
    sceneNo: `场景${scenarios.length + 1}`,
    title: "新场景",
    goal: "",
    entry: "",
    stepsText: "",
    checksText: "",
    tipsText: "",
    imagesText: "",
  }]);
}

function ScenarioGroupEditor({
  title,
  scenarios,
  busy,
  onTitleChange,
  onScenariosChange,
  onSave,
  onCancel,
}: {
  title: string;
  scenarios: ScenarioDraft[];
  busy: boolean;
  onTitleChange: (value: string) => void;
  onScenariosChange: (items: ScenarioDraft[]) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const updateScenario = (index: number, patch: Partial<ScenarioDraft>) => {
    onScenariosChange(scenarios.map((scenario, i) => i === index ? { ...scenario, ...patch } : scenario));
  };
  return (
    <div className="prj-pm-scenarios__editor">
      <header>
        <h3>编辑场景分组</h3>
        <div>
          <button type="button" className="prj-btn-link" onClick={onCancel} disabled={busy}>取消</button>
          <button type="button" className="prj-btn-primary" onClick={onSave} disabled={busy}>保存</button>
        </div>
      </header>
      <label>
        <span>分组名称</span>
        <input value={title} onChange={event => onTitleChange(event.target.value)} />
      </label>
      <div className="prj-pm-scenarios__editor-list">
        {scenarios.map((scenario, index) => (
          <section key={`${scenario.id}-${index}`}>
            <div className="prj-pm-scenarios__editor-scene-head">
              <strong>{scenario.sceneNo || `场景${index + 1}`}</strong>
              <button type="button" className="prj-btn-link prj-btn-danger" onClick={() => onScenariosChange(scenarios.filter((_, i) => i !== index))}>删除</button>
            </div>
            <div className="prj-pm-scenarios__editor-grid">
              <label>
                <span>编号</span>
                <input value={scenario.sceneNo} onChange={event => updateScenario(index, { sceneNo: event.target.value })} />
              </label>
              <label>
                <span>名称</span>
                <input value={scenario.title} onChange={event => updateScenario(index, { title: event.target.value })} />
              </label>
            </div>
            <label>
              <span>场景</span>
              <textarea value={scenario.goal} onChange={event => updateScenario(index, { goal: event.target.value })} />
            </label>
            <label>
              <span>入口</span>
              <textarea value={scenario.entry} onChange={event => updateScenario(index, { entry: event.target.value })} />
            </label>
            <label>
              <span>操作步骤</span>
              <textarea value={scenario.stepsText} onChange={event => updateScenario(index, { stepsText: event.target.value })} />
            </label>
            <label>
              <span>检查项</span>
              <textarea value={scenario.checksText} onChange={event => updateScenario(index, { checksText: event.target.value })} />
            </label>
            <label>
              <span>注意事项</span>
              <textarea value={scenario.tipsText} onChange={event => updateScenario(index, { tipsText: event.target.value })} />
            </label>
            <label>
              <span>截图名称</span>
              <textarea value={scenario.imagesText} onChange={event => updateScenario(index, { imagesText: event.target.value })} />
            </label>
          </section>
        ))}
      </div>
      <button
        type="button"
        className="prj-btn-link"
        onClick={() => onAddDraftScenario(scenarios, onScenariosChange)}>
        新增场景
      </button>
    </div>
  );
}

export function EnvironmentsSection({ project, summary }: { project: Element; summary: ProjectManagementSummary | null }) {
  const [environments, setEnvironments] = useState<ProjectModuleItem[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [selectedServer, setSelectedServer] = useState<{ server: Record<string, unknown>; module: Record<string, unknown>; environment: string } | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void api.listProjectManagementModuleItems(project.id, "environments")
      .then(next => {
        if (cancelled) return;
        setEnvironments(next);
        setSelectedId(current => current || next[0]?.id || "");
      })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)); });
    return () => { cancelled = true; };
  }, [project.id]);

  const selected = environments.find(env => env.id === selectedId) ?? environments[0];
  const original = recordValue(selected?.content.original);
  const modules = arrayRecords(original.modules);
  const connections = arrayRecords(original.connections);
  const serverCount = modules.reduce((sum, module) => sum + arrayRecords(module.servers).length, 0);
  const count = summary?.modules.find(module => module.key === "environments")?.count ?? environments.length;
  const selectedTitle = textValue(original, "name") || textValue(original, "title") || selected?.title || "环境配置";
  const beginEdit = () => {
    if (!selected) return;
    setDraft({ ...original, title: selectedTitle, name: selectedTitle });
    setEditing(true);
  };
  const save = async () => {
    if (!selected) return;
    const title = textValue(draft, "name") || textValue(draft, "title") || selected.title;
    setBusy(true);
    setError(null);
    try {
      await api.updateProjectManagementModuleItem(project.id, selected.id, {
        title,
        subtitle: textValue(draft, "type") || selected.subtitle,
        content: { ...selected.content, original: { ...original, ...draft, name: title, title } },
      });
      const next = await api.listProjectManagementModuleItems(project.id, "environments");
      setEnvironments(next);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="prj-pm-env prj-pm-legacy-skin">
      {error && <div className="prj-pm-error">{error}</div>}

      <div className="env-title-row">
        <div className="prj-pm-env__tabs env-title-tabs">
          {environments.map(env => (
            <button
              key={env.id}
              type="button"
              className={selected?.id === env.id ? "is-active" : ""}
              onClick={() => {
                setSelectedId(env.id);
                setEditing(false);
              }}>
              <strong>{textValue(env.content.original, "name") || env.title}</strong>
              {env.subtitle && <span>{env.subtitle}</span>}
            </button>
          ))}
        </div>
        {selected && (
          <div className="env-title-tools">
            <div className="env-mini-stat"><strong>{count}</strong><span>环境</span></div>
            <div className="env-mini-stat"><strong>{editing ? arrayRecords(draft.modules).reduce((sum, module) => sum + arrayRecords(module.servers).length, 0) : serverCount}</strong><span>服务器</span></div>
            <div className="env-mini-stat"><strong>{editing ? arrayRecords(draft.connections).length : connections.length}</strong><span>连接</span></div>
            {editing ? (
              <>
                <button type="button" className={`env-mode-toggle env-mode-toggle--compact${busy ? " is-saving" : ""}`} onClick={() => void save()} disabled={busy}>{busy ? "保存中" : "保存"}</button>
                <button type="button" className="env-mode-toggle env-mode-toggle--compact" onClick={() => setEditing(false)} disabled={busy}>取消</button>
              </>
            ) : (
              <button type="button" className="env-mode-toggle env-mode-toggle--compact" onClick={beginEdit}>编辑</button>
            )}
          </div>
        )}
      </div>

      {selected ? (
        editing ? (
          <div className="env-workspace">
            <section className="panel env-edit-head">
              <div className="env-banner-main">
                <label>
                  <span>环境名称</span>
                  <input className="env-title-input" value={textValue(draft, "name") || textValue(draft, "title")} onChange={event => onDraftEnvChange(draft, setDraft, { name: event.target.value, title: event.target.value })} />
                </label>
                <label>
                  <span>环境说明</span>
                  <textarea value={textValue(draft, "description")} onChange={event => onDraftEnvChange(draft, setDraft, { description: event.target.value })} />
                </label>
              </div>
            </section>
            <section className="panel env-page-head">
              <div className="env-section-head">
                <div>
                  <h3>模块与服务器</h3>
                  <p>编辑模式下保留原始结构，后续可以继续升级成逐项编辑。</p>
                </div>
              </div>
              <ProjectField label="模块与服务器 JSON">
                <textarea value={JSON.stringify(arrayRecords(draft.modules), null, 2)} onChange={event => onDraftEnvChange(draft, setDraft, { modules: parseJsonArray(event.target.value) })} />
              </ProjectField>
            </section>
            <section className="panel env-connection-panel">
              <div className="env-section-head">
                <div>
                  <h3>连接关系</h3>
                  <p>来源、目标、端口、用途都按旧工具表格结构保存。</p>
                </div>
              </div>
              <ProjectField label="连接关系 JSON">
                <textarea value={JSON.stringify(arrayRecords(draft.connections), null, 2)} onChange={event => onDraftEnvChange(draft, setDraft, { connections: parseJsonArray(event.target.value) })} />
              </ProjectField>
            </section>
          </div>
        ) : <div className="env-workspace">
          <section className="module-grid env-module-grid">
            {modules.length === 0 ? <div className="panel env-empty-panel">当前环境还没有服务器模块。</div> : modules.map((module, index) => (
              <EnvironmentModuleCard
                key={textValue(module, "id") || textValue(module, "name")}
                module={module}
                index={index}
                environmentName={selectedTitle}
                onServerClick={(server) => setSelectedServer({ server, module, environment: selectedTitle })}
              />
            ))}
          </section>

          <section className="panel env-connection-panel">
            <div className="env-section-head">
              <div>
                <h3>连接关系</h3>
                <p>展示应用、数据库、前置机、可信区组件之间的端口和用途。</p>
              </div>
            </div>
            {connections.length === 0 ? (
              <div className="prj-pm-empty">当前环境还没有连接关系。</div>
            ) : (
              <div className="env-connection-table">
                <div className="env-connection-header">
                  <span>来源模块</span><span>来源服务器</span><span>目标模块</span><span>目标服务器</span><span>端口</span><span>用途说明</span>
                </div>
                {connections.map((connection, index) => (
                  <div className="env-connection-row" key={`${textValue(connection, "from")}-${textValue(connection, "to")}-${index}`}>
                    <strong>{textValue(connection, "fromModule") || textValue(connection, "from")}</strong>
                    <span>{textValue(connection, "from")}</span>
                    <strong>{textValue(connection, "toModule") || textValue(connection, "to")}</strong>
                    <span>{textValue(connection, "to")}</span>
                    <code>{textValue(connection, "port") || "-"}</code>
                    <p>{textValue(connection, "purpose") || textValue(connection, "note")}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      ) : <div className="prj-pm-empty">还没有环境配置数据。</div>}

      {selectedServer && (
        <EnvironmentServerDetailModal
          server={selectedServer.server}
          module={selectedServer.module}
          environment={selectedServer.environment}
          onClose={() => setSelectedServer(null)}
        />
      )}
    </div>
  );
}

function onDraftEnvChange(
  current: Record<string, unknown>,
  onChange: (next: Record<string, unknown>) => void,
  patch: Record<string, unknown>,
) {
  onChange({ ...current, ...patch });
}

function EnvironmentEditor({
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
    <ProjectModuleEditorShell title="编辑环境配置" busy={busy} onSave={onSave} onCancel={onCancel}>
      <div className="prj-pm-editor-grid">
        <ProjectTextField label="环境名称" value={textValue(draft, "title")} onChange={value => onChange({ ...draft, title: value })} />
        <ProjectTextField label="环境类型" value={textValue(draft, "type")} onChange={value => onChange({ ...draft, type: value })} />
      </div>
      <ProjectField label="环境说明">
        <ProjectRichTextEditor projectId={`${projectId}-environment`} value={textValue(draft, "description")} onChange={description => onChange({ ...draft, description })} />
      </ProjectField>
      <ProjectField label="模块与服务器">
        <textarea value={JSON.stringify(arrayRecords(draft.modules), null, 2)} onChange={event => onChange({ ...draft, modules: parseJsonArray(event.target.value) })} />
      </ProjectField>
      <ProjectField label="连接关系">
        <textarea value={JSON.stringify(arrayRecords(draft.connections), null, 2)} onChange={event => onChange({ ...draft, connections: parseJsonArray(event.target.value) })} />
      </ProjectField>
    </ProjectModuleEditorShell>
  );
}

export function ProjectDeploymentStepsSection({ project, summary }: { project: Element; summary: ProjectManagementSummary | null }) {
  const [items, setItems] = useState<ProjectModuleItem[]>([]);
  const [environmentItems, setEnvironmentItems] = useState<ProjectModuleItem[]>([]);
  const [release, setRelease] = useState("");
  const [sheet, setSheet] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void api.listProjectManagementModuleItems(project.id, "deploymentSteps")
      .then(next => {
        if (cancelled) return;
        setItems(next);
        const firstOriginal = recordValue(next[0]?.content.original);
        setRelease(current => current || textValue(firstOriginal, "release") || "首次部署");
        setSheet(current => current || deploymentSheetOf(firstOriginal));
        setSelectedId(current => current || next[0]?.id || "");
      })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)); });
    return () => { cancelled = true; };
  }, [project.id]);

  useEffect(() => {
    let cancelled = false;
    void api.listProjectManagementModuleItems(project.id, "environments")
      .then(next => { if (!cancelled) setEnvironmentItems(next); })
      .catch(() => { if (!cancelled) setEnvironmentItems([]); });
    return () => { cancelled = true; };
  }, [project.id]);

  const releases = [...new Set(items.map(item => textValue(item.content.original, "release") || "首次部署"))];
  const activeRelease = release || releases[0] || "首次部署";
  const releaseItems = items.filter(item => (textValue(item.content.original, "release") || "首次部署") === activeRelease);
  const sheets = [...new Set(releaseItems.map(item => deploymentSheetOf(recordValue(item.content.original))))];
  const activeSheet = sheet && sheets.includes(sheet) ? sheet : sheets[0] || "";
  const selectedVersionSteps = releaseItems.filter(item => deploymentSheetOf(recordValue(item.content.original)) === activeSheet);
  const selected = selectedVersionSteps.find(item => item.id === selectedId) ?? selectedVersionSteps[0];
  const selectedOriginal = recordValue(selected?.content.original);
  const checklistTotal = releaseItems.reduce((sum, item) => sum + arrayRecords(recordValue(item.content.original).checklist).length, 0);
  const count = summary?.modules.find(module => module.key === "deploymentSteps")?.count ?? items.length;
  const beginEdit = () => {
    if (!selected) return;
    setDraft({ ...selectedOriginal, title: selected.title });
    setEditing(true);
  };
  const save = async () => {
    if (!selected) return;
    const title = textValue(draft, "phase") || textValue(draft, "title") || selected.title;
    setBusy(true);
    setError(null);
    try {
      await api.updateProjectManagementModuleItem(project.id, selected.id, {
        title,
        subtitle: textValue(draft, "sheetName") || selected.subtitle,
        content: { ...selected.content, original: { ...selectedOriginal, ...draft, phase: title } },
      });
      const next = await api.listProjectManagementModuleItems(project.id, "deploymentSteps");
      setItems(next);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const createDeploymentStep = async () => {
    const targetRelease = activeRelease || "首次部署";
    const targetSheet = activeSheet || "部署步骤";
    setBusy(true);
    setError(null);
    try {
      const created = await api.createProjectManagementModuleItem(project.id, "deploymentSteps", {
        title: "新部署区块",
        subtitle: targetSheet,
        sortOrder: items.length,
        content: {
          sourceKey: "deploymentSteps",
          original: {
            id: `deployment-${Date.now()}`,
            release: targetRelease,
            sheetName: targetSheet,
            version: targetSheet,
            phase: "新部署区块",
            target: "",
            environment: "",
            executionHtml: "",
            executionText: "",
            checklist: [],
            serverIdsByEnv: {},
            steps: [],
          },
        },
      });
      const next = await api.listProjectManagementModuleItems(project.id, "deploymentSteps");
      setItems(next);
      setRelease(targetRelease);
      setSheet(targetSheet);
      setSelectedId(created.id);
      setDraft(recordValue(created.content.original));
      setEditing(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`deployment-workspace prj-pm-legacy-skin${editing ? " is-editing" : ""}`}>
      {error && <div className="prj-pm-error">{error}</div>}

      {items.length === 0 ? (
        <>
          <section className="deployment-title-row">
            <div className="deployment-title-tabs" />
            <div className="deployment-title-actions">
              <button type="button" className={`deployment-mode-toggle${editing ? " is-saving" : ""}`} onClick={() => setEditing(!editing)}>{editing ? "完成" : "编辑"}</button>
            </div>
          </section>
          <section className="panel"><p className="empty-note">暂无部署步骤。</p></section>
        </>
      ) : (
        <>
          <section className="deployment-title-row deployment-release-row">
            <div className="deployment-title-tabs deployment-release-tabs">
              {releases.map(name => {
                const currentReleaseItems = items.filter(item => (textValue(item.content.original, "release") || "首次部署") === name);
                const releaseSheets = [...new Set(currentReleaseItems.map(item => deploymentSheetOf(recordValue(item.content.original))))];
                const active = activeRelease === name;
                return (
                  <button
                    key={name}
                    type="button"
                    className={`deployment-title-tab deployment-release-tab${active ? " is-active" : ""}`}
                    aria-pressed={active}
                    onClick={() => {
                      const first = currentReleaseItems[0];
                      const firstOriginal = recordValue(first?.content.original);
                      setRelease(name);
                      setSheet(deploymentSheetOf(firstOriginal));
                      setSelectedId(first?.id || "");
                      setEditing(false);
                    }}>
                    <span>版本</span>
                    <strong>{name}</strong>
                    <small>{releaseSheets.length} 个 Sheet · {currentReleaseItems.length} 个区块</small>
                  </button>
                );
              })}
            </div>
            <div className="deployment-title-actions">
              <span className="deployment-count-note">{count} 区块 · {checklistTotal} 检查</span>
            </div>
          </section>

          <section className="deployment-title-row">
            <div className="deployment-title-tabs">
              {sheets.map(name => {
                const versionSteps = releaseItems.filter(item => deploymentSheetOf(recordValue(item.content.original)) === name);
                const active = activeSheet === name;
                return (
                  <button
                    key={name}
                    type="button"
                    className={`deployment-title-tab${active ? " is-active" : ""}`}
                    aria-pressed={active}
                    onClick={() => {
                      setSheet(name);
                      setSelectedId(versionSteps[0]?.id || "");
                      setEditing(false);
                    }}>
                    <span>Sheet</span>
                    <strong>{name}</strong>
                    <small>{versionSteps.length} 个区块</small>
                  </button>
                );
              })}
            </div>
            <div className="deployment-title-actions">
              <button type="button" onClick={() => void createDeploymentStep()} disabled={busy}>+ 区块</button>
              <button type="button" className={`deployment-mode-toggle${editing ? " is-saving" : ""}`} onClick={() => {
                if (editing) setEditing(false);
                else beginEdit();
              }}>{editing ? "完成" : "编辑"}</button>
            </div>
          </section>

          <section className="deployment-layout">
            <aside className="deployment-sidebar">
              <div className="deployment-sidebar-head">
                <strong>{activeSheet || "部署目录"}</strong>
                <span>{selectedVersionSteps.length} 个区块</span>
              </div>
              <div className="deployment-menu">
                <section className="deployment-version-menu">
                  {selectedVersionSteps.map((item, index) => {
                    const original = recordValue(item.content.original);
                    return (
                      <article key={item.id} className={`deployment-step-nav${selected?.id === item.id ? " is-active" : ""}`}>
                        <button
                          className="deployment-step-main"
                          type="button"
                          onClick={() => {
                            setSelectedId(item.id);
                            setEditing(false);
                          }}>
                          <span>{String(index + 1).padStart(2, "0")}</span>
                          <strong>{textValue(original, "phase") || item.title || "未命名模块"}</strong>
                          <small>{textValue(original, "sourceType") === "excel-sheet" ? `${textValue(original, "rowCount") || arrayRecords(original.steps).length} 行记录` : textValue(original, "target") || "未填写说明"}</small>
                        </button>
                      </article>
                    );
                  })}
                  <button className="deployment-add-module-bottom" type="button" onClick={() => void createDeploymentStep()} disabled={busy}>+ 区块</button>
                </section>
              </div>
            </aside>

            <section className="deployment-detail">
              {selected ? (
                editing ? (
                  <DeploymentStepEditor
                    projectId={project.id}
                    draft={draft}
                    busy={busy}
                    onChange={setDraft}
                    onSave={() => void save()}
                    onCancel={() => setEditing(false)}
                  />
                ) : <DeploymentStepDetail item={selected} environments={environmentItems} onEdit={beginEdit} />
              ) : <div className="prj-pm-empty">请选择部署模块。</div>}
            </section>
          </section>
        </>
      )}
    </div>
  );
}

export function MonitoringSection({ project, summary }: { project: Element; summary: ProjectManagementSummary | null }) {
  const [sections, setSections] = useState<ProjectModuleItem[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftItems, setDraftItems] = useState<Array<{ name: string; detail: string; check: string }>>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = () => api.listProjectManagementModuleItems(project.id, "monitoring").then(next => {
    setSections(next);
    setSelectedId(current => current || next[0]?.id || "");
  });

  useEffect(() => {
    let cancelled = false;
    void reload()
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)); });
    return () => { cancelled = true; };
  }, [project.id]);

  const selected = sections.find(section => section.id === selectedId) ?? sections[0];
  const selectedOriginal = recordValue(selected?.content.original);
  const items = arrayRecords(selectedOriginal.items);
  const itemCount = sections.reduce((sum, section) => sum + arrayRecords(recordValue(section.content.original).items).length, 0);
  const count = summary?.modules.find(module => module.key === "monitoring")?.count ?? sections.length;
  const beginEdit = (section: ProjectModuleItem) => {
    const original = recordValue(section.content.original);
    setSelectedId(section.id);
    setDraftTitle(section.title);
    setDraftItems(arrayRecords(original.items).map(item => ({
      name: textValue(item, "name"),
      detail: textValue(item, "detail"),
      check: textValue(item, "check"),
    })));
    setEditing(true);
  };
  const saveMonitoring = async () => {
    if (!selected) return;
    const title = draftTitle.trim() || "未命名分组";
    setBusy(true);
    setError(null);
    try {
      await api.updateProjectManagementModuleItem(project.id, selected.id, {
        title,
        content: {
          ...selected.content,
          original: {
            ...selectedOriginal,
            title,
            items: draftItems.filter(item => item.name.trim() || item.detail.trim() || item.check.trim()),
          },
        },
      });
      await reload();
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const createSection = async () => {
    setBusy(true);
    setError(null);
    try {
      const created = await api.createProjectManagementModuleItem(project.id, "monitoring", {
        title: "新监控分组",
        sortOrder: sections.length,
        content: { original: { id: `monitor-${Date.now()}`, title: "新监控分组", items: [] } },
      });
      await reload();
      setSelectedId(created.id);
      beginEdit(created);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const deleteSection = async () => {
    if (!selected || !window.confirm(`删除监控分组「${selected.title}」？`)) return;
    setBusy(true);
    setError(null);
    try {
      await api.deleteProjectManagementModuleItem(project.id, selected.id);
      await reload();
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="prj-pm-monitor">
      <section className="prj-pm-monitor__head">
        <div>
          <p className="prj-pm-eyebrow">Monitoring And Alerts</p>
          <h3>监控预警</h3>
          <p>把任务状态、异常预警、资源风险、启停检查沉淀成可追踪的运行保障清单。</p>
        </div>
        <div className="prj-pm-monitor__stats">
          <span><b>{count}</b>分组</span>
          <span><b>{itemCount}</b>事项</span>
        </div>
      </section>

      {error && <div className="prj-pm-error">{error}</div>}

      <div className="prj-pm-monitor__actions">
        <button type="button" className="prj-btn-primary" onClick={() => void createSection()} disabled={busy}>新增分组</button>
        {selected && !editing && <button type="button" className="prj-btn-link" onClick={() => beginEdit(selected)}>编辑当前分组</button>}
        {selected && editing && <button type="button" className="prj-btn-link prj-btn-danger" onClick={() => void deleteSection()} disabled={busy}>删除当前分组</button>}
      </div>

      <div className="prj-pm-monitor__layout">
        <aside className="prj-pm-panel prj-pm-monitor__menu">
          {sections.map(section => {
            const original = recordValue(section.content.original);
            const sectionItems = arrayRecords(original.items);
            return (
              <button
                key={section.id}
                type="button"
                className={selected?.id === section.id ? "is-active" : ""}
                onClick={() => setSelectedId(section.id)}>
                <strong>{section.title}</strong>
                <span>{sectionItems.length} 个事项</span>
              </button>
            );
          })}
        </aside>

        <section className="prj-pm-panel prj-pm-monitor__detail">
          {selected && editing ? (
            <MonitoringEditor
              title={draftTitle}
              items={draftItems}
              busy={busy}
              onTitleChange={setDraftTitle}
              onItemsChange={setDraftItems}
              onSave={() => void saveMonitoring()}
              onCancel={() => setEditing(false)}
            />
          ) : selected ? (
            <article>
              <header>
                <div>
                  <p>运行保障</p>
                  <h3>{selected.title}</h3>
                </div>
                <div className="prj-pm-inline-actions">
                  <span>{items.length} 项</span>
                  <button type="button" className="prj-btn-link" onClick={() => beginEdit(selected)}>编辑</button>
                </div>
              </header>

              {items.length === 0 ? <div className="prj-pm-empty">当前分组还没有监控项。</div> : (
                <div className="prj-pm-monitor__grid">
                  {items.map((item, index) => <MonitoringCard key={`${textValue(item, "name")}-${index}`} item={item} index={index} />)}
                </div>
              )}
            </article>
          ) : <div className="prj-pm-empty">还没有监控预警数据。</div>}
        </section>
      </div>
    </div>
  );
}

function MonitoringEditor({
  title,
  items,
  busy,
  onTitleChange,
  onItemsChange,
  onSave,
  onCancel,
}: {
  title: string;
  items: Array<{ name: string; detail: string; check: string }>;
  busy: boolean;
  onTitleChange: (value: string) => void;
  onItemsChange: (items: Array<{ name: string; detail: string; check: string }>) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const updateItem = (index: number, patch: Partial<{ name: string; detail: string; check: string }>) => {
    onItemsChange(items.map((item, i) => i === index ? { ...item, ...patch } : item));
  };
  return (
    <div className="prj-pm-monitor__editor">
      <header>
        <h3>编辑监控分组</h3>
        <div>
          <button type="button" className="prj-btn-link" onClick={onCancel} disabled={busy}>取消</button>
          <button type="button" className="prj-btn-primary" onClick={onSave} disabled={busy}>保存</button>
        </div>
      </header>
      <label>
        <span>分组名称</span>
        <input value={title} onChange={event => onTitleChange(event.target.value)} />
      </label>
      <div className="prj-pm-monitor__editor-list">
        {items.map((item, index) => (
          <section key={index}>
            <div className="prj-pm-monitor__editor-item-head">
              <strong>事项 {index + 1}</strong>
              <button type="button" className="prj-btn-link prj-btn-danger" onClick={() => onItemsChange(items.filter((_, i) => i !== index))}>删除</button>
            </div>
            <label>
              <span>名称</span>
              <input value={item.name} onChange={event => updateItem(index, { name: event.target.value })} />
            </label>
            <label>
              <span>关注内容</span>
              <ProjectRichTextEditor value={item.detail} projectId={`monitor-detail-${index}`} onChange={detail => updateItem(index, { detail })} />
            </label>
            <label>
              <span>检查方式</span>
              <ProjectRichTextEditor value={item.check} projectId={`monitor-check-${index}`} onChange={check => updateItem(index, { check })} />
            </label>
          </section>
        ))}
      </div>
      <button
        type="button"
        className="prj-btn-link"
        onClick={() => onItemsChange([...items, { name: "新监控项", detail: "", check: "" }])}>
        新增监控项
      </button>
    </div>
  );
}

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

function DeploymentStepEditor({
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
      </section>

      <section className="deployment-edit-section">
        <div className="deployment-edit-section-head">
          <h4>Checklist</h4>
        </div>
        <textarea
          className="deployment-check-textarea"
          value={arrayRecords(draft.checklist).map(item => `${truthy(item.done) ? "x" : " "} ${textValue(item, "label")}`).join("\n")}
          onChange={event => onChange({ ...draft, checklist: splitLines(event.target.value).map(row => ({ done: row.trim().toLowerCase().startsWith("x "), label: row.replace(/^[x ]\s+/i, "") })) })}
        />
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

function CodeVersionsEditor({
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
    <ProjectModuleEditorShell title="编辑代码版本" busy={busy} onSave={onSave} onCancel={onCancel}>
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

export function CodeVersionsSection({ project, summary }: { project: Element; summary: ProjectManagementSummary | null }) {
  const [apps, setApps] = useState<ProjectModuleItem[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void api.listProjectManagementModuleItems(project.id, "codeVersions")
      .then(next => {
        if (cancelled) return;
        setApps(next);
        setSelectedId(current => current || next[0]?.id || "");
      })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)); });
    return () => { cancelled = true; };
  }, [project.id]);

  const selected = apps.find(app => app.id === selectedId) ?? apps[0];
  const original = recordValue(selected?.content.original);
  const versions = arrayRecords(original.versions);
  const versionCount = apps.reduce((sum, app) => sum + arrayRecords(recordValue(app.content.original).versions).length, 0);
  const count = summary?.modules.find(module => module.key === "codeVersions")?.count ?? apps.length;
  const beginEdit = () => {
    if (!selected) return;
    setDraft({ ...original, title: selected.title });
    setEditing(true);
  };
  const save = async () => {
    if (!selected) return;
    const title = textValue(draft, "name") || textValue(draft, "title") || selected.title;
    setBusy(true);
    setError(null);
    try {
      await api.updateProjectManagementModuleItem(project.id, selected.id, {
        title,
        content: { ...selected.content, original: { ...original, ...draft, name: title } },
      });
      const next = await api.listProjectManagementModuleItems(project.id, "codeVersions");
      setApps(next);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="prj-pm-code">
      <section className="prj-pm-code__head">
        <div>
          <p className="prj-pm-eyebrow">Application Versions</p>
          <h3>代码版本</h3>
          <p>按应用记录版本号、发布时间、上线时间、升级路线和升级内容，后续可继续扩展版本审批与上线关联。</p>
        </div>
        <div className="prj-pm-code__stats">
          <span><b>{count}</b>应用</span>
          <span><b>{versionCount}</b>版本</span>
        </div>
      </section>

      {error && <div className="prj-pm-error">{error}</div>}

      <div className="prj-pm-code__layout">
        <aside className="prj-pm-panel prj-pm-code__apps">
          {apps.map(app => {
            const appOriginal = recordValue(app.content.original);
            const appVersions = arrayRecords(appOriginal.versions);
            return (
              <button
                key={app.id}
                type="button"
                className={selected?.id === app.id ? "is-active" : ""}
                onClick={() => setSelectedId(app.id)}>
                <strong>{app.title}</strong>
                {textValue(appOriginal, "description") && <p>{textValue(appOriginal, "description")}</p>}
                <span>{appVersions.length} 个版本</span>
              </button>
            );
          })}
        </aside>

        <section className="prj-pm-panel prj-pm-code__detail">
          {selected ? editing ? (
            <CodeVersionsEditor
              projectId={project.id}
              draft={draft}
              busy={busy}
              onChange={setDraft}
              onSave={() => void save()}
              onCancel={() => setEditing(false)}
            />
          ) : (
            <article>
              <header>
                <div>
                  <p>应用版本历史</p>
                  <h3>{selected.title}</h3>
                </div>
                <div className="prj-pm-inline-actions">
                  <span>{versions.length} 个版本</span>
                  <button type="button" className="prj-btn-link" onClick={beginEdit}>编辑</button>
                </div>
              </header>
              {textValue(original, "description") && (
                <section className="prj-pm-code__app-desc">
                  <strong>应用组件</strong>
                  <p>{textValue(original, "description")}</p>
                </section>
              )}
              {versions.length === 0 ? <div className="prj-pm-empty">当前应用还没有版本记录。</div> : (
                <div className="prj-pm-code__timeline">
                  {versions.map((version, index) => <CodeVersionCard key={textValue(version, "id") || `${index}`} version={version} index={index} />)}
                </div>
              )}
            </article>
          ) : <div className="prj-pm-empty">还没有代码版本数据。</div>}
        </section>
      </div>
    </div>
  );
}

export function TodosSection({ project, summary }: { project: Element; summary: ProjectManagementSummary | null }) {
  const [todos, setTodos] = useState<ProjectModuleItem[]>([]);
  const [draggedId, setDraggedId] = useState("");
  const [dropLane, setDropLane] = useState<TodoStatus | "">("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = () => api.listProjectManagementModuleItems(project.id, "todos").then(next => {
    setTodos(next);
  });

  useEffect(() => {
    let cancelled = false;
    void reload()
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)); });
    return () => { cancelled = true; };
  }, [project.id]);

  const count = summary?.modules.find(module => module.key === "todos")?.count ?? todos.length;
  const lanes = [
    { id: "todo", title: "待办", accent: "#7aa7ff" },
    { id: "doing", title: "进行中", accent: "#fbbf24" },
    { id: "done", title: "已完成", accent: "#4ade80" },
  ] as const;
  const createTodo = async (status: TodoStatus) => {
    setBusy(true);
    setError(null);
    try {
      const created = await api.createProjectManagementModuleItem(project.id, "todos", {
        title: "新待办",
        subtitle: status,
        sortOrder: todos.length,
        content: { original: { id: `todo-${Date.now()}`, title: "新待办", owner: "", priority: "普通", dueAt: "", description: "", status } },
      });
      setTodos(current => [...current, created]);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const deleteTodo = async (todo: ProjectModuleItem) => {
    if (!window.confirm(`删除代办「${todo.title}」？`)) return;
    setBusy(true);
    setError(null);
    try {
      await api.deleteProjectManagementModuleItem(project.id, todo.id);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const editTodoLocal = (todoId: string, patch: Record<string, unknown>) => {
    setTodos(current => current.map(todo => {
      if (todo.id !== todoId) return todo;
      const original = { ...recordValue(todo.content.original), ...patch };
      const title = textValue(original, "title") || todo.title;
      return {
        ...todo,
        title,
        subtitle: [textValue(original, "status"), textValue(original, "owner")].filter(Boolean).join(" · "),
        content: { ...todo.content, original },
      };
    }));
  };
  const persistTodo = async (todoId: string) => {
    const todo = todos.find(item => item.id === todoId);
    if (!todo) return;
    const original = recordValue(todo.content.original);
    const title = textValue(original, "title") || todo.title || "未命名待办";
    setError(null);
    try {
      await api.updateProjectManagementModuleItem(project.id, todo.id, {
        title,
        subtitle: [textValue(original, "status"), textValue(original, "owner")].filter(Boolean).join(" · "),
        content: { ...todo.content, original: { ...original, title } },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      await reload();
    }
  };
  const moveTodoToLane = async (todoId: string, targetStatus: TodoStatus, beforeId = "") => {
    const moving = todos.find(todo => todo.id === todoId);
    if (!moving) return;
    const withoutMoving = todos.filter(todo => todo.id !== todoId);
    const movedOriginal = { ...recordValue(moving.content.original), status: targetStatus };
    const moved = {
      ...moving,
      subtitle: [targetStatus, textValue(movedOriginal, "owner")].filter(Boolean).join(" · "),
      content: { ...moving.content, original: movedOriginal },
    };
    const beforeIndex = beforeId ? withoutMoving.findIndex(todo => todo.id === beforeId) : -1;
    const next = [...withoutMoving];
    if (beforeIndex >= 0) {
      next.splice(beforeIndex, 0, moved);
    } else {
      let insertIndex = next.length;
      for (let index = next.length - 1; index >= 0; index -= 1) {
        if (normalizeTodoStatus(recordValue(next[index].content.original)) === targetStatus) {
          insertIndex = index + 1;
          break;
        }
      }
      next.splice(insertIndex, 0, moved);
    }
    setTodos(next);
    setDraggedId("");
    setDropLane("");
    try {
      await api.updateProjectManagementModuleItem(project.id, moved.id, {
        title: moved.title,
        subtitle: moved.subtitle,
        content: moved.content,
      });
      await api.reorderProjectManagementModuleItems(project.id, "todos", next.map(item => item.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      await reload();
    }
  };

  return (
    <div className="kanban todo-board prj-pm-legacy-skin">
      {error && <div className="prj-pm-error">{error}</div>}
      <div className="todo-board-summary">
        <span>{count} 项</span>
        <small>直接编辑卡片内容，拖拽调整状态和顺序。</small>
      </div>
      {lanes.map(lane => {
        const laneTodos = todos.filter(todo => normalizeTodoStatus(recordValue(todo.content.original)) === lane.id);
        return (
          <section
            key={lane.id}
            className={`lane todo-lane${dropLane === lane.id ? " is-drop-target" : ""}`}
            style={{ "--todo-accent": lane.accent } as CSSProperties}
            onDragOver={event => {
              event.preventDefault();
              setDropLane(lane.id);
            }}
            onDragLeave={event => {
              if (event.currentTarget === event.target) setDropLane("");
            }}
            onDrop={event => {
              event.preventDefault();
              const todoId = event.dataTransfer.getData("text/plain") || draggedId;
              const beforeId = (event.target as HTMLElement).closest<HTMLElement>("[data-todo-card]")?.dataset.todoCard || "";
              if (todoId && beforeId !== todoId) void moveTodoToLane(todoId, lane.id, beforeId);
            }}>
            <header className="todo-lane-head">
              <div><h3>{lane.title}</h3><span>{laneTodos.length} 项</span></div>
              <button type="button" onClick={() => void createTodo(lane.id)} disabled={busy}>+ 新增</button>
            </header>
            <div className="todo-list">
              {laneTodos.length === 0 ? <p className="empty-note">暂无</p> : laneTodos.map(todo => {
                const original = recordValue(todo.content.original);
                return (
                  <article key={todo.id} className={`todo${draggedId === todo.id ? " is-dragging" : ""}`} data-todo-card={todo.id}>
                    <button
                      type="button"
                      className="todo-drag-handle"
                      draggable
                      onDragStart={event => {
                        setDraggedId(todo.id);
                        event.dataTransfer.setData("text/plain", todo.id);
                      }}
                      onDragEnd={() => {
                        setDraggedId("");
                        setDropLane("");
                      }}
                      aria-label={`拖拽调整 ${todo.title}`}>⠿</button>
                    <div className="todo-fields">
                      <textarea
                        value={textValue(original, "title") || todo.title}
                        aria-label="待办标题"
                        onChange={event => editTodoLocal(todo.id, { title: event.target.value })}
                        onBlur={() => void persistTodo(todo.id)}
                      />
                      <input
                        value={textValue(original, "owner")}
                        aria-label="负责人"
                        placeholder="负责人"
                        onChange={event => editTodoLocal(todo.id, { owner: event.target.value })}
                        onBlur={() => void persistTodo(todo.id)}
                      />
                    </div>
                    <button type="button" className="todo-delete" onClick={() => void deleteTodo(todo)} aria-label="删除待办">×</button>
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function CodeVersionCard({ version, index }: { version: Record<string, unknown>; index: number }) {
  return (
    <section className="prj-pm-code-version">
      <header>
        <span>{String(index + 1).padStart(2, "0")}</span>
        <strong>{textValue(version, "versionNo") || `版本 ${index + 1}`}</strong>
      </header>
      <div className="prj-pm-code-version__dates">
        <VersionDate label="计划发布时间" value={textValue(version, "plannedReleaseAt")} />
        <VersionDate label="实际发布时间" value={textValue(version, "actualReleaseAt")} />
        <VersionDate label="计划上线时间" value={textValue(version, "plannedOnlineAt")} />
        <VersionDate label="实际上线时间" value={textValue(version, "actualOnlineAt")} />
      </div>
      <VersionTextBlock title="升级路线" value={textValue(version, "upgradePath")} />
      <VersionTextBlock title="升级内容" value={textValue(version, "upgradeContent")} important />
    </section>
  );
}

type TodoStatus = "todo" | "doing" | "done";

function TodoEditor({
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

function TodoDetail({ todo, onEdit, onDelete }: { todo: ProjectModuleItem; onEdit: () => void; onDelete: () => void }) {
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

function ProjectModuleEditorShell({
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

function ProjectField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="prj-pm-editor-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function ProjectTextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <ProjectField label={label}>
      <input value={value} onChange={event => onChange(event.target.value)} />
    </ProjectField>
  );
}

function ProjectRichTextEditor({
  value,
  projectId,
  onChange,
}: {
  value: string;
  projectId: string;
  onChange: (value: string) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (ref.current && document.activeElement !== ref.current && ref.current.innerHTML !== value) {
      ref.current.innerHTML = value || "";
    }
  }, [value]);

  const emit = () => onChange(ref.current?.innerHTML ?? "");
  const command = (name: string, commandValue?: string) => {
    ref.current?.focus();
    document.execCommand(name, false, commandValue);
    emit();
  };
  const uploadAndInsert = async (files: File[]) => {
    if (files.length === 0) return;
    const uploaded = await api.uploadAttachments(`pm-${projectId}`, files);
    ref.current?.focus();
    for (const file of uploaded) {
      document.execCommand("insertHTML", false, `<figure class="pm-rich-image"><img src="${file.src}" alt="${escapeAttribute(file.name)}"></figure>`);
    }
    emit();
  };

  return (
    <div className="prj-pm-rich-editor">
      <div className="prj-pm-rich-toolbar">
        <button type="button" onClick={() => command("formatBlock", "p")}>正文</button>
        <button type="button" onClick={() => command("formatBlock", "h3")}>标题</button>
        <button type="button" onClick={() => command("bold")}>B</button>
        <button type="button" onClick={() => command("foreColor", "#f7c76b")}>重点</button>
        <button type="button" onClick={() => command("hiliteColor", "rgba(143,254,247,.18)")}>底色</button>
        <button type="button" onClick={() => command("insertUnorderedList")}>列表</button>
        <button type="button" onClick={() => command("insertOrderedList")}>序号</button>
        <button type="button" onClick={() => command("formatBlock", "pre")}>代码</button>
        <button type="button" onClick={() => command("removeFormat")}>清除</button>
        <button type="button" onClick={() => fileRef.current?.click()}>图片</button>
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
      <div
        ref={ref}
        className="prj-pm-rich-surface workflow-rich-content"
        contentEditable
        suppressContentEditableWarning
        onInput={emit}
        onBlur={emit}
        onPaste={event => {
          const imageFiles = Array.from(event.clipboardData.files).filter(file => file.type.startsWith("image/"));
          if (imageFiles.length === 0) return;
          event.preventDefault();
          void uploadAndInsert(imageFiles);
        }}
        dangerouslySetInnerHTML={{ __html: value || "" }}
      />
    </div>
  );
}

function normalizeTodoStatus(value: Record<string, unknown>): TodoStatus {
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

function MonitoringCard({ item, index }: { item: Record<string, unknown>; index: number }) {
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

type WorkflowModalType = "overview" | "servers" | "tasks" | "scenarios" | "notes" | "create";

function WorkflowModal({
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

function DeploymentStepDetail({ item, environments, onEdit }: { item: ProjectModuleItem; environments?: ProjectModuleItem[]; onEdit?: () => void }) {
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
            <span>关联服务器</span>
            <div className="deployment-server-list">
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
            </div>
          </div>
        </section>
      )}

      {checklist.length > 0 && (
        <section className="deployment-detail-section">
          <h4>部署检查 <span>{doneCount(checklist)}/{checklist.length}</span></h4>
          <div className="checks">
            {checklist.map((row, index) => (
              <label key={`${textValue(row, "label")}-${index}`} className={`check${truthy(row.done) ? " is-done" : ""}`}>
                <input type="checkbox" checked={truthy(row.done)} readOnly />
                <span>{textValue(row, "label") || `检查项 ${index + 1}`}</span>
              </label>
            ))}
          </div>
        </section>
      )}

      <section className="deployment-detail-section">
        <h4>执行步骤</h4>
        <div className="deployment-execution-view workflow-rich-content">
          {html ? <div dangerouslySetInnerHTML={{ __html: html }} /> : text ? <p>{text}</p> : steps.length > 0 ? (
            <div className="prj-pm-deploy-detail__step-list">
              {steps.map((step, index) => (
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
      </section>
    </article>
  );
}

function EnvironmentModuleCard({
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

function EnvironmentServerDetailModal({
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

function ScenarioDetail({ scenario, groupTitle, projectId }: { scenario: Record<string, unknown>; groupTitle?: string; projectId: string }) {
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

function DictionarySystemTitleRail({
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

function DictionaryTableTitleRail({
  tables,
  selectedTableId,
  pinnedTableIds,
  onSelect,
  onTogglePin,
}: {
  tables: ProjectDictionaryTable[];
  selectedTableId: string;
  pinnedTableIds: string[];
  onSelect: (tableId: string) => void;
  onTogglePin: (tableId: string) => void;
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
          <button
            key={table.id}
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
        );
      })}
    </div>
  );
}

function DictionarySystemOverview({
  system,
  tables,
  dictionary,
  onInspectTable,
  onOpenTable,
}: {
  system?: ProjectDictionarySystem;
  tables: ProjectDictionaryTable[];
  dictionary: { systems: number; tables: number; fields: number };
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
    { id: "fieldCount", label: "字段数", width: 78, minWidth: 64 },
    { id: "description", label: "说明", width: 320, minWidth: 180 },
    { id: "caliber", label: "口径", width: 360, minWidth: 180 },
  ], []);
  const columnResize = useDictionaryResizableColumns(`dictionary-system-table-summary:${system?.id || "empty"}`, columns);
  const indexColumnWidth = Math.max(columnResize.columnWidth("index"), 58);
  const gridStyle = useMemo(() => ({
    "--dict-summary-c1": `${indexColumnWidth}px`,
    "--dict-summary-c2": `${columnResize.columnWidth("tableCn")}px`,
    "--dict-summary-c3": `${columnResize.columnWidth("tableName")}px`,
    "--dict-summary-c4": `${columnResize.columnWidth("dataLayer")}px`,
    "--dict-summary-c5": `${columnResize.columnWidth("sourceKind")}px`,
    "--dict-summary-c6": `${columnResize.columnWidth("fileType")}px`,
    "--dict-summary-c7": `${columnResize.columnWidth("fieldCount")}px`,
    "--dict-summary-c8": `${columnResize.columnWidth("description")}px`,
    "--dict-summary-c9": `${columnResize.columnWidth("caliber")}px`,
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

function DictionaryFieldGrid({
  fields,
  loading,
  storageKey,
  selectedFieldId,
  onSelectField,
  onInspectProperty,
}: {
  fields: ProjectDictionaryFieldHit[];
  loading: boolean;
  storageKey: string;
  selectedFieldId: string;
  onSelectField: (fieldId: string) => void;
  onInspectProperty: (payload: DictionaryPropertyPayload) => void;
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
  const columnResize = useDictionaryResizableColumns(storageKey, columns);
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
            }}>
            <span>{index + 1}</span>
            <strong>{field.fieldName || "-"}</strong>
            <strong>{field.fieldCn || "-"}</strong>
            <span>{field.fieldType || "-"}</span>
            <span>{field.fieldLength || "-"}</span>
            <span>{compactText(field.formatPattern)}</span>
            <span>{compactText(field.description)}</span>
            <span>{formatCodeValueSummary(field)}</span>
            <span>{compactText(field.remark)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function DictionaryMappingPanel({
  table,
  fields,
  allFields,
  onInspectProperty,
  onOpenFieldRef,
}: {
  table?: ProjectDictionaryTable;
  fields: ProjectDictionaryFieldHit[];
  allFields: ProjectDictionaryFieldHit[];
  onInspectProperty: (payload: DictionaryPropertyPayload) => void;
  onOpenFieldRef: (field: ProjectDictionaryFieldHit) => void;
}) {
  const fieldRefIndex = useMemo(() => buildDictionaryFieldRefIndex(allFields), [allFields]);
  const scenarios = useMemo(() => buildDictionaryMappingScenarios(table, fields, fieldRefIndex), [table, fields, fieldRefIndex]);
  const [activeScenarioKey, setActiveScenarioKey] = useState("");
  const activeScenario = scenarios.find(scenario => scenario.key === activeScenarioKey) ?? scenarios[0];

  useEffect(() => {
    if (scenarios.length === 0) {
      setActiveScenarioKey("");
      return;
    }
    setActiveScenarioKey(current => scenarios.some(scenario => scenario.key === current) ? current : scenarios[0].key);
  }, [scenarios]);

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
                </summary>
                <p>{activeScenario.caliber}</p>
              </details>
              <div className="prj-pm-dict-mapping-table-wrap">
                <table className="prj-pm-dict-mapping-table">
                  <thead>
                    <tr className="prj-pm-dict-mapping-table__head">
                      {["", "字段名", "中文名", "涉及字段", "逻辑", "SQL转换", "备注"].map(column => (
                        <th key={column}>{column}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {activeScenario.rules.map((rule, index) => {
                      const sqlConversion = convertDictionaryMappingRuleToSql(rule);
                      return (
                        <tr
                          key={`${activeScenario.key}-${rule.field.id}-${index}`}
                          className="prj-pm-dict-mapping-table__row"
                          tabIndex={0}
                          onClick={() => {
                            onInspectProperty({
                              kind: "mappingLogic",
                              title: "涉及字段 + 逻辑",
                              subtitle: `${rule.field.fieldName} ${rule.field.fieldCn || ""}`.trim(),
                              value: rule.logic,
                              remark: rule.remark,
                              field: rule.field,
                              refs: rule.sourceRefs,
                              sqlConversion,
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
                                remark: rule.remark,
                                field: rule.field,
                                refs: rule.sourceRefs,
                                sqlConversion,
                              });
                            }
                          }}>
                          <td>{index + 1}</td>
                          <td><strong>{rule.field.fieldName || "-"}</strong></td>
                          <td><strong>{rule.field.fieldCn || "-"}</strong></td>
                          <td>
                            <div className="prj-pm-dict-mapping__refs" aria-label="涉及字段">
                              {rule.sourceRefs.length
                                ? rule.sourceRefs.map(ref => ref.field ? (
                                  <span
                                    key={ref.label}
                                    className="is-bound"
                                    role="link"
                                    tabIndex={0}
                                    title="已绑定字段元，点击打开所在表"
                                    onClick={event => {
                                      event.stopPropagation();
                                      onOpenFieldRef(ref.field!);
                                    }}
                                    onKeyDown={event => {
                                      if (event.key === "Enter" || event.key === " ") {
                                        event.preventDefault();
                                        event.stopPropagation();
                                        onOpenFieldRef(ref.field!);
                                      }
                                    }}>
                                    {ref.label}
                                  </span>
                                ) : <span key={ref.label}>{ref.label}</span>)
                                : <em>-</em>}
                            </div>
                          </td>
                          <td className="prj-pm-dict-mapping-table__text">
                            {renderDictionaryLogicWithRefs(rule.logic, rule.sourceRefs, onOpenFieldRef)}
                          </td>
                          <td>
                            <DictionarySqlConversionBadge conversion={sqlConversion} />
                          </td>
                          <td>{compactText(rule.remark)}</td>
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

function DictionaryPropertyViewer({
  payload,
  onClose,
  onOpenFieldRef,
}: {
  payload: DictionaryPropertyPayload | null;
  onClose: () => void;
  onOpenFieldRef: (field: ProjectDictionaryFieldHit) => void;
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
          <DictionaryPropertyContent payload={payload} onOpenFieldRef={onOpenFieldRef} />
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
}: {
  payload: DictionaryPropertyPayload;
  onOpenFieldRef: (field: ProjectDictionaryFieldHit) => void;
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
          <section className={`prj-pm-dict-field-popover__section is-sql ${payload.sqlConversion.status === "complete" ? "is-complete" : "is-blocked"}`}>
            <header>
              <strong>SQL转换</strong>
              <span>{payload.sqlConversion.status === "complete" ? "完成" : "无法转换"}</span>
            </header>
            {payload.sqlConversion.status === "complete" && payload.sqlConversion.sql ? (
              <pre>{payload.sqlConversion.sql}</pre>
            ) : (
              <p>{payload.sqlConversion.reason || "当前逻辑还不能通过标准动作稳定转换出 SQL。"}</p>
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

function DictionarySourceRefTag({
  refItem,
  onOpenFieldRef,
  children,
}: {
  refItem: DictionarySourceRef;
  onOpenFieldRef: (field: ProjectDictionaryFieldHit) => void;
  children: ReactNode;
}) {
  return (
    <span
      className={`prj-pm-dict-ref-chip${refItem.field ? " is-bound" : ""}`}
      role={refItem.field ? "link" : undefined}
      tabIndex={refItem.field ? 0 : undefined}
      title={refItem.field ? "已绑定字段元，点击打开所在表" : undefined}
      onClick={refItem.field ? event => {
        event.stopPropagation();
        onOpenFieldRef(refItem.field!);
      } : undefined}
      onKeyDown={refItem.field ? event => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          event.stopPropagation();
          onOpenFieldRef(refItem.field!);
        }
      } : undefined}>
      {children}
    </span>
  );
}

function DictionarySqlConversionBadge({ conversion }: { conversion: DictionarySqlConversion }) {
  if (conversion.status === "complete" && conversion.sql) {
    return <code className="prj-pm-dict-sql-conversion is-complete">{conversion.sql}</code>;
  }
  return <span className="prj-pm-dict-sql-conversion is-blocked">{conversion.reason || "无法转换"}</span>;
}

function convertDictionaryMappingRuleToSql(rule: DictionaryMappingRule): DictionarySqlConversion {
  const target = sanitizeDictionarySqlIdentifier(rule.field.fieldName);
  if (!target) return { status: "blocked", reason: "缺少目标字段" };

  const logic = rule.logic.trim();
  if (!logic) return { status: "blocked", reason: "无法转换" };

  const directExpr = extractSqlExpressionByLabels(logic, ["直取", "字段", "mapping"]);
  if (directExpr && isSimpleDictionarySqlSource(directExpr)) {
    return { status: "complete", sql: `${normalizeDictionarySqlSource(directExpr, rule.sourceRefs)} AS ${target}` };
  }

  const defaultExpr = extractSqlExpressionByLabels(logic, ["默认值", "固定值"]);
  if (defaultExpr) {
    return { status: "complete", sql: `${formatDictionarySqlLiteral(defaultExpr)} AS ${target}` };
  }

  const resultExpr = stripDictionaryLogicPrefix(logic, ["结果", "表达式", "转换后SQL", "SQL"]);
  if (resultExpr && isDictionarySqlExpression(resultExpr)) {
    return { status: "complete", sql: `${normalizeDictionarySqlExpression(resultExpr, rule.sourceRefs)} AS ${target}` };
  }

  const caseExpr = logic.match(/\bcase\b[\s\S]+\bend\b/i)?.[0];
  if (caseExpr) {
    return { status: "complete", sql: `${normalizeDictionarySqlExpression(caseExpr, rule.sourceRefs)} AS ${target}` };
  }

  if (/^(无|空|null)$/i.test(logic)) {
    return { status: "complete", sql: `NULL AS ${target}` };
  }

  return { status: "blocked", reason: "无法转换" };
}

function extractSqlExpressionByLabels(text: string, labels: string[]): string {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const line = lines.find(item => new RegExp(`^${escaped}[：:]`, "i").test(item));
    const value = line?.replace(new RegExp(`^${escaped}[：:]\\s*`, "i"), "").trim();
    if (value) return value;
  }
  return "";
}

function stripDictionaryLogicPrefix(text: string, labels: string[]): string {
  const trimmed = text.trim();
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const next = trimmed.replace(new RegExp(`^${escaped}[：:]\\s*`, "i"), "").trim();
    if (next !== trimmed) return next;
  }
  return "";
}

function isSimpleDictionarySqlSource(value: string): boolean {
  const text = value.trim();
  return /^[A-Za-z_][\w$]*(?:\.[A-Za-z_][\w$]*){0,2}$/.test(text);
}

function isDictionarySqlExpression(value: string): boolean {
  return /[()|+\-*=\/<>]|\b(case|when|then|else|substr|substring|concat|decode|nvl|coalesce|to_char|to_date|cast|sum|count|max|min)\b/i.test(value);
}

function normalizeDictionarySqlSource(value: string, refs: DictionarySourceRef[]): string {
  const normalized = value.trim();
  const ref = refs.find(item => [item.label, item.field?.fieldName, getDictionarySourceRefEnglish(item)]
    .filter(Boolean)
    .some(token => normalizeDictionaryRefKey(token) === normalizeDictionaryRefKey(normalized)));
  return ref ? getDictionarySourceRefSqlName(ref) : normalized;
}

function normalizeDictionarySqlExpression(value: string, refs: DictionarySourceRef[]): string {
  let next = value.trim();
  refs.forEach(ref => {
    buildDictionaryLogicRefCandidates([ref]).forEach(candidate => {
      const sqlName = getDictionarySourceRefSqlName(ref);
      if (!sqlName || candidate.token === sqlName) return;
      next = replaceDictionarySqlToken(next, candidate.token, sqlName);
    });
  });
  return next;
}

function replaceDictionarySqlToken(text: string, token: string, replacement: string): string {
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.replace(new RegExp(escaped, "g"), replacement);
}

function getDictionarySourceRefSqlName(ref: DictionarySourceRef): string {
  if (!ref.field) return ref.label;
  return [ref.field.tableName, ref.field.fieldName].filter(Boolean).join(".") || ref.field.fieldName || ref.label;
}

function sanitizeDictionarySqlIdentifier(value?: string): string {
  const text = value?.trim() || "";
  return /^[A-Za-z_][\w$]*$/.test(text) ? text : "";
}

function formatDictionarySqlLiteral(value: string): string {
  const trimmed = value.trim();
  if (/^(null|空)$/i.test(trimmed)) return "NULL";
  if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) return trimmed;
  if (/^'.*'$/.test(trimmed)) return trimmed;
  return `'${trimmed.replace(/'/g, "''")}'`;
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
        <p>{field.description || "暂无字段说明。"}</p>
      </section>

      <section className="prj-pm-dict-field-popover__section is-code">
        <header>
          <strong>码值说明</strong>
          <span>{field.fieldName}</span>
        </header>
        {codeRows.length > 0 ? (
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
        ) : field.codeValue?.trim() ? (
          <div className="prj-pm-dict-property-viewer__text">{field.codeValue}</div>
        ) : (
          <p>暂无码值说明。</p>
        )}
      </section>

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
          <span>字段数</span><strong>{table.fieldCount}</strong>
        </div>
      </section>
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

function DictionaryRelationsPanel({ fields }: { fields: ProjectDictionaryFieldHit[] }) {
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

type DictionaryUploadedTestFile = {
  file: File;
  text: string;
  preview: string;
  encoding: string;
  delimiter: string;
};

type DictionaryUploadStatus = { tone: "info" | "success" | "error"; message: string };

function DictionaryTestDataPanel({ table, fields, storageKey }: { table?: ProjectDictionaryTable; fields: ProjectDictionaryFieldHit[]; storageKey: string }) {
  const visibleFields = useMemo(() => fields.slice(0, 32), [fields]);
  const importedTestData = useMemo(() => getDictionaryImportedTestData(table), [table]);
  const parseConfig = useMemo(() => getDictionaryFileParseConfig(table), [table]);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<DictionaryUploadedTestFile | null>(null);
  const [uploadedDraftRows, setUploadedDraftRows] = useState<DictionaryImportedTestData["rows"] | null>(null);
  const [syncedRows, setSyncedRows] = useState<DictionaryImportedTestData["rows"] | null>(null);
  const [uploadError, setUploadError] = useState("");
  const [uploadStatus, setUploadStatus] = useState<DictionaryUploadStatus | null>(null);
  const columns = useMemo<DictionaryResizableColumn[]>(() => [
    { id: "index", label: "#", width: 42, minWidth: 38 },
    ...visibleFields.map(field => ({
      id: field.id,
      label: field.fieldName || "-",
      width: 168,
      minWidth: 96,
    })),
  ], [visibleFields]);
  const columnResize = useDictionaryResizableColumns(storageKey, columns);
  useEffect(() => {
    setUploadedFile(null);
    setUploadedDraftRows(null);
    setSyncedRows(null);
    setUploadError("");
    setUploadStatus(null);
    setUploadOpen(false);
  }, [table?.id]);
  const activeRows = syncedRows ?? importedTestData?.rows ?? [];
  const importedRows = activeRows.slice(0, 12);
  const rows = importedRows.length
    ? importedRows.map((row, rowIndex) => ({
      id: `imported-${row.lineNumber ?? rowIndex + 1}`,
      indexLabel: String(row.lineNumber ?? rowIndex + 1),
      values: visibleFields.map(field => stringifyTestDataValue(row.values?.[field.fieldName])),
    }))
    : Array.from({ length: 12 }, (_, rowIndex) => ({
      id: `sample-${rowIndex}`,
      indexLabel: String(rowIndex + 1),
      values: visibleFields.map(field => sampleDictionaryValue(field, rowIndex)),
    }));
  if (visibleFields.length === 0) {
    return <div className="prj-pm-dict__grid-empty">请选择左侧表后查看测试数据。</div>;
  }
  return (
    <div className="prj-pm-dict-test-table-wrap">
      <div className="prj-pm-dict-test-summary">
        <div className="prj-pm-dict-test-summary__meta">
          <strong>{syncedRows && uploadedFile ? uploadedFile.file.name : importedTestData?.sourceFileName || table?.tableName || "测试文件"}</strong>
          <span>{syncedRows ? `${syncedRows.length} 行` : `${importedTestData?.recordCount ?? 0} 行`}</span>
          <span>展示 {rows.length} 行</span>
          <span>{[uploadedFile?.encoding || parseConfig.encoding, (uploadedFile?.delimiter || parseConfig.delimiter) ? `分隔符 ${uploadedFile?.delimiter || parseConfig.delimiter}` : ""].filter(Boolean).join(" / ")}</span>
          {uploadedDraftRows ? <span>待同步 {uploadedDraftRows.length} 行</span> : null}
          {uploadStatus ? <em className={`prj-pm-dict-test-summary__status is-${uploadStatus.tone}`}>{uploadStatus.message}</em> : null}
        </div>
        <div className="prj-pm-dict-test-summary__actions">
          {uploadedDraftRows ? (
            <button
              type="button"
              className="is-primary"
              onClick={() => {
                setSyncedRows(uploadedDraftRows);
                setUploadStatus({ tone: "success", message: `已同步 ${uploadedDraftRows.length} 行到测试数据表格` });
              }}>
              同步到测试数据
            </button>
          ) : null}
          <button type="button" onClick={() => setUploadOpen(true)}>上传测试文件</button>
        </div>
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
                <th key={field.id} style={{ width: columnResize.columnWidth(field.id), minWidth: columnResize.columnWidth(field.id) }}>
                  <strong>{field.fieldName || "-"}</strong>
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
                {row.values.map((value, index) => (
                  <td
                    key={visibleFields[index]?.id ?? index}
                    className={!value ? "is-null" : ""}
                    style={{ width: columnResize.columnWidth(visibleFields[index]?.id ?? ""), minWidth: columnResize.columnWidth(visibleFields[index]?.id ?? "") }}>
                    {value || "(NULL)"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {uploadOpen && (
        <DictionaryTestFileUploadDialog
          tableName={table?.tableName || "测试文件"}
          config={parseConfig}
          uploadedFile={uploadedFile}
          error={uploadError}
          onClose={() => setUploadOpen(false)}
          onFileLoaded={file => {
            setUploadedFile(file);
            setUploadedDraftRows(null);
            setUploadError("");
            setUploadStatus({ tone: "info", message: "文件已上传，请点击解析" });
          }}
          status={uploadStatus}
          onError={message => {
            setUploadError(message);
            setUploadStatus(message ? { tone: "error", message } : null);
          }}
          onParse={() => {
            if (!uploadedFile) {
              setUploadError("请先选择测试文件。");
              setUploadStatus({ tone: "error", message: "请先选择测试文件" });
              return;
            }
            const parsed = parseDictionaryUploadedTestFile(uploadedFile.text, visibleFields, uploadedFile.delimiter);
            setUploadedDraftRows(parsed);
            setUploadError(parsed.length ? "" : "文件没有解析出可展示的数据。");
            setUploadStatus(parsed.length
              ? { tone: "success", message: `解析成功，已生成 ${parsed.length} 行，点击“同步到测试数据”后展示到表格` }
              : { tone: "error", message: "文件没有解析出可展示的数据" });
          }}
        />
      )}
    </div>
  );
}

function DictionaryTestFileUploadDialog({
  tableName,
  config,
  uploadedFile,
  error,
  status,
  onClose,
  onFileLoaded,
  onError,
  onParse,
}: {
  tableName: string;
  config: { encoding: string; delimiter: string };
  uploadedFile: DictionaryUploadedTestFile | null;
  error: string;
  status: DictionaryUploadStatus | null;
  onClose: () => void;
  onFileLoaded: (file: DictionaryUploadedTestFile) => void;
  onError: (message: string) => void;
  onParse: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const downloadUrl = useMemo(() => uploadedFile ? URL.createObjectURL(uploadedFile.file) : "", [uploadedFile]);

  useEffect(() => () => {
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
  }, [downloadUrl]);

  const loadFile = async (file: File) => {
    try {
      const encoding = normalizeDictionaryTextEncoding(config.encoding);
      const buffer = await file.arrayBuffer();
      const text = decodeDictionaryTextFile(buffer, encoding);
      onFileLoaded({
        file,
        text,
        preview: text.split(/\r\n|\n|\r/).slice(0, 80).join("\n"),
        encoding,
        delimiter: config.delimiter,
      });
    } catch (errorValue) {
      onError(errorValue instanceof Error ? errorValue.message : String(errorValue));
    }
  };

  return (
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
            ref={fileInputRef}
            type="file"
            accept=".txt,.csv,.xml,.xls,.xlsx,text/plain,text/csv,text/xml,application/xml"
            onChange={event => {
              const file = event.currentTarget.files?.[0];
              if (file) void loadFile(file);
            }}
          />
          <button type="button" onClick={() => fileInputRef.current?.click()}>选择文件</button>
          <button type="button" disabled={!uploadedFile} onClick={onParse}>解析</button>
          {uploadedFile && downloadUrl ? <a href={downloadUrl} download={uploadedFile.file.name}>下载</a> : <span>下载</span>}
        </div>
        <dl className="prj-pm-dict-upload-modal__meta">
          <dt>字符集</dt><dd>{normalizeDictionaryTextEncoding(config.encoding)}</dd>
          <dt>分隔符</dt><dd>{config.delimiter || "未配置"}</dd>
          <dt>文件</dt><dd>{uploadedFile ? `${uploadedFile.file.name} / ${formatFileSize(uploadedFile.file.size)}` : "未选择"}</dd>
        </dl>
        {status && !error ? <p className={`prj-pm-dict-upload-modal__status is-${status.tone}`}>{status.message}</p> : null}
        {error ? <p className="prj-pm-dict-upload-modal__error">{error}</p> : null}
        <pre>{uploadedFile?.preview || "选择文件后在这里预览前 80 行内容。"}</pre>
      </section>
    </div>
  );
}

function DictionaryTableInfoPanel({ table, fields }: { table?: ProjectDictionaryTable; fields: ProjectDictionaryFieldHit[] }) {
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

type DictionaryMappingRule = {
  field: ProjectDictionaryFieldHit;
  logic: string;
  remark?: string;
  sourceRefs: DictionarySourceRef[];
};

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
        remark: field.remark,
        sourceRefs: bindDictionarySourceRefs(extractMappingSourceRefs(field, piece), fieldRefIndex),
      });
    });
  });
  return Array.from(groups.values()).sort((a, b) => scenarioSortWeight(a.title) - scenarioSortWeight(b.title));
}

function collectDictionaryMappingRefLabels(table: ProjectDictionaryTable | undefined, fields: ProjectDictionaryFieldHit[]): string[] {
  const refs = new Set<string>();
  fields.forEach(field => {
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
      && !/^(取数范围描述|业务口径|口径说明|数据表mapping|表别名|数据字段)[：:]?/.test(line)
      && !/^mapping[：:]/i.test(line))
    .join("\n");
}

function extractMappingSourceRefs(field: ProjectDictionaryFieldHit, logicText: string): string[] {
  const refs = new Set<string>();
  const tableName = extractMappingLineValue(logicText, "数据表mapping") || field.mappedTable || field.tableName;
  const sourceFieldText = [extractMappingLineValue(logicText, "mapping"), field.mappedField].filter(Boolean).join("、");
  extractFieldRefsFromExpression(sourceFieldText).forEach(ref => refs.add(ref));
  splitMappingTokens(sourceFieldText).forEach(token => {
    const normalized = normalizeSourceFieldToken(token);
    if (!normalized) return;
    refs.add(normalized.includes(".") ? normalized : [tableName, normalized].filter(Boolean).join("."));
  });
  if (refs.size === 0 && field.mappedTable) refs.add(field.mappedTable);
  return Array.from(refs).slice(0, 8);
}

function buildDictionaryFieldRefIndex(fields: ProjectDictionaryFieldHit[]): Map<string, ProjectDictionaryFieldHit> {
  const index = new Map<string, ProjectDictionaryFieldHit>();
  const fieldNameCounts = new Map<string, number>();
  fields.forEach(field => {
    const fieldKey = normalizeDictionaryRefKey(field.fieldName);
    if (fieldKey) fieldNameCounts.set(fieldKey, (fieldNameCounts.get(fieldKey) ?? 0) + 1);
  });

  fields.forEach(field => {
    const keys = [
      [field.tableName, field.fieldName].filter(Boolean).join("."),
      [field.tableCn, field.fieldName].filter(Boolean).join("."),
      [field.systemCode, field.tableName, field.fieldName].filter(Boolean).join("."),
      [field.systemName, field.tableCn, field.fieldName].filter(Boolean).join("."),
      [field.tableName, field.fieldCn].filter(Boolean).join("."),
      [field.tableCn, field.fieldCn].filter(Boolean).join("."),
    ];
    keys.forEach(key => {
      const normalized = normalizeDictionaryRefKey(key);
      if (normalized && !index.has(normalized)) index.set(normalized, field);
    });

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

function renderDictionaryLogicWithRefs(
  text: string,
  refs: DictionarySourceRef[],
  onOpenFieldRef: (field: ProjectDictionaryFieldHit) => void,
): ReactNode {
  if (!text || refs.length === 0) return text || "-";
  const candidates = buildDictionaryLogicRefCandidates(refs);
  if (candidates.length === 0) return text;

  const nodes: ReactNode[] = [];
  let cursor = 0;
  let key = 0;
  while (cursor < text.length) {
    const match = findNextDictionaryLogicRefMatch(text, cursor, candidates);
    if (!match) {
      nodes.push(text.slice(cursor));
      break;
    }
    if (match.start > cursor) nodes.push(text.slice(cursor, match.start));
    nodes.push(
      <DictionarySourceRefTag
        key={`ref-${key}`}
        refItem={match.ref}
        onOpenFieldRef={onOpenFieldRef}>
        {match.text}
      </DictionarySourceRefTag>,
    );
    key += 1;
    cursor = match.end;
  }
  return nodes;
}

function buildDictionaryLogicRefCandidates(refs: DictionarySourceRef[]) {
  const seen = new Set<string>();
  const candidates: Array<{ token: string; ref: DictionarySourceRef }> = [];
  refs.forEach(ref => {
    [
      ref.label,
      getDictionarySourceRefEnglish(ref),
      ref.field?.fieldName,
      [ref.field?.tableName, ref.field?.fieldName].filter(Boolean).join("."),
      ref.field?.fieldCn,
    ].forEach(token => {
      const normalized = token?.trim();
      if (!normalized || normalized.length < 2 || seen.has(normalized)) return;
      seen.add(normalized);
      candidates.push({ token: normalized, ref });
    });
  });
  return candidates.sort((a, b) => b.token.length - a.token.length);
}

function findNextDictionaryLogicRefMatch(
  text: string,
  start: number,
  candidates: Array<{ token: string; ref: DictionarySourceRef }>,
): { start: number; end: number; text: string; ref: DictionarySourceRef } | null {
  let best: { start: number; end: number; text: string; ref: DictionarySourceRef } | null = null;
  candidates.forEach(candidate => {
    const index = text.indexOf(candidate.token, start);
    if (index < 0) return;
    if (!best || index < best.start || (index === best.start && candidate.token.length > best.text.length)) {
      best = { start: index, end: index + candidate.token.length, text: candidate.token, ref: candidate.ref };
    }
  });
  return best;
}

function getDictionarySourceRefEnglish(ref: DictionarySourceRef): string {
  if (!ref.field) return ref.label;
  return [ref.field.systemCode, ref.field.tableName, ref.field.fieldName].filter(Boolean).join(".") || ref.label;
}

function getDictionarySourceRefChinese(ref: DictionarySourceRef): string {
  if (!ref.field) return "未绑定字段元";
  return [ref.field.systemName, ref.field.tableCn, ref.field.fieldCn].filter(Boolean).join(" / ") || ref.field.fieldCn || ref.label;
}

function findDictionaryFieldByRef(ref: string, fieldRefIndex: Map<string, ProjectDictionaryFieldHit>): ProjectDictionaryFieldHit | undefined {
  const normalized = normalizeDictionaryRefKey(ref);
  if (!normalized) return undefined;
  const direct = fieldRefIndex.get(normalized);
  if (direct) return direct;
  const parts = normalized.split(".").filter(Boolean);
  for (let start = 1; start < parts.length; start += 1) {
    const sliced = parts.slice(start).join(".");
    const match = fieldRefIndex.get(sliced);
    if (match) return match;
  }
  return fieldRefIndex.get(parts.at(-1) ?? "");
}

function normalizeDictionaryRefKey(value?: string): string {
  return (value ?? "")
    .replace(/--.*$/g, "")
    .replace(/[“”"'`]/g, "")
    .replace(/\s+/g, "")
    .trim()
    .toLowerCase();
}

function extractMappingLineValue(text: string, label: string): string {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = text.match(new RegExp(`${escaped}[：:]\\s*([^\\n\\r]+)`));
  return match?.[1]?.trim() || "";
}

function splitMappingTokens(value: string): string[] {
  return value.split(/[、,，;；\n\r]+/).map(item => item.trim()).filter(Boolean);
}

function normalizeSourceFieldToken(value: string): string {
  const text = value.replace(/^[-—]+|[-—]+$/g, "").trim();
  if (!text || /^(无|否|不涉及|直取|-)$/.test(text)) return "";
  if (/^[A-Za-z_][\w$]*\.[A-Za-z_][\w$]*$/.test(text)) return text;
  const parts = text.split(/[-－:：]/).map(item => item.trim()).filter(Boolean);
  return parts.at(-1) || text;
}

function extractFieldRefsFromExpression(value: string): string[] {
  const matches = value.match(/[A-Za-z_][\w$]*\.[A-Za-z_][\w$]*/g) || [];
  return Array.from(new Set(matches));
}

function isMappingExpression(value: string): boolean {
  return /[()|+\-*=\/<>]|\b(case|when|then|else|substr|concat|decode|nvl|coalesce|if)\b/i.test(value);
}

function dictionaryViewTitle(view: DictionaryView, query: string, table?: ProjectDictionaryTable): string {
  if (query) return "搜索结果";
  if (view === "mapping") return "Mapping";
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
  if (view === "relations") return "展示目标字段与来源表、来源字段之间的 Mapping 关系。";
  if (view === "test-data") return "根据字段类型、长度、码值生成便于校验的测试数据样例。";
  if (view === "table-info") return "展示当前表元的分组、层级、载体、说明和口径。";
  return table?.description || table?.caliber || "选择左侧表后展示字段 Mapping 明细。";
}

function dictionaryViewCount(view: DictionaryView, fieldCount: number): string {
  if (view === "field-design") return `${fieldCount} 字段`;
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

function getDictionaryFileParseConfig(table?: ProjectDictionaryTable): { encoding: string; delimiter: string } {
  const testData = recordValue(table?.extra?.testData);
  const fileSource = recordValue(table?.extra?.fileSource);
  const onegenSourceFile = recordValue(table?.extra?.onegenSourceFile);
  const encoding = [
    testData.encoding,
    fileSource.encoding,
    onegenSourceFile.encoding,
  ].find(value => typeof value === "string" && value.trim());
  const delimiter = [
    testData.delimiter,
    fileSource.delimiter,
    onegenSourceFile.delimiter,
  ].find(value => typeof value === "string" && value.length > 0);
  return {
    encoding: normalizeDictionaryTextEncoding(typeof encoding === "string" ? encoding : "utf-8"),
    delimiter: normalizeDictionaryDelimiter(typeof delimiter === "string" ? delimiter : defaultDictionaryDelimiter(table)),
  };
}

function defaultDictionaryDelimiter(table?: ProjectDictionaryTable): string {
  const fileType = table?.fileType?.toLowerCase();
  if (fileType === "csv") return ",";
  if (fileType === "txt") return "|";
  return "|";
}

function normalizeDictionaryTextEncoding(value: string): string {
  const raw = value.trim().toLowerCase();
  if (!raw) return "utf-8";
  if (/utf[-_ ]?16le|unicode little/.test(raw)) return "utf-16le";
  if (/utf[-_ ]?16be|unicode big/.test(raw)) return "utf-16be";
  if (/utf[-_ ]?16|charset\.forname\(\"unicode\"\)|unicode/.test(raw)) return "utf-16le";
  if (/gbk|gb2312|gb18030/.test(raw)) return "gb18030";
  if (/ascii/.test(raw)) return "utf-8";
  if (/utf[-_ ]?8/.test(raw)) return "utf-8";
  return value.trim();
}

function normalizeDictionaryDelimiter(value: string): string {
  if (value === "\\t" || value.toLowerCase() === "tab") return "\t";
  if (value === "\\|") return "|";
  if (value === "\\n") return "\n";
  return value;
}

function decodeDictionaryTextFile(buffer: ArrayBuffer, encoding: string): string {
  try {
    return new TextDecoder(encoding).decode(buffer).replace(/^\uFEFF/, "");
  } catch {
    return new TextDecoder("utf-8").decode(buffer).replace(/^\uFEFF/, "");
  }
}

function parseDictionaryUploadedTestFile(
  text: string,
  fields: ProjectDictionaryFieldHit[],
  delimiter: string,
): NonNullable<DictionaryImportedTestData["rows"]> {
  const usableFields = fields.slice(0, 200);
  const lines = text.split(/\r\n|\n|\r/).filter(line => line.length > 0);
  return lines.map((line, index) => {
    const columns = splitDictionaryTestDataLine(line, delimiter);
    const values = Object.fromEntries(usableFields.map((field, fieldIndex) => [field.fieldName, columns[fieldIndex] ?? ""]));
    return {
      lineNumber: index + 1,
      values,
      rawColumns: columns,
      extraColumns: columns.slice(usableFields.length),
    };
  });
}

function splitDictionaryTestDataLine(line: string, delimiter: string): string[] {
  if (!delimiter) return [line];
  if (delimiter === ",") return splitCsvLine(line);
  return line.split(delimiter);
}

function splitCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === "\"" && quoted && next === "\"") {
      current += "\"";
      index += 1;
    } else if (char === "\"") {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current);
  return values;
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


function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function arrayRecords(value: unknown): Array<Record<string, unknown>> {
  return arrayValue(value).map(recordValue).filter(record => Object.keys(record).length > 0);
}

function stringList(value: unknown): string[] {
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

function scenarioMarkerClass(markerColor: string): string {
  const normalized = markerColor.trim().toLowerCase();
  if (["red", "green", "blue", "yellow", "purple"].includes(normalized)) return `marker-${normalized}`;
  return "";
}

function getScenarios(group?: ProjectModuleItem): Array<Record<string, unknown>> {
  const original = recordValue(group?.content.original);
  const scenarios = arrayValue(original.scenarios);
  return scenarios.map(recordValue).filter(scenario => Object.keys(scenario).length > 0);
}

function scenarioToDraft(scenario: Record<string, unknown>): ScenarioDraft {
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

function splitLines(value: string): string[] {
  return value.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
}

function textValue(value: unknown, key: string): string {
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

function parseJsonArray(value: string): Array<Record<string, unknown>> {
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

function deploymentSheetOf(value: Record<string, unknown>): string {
  return textValue(value, "sheetName") || textValue(value, "version") || "未命名版本";
}

function pinnedDictionarySystemsKey(projectId: string) {
  return `rich-project-dictionary-pinned-systems:${projectId}`;
}

function loadPinnedDictionarySystems(projectId: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(pinnedDictionarySystemsKey(projectId)) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter(id => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function savePinnedDictionarySystems(projectId: string, systemIds: string[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(pinnedDictionarySystemsKey(projectId), JSON.stringify(systemIds));
  } catch {
    // Pinned system titles are a UI convenience; failing to persist them is safe.
  }
}

function pinnedDictionaryTablesKey(projectId: string) {
  return `rich-project-dictionary-pinned-tables:${projectId}`;
}

function loadPinnedDictionaryTables(projectId: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(pinnedDictionaryTablesKey(projectId)) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter(id => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function savePinnedDictionaryTables(projectId: string, tableIds: string[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(pinnedDictionaryTablesKey(projectId), JSON.stringify(tableIds));
  } catch {
    // Pinned table titles are a UI convenience; failing to persist them is safe.
  }
}

function dictionarySystemOrderKey(projectId: string) {
  return `rich-project-dictionary-system-order:${projectId}`;
}

function loadDictionarySystemOrder(projectId: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(dictionarySystemOrderKey(projectId)) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter(id => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function saveDictionarySystemOrder(projectId: string, systemIds: string[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(dictionarySystemOrderKey(projectId), JSON.stringify(systemIds));
  } catch {
    // Dictionary tree order is a local convenience; failing to persist it is safe.
  }
}

function dictionaryTableOrderKey(projectId: string) {
  return `rich-project-dictionary-table-order:${projectId}`;
}

function loadDictionaryTableOrder(projectId: string): Record<string, string[]> {
  if (typeof window === "undefined") return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(dictionaryTableOrderKey(projectId)) ?? "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed)
      .filter(([systemId, tableIds]) => typeof systemId === "string" && Array.isArray(tableIds))
      .map(([systemId, tableIds]) => [systemId, (tableIds as unknown[]).filter((id): id is string => typeof id === "string")]));
  } catch {
    return {};
  }
}

function saveDictionaryTableOrder(projectId: string, tableOrderBySystem: Record<string, string[]>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(dictionaryTableOrderKey(projectId), JSON.stringify(tableOrderBySystem));
  } catch {
    // Dictionary tree order is a local convenience; failing to persist it is safe.
  }
}

function applyDictionaryItemOrder<T extends { id: string }>(items: T[], orderIds: string[]): T[] {
  if (orderIds.length === 0 || items.length < 2) return items;
  const byId = new Map(items.map(item => [item.id, item]));
  const ordered = orderIds.flatMap(id => {
    const item = byId.get(id);
    if (!item) return [];
    byId.delete(id);
    return [item];
  });
  return [...ordered, ...items.filter(item => byId.has(item.id))];
}

function reorderDictionaryIds(ids: string[], activeId: string, targetId: string): string[] {
  if (activeId === targetId) return ids;
  const from = ids.indexOf(activeId);
  const to = ids.indexOf(targetId);
  if (from < 0 || to < 0) return ids;
  const next = [...ids];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function dictionaryColumnWidthsKey(storageKey: string) {
  return `rich-project-dictionary-column-widths:${storageKey}`;
}

function loadDictionaryColumnWidths(storageKey: string, defaults: Record<string, number>): Record<string, number> {
  if (typeof window === "undefined") return defaults;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(dictionaryColumnWidthsKey(storageKey)) ?? "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return defaults;
    const next = { ...defaults };
    Object.entries(parsed).forEach(([columnId, value]) => {
      if (typeof value === "number" && Number.isFinite(value) && value > 0 && columnId in defaults) {
        next[columnId] = Math.round(value);
      }
    });
    return next;
  } catch {
    return defaults;
  }
}

function saveDictionaryColumnWidths(storageKey: string, widths: Record<string, number>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(dictionaryColumnWidthsKey(storageKey), JSON.stringify(widths));
  } catch {
    // Column widths are a local UI preference; failing to persist them is safe.
  }
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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
