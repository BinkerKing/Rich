import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import type { Element } from "@ke/domain";
import { Bookmark, CheckCircle2, Clock3, Flag, LibraryBig, MessageSquare, Star, TriangleAlert, type LucideIcon } from "lucide-react";
import {
  api,
  type ProjectDictionaryFieldHit,
  type ProjectDictionaryMappingTempTable,
  type ProjectDictionaryMappingSqlValidationResult,
  type ProjectDictionaryRectification,
  type ProjectDictionaryRectificationInput,
  type ProjectDictionarySystem,
  type ProjectDictionaryBusinessScenario,
  type ProjectDictionaryBusinessScenarioLibrary,
  type ProjectDictionaryTable,
  type ProjectManagementSummary,
} from "../../api/client.js";
import { DictionaryTestDataPanel } from "./dictionary/DictionaryTestDataPanel.js";
import { dictionaryCodexAttention, type DictionaryCodexAttention } from "./dictionary/DictionaryCodexAttention.js";
import { sortDictionaryFieldsByTemplateOrder } from "./dictionary/DictionaryMetadata.js";
import { dictionaryTableMarker, dictionaryTableMarkerOptions, type DictionaryTableMarker } from "./dictionary/DictionaryTableMarker.js";
import {
  DictionaryFieldGrid,
  DictionaryMappingPanel,
  DictionaryPropertyViewer,
  DictionaryRelationsPanel,
  DictionaryTableInfoPanel,
  DictionaryTempTablePanel,
  collectDictionaryMappingRefLabels,
  dictionaryPropertyLabel,
  dictionaryRectificationStatusLabel,
  dictionaryTempTablesToFieldHits,
  isDictionaryTempField,
} from "./dictionary/DictionaryComponents.js";
import {
  DictionarySystemOverview,
  DictionarySystemTitleRail,
  DictionaryTableTitleRail,
} from "./dictionary/DictionarySystemPanels.js";
import type { ProjectManagementSearchTarget } from "./ProjectManagementNavigation.js";
import { openBoundCodex } from "./deliverables/DeliverableCodexLauncher.js";
import { ProjectRichTextEditor } from "./ProjectManagementModules.js";

type DictionaryView = "field-design" | "mapping" | "temp-table" | "relations" | "test-data" | "table-info";
type DictionarySourceRef = { label: string; field?: ProjectDictionaryFieldHit };
type DictionaryTableRef = { label: string; table?: ProjectDictionaryTable };
type DictionarySqlConversion = { status: "complete" | "blocked" | "invalid"; sql?: string; reason?: string };
type DictionaryPropertyPayload = {
  kind: "fieldDetail" | "tableDetail" | "systemDetail" | "description" | "codeValue" | "formatPattern" | "mappingLogic" | "mappingCaliber" | "externalSql" | "sourceRefs" | "generic";
  title: string; subtitle?: string; value: string; remark?: string;
  system?: ProjectDictionarySystem; table?: ProjectDictionaryTable; field?: ProjectDictionaryFieldHit;
  refs?: DictionarySourceRef[]; tableRefs?: DictionaryTableRef[]; sqlConversion?: DictionarySqlConversion;
  sqlValidation?: ProjectDictionaryMappingSqlValidationResult["caliber"] | ProjectDictionaryMappingSqlValidationResult["fields"][number];
  sqlValidationBusy?: boolean;
};
type DictionaryRectificationTarget = Pick<ProjectDictionaryRectificationInput, "entityType" | "entityId" | "propertyKey"> & { label: string; currentValue?: string };
type DictionaryTreeDragState = { kind: "system"; id: string } | { kind: "table"; id: string; systemId: string };
type DictionaryWorkspaceState = { selectedSystemId: string; expandedSystemIds: string[]; selectedTableId: string; openTableTitleIds: string[] };
type DictionaryTreeDragEvent = { dataTransfer: DataTransfer; preventDefault: () => void };
type DictionaryCatalog = "business-scenarios" | "tables";

export { dictionaryCodexAttention } from "./dictionary/DictionaryCodexAttention.js";

