import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { AgGridReact, type CustomCellEditorProps } from "ag-grid-react";
import { AllCommunityModule, colorSchemeDark, ModuleRegistry, themeQuartz, type ColDef, type GridApi } from "ag-grid-community";
import { api, type TestCenterGridColumn, type TestCenterGridStyle, type TestCenterIssue } from "../api/client.js";
import "./IssueDataGrid.css";

ModuleRegistry.registerModules([AllCommunityModule]);

type IssueStatus = string;
type EditableIssueField = "title" | "description" | "owner" | "status" | "externalRef";
type IssueChange = Partial<Pick<TestCenterIssue, EditableIssueField | "customFields">>;
type IssueGridRow = { id: string; serial: number; title: string; description: string; owner: string; status: IssueStatus; externalRef: string; updatedAt: string; customFields: Record<string, string>; [key: string]: string | number | Record<string, string> };
type CopiedCell = { issueId: string; field: string; value: string };

type IssueDataGridProps = { projectId: string; tableId: string; title?: string; onBack?: () => void; issues: TestCenterIssue[]; onIssueChange: (issueId: string, patch: IssueChange) => void; onIssueReorder: (issueIds: string[]) => void; onAddIssue: () => void; onDeleteIssue: (issueId: string) => void };
type StyleSelection = { key: string; target: "header" | "cell" | "dropdown"; optionValue?: string };
type SavedTableStyle = { key: string; columns: TestCenterGridColumn[]; style?: TestCenterGridStyle };

const systemFields = new Set(["serial", "title", "description", "owner", "status", "externalRef", "updatedAt"]);
const statusLabels: Record<string, string> = { open: "待处理", fixed: "已修复", retest: "待复测", closed: "已关闭" };
const issueTypeOptions = [{ label: "BA-需求", value: "ba-requirement" }, { label: "BA-BUG", value: "ba-bug" }, { label: "产品-BUG", value: "product-bug" }, { label: "产品-需求", value: "product-requirement" }];
const defaultColumns: TestCenterGridColumn[] = [
  { key: "serial", name: "序号", width: 76, editable: false, visible: true },
  { key: "project", name: "项目", width: 150, editable: true, searchable: true, visible: true },
  { key: "issueType", name: "类型", width: 142, editable: true, fieldType: "select", options: issueTypeOptions, dropdownStyle: "signal", searchable: true, visible: true },
  { key: "module", name: "模块", width: 140, editable: true, searchable: true, visible: true },
  { key: "title", name: "问题", width: 220, editable: true, searchable: true, visible: true },
  { key: "description", name: "问题说明", width: 260, editable: true, searchable: true, visible: true },
  { key: "eta", name: "ETA", width: 132, editable: true, searchable: true, visible: true },
  { key: "progressFollowUp", name: "进度跟进", width: 180, editable: true, searchable: true, visible: true },
  { key: "owner", name: "负责人", width: 136, editable: true, searchable: true, visible: true },
  { key: "status", name: "状态", width: 118, editable: true, fieldType: "select", options: Object.entries(statusLabels).map(([value, label]) => ({ value, label })), dropdownStyle: "signal", searchable: true, visible: true },
  { key: "externalRef", name: "外部记录", width: 150, editable: true, searchable: true, visible: true },
  { key: "updatedAt", name: "更新时间", width: 164, editable: false, searchable: false, visible: true },
];
const defaultStyle: TestCenterGridStyle = { density: "comfortable", headerTone: "neutral", stripedRows: false, borderColor: "#373d41", borderWidth: "1px", borderStyle: "solid" };
const issueGridTheme = themeQuartz.withPart(colorSchemeDark);
const formatTime = (value: string) => value.replace("T", " ").slice(0, 16);
const fieldKeyFromName = (name: string) => `custom_${name.trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "_").replace(/^_+|_+$/g, "") || "field"}`;
const needsOptions = (type?: TestCenterGridColumn["fieldType"]) => type === "select" || type === "multiSelect";
const isTextField = (column: TestCenterGridColumn) => !column.fieldType || column.fieldType === "text";
const dropdownStyles = [{ value: "standard", label: "标准" }, { value: "soft", label: "轻柔色块" }, { value: "pill", label: "圆角标签" }, { value: "signal", label: "强调色块" }] as const;
const dropdownStyleColors = { standard: "#82939a", soft: "#54aeb4", pill: "#64bcc0", signal: "#de9556" } as const;
const contentModes = [{ value: "plain", label: "单行", icon: "T" }, { value: "wrap", label: "换行", icon: "↵" }, { value: "numbered", label: "序号任务", icon: "1." }, { value: "bulleted", label: "点点任务", icon: "•" }, { value: "checklist", label: "复选任务", icon: "☑" }] as const;
type DropdownOption = NonNullable<TestCenterGridColumn["options"]>[number];
const optionColorStyle = (color?: string) => color ? { "--issue-dropdown-color": color } as CSSProperties : undefined;
const dropdownColor = (style: NonNullable<TestCenterGridColumn["dropdownStyle"]>, color?: string) => color ?? dropdownStyleColors[style];

function loadStoredGridColumns(key: string): TestCenterGridColumn[] {
  try {
    const stored = JSON.parse(window.localStorage.getItem(key) ?? "[]") as unknown;
    return Array.isArray(stored) && stored.every(column => column && typeof column === "object" && typeof (column as TestCenterGridColumn).key === "string") ? stored as TestCenterGridColumn[] : [];
  } catch { return []; }
}

function SelectBadge({ value, options, dropdownStyle = "soft" }: { value: string | number; options?: TestCenterGridColumn["options"]; dropdownStyle?: TestCenterGridColumn["dropdownStyle"] }): ReactNode {
  const option = options?.find(item => item.value === value);
  const label = option?.label ?? String(value || "");
  const style = option?.style ?? dropdownStyle;
  return <span className={`issue-data-grid__select-badge issue-data-grid__select-badge--${style}${value ? "" : " issue-data-grid__select-badge--empty"}`} style={optionColorStyle(option?.color)}>{label}</span>;
}

