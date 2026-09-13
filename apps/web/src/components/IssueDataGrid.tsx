import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { AgGridReact, type CustomCellEditorProps } from "ag-grid-react";
import { AllCommunityModule, colorSchemeDark, ModuleRegistry, themeQuartz, type ColDef, type GridApi } from "ag-grid-community";
import { api, type TestCenterGridColumn, type TestCenterGridStyle, type TestCenterIssue } from "../api/client.js";
import "./IssueDataGrid.css";

ModuleRegistry.registerModules([AllCommunityModule]);

type IssueStatus = "" | "open" | "fixed" | "retest" | "closed";
type EditableIssueField = "title" | "description" | "owner" | "status" | "externalRef";
type IssueChange = Partial<Pick<TestCenterIssue, EditableIssueField | "customFields">>;
type IssueGridRow = { id: string; serial: number; title: string; description: string; owner: string; status: IssueStatus; externalRef: string; updatedAt: string; customFields: Record<string, string>; [key: string]: string | number | Record<string, string> };
type CopiedCell = { issueId: string; field: string; value: string };

type IssueDataGridProps = { projectId: string; tableId: string; title?: string; onBack?: () => void; issues: TestCenterIssue[]; onIssueChange: (issueId: string, patch: IssueChange) => void; onIssueReorder: (issueIds: string[]) => void; onAddIssue: () => void; onDeleteIssue: (issueId: string) => void };
type StyleSelection = { key: string; target: "header" | "cell" | "dropdown"; optionValue?: string };

const systemFields = new Set(["serial", "title", "description", "owner", "status", "externalRef", "updatedAt"]);
const statusLabels: Record<Exclude<IssueStatus, "">, string> = { open: "待处理", fixed: "已修复", retest: "待复测", closed: "已关闭" };
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
const defaultStyle: TestCenterGridStyle = { density: "comfortable", headerTone: "neutral", stripedRows: false };
const issueGridTheme = themeQuartz.withPart(colorSchemeDark);
const formatTime = (value: string) => value.replace("T", " ").slice(0, 16);
const fieldKeyFromName = (name: string) => `custom_${name.trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "_").replace(/^_+|_+$/g, "") || "field"}`;
const needsOptions = (type?: TestCenterGridColumn["fieldType"]) => type === "select" || type === "multiSelect";
const isTextField = (column: TestCenterGridColumn) => !column.fieldType || column.fieldType === "text";
const taskItemGap = 4;
const taskListVerticalPadding = 14;
const getIssueRowHeight = (row: IssueGridRow | undefined, columns: TestCenterGridColumn[], baseHeight: number) => {
  if (!row) return baseHeight;
  const height = columns.filter(column => column.visible !== false && isTextField(column) && (column.contentMode !== undefined && column.contentMode !== "plain" || column.cellStyle?.whiteSpace === "normal")).reduce((tallest, column) => {
    const value = String(row[column.key] ?? "");
    if (!value) return tallest;
    const isTaskList = column.contentMode === "numbered" || column.contentMode === "bulleted" || column.contentMode === "checklist";
    const charactersPerLine = Math.max(8, Math.floor(((column.width ?? 160) - 24 - (isTaskList ? 27 : 0)) / 7));
    const lines = value.split(/\r?\n/);
    const visualLines = lines.reduce((count, line) => count + Math.max(1, Math.ceil(line.length / charactersPerLine)), 0);
    const contentHeight = visualLines * 20 + 16;
    const taskListHeight = contentHeight + taskListVerticalPadding + Math.max(0, lines.filter(line => line.trim()).length - 1) * taskItemGap;
    return Math.max(tallest, isTaskList ? taskListHeight : contentHeight);
  }, baseHeight);
  return height;
};
const dropdownStyles = [{ value: "standard", label: "标准" }, { value: "soft", label: "轻柔色块" }, { value: "pill", label: "圆角标签" }, { value: "signal", label: "强调色块" }] as const;
const contentModes = [{ value: "plain", label: "单行", icon: "T" }, { value: "wrap", label: "换行", icon: "↵" }, { value: "numbered", label: "序号任务", icon: "1." }, { value: "bulleted", label: "点点任务", icon: "•" }, { value: "checklist", label: "复选任务", icon: "☑" }] as const;