export function DictionarySection({ project, summary, searchTarget }: { project: Element; summary: ProjectManagementSummary | null; searchTarget?: ProjectManagementSearchTarget | null }) {
  const rememberedWorkspace = useMemo(() => loadDictionaryWorkspaceState(project.id), [project.id]);
  const [systems, setSystems] = useState<ProjectDictionarySystem[]>([]);
  const [catalog, setCatalog] = useState<DictionaryCatalog>("tables");
  const [businessScenarios, setBusinessScenarios] = useState<ProjectDictionaryBusinessScenario[]>([]);
  const [businessScenarioLibraries, setBusinessScenarioLibraries] = useState<ProjectDictionaryBusinessScenarioLibrary[]>([]);
  const [selectedBusinessScenarioLibraryId, setSelectedBusinessScenarioLibraryId] = useState("");
  const [creatingBusinessScenario, setCreatingBusinessScenario] = useState(false);
  const [businessScenarioLibraryDraft, setBusinessScenarioLibraryDraft] = useState({ name: "", dbType: "postgresql", host: "", port: "", database: "", username: "", password: "" });
  const [selectedBusinessScenarioId, setSelectedBusinessScenarioId] = useState("");
  const [businessScenarioBusy, setBusinessScenarioBusy] = useState(false);
  const [businessScenarioDraft, setBusinessScenarioDraft] = useState({ title: "", procedureName: "", externalLocation: "", sqlText: "", remark: "", tableIds: [] as string[] });
  const [selectedSystemId, setSelectedSystemId] = useState<string>(rememberedWorkspace.selectedSystemId);
  const [expandedSystemIds, setExpandedSystemIds] = useState<string[]>(rememberedWorkspace.expandedSystemIds);
  const [expandedScenarioSystemIds, setExpandedScenarioSystemIds] = useState<string[]>([]);
  const [tables, setTables] = useState<ProjectDictionaryTable[]>([]);
  const [tableTrees, setTableTrees] = useState<Record<string, ProjectDictionaryTable[]>>({});
  const [selectedTableId, setSelectedTableId] = useState<string>(rememberedWorkspace.selectedTableId);
  const [activeView, setActiveView] = useState<DictionaryView>(() => rememberedWorkspace.selectedTableId
    ? loadDictionaryTableViews(project.id)[rememberedWorkspace.selectedTableId] || "field-design"
    : "field-design");
  const [viewByTableId, setViewByTableId] = useState<Record<string, DictionaryView>>(() => loadDictionaryTableViews(project.id));
  const [query, setQuery] = useState("");
  const [tableFields, setTableFields] = useState<ProjectDictionaryFieldHit[]>([]);
  const [mappingRefFields, setMappingRefFields] = useState<ProjectDictionaryFieldHit[]>([]);
  const [tempTables, setTempTables] = useState<ProjectDictionaryMappingTempTable[]>([]);
  const [results, setResults] = useState<ProjectDictionaryFieldHit[]>([]);
  const [selectedFieldId, setSelectedFieldId] = useState<string>("");
  const [propertyViewer, setPropertyViewer] = useState<DictionaryPropertyPayload | null>(null);
  const [rectifications, setRectifications] = useState<ProjectDictionaryRectification[]>([]);
  const [rectificationMenu, setRectificationMenu] = useState<(DictionaryRectificationTarget & { x: number; y: number }) | null>(null);
  const [tableMarkerMenu, setTableMarkerMenu] = useState<{ table: ProjectDictionaryTable; x: number; y: number } | null>(null);
  const [tableMarkerBusy, setTableMarkerBusy] = useState(false);
  const [rectificationDraft, setRectificationDraft] = useState<DictionaryRectificationTarget | null>(null);
  const [rectificationRequirement, setRectificationRequirement] = useState("");
  const [rectificationBusy, setRectificationBusy] = useState(false);
  const [tableCache, setTableCache] = useState<Record<string, ProjectDictionaryTable>>({});
  const [pinnedSystemIds, setPinnedSystemIds] = useState<string[]>(() => loadPinnedDictionarySystems(project.id));
  const [pinnedTableIds, setPinnedTableIds] = useState<string[]>(() => loadPinnedDictionaryTables(project.id));
  const [openTableTitleIds, setOpenTableTitleIds] = useState<string[]>(rememberedWorkspace.openTableTitleIds);
  const [systemOrderIds, setSystemOrderIds] = useState<string[]>(() => loadDictionarySystemOrder(project.id));
  const [tableOrderBySystem, setTableOrderBySystem] = useState<Record<string, string[]>>(() => loadDictionaryTableOrder(project.id));
  const [treeDrag, setTreeDrag] = useState<DictionaryTreeDragState | null>(null);
  const [loading, setLoading] = useState(false);
  const [systemsLoaded, setSystemsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [dictionaryInfoOpen, setDictionaryInfoOpen] = useState(false);
  const [dictionaryInfoHtml, setDictionaryInfoHtml] = useState("");
  const [savedDictionaryInfoHtml, setSavedDictionaryInfoHtml] = useState("");
  const [dictionaryInfoLoaded, setDictionaryInfoLoaded] = useState(false);
  const [codexAttention, setCodexAttention] = useState<DictionaryCodexAttention>("idle");
  const tableNavigationStackRef = useRef<string[]>(rememberedWorkspace.selectedTableId ? [rememberedWorkspace.selectedTableId] : []);
  const dictionaryCodexViewedAtKey = (conversationId: string) => `rich:dictionary-codex-viewed-at:${project.id}:${conversationId}`;
  const setDictionaryCodexViewedAt = (conversationId: string) => localStorage.setItem(dictionaryCodexViewedAtKey(conversationId), new Date().toISOString());
  useEffect(() => {
    let cancelled = false;
    const refreshCodexAttention = async () => {
      try {
        const session = (await api.listProjectDictionaryCodexSessions(project.id)).find(item => item.isBound);
        if (!session) { if (!cancelled) setCodexAttention("idle"); return; }
        const [status, messages] = await Promise.all([
          api.getProjectDictionaryCodexStatus(session.id),
          api.listProjectDictionaryCodexMessages(session.id),
        ]);
        const latestAssistantCreatedAt = [...messages].reverse().find(message => message.role === "assistant")?.createdAt;
        const key = dictionaryCodexViewedAtKey(session.id);
        let viewedAt = localStorage.getItem(key) ?? undefined;
        if (!viewedAt) {
          viewedAt = latestAssistantCreatedAt ?? new Date().toISOString();
          localStorage.setItem(key, viewedAt);
        }
        if (!cancelled) setCodexAttention(dictionaryCodexAttention({ running: status.running, latestAssistantCreatedAt, viewedAt }));
      } catch {
        if (!cancelled) setCodexAttention("idle");
      }
    };
    void refreshCodexAttention();
    const timer = window.setInterval(() => void refreshCodexAttention(), 2_000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [project.id]);
  useEffect(() => {
    let cancelled = false;
    setSystemsLoaded(false);
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
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (!cancelled) setSystemsLoaded(true); });
    return () => { cancelled = true; };
  }, [project.id, refreshKey]);
  useEffect(() => {
    setDictionaryInfoOpen(false);
    setDictionaryInfoHtml("");
    setSavedDictionaryInfoHtml("");
    setDictionaryInfoLoaded(false);
  }, [project.id]);
  useEffect(() => {
    if (!dictionaryInfoOpen || !dictionaryInfoLoaded || dictionaryInfoHtml === savedDictionaryInfoHtml) return;
    const timer = window.setTimeout(() => {
      void api.saveProjectDictionaryInfo(project.id, dictionaryInfoHtml)
        .then(next => setSavedDictionaryInfoHtml(next.html))
        .catch(reason => setError(reason instanceof Error ? reason.message : String(reason)));
    }, 600);
    return () => window.clearTimeout(timer);
  }, [dictionaryInfoHtml, dictionaryInfoLoaded, dictionaryInfoOpen, project.id, savedDictionaryInfoHtml]);
  useEffect(() => { let cancelled = false; void api.listProjectDictionaryBusinessScenarioLibraries(project.id).then(items => { if (!cancelled) { setBusinessScenarioLibraries(items); setSelectedBusinessScenarioLibraryId(current => current || items[0]?.id || ""); } }).catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)); }); return () => { cancelled = true; }; }, [project.id, refreshKey]);

  useEffect(() => {
    let cancelled = false;
    void api.listProjectDictionaryBusinessScenarios(project.id).then(items => { if (!cancelled) setBusinessScenarios(items); }).catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)); });
    return () => { cancelled = true; };
  }, [project.id, refreshKey]);

  useEffect(() => {
    let cancelled = false;
    void api.listProjectDictionaryRectifications(project.id)
      .then(next => { if (!cancelled) setRectifications(next); })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)); });
    return () => { cancelled = true; };
  }, [project.id, refreshKey]);

  useEffect(() => {
    if (!searchTarget || (searchTarget.entityType !== "dictionaryField" && searchTarget.entityType !== "dictionaryTable")) return;
    if (searchTarget.systemId) {
      setSelectedSystemId(searchTarget.systemId);
      setExpandedSystemIds(current => current.includes(searchTarget.systemId!) ? current : [...current, searchTarget.systemId!]);
    }
    if (searchTarget.tableId) {
      setSelectedTableId(searchTarget.tableId);
      setOpenTableTitleIds(current => current.includes(searchTarget.tableId!) ? current : [...current, searchTarget.tableId!]);
      setActiveView("field-design");
    }
    if (searchTarget.entityType === "dictionaryTable") {
      setSelectedFieldId("");
      return;
    }
    let cancelled = false;
    void api.getProjectDictionaryField(project.id, searchTarget.entityId)
      .then(field => {
        if (cancelled) return;
        if (field.systemId) {
          setSelectedSystemId(field.systemId);
          setExpandedSystemIds(current => current.includes(field.systemId!) ? current : [...current, field.systemId!]);
        }
        if (field.tableId) {
          setSelectedTableId(field.tableId);
          setOpenTableTitleIds(current => current.includes(field.tableId!) ? current : [...current, field.tableId!]);
          setActiveView("field-design");
        }
        setSelectedFieldId(field.id);
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [project.id, searchTarget]);

  useEffect(() => {
    const savedWorkspace = loadDictionaryWorkspaceState(project.id);
    const savedViews = loadDictionaryTableViews(project.id);
    setPinnedSystemIds(loadPinnedDictionarySystems(project.id));
    setPinnedTableIds(loadPinnedDictionaryTables(project.id));
    setOpenTableTitleIds(savedWorkspace.openTableTitleIds);
    setViewByTableId(savedViews);
    setSelectedSystemId(savedWorkspace.selectedSystemId);
    setExpandedSystemIds(savedWorkspace.expandedSystemIds);
    setSelectedTableId(savedWorkspace.selectedTableId);
    setActiveView(savedWorkspace.selectedTableId ? savedViews[savedWorkspace.selectedTableId] || "field-design" : "field-design");
    setSystemOrderIds(loadDictionarySystemOrder(project.id));
    setTableOrderBySystem(loadDictionaryTableOrder(project.id));
  }, [project.id]);

  useEffect(() => {
    saveDictionaryWorkspaceState(project.id, {
      selectedSystemId,
      expandedSystemIds,
      selectedTableId,
      openTableTitleIds,
    });
  }, [expandedSystemIds, openTableTitleIds, project.id, selectedSystemId, selectedTableId]);

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
      setTempTables([]);
      setPropertyViewer(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void api.listProjectDictionaryFields(project.id, selectedTableId)
      .then(next => {
        if (cancelled) return;
        const sorted = sortDictionaryFieldsByTemplateOrder(next);
        setTableFields(sorted);
        setSelectedFieldId(current => sorted.some(field => field.id === current) ? current : sorted[0]?.id || "");
        setPropertyViewer(current => {
          if (current?.kind !== "fieldDetail" || !current.field) return current;
          const updated = sorted.find(field => field.id === current.field?.id);
          return updated ? { ...current, field: updated, value: [updated.description, updated.codeValue, updated.remark].filter(Boolean).join("\n") } : current;
        });
      })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [project.id, refreshKey, selectedTableId]);

  useEffect(() => {
    let cancelled = false;
    if (!selectedTableId) {
      setTempTables([]);
      return () => { cancelled = true; };
    }
    void api.listProjectDictionaryMappingTempTables(project.id, selectedTableId)
      .then(next => { if (!cancelled) setTempTables(next); })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)); });
    return () => { cancelled = true; };
  }, [project.id, refreshKey, selectedTableId]);

  const dictionary = summary?.dictionary ?? { systems: 0, tables: 0, fields: 0 };
  const orderedSystems = useMemo(() => applyDictionaryItemOrder(systems, systemOrderIds), [systems, systemOrderIds]);
  const orderedTables = useMemo(
    () => applyDictionaryItemOrder(tables, tableOrderBySystem[selectedSystemId] ?? []),
    [selectedSystemId, tableOrderBySystem, tables],
  );
  const rectificationIndex = useMemo(() => new Map(
    rectifications
      .filter(item => item.status !== "cancelled")
      .map(item => [`${item.entityType}:${item.entityId}:${item.propertyKey}`, item] as const),
  ), [rectifications]);
  const selectedSystem = orderedSystems.find(system => system.id === selectedSystemId);
  const selectedTable = orderedTables.find(table => table.id === selectedTableId) ?? tableCache[selectedTableId];
  const selectedBusinessScenario = businessScenarios.find(scenario => scenario.id === selectedBusinessScenarioId);
  const selectedBusinessScenarioLibrary = businessScenarioLibraries.find(library => library.id === selectedBusinessScenarioLibraryId);
  useEffect(() => { if (selectedBusinessScenarioLibrary) setBusinessScenarioLibraryDraft({ name: selectedBusinessScenarioLibrary.name, dbType: selectedBusinessScenarioLibrary.dbType || "postgresql", host: selectedBusinessScenarioLibrary.connection?.host || "", port: String(selectedBusinessScenarioLibrary.connection?.port || ""), database: selectedBusinessScenarioLibrary.connection?.database || "", username: selectedBusinessScenarioLibrary.connection?.username || "", password: selectedBusinessScenarioLibrary.connection?.password || "" }); }, [selectedBusinessScenarioLibrary?.updatedAt, selectedBusinessScenarioLibraryId]);
  const scenarioLibraryTree = businessScenarioLibraries.map(library => ({ id: library.id, code: library.name, name: library.name, assetLayer: "业务场景", tableCount: 0, fieldCount: 0 } as ProjectDictionarySystem));
  useEffect(() => { if (selectedBusinessScenario) setBusinessScenarioDraft({ title: selectedBusinessScenario.title, procedureName: selectedBusinessScenario.procedureName, externalLocation: selectedBusinessScenario.externalLocation || "", sqlText: selectedBusinessScenario.sqlText, remark: selectedBusinessScenario.remark || "", tableIds: selectedBusinessScenario.tableIds }); }, [selectedBusinessScenarioId, selectedBusinessScenario?.updatedAt]);
  const mappingAvailable = dictionaryTableSupportsMapping(selectedTable);
  const tempTablesAvailable = dictionaryTableHasTempTables(selectedTable, tempTables);

  useEffect(() => {
    let cancelled = false;
    const tempRefFields = dictionaryTempTablesToFieldHits(selectedSystem, selectedTable, tempTables);
    const baseRefFields = [...tableFields, ...tempRefFields];
    if (activeView !== "mapping" && activeView !== "temp-table") {
      setMappingRefFields(baseRefFields);
      return () => { cancelled = true; };
    }
    const refs = activeView === "temp-table"
      ? collectDictionaryMappingRefLabels(selectedTable, tempRefFields)
      : collectDictionaryMappingRefLabels(selectedTable, tableFields);
    if (refs.length === 0) {
      setMappingRefFields(baseRefFields);
      return () => { cancelled = true; };
    }
    void api.resolveProjectDictionaryFieldRefs(project.id, refs)
      .then(next => {
        if (cancelled) return;
        const byId = new Map<string, ProjectDictionaryFieldHit>();
        tableFields.forEach(field => byId.set(field.id, field));
        tempRefFields.forEach(field => byId.set(field.id, field));
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
  }, [activeView, project.id, selectedSystem, selectedTable, tableFields, tempTables]);

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
    const ids = [...pinnedTableIds, ...openTableTitleIds];
    if (selectedTableId && !ids.includes(selectedTableId)) ids.push(selectedTableId);
    const seen = new Set<string>();
    return ids.flatMap(id => {
      if (seen.has(id)) return [];
      seen.add(id);
      const table = byId.get(id);
      return table ? [table] : [];
    });
  }, [openTableTitleIds, orderedTables, pinnedTableIds, selectedTableId, tableCache]);
  const rememberOpenTableTitle = (tableId: string) => {
    setOpenTableTitleIds(current => {
      const withoutTarget = current.filter(id => id !== tableId);
      const currentWasOpen = current.includes(tableId);
      const previousTableNeedsTitle = selectedTableId
        && selectedTableId !== tableId
        && !pinnedTableIds.includes(selectedTableId)
        && !withoutTarget.includes(selectedTableId);
      const withPrevious = previousTableNeedsTitle ? [...withoutTarget, selectedTableId] : withoutTarget;
      if (currentWasOpen) return current;
      if (pinnedTableIds.includes(tableId)) return withPrevious;
      return [...withPrevious, tableId];
    });
  };
  const closeDictionaryInfo = () => {
    if (dictionaryInfoLoaded && dictionaryInfoHtml !== savedDictionaryInfoHtml) {
      void api.saveProjectDictionaryInfo(project.id, dictionaryInfoHtml)
        .then(info => setSavedDictionaryInfoHtml(info.html))
        .catch(reason => setError(reason instanceof Error ? reason.message : String(reason)));
    }
    setDictionaryInfoOpen(false);
  };
  const openTable = (tableId: string) => {
    closeDictionaryInfo();
    if (selectedTableId !== tableId) setPropertyViewer(null);
    if (selectedTableId && selectedTableId !== tableId) {
      tableNavigationStackRef.current = [
        ...tableNavigationStackRef.current.filter(id => id !== selectedTableId),
        selectedTableId,
      ].slice(-30);
    }
    const tablePageAlreadyOpen = selectedTableId === tableId || pinnedTableIds.includes(tableId) || openTableTitleIds.includes(tableId);
    const table = Object.values(tableTrees).flat().find(item => item.id === tableId)
      ?? tables.find(item => item.id === tableId)
      ?? tableCache[tableId];
    if (table) {
      setTableCache(current => current[table.id] ? current : { ...current, [table.id]: table });
      if (table.systemId) setSelectedSystemId(table.systemId);
    }
    rememberOpenTableTitle(tableId);
    if (!tablePageAlreadyOpen) {
      setViewByTableId(current => {
        if (!(tableId in current)) return current;
        const next = { ...current };
        delete next[tableId];
        saveDictionaryTableViews(project.id, next);
        return next;
      });
    }
    setSelectedTableId(tableId);
    const rememberedView = tablePageAlreadyOpen ? viewByTableId[tableId] || "field-design" : "field-design";
    setActiveView(dictionaryTableSupportsMapping(table) || !["mapping", "temp-table", "relations"].includes(rememberedView) ? rememberedView : "field-design");
    setQuery("");
  };
  const selectDictionaryView = (view: DictionaryView) => {
    if (activeView !== view) setPropertyViewer(null);
    setActiveView(view);
    if (!selectedTableId) return;
    setViewByTableId(current => {
      if (current[selectedTableId] === view) return current;
      const next = { ...current, [selectedTableId]: view };
      saveDictionaryTableViews(project.id, next);
      return next;
    });
  };
  useEffect(() => {
    if (!mappingAvailable && ["mapping", "temp-table", "relations"].includes(activeView)) {
      setActiveView("field-design");
      return;
    }
    if (!tempTablesAvailable && activeView === "temp-table") setActiveView(mappingAvailable ? "mapping" : "field-design");
  }, [activeView, mappingAvailable, tempTablesAvailable]);
  const visibleFields = query.trim()
    ? results
    : tableFields;
  const refreshDictionary = () => {
    setError(null);
    setRefreshKey(current => current + 1);
  };
  const openSystem = (systemId: string) => {
    setPropertyViewer(null);
    setSelectedSystemId(systemId);
    setExpandedSystemIds(current => current.includes(systemId) ? current : [...current, systemId]);
    setSelectedTableId("");
    setActiveView("field-design");
    setSelectedFieldId("");
    setQuery("");
  };
  const toggleSystemExpanded = (systemId: string) => {
    setExpandedSystemIds(current => current.includes(systemId)
      ? current.filter(id => id !== systemId)
      : [...current, systemId]);
  };
  const handleSystemClick = (system: ProjectDictionarySystem) => {
    setPropertyViewer(null);
    if (catalog === "business-scenarios") { setSelectedBusinessScenarioLibraryId(system.id); setSelectedBusinessScenarioId(""); setCreatingBusinessScenario(false); }
    else setSelectedSystemId(system.id);
    if (catalog === "business-scenarios") setExpandedScenarioSystemIds(current => current.includes(system.id) ? current.filter(id => id !== system.id) : [...current, system.id]);
    else toggleSystemExpanded(system.id);
    setSelectedTableId("");
    setActiveView("field-design");
    setSelectedFieldId("");
    setQuery("");
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
  const closeTableTitle = (tableId: string) => {
    const nextOpenIds = openTableTitleIds.filter(id => id !== tableId);
    const nextPinnedIds = pinnedTableIds.filter(id => id !== tableId);
    setOpenTableTitleIds(nextOpenIds);
    setPinnedTableIds(() => {
      savePinnedDictionaryTables(project.id, nextPinnedIds);
      return nextPinnedIds;
    });
    setViewByTableId(current => {
      if (!(tableId in current)) return current;
      const next = { ...current };
      delete next[tableId];
      saveDictionaryTableViews(project.id, next);
      return next;
    });

    if (selectedTableId !== tableId) return;
    tableNavigationStackRef.current = tableNavigationStackRef.current.filter(id => id !== tableId);
    const fallbackCandidates = [...nextPinnedIds, ...nextOpenIds].filter(id => id !== tableId);
    const fallbackId = [...tableNavigationStackRef.current]
      .reverse()
      .find(id => fallbackCandidates.includes(id))
      ?? fallbackCandidates.at(-1);
    if (!fallbackId) {
      setPropertyViewer(null);
      setSelectedTableId("");
      setActiveView("field-design");
      setSelectedFieldId("");
      setQuery("");
      return;
    }
    const fallbackTable = Object.values(tableTrees).flat().find(item => item.id === fallbackId)
      ?? tables.find(item => item.id === fallbackId)
      ?? tableCache[fallbackId];
    if (fallbackTable?.systemId) setSelectedSystemId(fallbackTable.systemId);
    setPropertyViewer(null);
    setSelectedTableId(fallbackId);
    setActiveView(viewByTableId[fallbackId] || "field-design");
    setSelectedFieldId("");
    setQuery("");
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
  const openRectificationMenu = (event: ReactMouseEvent<HTMLElement>, target: DictionaryRectificationTarget) => {
    event.preventDefault();
    event.stopPropagation();
    setRectificationMenu({ ...target, x: event.clientX, y: event.clientY });
  };
  const openTableMarkerMenu = (event: ReactMouseEvent<HTMLElement>, table: ProjectDictionaryTable) => {
    event.preventDefault();
    event.stopPropagation();
    setRectificationMenu(null);
    setTableMarkerMenu({ table, x: event.clientX, y: event.clientY });
  };
  const saveTableMarker = async (table: ProjectDictionaryTable, marker?: DictionaryTableMarker) => {
    setTableMarkerBusy(true);
    setError(null);
    try {
      const nextExtra = { ...(table.extra ?? {}) };
      if (marker) nextExtra.tableMarker = marker;
      else delete nextExtra.tableMarker;
      const updated = await api.updateProjectDictionaryTable(project.id, table.id, { extra: nextExtra });
      const replace = (items: ProjectDictionaryTable[]) => items.map(item => item.id === updated.id ? updated : item);
      setTables(replace);
      setTableTrees(current => Object.fromEntries(Object.entries(current).map(([systemId, items]) => [systemId, replace(items)])));
      setTableCache(current => ({ ...current, [updated.id]: updated }));
      setTableMarkerMenu(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setTableMarkerBusy(false);
    }
  };
  const rectificationFor = (target: DictionaryRectificationTarget) => rectificationIndex.get(`${target.entityType}:${target.entityId}:${target.propertyKey}`);
  const createRectification = async () => {
    if (!rectificationDraft || !rectificationRequirement.trim()) return;
    setRectificationBusy(true);
    setError(null);
    try {
      const created = await api.createProjectDictionaryRectification(project.id, {
        entityType: rectificationDraft.entityType,
        entityId: rectificationDraft.entityId,
        propertyKey: rectificationDraft.propertyKey,
        requirement: rectificationRequirement.trim(),
        createdBy: "Rich 用户",
      });
      setRectifications(current => [created, ...current]);
      setRectificationDraft(null);
      setRectificationRequirement("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRectificationBusy(false);
    }
  };
  const updateRectificationStatus = async (record: ProjectDictionaryRectification, status: ProjectDictionaryRectification["status"]) => {
    setRectificationBusy(true);
    setError(null);
    try {
      const updated = await api.updateProjectDictionaryRectification(project.id, record.id, {
        status,
        resolvedBy: status === "open" ? null : "Rich 用户",
      });
      setRectifications(current => current.map(item => item.id === updated.id ? updated : item));
      setRectificationMenu(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRectificationBusy(false);
    }
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
    if (isDictionaryTempField(field)) {
      setPropertyViewer({
        kind: "fieldDetail",
        title: "临时字段详情",
        subtitle: `${field.tableCn || field.tableName || "临时表"} / ${field.fieldName}`,
        value: [field.description, field.remark].filter(Boolean).join("\n"),
        field,
      });
      return;
    }
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
                tableType: undefined,
                dataLayer: "",
                caliber: "",
                fieldCount: 0,
              },
            });
      }
      rememberOpenTableTitle(tableId);
      setSelectedTableId(tableId);
    }
    setActiveView("field-design");
    const targetTableId = field.tableId || selectedTableId;
    if (targetTableId) {
      setViewByTableId(current => {
        if (current[targetTableId] === "field-design") return current;
        const next = { ...current, [targetTableId]: "field-design" as DictionaryView };
        saveDictionaryTableViews(project.id, next);
        return next;
      });
    }
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
  const getVisibleTreeTables = (systemId: string) => getTreeTables(systemId)
    .filter(dictionaryTableIsInUse);
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
  const openDictionaryCodexConversation = async () => {
    try {
      const session = await api.ensureProjectDictionaryCodexSession(project.id);
      setDictionaryCodexViewedAt(session.conversation.id);
      setCodexAttention("idle");
      openBoundCodex({ projectId: project.id, deliverableId: project.id, deliverableTitle: `${project.title} · 数据字典`, resourceType: "dictionary", conversationId: session.conversation.id });
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
  };
  const openDictionaryInfo = async () => {
    try {
      const info = await api.getProjectDictionaryInfo(project.id);
      setDictionaryInfoHtml(info.html);
      setSavedDictionaryInfoHtml(info.html);
      setDictionaryInfoLoaded(true);
      setDictionaryInfoOpen(true);
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
  };

  if (!systemsLoaded && !error) return null;

  return (
    <div className="prj-pm-dict prj-pm-dict-workbench">
      {error && <div className="prj-pm-error">{error}</div>}

      <div className="prj-pm-dict__layout no-inspector">
        <aside className="prj-pm-dict__systems">
          <div className="prj-pm-dict__tabs" aria-label="数据字典分类">
            <button type="button" className={catalog === "business-scenarios" ? "is-active" : ""} onClick={() => { closeDictionaryInfo(); setCatalog("business-scenarios"); setSelectedTableId(""); }}>业务场景</button>
            <button type="button" className={catalog === "tables" ? "is-active" : ""} onClick={() => { closeDictionaryInfo(); setCatalog("tables"); setSelectedBusinessScenarioId(""); setCreatingBusinessScenario(false); }}>表清单</button>
            <button type="button" className="prj-pm-dict__information-library" aria-label="数据字典信息库" title="数据字典信息库" onClick={() => void openDictionaryInfo()}><LibraryBig aria-hidden="true" /></button>
            <button type="button" className={`prj-pm-dict__codex${codexAttention === "idle" ? "" : ` is-${codexAttention}`}`} aria-label="Codex 对话" title={codexAttention === "working" ? "Codex 正在处理" : codexAttention === "unread" ? "Codex 有未查看回复" : "Codex 对话"} onClick={() => void openDictionaryCodexConversation()}><MessageSquare aria-hidden="true" /></button>
            {catalog === "business-scenarios" && <button type="button" onClick={() => { const name = window.prompt("场景库名称"); if (!name?.trim()) return; void api.createProjectDictionaryBusinessScenarioLibrary(project.id, { name: name.trim() }).then(next => { setBusinessScenarioLibraries(items => [...items, next]); setSelectedBusinessScenarioLibraryId(next.id); setExpandedScenarioSystemIds(items => [...items, next.id]); }).catch(e => setError(e instanceof Error ? e.message : String(e))); }}>新建库</button>}
            {catalog === "business-scenarios" && <button type="button" disabled={!selectedBusinessScenarioLibraryId} onClick={() => { const library = businessScenarioLibraries.find(item => item.id === selectedBusinessScenarioLibraryId); if (!library) return; const dbType = window.prompt("数据库类型（postgresql / sqlserver）", library.dbType || "postgresql"); if (!dbType) return; const host = window.prompt("主机", library.connection?.host || ""); const database = window.prompt("数据库名", library.connection?.database || ""); const username = window.prompt("用户名", library.connection?.username || ""); if (host === null || database === null || username === null) return; void api.updateProjectDictionaryBusinessScenarioLibrary(project.id, library.id, { dbType: dbType as "postgresql" | "sqlserver", sqlDialect: dbType as "postgresql" | "sqlserver", connection: { ...library.connection, host, database, username } }).then(next => setBusinessScenarioLibraries(items => items.map(item => item.id === next.id ? next : item))).catch(e => setError(e instanceof Error ? e.message : String(e))); }}>配置库</button>}
            {catalog === "business-scenarios" && <button type="button" onClick={() => { if (!selectedBusinessScenarioLibraryId) return; setSelectedBusinessScenarioId(""); setCreatingBusinessScenario(true); setBusinessScenarioDraft({ title: "", procedureName: "", externalLocation: "", sqlText: "", remark: "", tableIds: [] }); }}>新建场景</button>}
          </div>
          {systems.length === 0 ? (
            <div className="prj-pm-empty">还没有导入首都银行一表通 Mapping 数据。</div>
          ) : (
            (catalog === "business-scenarios" ? scenarioLibraryTree : orderedSystems).map(system => (
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
                  onClick={() => handleSystemClick(system)}
                  onContextMenu={event => openRectificationMenu(event, {
                    entityType: "library", entityId: system.id, propertyKey: "entity",
                    label: `库：${system.name || system.code}`,
                  })}>
                  <span>{(catalog === "business-scenarios" ? expandedScenarioSystemIds : expandedSystemIds).includes(system.id) ? "▾" : "▸"}</span>
                  <b>{system.code || system.name}</b>
                  <small>{catalog === "business-scenarios" ? "业务场景" : system.assetLayer || system.type || "mapping"}</small>
                  <em>{catalog === "business-scenarios" ? `${businessScenarios.filter(scenario => scenario.libraryId === system.id).length} 个` : (() => {
                    const counts = dictionarySystemTableCounts(getTreeTables(system.id), system.tableCount);
                    return `${counts.used} / ${counts.total}`;
                  })()}</em>
                </button>
                {expandedScenarioSystemIds.includes(system.id) && catalog === "business-scenarios" && (
                  <div className="prj-pm-dict__table-tree prj-pm-dict__scenario-tree">
                    {businessScenarios.filter(scenario => scenario.libraryId === system.id).map(scenario => <button key={scenario.id} type="button" className={selectedBusinessScenarioId === scenario.id ? "is-active" : ""} onClick={() => { setSelectedBusinessScenarioId(scenario.id); setCreatingBusinessScenario(false); setSelectedTableId(""); }}><span>{scenario.title}</span><code>{scenario.procedureName}</code></button>)}
                  </div>
                )}
                {expandedSystemIds.includes(system.id) && catalog === "tables" && (
                  <div className="prj-pm-dict__table-tree">
                    {getVisibleTreeTables(system.id).map(table => (
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
                        onClick={() => openTable(table.id)}
                        onContextMenu={event => openTableMarkerMenu(event, table)}>
                        <span className="prj-pm-dict__table-name">{renderDictionaryTableMarker(dictionaryTableMarker(table.extra))}{table.tableCn || table.tableName}</span>
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
          dictionaryInfoOpen ? "is-information-library" : "",
          selectedBusinessScenario || (catalog === "business-scenarios" && !selectedBusinessScenarioId) ? "is-business-scenario" : "",
          !query.trim() && !selectedTable ? "is-system-overview" : "",
          titleTables.length > 0 || titleSystems.length > 0 ? "has-table-rail" : "",
          titleTables.length > 0 && titleSystems.length > 0 ? "has-system-and-table-rail" : "",
        ].filter(Boolean).join(" ")}>
          {dictionaryInfoOpen ? (
            <div className="prj-pm-dict__information-library-editor">
              <ProjectRichTextEditor projectId={`${project.id}-dictionary-info`} value={dictionaryInfoHtml} onChange={setDictionaryInfoHtml} />
            </div>
          ) : catalog === "business-scenarios" && creatingBusinessScenario ? (
            <div className="prj-pm-dict__scenario-detail"><h2>新建业务场景</h2><BusinessScenarioEditor draft={businessScenarioDraft} setDraft={setBusinessScenarioDraft} tables={orderedTables} busy={businessScenarioBusy} onSave={() => { if (!selectedBusinessScenarioLibraryId) return; setBusinessScenarioBusy(true); void api.createProjectDictionaryBusinessScenario(project.id, { libraryId: selectedBusinessScenarioLibraryId, ...businessScenarioDraft }).then(next => { setBusinessScenarios(items => [...items, next]); setSelectedBusinessScenarioId(next.id); }).catch(e => setError(e instanceof Error ? e.message : String(e))).finally(() => setBusinessScenarioBusy(false)); }} /></div>
          ) : selectedBusinessScenario ? (
            <div className="prj-pm-dict__scenario-detail">
              <h2>{selectedBusinessScenario.title}</h2>
              <p>SQL 校验：{selectedBusinessScenario.validationStatus === "passed" ? "已通过" : selectedBusinessScenario.validationStatus === "failed" ? "失败" : "待校验"}</p>
              {selectedBusinessScenario.validationMessage && <p>{selectedBusinessScenario.validationMessage}</p>}
              <p>
                <button type="button" disabled={businessScenarioBusy} onClick={() => { setBusinessScenarioBusy(true); void api.formatProjectDictionaryBusinessScenario(project.id, selectedBusinessScenario.id).then(next => setBusinessScenarios(items => items.map(item => item.id === next.id ? next : item))).catch(e => setError(e instanceof Error ? e.message : String(e))).finally(() => setBusinessScenarioBusy(false)); }}>格式化 SQL</button>
                <button type="button" disabled={businessScenarioBusy} onClick={() => { setBusinessScenarioBusy(true); void api.validateProjectDictionaryBusinessScenario(project.id, selectedBusinessScenario.id).then(next => setBusinessScenarios(items => items.map(item => item.id === next.id ? next : item))).catch(e => setError(e instanceof Error ? e.message : String(e))).finally(() => setBusinessScenarioBusy(false)); }}>SQL 校验</button>
              </p>
              {selectedBusinessScenario.externalLocation && <p>外部位置：{selectedBusinessScenario.externalLocation}</p>}
              <h3>完整 SQL</h3><pre>{selectedBusinessScenario.sqlText}</pre>
              <h3>关联表</h3><p>{selectedBusinessScenario.tableIds.map(id => orderedTables.find(table => table.id === id)?.tableName || id).join("、") || "未关联表"}</p>
              <BusinessScenarioEditor draft={businessScenarioDraft} setDraft={setBusinessScenarioDraft} tables={orderedTables} busy={businessScenarioBusy} onSave={() => { setBusinessScenarioBusy(true); void api.updateProjectDictionaryBusinessScenario(project.id, selectedBusinessScenario.id, businessScenarioDraft).then(next => setBusinessScenarios(items => items.map(item => item.id === next.id ? next : item))).catch(e => setError(e instanceof Error ? e.message : String(e))).finally(() => setBusinessScenarioBusy(false)); }} />
            </div>
          ) : catalog === "business-scenarios" && selectedBusinessScenarioLibrary ? (
            <div className="prj-pm-dict__scenario-detail"><h2>场景库：{selectedBusinessScenarioLibrary.name}</h2><p>该库下的所有场景与存储过程均使用以下数据库配置。</p><ScenarioLibraryEditor draft={businessScenarioLibraryDraft} setDraft={setBusinessScenarioLibraryDraft} onSave={() => { void api.updateProjectDictionaryBusinessScenarioLibrary(project.id, selectedBusinessScenarioLibrary.id, { name: businessScenarioLibraryDraft.name, dbType: businessScenarioLibraryDraft.dbType as "postgresql" | "sqlserver", sqlDialect: businessScenarioLibraryDraft.dbType as "postgresql" | "sqlserver", connection: { host: businessScenarioLibraryDraft.host, port: Number(businessScenarioLibraryDraft.port) || undefined, database: businessScenarioLibraryDraft.database, username: businessScenarioLibraryDraft.username, password: businessScenarioLibraryDraft.password || undefined } }).then(next => setBusinessScenarioLibraries(items => items.map(item => item.id === next.id ? next : item))).catch(e => setError(e instanceof Error ? e.message : String(e))); }} /></div>
          ) : !query.trim() && !selectedTable ? (
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
                  onClose={closeTableTitle}
                />
                <button type="button" className="prj-pm-dict-refresh" aria-label={loading ? "刷新中" : "刷新"} title={loading ? "刷新中" : "刷新"} onClick={refreshDictionary} disabled={loading}>↻</button>
              </div>
              <DictionarySystemOverview
                projectId={project.id}
                system={selectedSystem}
                tables={orderedTables}
                dictionary={dictionary}
                onSystemSaved={(nextSystem) => setSystems(current => current.map(item => item.id === nextSystem.id ? nextSystem : item))}
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
                  onClose={closeTableTitle}
                />
                <button type="button" className="prj-pm-dict-refresh" aria-label={loading ? "刷新中" : "刷新"} title={loading ? "刷新中" : "刷新"} onClick={refreshDictionary} disabled={loading}>↻</button>
              </div>
              <div className="prj-pm-dict__tabs">
                <button type="button" className={activeView === "field-design" ? "is-active" : ""} onClick={() => selectDictionaryView("field-design")}>字段设计</button>
                {mappingAvailable && <button type="button" className={activeView === "mapping" ? "is-active" : ""} onClick={() => selectDictionaryView("mapping")}>Mapping</button>}
                {tempTablesAvailable && <button type="button" className={activeView === "temp-table" ? "is-active" : ""} onClick={() => selectDictionaryView("temp-table")}>临时表</button>}
                {mappingAvailable && <button type="button" className={activeView === "relations" ? "is-active" : ""} onClick={() => selectDictionaryView("relations")}>关联关系</button>}
                <button type="button" className={activeView === "test-data" ? "is-active" : ""} onClick={() => selectDictionaryView("test-data")}>测试数据</button>
                <button type="button" className={activeView === "table-info" ? "is-active" : ""} onClick={() => selectDictionaryView("table-info")}>表说明</button>
              </div>
              {activeView === "field-design" && (
                <DictionaryFieldGrid
                  fields={visibleFields}
                  loading={loading}
                  storageKey={`dictionary-field-grid:${project.id}:${selectedTableId || "search"}`}
                  selectedFieldId={selectedFieldId}
                  onSelectField={setSelectedFieldId}
                  onInspectProperty={setPropertyViewer}
                  rectificationIndex={rectificationIndex}
                  onRectify={openRectificationMenu}
                />
              )}
              {activeView === "mapping" && (
                <DictionaryMappingPanel
                  projectId={project.id}
                  system={selectedSystem}
                  table={selectedTable}
                  fields={visibleFields}
                  allFields={mappingRefFields}
                  onInspectProperty={setPropertyViewer}
                  onOpenFieldRef={openLinkedDictionaryField}
                  onOpenTableRef={openTable}
                  rectificationIndex={rectificationIndex}
                  onRectify={openRectificationMenu}
                />
              )}
              {activeView === "temp-table" && (
                <DictionaryTempTablePanel
                  projectId={project.id}
                  system={selectedSystem}
                  table={selectedTable}
                  tempTables={tempTables}
                  allFields={mappingRefFields}
                  onInspectProperty={setPropertyViewer}
                  onOpenFieldRef={openLinkedDictionaryField}
                  onOpenTableRef={openTable}
                />
              )}
              {activeView === "relations" && <DictionaryRelationsPanel fields={visibleFields} />}
              {activeView === "test-data" && <DictionaryTestDataPanel key={selectedTableId || "search"} projectId={project.id} table={selectedTable} fields={visibleFields} storageKey={`dictionary-test-data:${project.id}:${selectedTableId || "search"}`} />}
              {activeView === "table-info" && <DictionaryTableInfoPanel table={selectedTable} fields={visibleFields} onInspectProperty={setPropertyViewer} />}
            </>
          )}
        </section>

      </div>
      <DictionaryPropertyViewer
        payload={propertyViewer}
        onClose={() => setPropertyViewer(null)}
        onOpenFieldRef={openLinkedDictionaryField}
        onOpenTableRef={openTable}
      />
      {tableMarkerMenu && (
        <div className="prj-pm-dict-table-marker-menu" style={{ left: tableMarkerMenu.x, top: tableMarkerMenu.y }}>
          <strong>{tableMarkerMenu.table.tableCn || tableMarkerMenu.table.tableName}</strong>
          <span>选择图标</span>
          <div className="prj-pm-dict-table-marker-menu__options">
            {dictionaryTableMarkerOptions.map(option => (
              <button key={option.id} type="button" disabled={tableMarkerBusy} className={dictionaryTableMarker(tableMarkerMenu.table.extra) === option.id ? "is-active" : ""} onClick={() => void saveTableMarker(tableMarkerMenu.table, option.id)}>
                {renderDictionaryTableMarker(option.id)}{option.label}
              </button>
            ))}
          </div>
          {dictionaryTableMarker(tableMarkerMenu.table.extra) && <button type="button" disabled={tableMarkerBusy} onClick={() => void saveTableMarker(tableMarkerMenu.table)}>移除图标</button>}
          <button type="button" className="is-subtle" onClick={() => { setRectificationDraft({ entityType: "table", entityId: tableMarkerMenu.table.id, propertyKey: "entity", label: `表：${tableMarkerMenu.table.tableCn || tableMarkerMenu.table.tableName}` }); setRectificationRequirement(""); setTableMarkerMenu(null); }}>标记整改</button>
          <button type="button" className="is-subtle" onClick={() => setTableMarkerMenu(null)}>取消</button>
        </div>
      )}
      {rectificationMenu && (() => {
        const existing = rectificationFor(rectificationMenu);
        return (
          <div className="prj-pm-dict-rectification-menu" style={{ left: rectificationMenu.x, top: rectificationMenu.y }}>
            <strong>{rectificationMenu.label}</strong>
            {existing ? (
              <>
                <span className={`is-${existing.status}`}>{dictionaryRectificationStatusLabel(existing.status)}</span>
                <p>{existing.requirement}</p>
                {existing.status === "open" && <button type="button" disabled={rectificationBusy} onClick={() => void updateRectificationStatus(existing, "fixed")}>标记已修复</button>}
                {existing.status === "fixed" && <button type="button" disabled={rectificationBusy} onClick={() => void updateRectificationStatus(existing, "verified")}>通过复核</button>}
                {existing.status !== "open" && <button type="button" disabled={rectificationBusy} onClick={() => void updateRectificationStatus(existing, "open")}>重新打开</button>}
              </>
            ) : (
              <button type="button" onClick={() => { setRectificationDraft(rectificationMenu); setRectificationRequirement(""); setRectificationMenu(null); }}>标记整改</button>
            )}
            <button type="button" className="is-subtle" onClick={() => setRectificationMenu(null)}>取消</button>
          </div>
        );
      })()}
      {rectificationDraft && (
        <div className="prj-pm-dict-rectification-modal" role="dialog" aria-modal="true" aria-label="标记数据字典整改">
          <div>
            <header><strong>标记整改</strong><span>{rectificationDraft.label}</span></header>
            <p>属性：{dictionaryPropertyLabel(rectificationDraft.propertyKey)}</p>
            {rectificationDraft.currentValue && <pre>{rectificationDraft.currentValue}</pre>}
            <textarea autoFocus value={rectificationRequirement} onChange={event => setRectificationRequirement(event.target.value)} placeholder="写下需要整改的规则、目标或核验要求" />
            <footer>
              <button type="button" onClick={() => setRectificationDraft(null)}>取消</button>
              <button type="button" className="is-primary" disabled={rectificationBusy || !rectificationRequirement.trim()} onClick={() => void createRectification()}>{rectificationBusy ? "保存中..." : "保存整改"}</button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}

const dictionaryTableMarkerIcons: Record<DictionaryTableMarker, LucideIcon> = {
  star: Star,
  flag: Flag,
  alert: TriangleAlert,
  bookmark: Bookmark,
  check: CheckCircle2,
  clock: Clock3,
};

function renderDictionaryTableMarker(marker?: DictionaryTableMarker) {
  if (!marker) return null;
  const Icon = dictionaryTableMarkerIcons[marker];
  return <Icon className={`prj-pm-dict__table-marker is-${marker}`} aria-hidden="true" strokeWidth={2.4} />;
}

function dictionaryTableIsInUse(table: ProjectDictionaryTable): boolean {
  return ["使用", "是", "yes", "true", "1", "active", "启用"]
    .includes(table.usageStatus?.trim().toLocaleLowerCase() || "");
}

export function dictionarySystemTableCounts(tables: ProjectDictionaryTable[], total: number): { used: number; total: number } {
  return { used: tables.filter(dictionaryTableIsInUse).length, total };
}

export function dictionaryTableSupportsMapping(table?: ProjectDictionaryTable): boolean {
  return table?.hasMapping !== false && !["源文件", "码值表"].includes(table?.tableType ?? "");
}

export function dictionaryTableHasTempTables(
  table: ProjectDictionaryTable | undefined,
  tempTables: ProjectDictionaryMappingTempTable[],
): boolean {
  return dictionaryTableSupportsMapping(table) && tempTables.length > 0;
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

function dictionaryWorkspaceStateKey(projectId: string) {
  return `rich-project-dictionary-workspace:${projectId}`;
}

function BusinessScenarioEditor({ draft, setDraft, tables, busy, onSave }: { draft: { title: string; procedureName: string; externalLocation: string; sqlText: string; remark: string; tableIds: string[] }; setDraft: (value: { title: string; procedureName: string; externalLocation: string; sqlText: string; remark: string; tableIds: string[] }) => void; tables: ProjectDictionaryTable[]; busy: boolean; onSave: () => void }) {
  const set = (key: "title" | "procedureName" | "externalLocation" | "sqlText" | "remark", value: string) => setDraft({ ...draft, [key]: value });
  return <div className="prj-pm-dict__scenario-editor">
    <label>场景名称<input value={draft.title} onChange={event => set("title", event.target.value)} /></label>
    <label>存储过程<input value={draft.procedureName} onChange={event => set("procedureName", event.target.value)} /></label>
    <label>外部位置<input value={draft.externalLocation} onChange={event => set("externalLocation", event.target.value)} /></label>
    <label>完整 SQL<textarea rows={14} value={draft.sqlText} onChange={event => set("sqlText", event.target.value)} /></label>
    <label>备注<textarea rows={3} value={draft.remark} onChange={event => set("remark", event.target.value)} /></label>
    <fieldset><legend>关联表</legend>{tables.map(table => <label key={table.id}><input type="checkbox" checked={draft.tableIds.includes(table.id)} onChange={() => setDraft({ ...draft, tableIds: draft.tableIds.includes(table.id) ? draft.tableIds.filter(id => id !== table.id) : [...draft.tableIds, table.id] })} />{table.tableCn || table.tableName}</label>)}</fieldset>
    <button type="button" disabled={busy || !draft.title.trim() || !draft.procedureName.trim() || !draft.sqlText.trim()} onClick={onSave}>保存业务场景</button>
  </div>;
}

function ScenarioLibraryEditor({ draft, setDraft, onSave }: { draft: { name: string; dbType: string; host: string; port: string; database: string; username: string; password: string }; setDraft: (value: { name: string; dbType: string; host: string; port: string; database: string; username: string; password: string }) => void; onSave: () => void }) {
  const set = (key: keyof typeof draft, value: string) => setDraft({ ...draft, [key]: value });
  return <div className="prj-pm-dict__scenario-editor"><label>库名称<input value={draft.name} onChange={event => set("name", event.target.value)} /></label><label>数据库类型<select value={draft.dbType} onChange={event => set("dbType", event.target.value)}><option value="postgresql">PostgreSQL</option><option value="sqlserver">SQL Server</option></select></label><label>主机<input value={draft.host} onChange={event => set("host", event.target.value)} /></label><label>端口<input value={draft.port} onChange={event => set("port", event.target.value)} /></label><label>数据库名<input value={draft.database} onChange={event => set("database", event.target.value)} /></label><label>用户名<input value={draft.username} onChange={event => set("username", event.target.value)} /></label><label>密码<input type="password" value={draft.password} onChange={event => set("password", event.target.value)} /></label><button type="button" onClick={onSave}>保存场景库配置</button></div>;
}

function loadDictionaryWorkspaceState(projectId: string): DictionaryWorkspaceState {
  if (typeof window === "undefined") return { selectedSystemId: "", expandedSystemIds: [], selectedTableId: "", openTableTitleIds: [] };
  try {
    const parsed = JSON.parse(window.localStorage.getItem(dictionaryWorkspaceStateKey(projectId)) ?? "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { selectedSystemId: "", expandedSystemIds: [], selectedTableId: "", openTableTitleIds: [] };
    }
    const record = parsed as Record<string, unknown>;
    return {
      selectedSystemId: typeof record.selectedSystemId === "string" ? record.selectedSystemId : "",
      expandedSystemIds: Array.isArray(record.expandedSystemIds) ? record.expandedSystemIds.filter(id => typeof id === "string") : [],
      selectedTableId: typeof record.selectedTableId === "string" ? record.selectedTableId : "",
      openTableTitleIds: Array.isArray(record.openTableTitleIds) ? record.openTableTitleIds.filter(id => typeof id === "string") : [],
    };
  } catch {
    return { selectedSystemId: "", expandedSystemIds: [], selectedTableId: "", openTableTitleIds: [] };
  }
}

function saveDictionaryWorkspaceState(projectId: string, state: DictionaryWorkspaceState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(dictionaryWorkspaceStateKey(projectId), JSON.stringify({
      selectedSystemId: state.selectedSystemId,
      expandedSystemIds: Array.from(new Set(state.expandedSystemIds.filter(Boolean))),
      selectedTableId: state.selectedTableId,
      openTableTitleIds: Array.from(new Set(state.openTableTitleIds.filter(Boolean))),
    }));
  } catch {
    // Workspace memory is best-effort; navigation remains usable without persistence.
  }
}

function dictionaryTableViewsKey(projectId: string) {
  return `rich-project-dictionary-table-views:${projectId}`;
}

function loadDictionaryTableViews(projectId: string): Record<string, DictionaryView> {
  if (typeof window === "undefined") return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(dictionaryTableViewsKey(projectId)) ?? "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const validViews = new Set<DictionaryView>(["field-design", "mapping", "temp-table", "relations", "test-data", "table-info"]);
    return Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, DictionaryView] => (
      typeof entry[0] === "string" && typeof entry[1] === "string" && validViews.has(entry[1] as DictionaryView)
    )));
  } catch {
    return {};
  }
}

function saveDictionaryTableViews(projectId: string, views: Record<string, DictionaryView>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(dictionaryTableViewsKey(projectId), JSON.stringify(views));
  } catch {
    // Per-table view memory is a UI convenience; the current view remains usable without persistence.
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