type SelectDrawerEditorProps = CustomCellEditorProps<IssueGridRow, string> & { options?: TestCenterGridColumn["options"]; dropdownStyle?: TestCenterGridColumn["dropdownStyle"] };
function SelectDrawerEditor({ value, options = [], dropdownStyle, onValueChange, stopEditing }: SelectDrawerEditorProps): ReactNode {
  const selectedValue = String(value ?? "");
  const choose = (nextValue: string) => { onValueChange(nextValue); stopEditing(); };
  return <div className="issue-data-grid__select-drawer" role="listbox" aria-label="选择选项">{options.map(option => <button key={option.value} className={`issue-data-grid__select-drawer-option${option.value === selectedValue ? " is-selected" : ""}`} type="button" role="option" aria-selected={option.value === selectedValue} onClick={() => choose(option.value)}><SelectBadge value={option.value} options={[option]} dropdownStyle={option.style ?? dropdownStyle} /></button>)}</div>;
}

function CheckboxCell({ value, setValue }: { value: string | number; setValue: (value: string) => void }): ReactNode {
  return <label className="issue-data-grid__checkbox"><input type="checkbox" checked={value === "true"} onChange={event => setValue(String(event.target.checked))} /><span>{value === "true" ? "是" : "否"}</span></label>;
}

function MultiSelectCell({ value, options, dropdownStyle }: { value: string | number; options?: Array<{ label: string; value: string }>; dropdownStyle?: TestCenterGridColumn["dropdownStyle"] }): ReactNode {
  const values = String(value ?? "").split("|").filter(Boolean);
  return <span className="issue-data-grid__multi-select">{values.length ? values.map(item => <SelectBadge key={item} value={item} options={options} dropdownStyle={dropdownStyle} />) : <SelectBadge value="" options={options} dropdownStyle={dropdownStyle} />}</span>;
}

function StructuredTextCell({ value, mode = "plain", setValue }: { value: string | number; mode?: NonNullable<TestCenterGridColumn["contentMode"]>; setValue?: (value: string) => void }): ReactNode {
  const source = String(value ?? "");
  if (mode === "plain") return <>{source}</>;
  if (mode === "wrap") return <span className="issue-data-grid__wrapped-text">{source}</span>;
  const lines = source.split("\n").filter(line => line.trim());
  return <div className={`issue-data-grid__task-list issue-data-grid__task-list--${mode}`}>{lines.map((line, index) => {
    const checked = /^\[x\]\s*/i.test(line);
    const label = line.replace(/^\[(?:x| )\]\s*/i, "");
    const toggle = () => setValue?.(source.split("\n").map(item => item === line ? `${checked ? "" : "[x] "}${item.replace(/^\[(?:x| )\]\s*/i, "")}` : item).join("\n"));
    return <div className={`issue-data-grid__task-item${checked ? " is-complete" : ""}`} key={`${line}-${index}`}>{mode === "numbered" ? <span className="issue-data-grid__task-marker">{index + 1}</span> : mode === "bulleted" ? <span className="issue-data-grid__task-bullet" aria-hidden="true" /> : <button className="issue-data-grid__task-check" type="button" aria-label={`${checked ? "取消完成" : "完成"}：${label}`} aria-pressed={checked} onClick={event => { event.stopPropagation(); toggle(); }}>{checked && "✓"}</button>}<span>{label}</span></div>;
  })}</div>;
}

function StructuredTextEditor({ value, onValueChange, stopEditing }: CustomCellEditorProps<IssueGridRow, string>): ReactNode {
  return <textarea className="issue-data-grid__structured-editor" autoFocus defaultValue={value ?? ""} onKeyDown={event => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault(); event.stopPropagation();
      const editor = event.currentTarget;
      editor.setRangeText("\n", editor.selectionStart, editor.selectionEnd, "end");
      onValueChange(editor.value);
      return;
    }
    if (event.key === "Enter") { event.preventDefault(); event.stopPropagation(); stopEditing(); return; }
    event.stopPropagation();
  }} onChange={event => onValueChange(event.target.value)} placeholder="输入内容，⌘/Ctrl + Enter 换行" />;
}

function ContentModeToolbar({ column, onChange }: { column: TestCenterGridColumn; onChange: (mode: NonNullable<TestCenterGridColumn["contentMode"]>) => void }): ReactNode {
  const activeMode = column.contentMode ?? "plain";
  return <div className="issue-data-grid__content-mode-toolbar" aria-label={`${column.name}内容格式`}><span>内容格式 · {column.name}</span>{contentModes.map(mode => <button key={mode.value} className={activeMode === mode.value ? "is-active" : ""} type="button" title={mode.label} onClick={() => onChange(mode.value)}><i aria-hidden="true">{mode.icon}</i><em>{mode.label}</em></button>)}</div>;
}