function SelectBadge({ value, options, dropdownStyle = "soft" }: { value: string | number; options?: TestCenterGridColumn["options"]; dropdownStyle?: TestCenterGridColumn["dropdownStyle"] }): ReactNode {
  const option = options?.find(item => item.value === value);
  const label = option?.label ?? String(value || "");
  const style = option?.style ?? dropdownStyle;
  return <span className={`issue-data-grid__select-badge issue-data-grid__select-badge--${style}${value ? "" : " issue-data-grid__select-badge--empty"}`}>{label}</span>;
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
  return <div className="issue-data-grid__content-mode-toolbar" aria-label={`${column.name}内容格式`}><span>内容格式 · {column.name}</span>{contentModes.map(mode => <button key={mode.value} className={activeMode === mode.value ? "is-active" : ""} type="button" title={mode.label} onClick={() => onChange(mode.value)}><i aria-hidden="true">{mode.icon}</i><em>{mode.label}</em></button>)}<div className="issue-data-grid__content-mode-preview"><StructuredTextCell value="梳理需求\n验证结果" mode={activeMode} /></div></div>;
}

function DateEditor({ value, onValueChange }: { value?: string; onValueChange: (value: string) => void }): ReactNode { return <input className="issue-data-grid__date-editor" autoFocus type="date" value={value ?? ""} onChange={event => onValueChange(event.target.value)} />; }
function MultiSelectEditor({ value, onValueChange, options = [] }: { value?: string; onValueChange: (value: string) => void; options?: Array<{ label: string; value: string }> }): ReactNode {
  const selected = String(value ?? "").split("|").filter(Boolean);
  return <select className="issue-data-grid__multi-select-editor" autoFocus multiple value={selected} onChange={event => onValueChange(Array.from(event.target.selectedOptions, option => option.value).join("|"))}>{options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select>;
}

export function IssueDataGrid({ projectId, tableId, title = "产品问题测试清单", onBack, issues, onIssueChange, onIssueReorder, onAddIssue, onDeleteIssue }: IssueDataGridProps): ReactNode {
  const [query, setQuery] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [columns, setColumns] = useState(defaultColumns);
  const [tableStyle, setTableStyle] = useState(defaultStyle);
  const [draftColumns, setDraftColumns] = useState<TestCenterGridColumn[] | null>(null);
  const [draftTableStyle, setDraftTableStyle] = useState<TestCenterGridStyle | null>(null);
  const [deletedColumns, setDeletedColumns] = useState<TestCenterGridColumn[]>([]);
  const [draftDeletedColumns, setDraftDeletedColumns] = useState<TestCenterGridColumn[]>([]);
  const [settingsDirty, setSettingsDirty] = useState(false);
  const [newFieldName, setNewFieldName] = useState("");
  const [styleSelection, setStyleSelection] = useState<StyleSelection | null>(null);
  const [recordMenu, setRecordMenu] = useState<{ x: number; y: number; issueId?: string } | null>(null);
  const copiedCell = useRef<CopiedCell | null>(null);
  const copiedCellElement = useRef<HTMLElement | null>(null);
  const gridApi = useRef<GridApi<IssueGridRow> | null>(null);
  const gridSettingsKey = `issues:${tableId}:columns`;

  useEffect(() => {
    let cancelled = false;
    void api.getTestCenterGridSettings(projectId, gridSettingsKey).then(settings => {
      if (cancelled || !settings.columns.length) return;
      const saved = new Map(settings.columns.map(column => [column.key, column]));
      const savedActiveColumns = settings.columns.filter(column => !column.deleted);
      const restored = [
        ...savedActiveColumns.map(column => ({ ...defaultColumns.find(defaultColumn => defaultColumn.key === column.key), ...column })),
        ...defaultColumns.filter(column => !saved.has(column.key)),
      ];
      setColumns(restored);
      setTableStyle({ ...defaultStyle, ...settings.style });
      setDeletedColumns(settings.columns.filter(column => column.deleted));
    });
    return () => { cancelled = true; };
  }, [gridSettingsKey, projectId]);
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
  const getRowHeight = useCallback((params: { data?: IssueGridRow }) => getIssueRowHeight(params.data, columns, baseRowHeight), [baseRowHeight, columns]);
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
    rowDrag: column.key === "serial" && !query,
    editable: column.key !== "serial" && column.key !== "updatedAt" && column.editable !== false,
    sortable: column.key !== "serial",
    resizable: true,
    pinned: column.frozen ? "left" : undefined,
    headerStyle: column.headerStyle,
    headerClass: `issue-data-grid__header-align-${column.headerStyle?.textAlign ?? "left"}`,
    cellStyle: column.cellStyle,
    cellEditor: column.fieldType === "select" ? SelectDrawerEditor : column.fieldType === "date" ? DateEditor : column.fieldType === "multiSelect" ? MultiSelectEditor : isTextField(column) && ((column.contentMode ?? "plain") !== "plain" || column.cellStyle?.whiteSpace === "normal") ? StructuredTextEditor : undefined,
    cellEditorParams: needsOptions(column.fieldType) ? { values: column.options?.map(option => option.value) ?? [], options: column.options, dropdownStyle: column.dropdownStyle } : undefined,
    cellEditorPopup: column.fieldType === "select",
    cellEditorPopupPosition: column.fieldType === "select" ? "under" : undefined,
    cellRenderer: column.fieldType === "select" ? (params: { value: string | number }) => <SelectBadge value={params.value} options={column.options} dropdownStyle={column.dropdownStyle} /> : column.fieldType === "checkbox" ? (params: { value: string | number; setValue: (value: string) => void }) => <CheckboxCell {...params} /> : column.fieldType === "multiSelect" ? (params: { value: string | number }) => <MultiSelectCell {...params} options={column.options} dropdownStyle={column.dropdownStyle} /> : isTextField(column) && (column.contentMode ?? "plain") !== "plain" ? (params: { value: string | number; setValue: (value: string) => void }) => <StructuredTextCell {...params} mode={column.contentMode} /> : undefined,
    wrapText: isTextField(column) && (column.contentMode === "wrap" || column.cellStyle?.whiteSpace === "normal"),
    suppressKeyboardEvent: params => handleClipboardShortcut(params.event, params.data, column.key, params.editing),
    cellClass: [column.key === "serial" ? "issue-data-grid__serial" : "", column.fieldType === "select" ? "issue-data-grid__select-cell" : "", column.contentMode && column.contentMode !== "plain" ? "issue-data-grid__cell-structured" : "", column.cellStyle?.whiteSpace === "normal" ? "issue-data-grid__cell-auto-wrap" : "", `issue-data-grid__cell-align-${column.cellStyle?.textAlign ?? "left"}`].filter(Boolean).join(" "),
  })), [columns, handleClipboardShortcut, query]);

  const persistSettings = (nextColumns: TestCenterGridColumn[], nextStyle = tableStyle, nextDeletedColumns = deletedColumns) => {
    setColumns(nextColumns);
    setTableStyle(nextStyle);
    void api.saveTestCenterGridSettings(projectId, gridSettingsKey, [...nextColumns, ...nextDeletedColumns], nextStyle);
  };
  const settingsColumns = draftColumns ?? columns;
  const settingsStyle = draftTableStyle ?? tableStyle;
  const updateDraft = (nextColumns: TestCenterGridColumn[]) => { setDraftColumns(nextColumns); setSettingsDirty(true); };
  const updateColumn = (key: string, patch: Partial<TestCenterGridColumn>) => updateDraft(settingsColumns.map(column => column.key === key ? { ...column, ...patch } : column));
  const updateHeaderStyle = (key: string, patch: NonNullable<TestCenterGridColumn["headerStyle"]>) => {
    const column = settingsColumns.find(item => item.key === key);
    updateColumn(key, { headerStyle: { ...column?.headerStyle, ...patch } });
  };
  const updateCellStyle = (key: string, patch: NonNullable<TestCenterGridColumn["cellStyle"]>) => {
    const column = settingsColumns.find(item => item.key === key);
    updateColumn(key, { cellStyle: { ...column?.cellStyle, ...patch } });
  };
  const updateOptions = (key: string, options: Array<{ label: string; value: string }>) => updateColumn(key, { options });
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
    if (defaultColumns.some(column => column.key === key)) {
      setDraftDeletedColumns(current => [...current.filter(item => item.key !== key), { ...column, deleted: true }]);
    }
    updateDraft(settingsColumns.filter(item => item.key !== key));
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
    const widths = new Map(gridApi.getColumnState().map(column => [column.colId, column.width ?? undefined]));
    persistSettings(columns.map(column => ({ ...column, width: widths.get(column.key) ?? column.width })));
  };
  const saveColumnOrder = (gridApi: GridApi<IssueGridRow>) => {
    const positions = new Map(gridApi.getColumnState().map((column, index) => [column.colId, index]));
    persistSettings([...columns].sort((left, right) => (positions.get(left.key) ?? Number.MAX_SAFE_INTEGER) - (positions.get(right.key) ?? Number.MAX_SAFE_INTEGER)));
  };
  const updateStyle = (patch: Partial<TestCenterGridStyle>) => {
    setDraftTableStyle({ ...settingsStyle, ...patch });
    setSettingsDirty(true);
  };
  const applySettings = () => {
    persistSettings(settingsColumns, settingsStyle, draftDeletedColumns);
    setDeletedColumns(draftDeletedColumns);
    setSettingsDirty(false);
  };
  const toggleSettings = () => {
    if (settingsOpen) { setSettingsOpen(false); setDraftColumns(null); setDraftTableStyle(null); setStyleSelection(null); return; }
    setDraftColumns(columns); setDraftTableStyle(tableStyle); setDraftDeletedColumns(deletedColumns); setSettingsDirty(false); setSettingsOpen(true);
  };
  const activeStyleColumn = styleSelection && styleSelection.target !== "dropdown" ? settingsColumns.find(column => column.key === styleSelection.key) : undefined;
  const activeStyle = styleSelection?.target === "header" ? activeStyleColumn?.headerStyle : styleSelection?.target === "cell" ? activeStyleColumn?.cellStyle : undefined;
  const activeHeaderStyle = styleSelection?.target === "header" ? activeStyleColumn?.headerStyle : undefined;
  const activeCellStyle = styleSelection?.target === "cell" ? activeStyleColumn?.cellStyle : undefined;
  const activeDropdownColumn = styleSelection?.target === "dropdown" ? settingsColumns.find(column => column.key === styleSelection.key) : undefined;
  const activeDropdownOption = activeDropdownColumn?.options?.find(option => option.value === styleSelection?.optionValue);

  return <div className={`issue-data-grid issue-data-grid--${tableStyle.density} issue-data-grid--header-${tableStyle.headerTone}${tableStyle.stripedRows ? " issue-data-grid--striped" : ""}`} aria-label="高级问题表格">
    <header className="issue-data-grid__identity">{onBack ? <button className="issue-data-grid__identity-title" type="button" onClick={onBack} title="返回问题清单列表" aria-label={`返回问题清单列表：${title}`}><span>TEST CENTER · ISSUE LOG</span><h2>{title}</h2></button> : <div className="issue-data-grid__identity-title"><span>TEST CENTER · ISSUE LOG</span><h2>{title}</h2></div>}<span className="issue-data-grid__record-count">{visibleRows.length} 条记录</span></header>
    <div className="issue-data-grid__toolbar">
      <label className="issue-data-grid__search"><span aria-hidden="true">⌕</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索已设为可检索的字段" /></label>
      <button className="issue-data-grid__settings-trigger" type="button" onClick={toggleSettings} aria-expanded={settingsOpen}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h2m4 0h10M14 4v6M8 14v6" /></svg><span>表格设置</span></button>
    </div>
    {settingsOpen && <aside className="issue-data-grid__settings" aria-label="表格设置">
      {activeStyleColumn && styleSelection?.target === "cell" && isTextField(activeStyleColumn) && <ContentModeToolbar column={activeStyleColumn} onChange={contentMode => updateColumn(activeStyleColumn.key, { contentMode })} />}
      {activeDropdownColumn && styleSelection && <div className="issue-data-grid__dropdown-toolbar"><span>下拉样式 · {activeDropdownColumn.name} · {activeDropdownOption?.label ?? "统一所有选项"}</span>{dropdownStyles.map(style => <button key={style.value} className={`issue-data-grid__toolbar-dropdown-style issue-data-grid__toolbar-dropdown-style--${style.value}${(activeDropdownOption?.style ?? activeDropdownColumn.dropdownStyle ?? "soft") === style.value ? " is-active" : ""}`} type="button" onClick={() => updateDropdownStyle(activeDropdownColumn.key, styleSelection.optionValue, style.value)}><span>{style.label}</span></button>)}</div>}
      <div className="issue-data-grid__settings-actions"><div className="issue-data-grid__add-field"><span aria-hidden="true">＋</span><input value={newFieldName} onChange={event => setNewFieldName(event.target.value)} onKeyDown={event => { if (event.key === "Enter") addField(); }} placeholder="新字段名称" /><button type="button" onClick={addField}>添加字段</button></div><div className="issue-data-grid__style-toolbar">{activeStyleColumn && styleSelection ? <><span className="issue-data-grid__style-toolbar-title">样式工具栏 · {activeStyleColumn.name} · {styleSelection.target === "header" ? "标题" : "内容"}</span><label>字号<select value={activeStyle?.fontSize ?? "13px"} onChange={event => styleSelection.target === "header" ? updateHeaderStyle(activeStyleColumn.key, { fontSize: event.target.value as NonNullable<TestCenterGridColumn["headerStyle"]>["fontSize"] }) : updateCellStyle(activeStyleColumn.key, { fontSize: event.target.value as NonNullable<TestCenterGridColumn["cellStyle"]>["fontSize"] })}><option value="12px">12</option><option value="13px">13</option><option value="14px">14</option><option value="16px">16</option></select></label><button className={activeStyle?.fontWeight === "700" ? "is-active" : ""} type="button" title="加粗" onClick={() => styleSelection.target === "header" ? updateHeaderStyle(activeStyleColumn.key, { fontWeight: activeStyle?.fontWeight === "700" ? "400" : "700" }) : updateCellStyle(activeStyleColumn.key, { fontWeight: activeStyle?.fontWeight === "700" ? "400" : "700" })}><b>B</b></button>{styleSelection.target === "header" && <button className={activeHeaderStyle?.fontStyle === "italic" ? "is-active" : ""} type="button" title="斜体" onClick={() => updateHeaderStyle(activeStyleColumn.key, { fontStyle: activeHeaderStyle?.fontStyle === "italic" ? "normal" : "italic" })}><i>I</i></button>}<label title="文字颜色"><input type="color" value={activeStyle?.color ?? (styleSelection.target === "header" ? "#aab4ba" : "#d7e0e3")} onChange={event => styleSelection.target === "header" ? updateHeaderStyle(activeStyleColumn.key, { color: event.target.value }) : updateCellStyle(activeStyleColumn.key, { color: event.target.value })} /></label><label title="背景颜色"><input type="color" value={activeStyle?.backgroundColor ?? (styleSelection.target === "header" ? "#292f34" : "#202529")} onChange={event => styleSelection.target === "header" ? updateHeaderStyle(activeStyleColumn.key, { backgroundColor: event.target.value }) : updateCellStyle(activeStyleColumn.key, { backgroundColor: event.target.value })} /></label>{styleSelection.target === "cell" && <button className={activeCellStyle?.whiteSpace === "normal" ? "is-active" : ""} type="button" title="自动换行" aria-label="自动换行" onClick={() => updateCellStyle(activeStyleColumn.key, { whiteSpace: activeCellStyle?.whiteSpace === "normal" ? "nowrap" : "normal" })}>↵</button>}<span className="issue-data-grid__style-toolbar-divider" /><button className={activeStyle?.textAlign === "left" || !activeStyle?.textAlign ? "is-active" : ""} type="button" title="左对齐" onClick={() => styleSelection.target === "header" ? updateHeaderStyle(activeStyleColumn.key, { textAlign: "left" }) : updateCellStyle(activeStyleColumn.key, { textAlign: "left" })}>≡</button><button className={activeStyle?.textAlign === "center" ? "is-active" : ""} type="button" title="居中" onClick={() => styleSelection.target === "header" ? updateHeaderStyle(activeStyleColumn.key, { textAlign: "center" }) : updateCellStyle(activeStyleColumn.key, { textAlign: "center" })}>≡</button><button className={activeStyle?.textAlign === "right" ? "is-active" : ""} type="button" title="右对齐" onClick={() => styleSelection.target === "header" ? updateHeaderStyle(activeStyleColumn.key, { textAlign: "right" }) : updateCellStyle(activeStyleColumn.key, { textAlign: "right" })}>≡</button></> : <span className="issue-data-grid__style-toolbar-hint">选择下面的标题或内容预览，开始调整样式</span>}</div></div>
      <div className="issue-data-grid__field-table-wrap"><table className="issue-data-grid__field-table"><thead><tr><th>字段名称</th><th>字段类型</th><th>选项与样式</th><th>标题样式</th><th>内容样式</th><th>可编辑</th><th>参与搜索</th><th>显示</th><th>操作</th></tr></thead><tbody>{settingsColumns.map(column => <tr key={column.key}>
        <td><input aria-label={`${column.name}列名`} value={column.name} onChange={event => updateColumn(column.key, { name: event.target.value })} /></td>
        <td><select value={column.fieldType ?? "text"} disabled={column.key === "serial" || column.key === "updatedAt"} onChange={event => { const fieldType = event.target.value as TestCenterGridColumn["fieldType"]; updateColumn(column.key, { fieldType, options: needsOptions(fieldType) ? column.options ?? [] : undefined }); }}><option value="text">编辑框</option><option value="date">日期</option><option value="checkbox">勾选</option><option value="select">下拉选项</option><option value="multiSelect">多选下拉</option></select></td>
        <td>{needsOptions(column.fieldType) ? <details className={`issue-data-grid__option-editor issue-data-grid__option-editor--${column.dropdownStyle ?? "soft"}`}><summary aria-label={`${column.name}下拉选项`} onClick={() => setStyleSelection({ key: column.key, target: "dropdown" })}><span>{column.options?.[0]?.label ?? "添加选项"}</span><span aria-hidden="true">⌄</span></summary><div className="issue-data-grid__option-editor-menu"><div className="issue-data-grid__option-list">{(column.options ?? []).map((option, index) => <div className="issue-data-grid__option-row" key={option.value}><input className={`issue-data-grid__option-content issue-data-grid__option-content--${option.style ?? column.dropdownStyle ?? "soft"}${styleSelection?.key === column.key && styleSelection.optionValue === option.value ? " is-selected" : ""}`} aria-label={`${option.label}选项`} value={option.label} onFocus={() => setStyleSelection({ key: column.key, target: "dropdown", optionValue: option.value })} onChange={event => updateOptions(column.key, (column.options ?? []).map(item => item.value === option.value ? { ...item, label: event.target.value } : item))} /><div><button type="button" aria-label="上移选项" title="上移选项" disabled={index === 0} onClick={() => moveOption(column.key, index, -1)}>↑</button><button type="button" aria-label="下移选项" title="下移选项" disabled={index === (column.options?.length ?? 0) - 1} onClick={() => moveOption(column.key, index, 1)}>↓</button><button type="button" aria-label="删除选项" title="删除选项" onClick={() => updateOptions(column.key, (column.options ?? []).filter(item => item.value !== option.value))}>×</button></div></div>)}</div><button className="issue-data-grid__add-option" type="button" onClick={() => addOption(column.key)}>＋ 新增选项</button></div></details> : <span className="issue-data-grid__not-applicable">—</span>}</td>
        <td><button className={`issue-data-grid__style-preview-button${styleSelection?.key === column.key && styleSelection.target === "header" ? " is-selected" : ""}`} type="button" onClick={() => setStyleSelection({ key: column.key, target: "header" })}><span className="issue-data-grid__style-preview-header" style={column.headerStyle}>{column.name}</span></button></td>
        <td><button className={`issue-data-grid__style-preview-button${styleSelection?.key === column.key && styleSelection.target === "cell" ? " is-selected" : ""}`} type="button" onClick={() => setStyleSelection({ key: column.key, target: "cell" })}><span className="issue-data-grid__style-preview-cell" style={column.cellStyle}>示例值</span></button></td>
        <td><input type="checkbox" checked={column.editable !== false && column.key !== "serial" && column.key !== "updatedAt"} disabled={column.key === "serial" || column.key === "updatedAt"} onChange={event => updateColumn(column.key, { editable: event.target.checked })} /></td>
        <td><input type="checkbox" checked={column.searchable === true} onChange={event => updateColumn(column.key, { searchable: event.target.checked })} /></td>
        <td><input type="checkbox" checked={column.visible !== false} onChange={event => updateColumn(column.key, { visible: event.target.checked })} /></td>
        <td><button className="issue-data-grid__delete-column" type="button" aria-label="删除字段" title="删除字段" onClick={() => removeColumn(column.key)}><svg className="issue-data-grid__delete-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13M10 11v5m4-5v5" /></svg></button></td>
      </tr>)}</tbody></table></div>
      <section className="issue-data-grid__style"><b>表格样式</b><label>密度<select value={settingsStyle.density} onChange={event => updateStyle({ density: event.target.value as TestCenterGridStyle["density"] })}><option value="compact">紧凑</option><option value="comfortable">舒适</option></select></label><label>表头色调<select value={settingsStyle.headerTone} onChange={event => updateStyle({ headerTone: event.target.value as TestCenterGridStyle["headerTone"] })}><option value="neutral">中性</option><option value="slate">石板</option><option value="cyan">青色</option></select></label><label><input type="checkbox" checked={settingsStyle.stripedRows} onChange={event => updateStyle({ stripedRows: event.target.checked })} /> 斑马纹行</label><button className={`issue-data-grid__apply-settings${settingsDirty ? " is-ready" : ""}`} type="button" disabled={!settingsDirty} onClick={applySettings}>{settingsDirty ? "应用更改" : "已应用"}</button></section>
    </aside>}
    <div className="issue-data-grid__table" onKeyDownCapture={handleGridKeyDownCapture} onContextMenu={event => { if (event.target === event.currentTarget) { event.preventDefault(); setRecordMenu({ x: event.clientX, y: event.clientY }); } }}><AgGridReact<IssueGridRow>
      theme={issueGridTheme} rowData={visibleRows} columnDefs={columnDefs} defaultColDef={{ sortable: true }} getRowId={params => params.data.id} onGridReady={event => { gridApi.current = event.api; }} getRowHeight={getRowHeight} rowDragManaged={!query} suppressMoveWhenRowDragging animateRows enableCellTextSelection suppressClipboardPaste suppressCutToClipboard rowHeight={baseRowHeight} headerHeight={40} singleClickEdit={false} stopEditingWhenCellsLoseFocus
      onCellClicked={event => { const column = columns.find(item => item.key === event.colDef.field); if (event.rowIndex !== null && needsOptions(column?.fieldType)) event.api.startEditingCell({ rowIndex: event.rowIndex, colKey: event.column.getColId() }); }}
      onCellContextMenu={event => { const mouseEvent = event.event as MouseEvent | undefined; if (!mouseEvent || !event.data) return; mouseEvent.preventDefault(); setRecordMenu({ x: mouseEvent.clientX, y: mouseEvent.clientY, issueId: event.data.id }); }}
      onRowDragEnd={event => { const issueIds: string[] = []; event.api.forEachNode(node => { if (node.data) issueIds.push(node.data.id); }); onIssueReorder(issueIds); }}
      onColumnResized={event => { if (event.finished) { event.api.resetRowHeights(); saveColumnWidths(event.api); } }}
      onColumnMoved={event => { if (event.finished) saveColumnOrder(event.api); }}
      onCellValueChanged={event => {
        const field = event.colDef.field;
        if (!field || event.oldValue === event.newValue) return;
        saveCellValue(event.data, field, String(event.newValue ?? ""));
      }}
    />{recordMenu && <div className="issue-data-grid__record-menu" style={{ left: recordMenu.x, top: recordMenu.y }} onPointerDown={event => event.stopPropagation()}><button type="button" onClick={() => { onAddIssue(); setRecordMenu(null); }}>＋ 新增记录</button>{recordMenu.issueId && <button className="is-danger" type="button" onClick={() => { onDeleteIssue(recordMenu.issueId!); setRecordMenu(null); }}>删除记录</button>}</div>}</div>
  </div>;
}

export default IssueDataGrid;