function DateEditor({ value, onValueChange }: { value?: string; onValueChange: (value: string) => void }): ReactNode { return <input className="issue-data-grid__date-editor" autoFocus type="date" value={value ?? ""} onChange={event => onValueChange(event.target.value)} />; }
function MultiSelectEditor({ value, onValueChange, options = [] }: { value?: string; onValueChange: (value: string) => void; options?: Array<{ label: string; value: string }> }): ReactNode {
  const selected = String(value ?? "").split("|").filter(Boolean);
  return <select className="issue-data-grid__multi-select-editor" autoFocus multiple value={selected} onChange={event => onValueChange(Array.from(event.target.selectedOptions, option => option.value).join("|"))}>{options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select>;
}

export function IssueDataGrid({ projectId, tableId, title = "产品问题测试清单", onBack, issues, onIssueChange, onIssueReorder, onAddIssue, onDeleteIssue }: IssueDataGridProps): ReactNode {
  const [query, setQuery] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [columns, setColumns] = useState<TestCenterGridColumn[]>([]);
  const [tableStyle, setTableStyle] = useState(defaultStyle);
  const [draftColumns, setDraftColumns] = useState<TestCenterGridColumn[] | null>(null);
  const [draftTableStyle, setDraftTableStyle] = useState<TestCenterGridStyle | null>(null);
  const [deletedColumns, setDeletedColumns] = useState<TestCenterGridColumn[]>([]);
  const [draftDeletedColumns, setDraftDeletedColumns] = useState<TestCenterGridColumn[]>([]);
  const [settingsDirty, setSettingsDirty] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState("");
  const [savedStyles, setSavedStyles] = useState<SavedTableStyle[]>([]);
  const [savedStyleName, setSavedStyleName] = useState("");
  const [selectedSavedStyleKey, setSelectedSavedStyleKey] = useState("");
  const [savedStyleSaving, setSavedStyleSaving] = useState(false);
  const [newFieldName, setNewFieldName] = useState("");
  const [styleSelection, setStyleSelection] = useState<StyleSelection | null>(null);
  const [recordMenu, setRecordMenu] = useState<{ x: number; y: number; issueId?: string } | null>(null);
  const copiedCell = useRef<CopiedCell | null>(null);
  const copiedCellElement = useRef<HTMLElement | null>(null);
  const gridApi = useRef<GridApi<IssueGridRow> | null>(null);
  const settingsSaveQueue = useRef<Promise<unknown>>(Promise.resolve());
  const settingsSaveRevision = useRef(0);
  const pendingGridColumnState = useRef<TestCenterGridColumn[] | null>(null);
  const restoringGridColumnState = useRef(false);
  const gridSettingsKey = `issues:${tableId}:columns`;
  const gridLayoutStorageKey = `rich.issue-data-grid:${projectId}:${tableId}:columns.v1`;
  const restoreGridColumnState = (api: GridApi<IssueGridRow>, configuredColumns: TestCenterGridColumn[]) => {
    restoringGridColumnState.current = true;
    api.applyColumnState({ state: configuredColumns.map(column => ({ colId: column.key, width: column.width, hide: column.visible === false, pinned: column.frozen === "right" ? "right" : column.frozen ? "left" : undefined })), applyOrder: true });
    restoringGridColumnState.current = false;
  };

  useEffect(() => {
    let cancelled = false;
    const legacyGridSettingsKeys = [`issue-table:${tableId}`];
    const loadSettings = async () => {
      let settings = await api.getTestCenterGridSettings(projectId, gridSettingsKey);
      const localColumns = loadStoredGridColumns(gridLayoutStorageKey);
      if (localColumns.length) settings = { ...settings, columns: localColumns };
      let restoredFromLegacy = false;
      if (!settings.columns.length) {
        for (const legacyKey of legacyGridSettingsKeys) {
          const legacySettings = await api.getTestCenterGridSettings(projectId, legacyKey);
          if (!legacySettings.columns.length) continue;
          settings = legacySettings;
          restoredFromLegacy = true;
          break;
        }
      }
      if (cancelled || !settings.columns.length) {
        setColumns([]);
        setDeletedColumns([]);
        return;
      }
      const restored = settings.columns.filter(column => !column.deleted);
      const restoredStyle = { ...defaultStyle, ...settings.style };
      setColumns(restored);
      setTableStyle(restoredStyle);
      setDeletedColumns(settings.columns.filter(column => column.deleted));
      pendingGridColumnState.current = restored;
      if (gridApi.current) restoreGridColumnState(gridApi.current, restored);
      if (restoredFromLegacy) await api.saveTestCenterGridSettings(projectId, gridSettingsKey, settings.columns, restoredStyle);
    };
    void loadSettings().catch(() => {
      if (!cancelled) setSettingsError("读取表格设置失败，请重试。");
    });
    return () => { cancelled = true; };
  }, [gridSettingsKey, projectId]);
  useEffect(() => {
    if (!settingsOpen) return;
    let cancelled = false;
    void api.listTestCenterGridSettings(projectId, "issue-style:").then(styles => {
      if (!cancelled) setSavedStyles(styles);
    }).catch(() => {
      if (!cancelled) setSettingsError("读取表格样式失败，请重试。");
    });
    return () => { cancelled = true; };
  }, [projectId, settingsOpen]);
  useEffect(() => {
    if (!recordMenu) return;
    const closeMenu = () => setRecordMenu(null);
    window.addEventListener("pointerdown", closeMenu);
    return () => window.removeEventListener("pointerdown", closeMenu);
  }, [recordMenu]);

  const rows = useMemo<IssueGridRow[]>(() => issues.map((issue, index) => ({
    id: issue.id, serial: index + 1, title: issue.title, description: issue.description, owner: issue.owner ?? "", status: issue.status as IssueStatus, externalRef: issue.externalRef ?? "", updatedAt: formatTime(issue.updatedAt), customFields: issue.customFields, ...issue.customFields,
  })), [issues]);
  const visibleRows = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return rows;
    return rows.filter(row => columns.filter(column => column.searchable).some(column => String(row[column.key] ?? "").toLowerCase().includes(keyword)));
  }, [columns, query, rows]);
  const baseRowHeight = tableStyle.density === "compact" ? 36 : 44;
  useEffect(() => { gridApi.current?.resetRowHeights(); }, [columns, baseRowHeight]);
  const saveCellValue = useCallback((row: IssueGridRow, field: string, value: string) => {
    if (!field || systemFields.has(field) && field !== "title" && field !== "description" && field !== "owner" && field !== "status" && field !== "externalRef") return;
    if (systemFields.has(field)) onIssueChange(row.id, { [field]: value });
    else onIssueChange(row.id, { customFields: { ...row.customFields, [field]: value } });
  }, [onIssueChange]);
  const handleClipboardShortcut = useCallback((keyEvent: KeyboardEvent, row: IssueGridRow | undefined, field: string, editing: boolean, targetCell?: HTMLElement | null) => {
    if ((!keyEvent.metaKey && !keyEvent.ctrlKey) || editing || !row) return false;
    const key = keyEvent.key.toLowerCase();
    if (key !== "c" && key !== "v") return false;
    keyEvent.preventDefault();
    keyEvent.stopPropagation();
    if (key === "c") {
      const value = String(row[field] ?? "");
      copiedCell.current = { issueId: row.id, field, value };
      copiedCellElement.current?.classList.remove("issue-data-grid__cell-copied");
      const cellElement = targetCell ?? (keyEvent.target instanceof Element ? keyEvent.target.closest<HTMLElement>(".ag-cell") : null);
      cellElement?.classList.add("issue-data-grid__cell-copied");
      copiedCellElement.current = cellElement;
      void navigator.clipboard?.writeText(value).catch(() => undefined);
    } else if (copiedCell.current && field !== "serial" && field !== "updatedAt" && columns.find(column => column.key === field)?.editable !== false) {
      saveCellValue(row, field, copiedCell.current.value);
    }
    return true;
  }, [columns, saveCellValue]);
  const handleGridKeyDownCapture = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    const api = gridApi.current;
    const focusedCell = api?.getFocusedCell();
    if (!api || !focusedCell) return;
    const row = api.getDisplayedRowAtIndex(focusedCell.rowIndex)?.data;
    const field = focusedCell.column.getColId();
    const targetCell = document.querySelector<HTMLElement>(`.ag-center-cols-container .ag-row[row-index="${focusedCell.rowIndex}"] .ag-cell[col-id="${field}"]`);
    if (handleClipboardShortcut(event.nativeEvent, row, field, api.getEditingCells().length > 0, targetCell)) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, [handleClipboardShortcut]);
  const columnDefs = useMemo<ColDef<IssueGridRow>[]>(() => columns.filter(column => column.visible !== false).map(column => ({
    field: column.key,
    headerName: column.name,
    width: column.width ?? 160,
    minWidth: 68,
    maxWidth: 1000,
    rowDrag: column.key === "serial" && !query,
    editable: column.key !== "serial" && column.key !== "updatedAt" && column.editable !== false,
    sortable: column.key !== "serial",
    resizable: true,
    pinned: column.frozen === "right" ? "right" : column.frozen ? "left" : undefined,
    headerStyle: column.headerStyle,
    headerClass: `issue-data-grid__header-align-${column.headerStyle?.textAlign ?? "left"}`,
    cellStyle: column.cellStyle,
    cellEditor: column.fieldType === "select" ? SelectDrawerEditor : column.fieldType === "date" ? DateEditor : column.fieldType === "multiSelect" ? MultiSelectEditor : isTextField(column) && ((column.contentMode ?? "plain") !== "plain" || column.cellStyle?.whiteSpace === "normal") ? StructuredTextEditor : undefined,
    cellEditorParams: needsOptions(column.fieldType) ? { values: column.options?.map(option => option.value) ?? [], options: column.options, dropdownStyle: column.dropdownStyle } : undefined,
    cellEditorPopup: column.fieldType === "select",
    cellEditorPopupPosition: column.fieldType === "select" ? "under" : undefined,
    cellRenderer: column.fieldType === "select" ? (params: { value: string | number }) => <SelectBadge value={params.value} options={column.options} dropdownStyle={column.dropdownStyle} /> : column.fieldType === "checkbox" ? (params: { value: string | number; setValue: (value: string) => void }) => <CheckboxCell {...params} /> : column.fieldType === "multiSelect" ? (params: { value: string | number }) => <MultiSelectCell {...params} options={column.options} dropdownStyle={column.dropdownStyle} /> : isTextField(column) && (column.contentMode ?? "plain") !== "plain" ? (params: { value: string | number; setValue: (value: string) => void }) => <StructuredTextCell {...params} mode={column.contentMode} /> : undefined,
    wrapText: isTextField(column),
    autoHeight: isTextField(column),
    suppressKeyboardEvent: params => handleClipboardShortcut(params.event, params.data, column.key, params.editing),
    cellClass: [column.key === "serial" ? "issue-data-grid__serial" : "", column.fieldType === "select" ? "issue-data-grid__select-cell" : "", isTextField(column) ? "issue-data-grid__cell-text" : "", `issue-data-grid__cell-align-${column.cellStyle?.textAlign ?? "left"}`].filter(Boolean).join(" "),
  })), [columns, handleClipboardShortcut, query]);

  const persistSettings = async (nextColumns: TestCenterGridColumn[], nextStyle = tableStyle, nextDeletedColumns = deletedColumns) => {
    setColumns(nextColumns);
    setTableStyle(nextStyle);
    setDeletedColumns(nextDeletedColumns);
    try { window.localStorage.setItem(gridLayoutStorageKey, JSON.stringify([...nextColumns, ...nextDeletedColumns])); } catch { /* The server copy remains authoritative when local storage is unavailable. */ }
    setSettingsSaving(true);
    const previousSave = settingsSaveQueue.current;
    const save = previousSave.then(async () => {
      setSettingsError("");
      try {
        await api.saveTestCenterGridSettings(projectId, gridSettingsKey, [...nextColumns, ...nextDeletedColumns], nextStyle);
        return true;
      } catch {
        setSettingsError("表格样式保存失败，请重试。");
        return false;
      }
    });
    settingsSaveQueue.current = save;
    void save.finally(() => { if (settingsSaveQueue.current === save) setSettingsSaving(false); });
    return save;
  };
  const settingsColumns = draftColumns ?? columns;
  const settingsStyle = draftTableStyle ?? tableStyle;
  const saveDraftSettings = (nextColumns: TestCenterGridColumn[], nextStyle = settingsStyle, nextDeletedColumns = draftDeletedColumns) => {
    const revision = ++settingsSaveRevision.current;
    setSettingsDirty(true);
    void persistSettings(nextColumns, nextStyle, nextDeletedColumns).then(saved => {
      if (saved && settingsSaveRevision.current === revision) setSettingsDirty(false);
    });
  };
  const updateDraft = (nextColumns: TestCenterGridColumn[], nextDeletedColumns = draftDeletedColumns) => { setDraftColumns(nextColumns); saveDraftSettings(nextColumns, settingsStyle, nextDeletedColumns); };
  const updateColumn = (key: string, patch: Partial<TestCenterGridColumn>) => updateDraft(settingsColumns.map(column => column.key === key ? { ...column, ...patch } : column));
  const updateHeaderStyle = (key: string, patch: NonNullable<TestCenterGridColumn["headerStyle"]>) => {
    const column = settingsColumns.find(item => item.key === key);
    updateColumn(key, { headerStyle: { ...column?.headerStyle, ...patch } });
  };
  const updateCellStyle = (key: string, patch: NonNullable<TestCenterGridColumn["cellStyle"]>) => {
    const column = settingsColumns.find(item => item.key === key);
    updateColumn(key, { cellStyle: { ...column?.cellStyle, ...patch } });
  };
  const updateOptions = (key: string, options: DropdownOption[]) => updateColumn(key, { options });
  const addOption = (key: string) => {
    const options = settingsColumns.find(column => column.key === key)?.options ?? [];
    const label = `选项 ${options.length + 1}`;
    updateOptions(key, [...options, { label, value: `option-${Date.now()}` }]);
  };
  const moveOption = (key: string, from: number, direction: -1 | 1) => {
    const options = [...(settingsColumns.find(column => column.key === key)?.options ?? [])];
    const to = from + direction;
    if (to < 0 || to >= options.length) return;
    [options[from], options[to]] = [options[to], options[from]];
    updateOptions(key, options);
  };
  const updateDropdownStyle = (key: string, optionValue: string | undefined, style: NonNullable<TestCenterGridColumn["dropdownStyle"]>) => {
    if (!optionValue) updateColumn(key, { dropdownStyle: style });
    else updateOptions(key, (settingsColumns.find(column => column.key === key)?.options ?? []).map(option => option.value === optionValue ? { ...option, style } : option));
  };
  const removeColumn = (key: string) => {
    const column = settingsColumns.find(item => item.key === key);
    if (!column) return;
    let nextDeletedColumns = draftDeletedColumns;
    if (defaultColumns.some(column => column.key === key)) {
      nextDeletedColumns = [...draftDeletedColumns.filter(item => item.key !== key), { ...column, deleted: true }];
      setDraftDeletedColumns(nextDeletedColumns);
    }
    updateDraft(settingsColumns.filter(item => item.key !== key), nextDeletedColumns);
  };
  const addField = () => {
    const name = newFieldName.trim();
    if (!name) return;
    const baseKey = fieldKeyFromName(name);
    let key = baseKey; let index = 2;
    while (settingsColumns.some(column => column.key === key)) key = `${baseKey}_${index++}`;
    updateDraft([...settingsColumns, { key, name, width: 160, editable: true, searchable: true, visible: true, fieldType: "text" }]);
    setNewFieldName("");
  };
  const saveColumnWidths = (gridApi: GridApi<IssueGridRow>) => {
    const widths = new Map(gridApi.getColumnState().map(column => {
      const width = column.width ?? 160;
      return [column.colId, Math.min(1000, Math.max(68, width))];
    }));
    persistSettings(columns.map(column => ({ ...column, width: widths.get(column.key) ?? column.width })));
  };
  const saveColumnOrder = (gridApi: GridApi<IssueGridRow>) => {
    const positions = new Map(gridApi.getColumnState().map((column, index) => [column.colId, index]));
    persistSettings([...columns].sort((left, right) => (positions.get(left.key) ?? Number.MAX_SAFE_INTEGER) - (positions.get(right.key) ?? Number.MAX_SAFE_INTEGER)));
  };
  const updateStyle = (patch: Partial<TestCenterGridStyle>) => {
    const nextStyle = { ...settingsStyle, ...patch };
    setDraftTableStyle(nextStyle);
    saveDraftSettings(settingsColumns, nextStyle);
  };
  const applySettings = async () => {
    const saved = await persistSettings(settingsColumns, settingsStyle, draftDeletedColumns);
    if (!saved) return;
    setDeletedColumns(draftDeletedColumns);
    setSettingsDirty(false);
  };
  const saveCurrentStyle = async () => {
    const name = savedStyleName.trim();
    if (!name) return;
    setSavedStyleSaving(true);
    setSettingsError("");
    try {
      const key = `issue-style:${encodeURIComponent(name)}`;
      await settingsSaveQueue.current;
      const currentSettings = await api.getTestCenterGridSettings(projectId, gridSettingsKey);
      if (!currentSettings.columns.length) throw new Error("current table settings are empty");
      const saved = await api.saveTestCenterGridSettings(projectId, key, currentSettings.columns, currentSettings.style);
      setSavedStyles(current => [...current.filter(item => item.key !== key), { key, ...saved }].sort((left, right) => left.key.localeCompare(right.key)));
      setSelectedSavedStyleKey(key);
      setSavedStyleName("");
    } catch {
      setSettingsError("保存表格样式失败，请重试。");
    } finally {
      setSavedStyleSaving(false);
    }
  };
  const applySavedStyle = async () => {
    const savedStyle = savedStyles.find(item => item.key === selectedSavedStyleKey);
    if (!savedStyle) return;
    const nextColumns = savedStyle.columns.filter(column => !column.deleted);
    const nextDeletedColumns = savedStyle.columns.filter(column => column.deleted);
    const nextStyle = { ...defaultStyle, ...savedStyle.style };
    setDraftColumns(nextColumns);
    setDraftTableStyle(nextStyle);
    setDraftDeletedColumns(nextDeletedColumns);
    const applied = await persistSettings(nextColumns, nextStyle, nextDeletedColumns);
    if (applied) setSettingsDirty(false);
  };
  const toggleSettings = () => {
    if (settingsOpen) { setSettingsOpen(false); setDraftColumns(null); setDraftTableStyle(null); setStyleSelection(null); return; }
    const defaultStyleColumn = columns.find(column => column.key !== "serial");
    setDraftColumns(columns); setDraftTableStyle(tableStyle); setDraftDeletedColumns(deletedColumns); setStyleSelection(defaultStyleColumn ? { key: defaultStyleColumn.key, target: "cell" } : null); setSettingsDirty(false); setSettingsOpen(true);
  };
  const activeStyleColumn = styleSelection && styleSelection.target !== "dropdown" ? settingsColumns.find(column => column.key === styleSelection.key) : undefined;
  const activeStyle = styleSelection?.target === "header" ? activeStyleColumn?.headerStyle : styleSelection?.target === "cell" ? activeStyleColumn?.cellStyle : undefined;
  const activeHeaderStyle = styleSelection?.target === "header" ? activeStyleColumn?.headerStyle : undefined;
  const activeCellStyle = styleSelection?.target === "cell" ? activeStyleColumn?.cellStyle : undefined;
  const activeDropdownColumn = styleSelection?.target === "dropdown" ? settingsColumns.find(column => column.key === styleSelection.key) : undefined;
  const activeDropdownOption = activeDropdownColumn?.options?.find(option => option.value === styleSelection?.optionValue);

  const gridBorderStyle = { "--issue-grid-border-color": tableStyle.borderColor, "--issue-grid-border-width": tableStyle.borderWidth, "--issue-grid-border-style": tableStyle.borderStyle } as CSSProperties;
  const handleTableContextMenu = (event: ReactMouseEvent<HTMLDivElement>) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target?.closest(".ag-root")) return;
    if (target.closest(".ag-row")) return;
    event.preventDefault();
    setRecordMenu({ x: event.clientX, y: event.clientY });
  };
  return <div className={`issue-data-grid issue-data-grid--${tableStyle.density} issue-data-grid--header-${tableStyle.headerTone}${tableStyle.stripedRows ? " issue-data-grid--striped" : ""}`} style={gridBorderStyle} aria-label="高级问题表格">
    <header className="issue-data-grid__identity">{onBack ? <button className="issue-data-grid__identity-title" type="button" onClick={onBack} title="返回问题清单列表" aria-label={`返回问题清单列表：${title}`}><span>TEST CENTER · ISSUE LOG</span><h2>{title}</h2></button> : <div className="issue-data-grid__identity-title"><span>TEST CENTER · ISSUE LOG</span><h2>{title}</h2></div>}<span className="issue-data-grid__record-count">{visibleRows.length} 条记录</span></header>
    <div className="issue-data-grid__toolbar">
      <label className="issue-data-grid__search"><span aria-hidden="true">⌕</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索已设为可检索的字段" /></label>
      <button className="issue-data-grid__settings-trigger" type="button" onClick={toggleSettings} aria-expanded={settingsOpen}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h2m4 0h10M14 4v6M8 14v6" /></svg><span>表格设置</span></button>
    </div>
    {settingsOpen && <aside className="issue-data-grid__settings" aria-label="表格设置">
      {activeDropdownColumn && styleSelection && <div className="issue-data-grid__dropdown-toolbar"><span>下拉样式 · {activeDropdownColumn.name} · {activeDropdownOption?.label ?? "统一所有选项"}</span>{dropdownStyles.map(style => <button key={style.value} className={`issue-data-grid__toolbar-dropdown-style issue-data-grid__toolbar-dropdown-style--${style.value}${(activeDropdownOption?.style ?? activeDropdownColumn.dropdownStyle ?? "soft") === style.value ? " is-active" : ""}`} type="button" onClick={() => updateDropdownStyle(activeDropdownColumn.key, styleSelection.optionValue, style.value)}><span>{style.label}</span></button>)}</div>}
      <div className="issue-data-grid__settings-actions"><div className="issue-data-grid__add-field"><span aria-hidden="true">＋</span><input value={newFieldName} onChange={event => setNewFieldName(event.target.value)} onKeyDown={event => { if (event.key === "Enter") addField(); }} placeholder="新字段名称" /><button type="button" onClick={addField}>添加字段</button></div><div className="issue-data-grid__style-controls"><div className="issue-data-grid__style-toolbar">{activeStyleColumn && styleSelection ? <><span className="issue-data-grid__style-toolbar-title">样式工具栏 · {activeStyleColumn.name} · {styleSelection.target === "header" ? "标题" : "内容"}</span><label>字号<select value={activeStyle?.fontSize ?? "13px"} onChange={event => styleSelection.target === "header" ? updateHeaderStyle(activeStyleColumn.key, { fontSize: event.target.value as NonNullable<TestCenterGridColumn["headerStyle"]>["fontSize"] }) : updateCellStyle(activeStyleColumn.key, { fontSize: event.target.value as NonNullable<TestCenterGridColumn["cellStyle"]>["fontSize"] })}><option value="12px">12</option><option value="13px">13</option><option value="14px">14</option><option value="16px">16</option></select></label><button className={activeStyle?.fontWeight === "700" ? "is-active" : ""} type="button" title="加粗" onClick={() => styleSelection.target === "header" ? updateHeaderStyle(activeStyleColumn.key, { fontWeight: activeStyle?.fontWeight === "700" ? "400" : "700" }) : updateCellStyle(activeStyleColumn.key, { fontWeight: activeStyle?.fontWeight === "700" ? "400" : "700" })}><b>B</b></button>{styleSelection.target === "header" && <button className={activeHeaderStyle?.fontStyle === "italic" ? "is-active" : ""} type="button" title="斜体" onClick={() => updateHeaderStyle(activeStyleColumn.key, { fontStyle: activeHeaderStyle?.fontStyle === "italic" ? "normal" : "italic" })}><i>I</i></button>}<label>字体颜色<input type="color" value={activeStyle?.color ?? (styleSelection.target === "header" ? "#aab4ba" : "#d7e0e3")} onChange={event => styleSelection.target === "header" ? updateHeaderStyle(activeStyleColumn.key, { color: event.target.value }) : updateCellStyle(activeStyleColumn.key, { color: event.target.value })} /></label><label>单元格底色<input type="color" value={activeStyle?.backgroundColor ?? (styleSelection.target === "header" ? "#292f34" : "#202529")} onChange={event => styleSelection.target === "header" ? updateHeaderStyle(activeStyleColumn.key, { backgroundColor: event.target.value }) : updateCellStyle(activeStyleColumn.key, { backgroundColor: event.target.value })} /></label>{styleSelection.target === "cell" && <button className={activeCellStyle?.whiteSpace === "normal" ? "is-active" : ""} type="button" title="自动换行" aria-label="自动换行" onClick={() => updateCellStyle(activeStyleColumn.key, { whiteSpace: activeCellStyle?.whiteSpace === "normal" ? "nowrap" : "normal" })}>↵</button>}<span className="issue-data-grid__style-toolbar-divider" /><button className={activeStyle?.textAlign === "left" || !activeStyle?.textAlign ? "is-active" : ""} type="button" title="左对齐" onClick={() => styleSelection.target === "header" ? updateHeaderStyle(activeStyleColumn.key, { textAlign: "left" }) : updateCellStyle(activeStyleColumn.key, { textAlign: "left" })}>≡</button><button className={activeStyle?.textAlign === "center" ? "is-active" : ""} type="button" title="居中" onClick={() => styleSelection.target === "header" ? updateHeaderStyle(activeStyleColumn.key, { textAlign: "center" }) : updateCellStyle(activeStyleColumn.key, { textAlign: "center" })}>≡</button><button className={activeStyle?.textAlign === "right" ? "is-active" : ""} type="button" title="右对齐" onClick={() => styleSelection.target === "header" ? updateHeaderStyle(activeStyleColumn.key, { textAlign: "right" }) : updateCellStyle(activeStyleColumn.key, { textAlign: "right" })}>≡</button></> : <span className="issue-data-grid__style-toolbar-hint">选择下面的标题或内容预览，开始调整样式</span>}</div>{activeStyleColumn && styleSelection?.target === "cell" && isTextField(activeStyleColumn) && <ContentModeToolbar column={activeStyleColumn} onChange={contentMode => updateColumn(activeStyleColumn.key, { contentMode })} />}</div></div>
      <div className="issue-data-grid__field-table-wrap"><table className="issue-data-grid__field-table"><thead><tr><th>字段名称</th><th>字段类型</th><th>选项与样式</th><th>标题样式</th><th>内容样式</th><th>固定列</th><th>可编辑</th><th>参与搜索</th><th>显示</th><th>操作</th></tr></thead><tbody>{settingsColumns.map(column => <tr key={column.key}>
        <td><input aria-label={`${column.name}列名`} value={column.name} onChange={event => updateColumn(column.key, { name: event.target.value })} /></td>
        <td><select value={column.fieldType ?? "text"} disabled={column.key === "serial" || column.key === "updatedAt"} onChange={event => { const fieldType = event.target.value as TestCenterGridColumn["fieldType"]; updateColumn(column.key, { fieldType, options: needsOptions(fieldType) ? column.options ?? [] : undefined }); }}><option value="text">编辑框</option><option value="date">日期</option><option value="checkbox">勾选</option><option value="select">下拉选项</option><option value="multiSelect">多选下拉</option></select></td>
        <td>{needsOptions(column.fieldType) ? <details className={`issue-data-grid__option-editor issue-data-grid__option-editor--${column.dropdownStyle ?? "soft"}`}><summary aria-label={`${column.name}下拉选项`} onClick={() => setStyleSelection({ key: column.key, target: "dropdown" })}><span>{column.options?.[0]?.label ?? "添加选项"}</span><span aria-hidden="true">⌄</span></summary><div className="issue-data-grid__option-editor-menu"><div className="issue-data-grid__option-list">{(column.options ?? []).map((option, index) => { const optionStyle = option.style ?? column.dropdownStyle ?? "soft"; return <div className="issue-data-grid__option-row" key={option.value}><input className={`issue-data-grid__option-content issue-data-grid__option-content--${optionStyle}${styleSelection?.key === column.key && styleSelection.optionValue === option.value ? " is-selected" : ""}`} style={optionColorStyle(option.color)} aria-label={`${option.label}选项`} value={option.label} onFocus={() => setStyleSelection({ key: column.key, target: "dropdown", optionValue: option.value })} onChange={event => updateOptions(column.key, (column.options ?? []).map(item => item.value === option.value ? { ...item, label: event.target.value } : item))} /><select aria-label={`${option.label}选项样式`} value={optionStyle} onChange={event => updateOptions(column.key, (column.options ?? []).map(item => item.value === option.value ? { ...item, style: event.target.value as DropdownOption["style"] } : item))}>{dropdownStyles.map(style => <option key={style.value} value={style.value}>{style.label}</option>)}</select><label className="issue-data-grid__option-color" title="选项颜色"><input aria-label={`${option.label}选项颜色`} type="color" value={dropdownColor(optionStyle, option.color)} onChange={event => updateOptions(column.key, (column.options ?? []).map(item => item.value === option.value ? { ...item, color: event.target.value } : item))} /></label><div><button type="button" aria-label="上移选项" title="上移选项" disabled={index === 0} onClick={() => moveOption(column.key, index, -1)}>↑</button><button type="button" aria-label="下移选项" title="下移选项" disabled={index === (column.options?.length ?? 0) - 1} onClick={() => moveOption(column.key, index, 1)}>↓</button><button type="button" aria-label="删除选项" title="删除选项" onClick={() => updateOptions(column.key, (column.options ?? []).filter(item => item.value !== option.value))}>×</button></div></div>; })}</div><button className="issue-data-grid__add-option" type="button" onClick={() => addOption(column.key)}>＋ 新增选项</button></div></details> : <span className="issue-data-grid__not-applicable">—</span>}</td>
        <td><button className={`issue-data-grid__style-preview-button${styleSelection?.key === column.key && styleSelection.target === "header" ? " is-selected" : ""}`} type="button" onClick={() => setStyleSelection({ key: column.key, target: "header" })}><span className="issue-data-grid__style-preview-header" style={column.headerStyle}>{column.name}</span></button></td>
        <td><button className={`issue-data-grid__style-preview-button${styleSelection?.key === column.key && styleSelection.target === "cell" ? " is-selected" : ""}`} type="button" onClick={() => setStyleSelection({ key: column.key, target: "cell" })}><span className="issue-data-grid__style-preview-cell" style={column.cellStyle}>示例值</span></button></td>
        <td>固定列<select value={column.frozen === "right" ? "right" : column.frozen ? "left" : ""} onChange={event => updateColumn(column.key, { frozen: event.target.value as "left" | "right" || undefined })}><option value="">不固定</option><option value="left">固定左侧</option><option value="right">固定右侧</option></select></td>
        <td><input type="checkbox" checked={column.editable !== false && column.key !== "serial" && column.key !== "updatedAt"} disabled={column.key === "serial" || column.key === "updatedAt"} onChange={event => updateColumn(column.key, { editable: event.target.checked })} /></td>
        <td><input type="checkbox" checked={column.searchable === true} onChange={event => updateColumn(column.key, { searchable: event.target.checked })} /></td>
        <td><input type="checkbox" checked={column.visible !== false} onChange={event => updateColumn(column.key, { visible: event.target.checked })} /></td>
        <td><button className="issue-data-grid__delete-column" type="button" aria-label="删除字段" title="删除字段" onClick={() => removeColumn(column.key)}><svg className="issue-data-grid__delete-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13M10 11v5m4-5v5" /></svg></button></td>
      </tr>)}</tbody></table></div>
      <section className="issue-data-grid__style"><b>表格样式</b><label>密度<select value={settingsStyle.density} onChange={event => updateStyle({ density: event.target.value as TestCenterGridStyle["density"] })}><option value="compact">紧凑</option><option value="comfortable">舒适</option></select></label><label>表头色调<select value={settingsStyle.headerTone} onChange={event => updateStyle({ headerTone: event.target.value as TestCenterGridStyle["headerTone"] })}><option value="neutral">中性</option><option value="slate">石板</option><option value="cyan">青色</option></select></label><label>边框颜色<input aria-label="边框颜色" type="color" value={settingsStyle.borderColor} onChange={event => updateStyle({ borderColor: event.target.value })} /></label><label>边框粗细<select value={settingsStyle.borderWidth} onChange={event => updateStyle({ borderWidth: event.target.value as TestCenterGridStyle["borderWidth"] })}><option value="1px">细</option><option value="2px">中</option><option value="3px">粗</option></select></label><label>边框线型<select value={settingsStyle.borderStyle} onChange={event => updateStyle({ borderStyle: event.target.value as TestCenterGridStyle["borderStyle"] })}><option value="solid">实线</option><option value="dashed">虚线</option><option value="dotted">点线</option></select></label><label><input type="checkbox" checked={settingsStyle.stripedRows} onChange={event => updateStyle({ stripedRows: event.target.checked })} /> 斑马纹行</label>{settingsError && <span className="issue-data-grid__settings-error" role="alert">{settingsError}</span>}<button className={`issue-data-grid__apply-settings${settingsDirty ? " is-ready" : ""}`} type="button" disabled={!settingsDirty || settingsSaving} onClick={() => void applySettings()}>{settingsSaving ? "正在保存…" : settingsDirty ? "应用更改" : "已应用"}</button></section>
      <section className="issue-data-grid__saved-styles" aria-label="表格样式库"><input aria-label="样式名称" value={savedStyleName} onChange={event => setSavedStyleName(event.target.value)} onKeyDown={event => { if (event.key === "Enter") void saveCurrentStyle(); }} placeholder="样式名称" /><button type="button" disabled={!savedStyleName.trim() || savedStyleSaving} onClick={() => void saveCurrentStyle()}>{savedStyleSaving ? "正在保存…" : "保存为样式"}</button><select aria-label="已保存的表格样式" value={selectedSavedStyleKey} onChange={event => setSelectedSavedStyleKey(event.target.value)}><option value="">选择已保存的样式</option>{savedStyles.map(item => <option key={item.key} value={item.key}>{decodeURIComponent(item.key.slice("issue-style:".length))}</option>)}</select><button type="button" disabled={!selectedSavedStyleKey || settingsSaving} onClick={() => void applySavedStyle()}>套用样式</button></section>
    </aside>}
    <div className="issue-data-grid__table" onKeyDownCapture={handleGridKeyDownCapture} onContextMenu={handleTableContextMenu}><AgGridReact<IssueGridRow>
      theme={issueGridTheme} rowData={visibleRows} columnDefs={columnDefs} defaultColDef={{ sortable: true }} getRowId={params => params.data.id} onGridReady={event => { gridApi.current = event.api; if (pendingGridColumnState.current) restoreGridColumnState(event.api, pendingGridColumnState.current); }} rowDragManaged={!query} suppressMoveWhenRowDragging animateRows enableCellTextSelection suppressClipboardPaste suppressCutToClipboard rowHeight={baseRowHeight} headerHeight={40} singleClickEdit={false} stopEditingWhenCellsLoseFocus
      onCellClicked={event => { const column = columns.find(item => item.key === event.colDef.field); if (event.rowIndex !== null && needsOptions(column?.fieldType)) event.api.startEditingCell({ rowIndex: event.rowIndex, colKey: event.column.getColId() }); }}
      onCellContextMenu={event => { const mouseEvent = event.event as MouseEvent | undefined; if (!mouseEvent || !event.data) return; mouseEvent.preventDefault(); setRecordMenu({ x: mouseEvent.clientX, y: mouseEvent.clientY, issueId: event.data.id }); }}
      onRowDragEnd={event => { const issueIds: string[] = []; event.api.forEachNode(node => { if (node.data) issueIds.push(node.data.id); }); onIssueReorder(issueIds); }}
      onColumnResized={event => { if (event.finished && !restoringGridColumnState.current) { event.api.resetRowHeights(); saveColumnWidths(event.api); } }}
      onColumnMoved={event => { if (event.finished && !restoringGridColumnState.current) saveColumnOrder(event.api); }}
      onCellValueChanged={event => {
        const field = event.colDef.field;
        if (!field || event.oldValue === event.newValue) return;
        saveCellValue(event.data, field, String(event.newValue ?? ""));
      }}
    />{recordMenu && <div className="issue-data-grid__record-menu" style={{ left: recordMenu.x, top: recordMenu.y }} onPointerDown={event => event.stopPropagation()}><button type="button" onClick={() => { onAddIssue(); setRecordMenu(null); }}>＋ 新增记录</button>{recordMenu.issueId && <button className="is-danger" type="button" onClick={() => { onDeleteIssue(recordMenu.issueId!); setRecordMenu(null); }}>删除记录</button>}</div>}</div>
  </div>;
}

export default IssueDataGrid;
