import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AgGridReact } from "ag-grid-react";
import { AllCommunityModule, colorSchemeDark, ModuleRegistry, themeQuartz, type ColDef, type GridApi } from "ag-grid-community";
import { api, type TestCenterGridColumn, type TestCenterGridStyle, type TestCenterIssue } from "../api/client.js";
import "./IssueDataGrid.css";

ModuleRegistry.registerModules([AllCommunityModule]);

type IssueStatus = "open" | "fixed" | "retest" | "closed";
type EditableIssueField = "title" | "description" | "owner" | "status" | "externalRef";
type IssueChange = Partial<Pick<TestCenterIssue, EditableIssueField | "customFields">>;
type IssueGridRow = { id: string; serial: number; title: string; description: string; owner: string; status: IssueStatus; externalRef: string; updatedAt: string; customFields: Record<string, string>; [key: string]: string | number | Record<string, string> };

type IssueDataGridProps = { projectId: string; tableId: string; issues: TestCenterIssue[]; onIssueChange: (issueId: string, patch: IssueChange) => void };

const systemFields = new Set(["serial", "title", "description", "owner", "status", "externalRef", "updatedAt"]);
const statusLabels: Record<IssueStatus, string> = { open: "待处理", fixed: "已修复", retest: "待复测", closed: "已关闭" };
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
const dropdownStyles = [{ value: "standard", label: "标准" }, { value: "soft", label: "轻柔色块" }, { value: "pill", label: "圆角标签" }, { value: "signal", label: "强调色块" }] as const;

function SelectBadge({ value, options, dropdownStyle = "soft" }: { value: string | number; options?: Array<{ label: string; value: string }>; dropdownStyle?: TestCenterGridColumn["dropdownStyle"] }): ReactNode {
  const label = options?.find(option => option.value === value)?.label ?? String(value || "选择选项");
  return <span className={`issue-data-grid__select-badge issue-data-grid__select-badge--${dropdownStyle}${value ? "" : " issue-data-grid__select-badge--empty"}`}>{label}</span>;
}

function CheckboxCell({ value, setValue }: { value: string | number; setValue: (value: string) => void }): ReactNode {
  return <label className="issue-data-grid__checkbox"><input type="checkbox" checked={value === "true"} onChange={event => setValue(String(event.target.checked))} /><span>{value === "true" ? "是" : "否"}</span></label>;
}

function MultiSelectCell({ value, options, dropdownStyle }: { value: string | number; options?: Array<{ label: string; value: string }>; dropdownStyle?: TestCenterGridColumn["dropdownStyle"] }): ReactNode {
  const values = String(value ?? "").split("|").filter(Boolean);
  return <span className="issue-data-grid__multi-select">{values.length ? values.map(item => <SelectBadge key={item} value={item} options={options} dropdownStyle={dropdownStyle} />) : <SelectBadge value="" options={options} dropdownStyle={dropdownStyle} />}</span>;
}

function DateEditor({ value, onValueChange }: { value?: string; onValueChange: (value: string) => void }): ReactNode { return <input className="issue-data-grid__date-editor" autoFocus type="date" value={value ?? ""} onChange={event => onValueChange(event.target.value)} />; }
function MultiSelectEditor({ value, onValueChange, options = [] }: { value?: string; onValueChange: (value: string) => void; options?: Array<{ label: string; value: string }> }): ReactNode {
  const selected = String(value ?? "").split("|").filter(Boolean);
  return <select className="issue-data-grid__multi-select-editor" autoFocus multiple value={selected} onChange={event => onValueChange(Array.from(event.target.selectedOptions, option => option.value).join("|"))}>{options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select>;
}

export function IssueDataGrid({ projectId, tableId, issues, onIssueChange }: IssueDataGridProps): ReactNode {
  const [query, setQuery] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [columns, setColumns] = useState(defaultColumns);
  const [tableStyle, setTableStyle] = useState(defaultStyle);
  const [newFieldName, setNewFieldName] = useState("");
  const resizeTimer = useRef<ReturnType<typeof setTimeout>>();
  const gridSettingsKey = `issues:${tableId}:columns`;

  useEffect(() => {
    let cancelled = false;
    void api.getTestCenterGridSettings(projectId, gridSettingsKey).then(settings => {
      if (cancelled || !settings.columns.length) return;
      const saved = new Map(settings.columns.map(column => [column.key, column]));
      const restored = [
        ...defaultColumns.filter(column => !saved.get(column.key)?.deleted).map(column => ({ ...column, ...saved.get(column.key) })),
        ...settings.columns.filter(column => !column.deleted && !systemFields.has(column.key) && !defaultColumns.some(defaultColumn => defaultColumn.key === column.key)),
      ];
      setColumns(restored);
      setTableStyle({ ...defaultStyle, ...settings.style });
    });
    return () => { cancelled = true; };
  }, [gridSettingsKey, projectId]);
  useEffect(() => () => clearTimeout(resizeTimer.current), []);

  const rows = useMemo<IssueGridRow[]>(() => issues.map((issue, index) => ({
    id: issue.id, serial: index + 1, title: issue.title, description: issue.description, owner: issue.owner ?? "", status: issue.status as IssueStatus, externalRef: issue.externalRef ?? "", updatedAt: formatTime(issue.updatedAt), customFields: issue.customFields, ...issue.customFields,
  })), [issues]);
  const visibleRows = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return rows;
    return rows.filter(row => columns.filter(column => column.searchable).some(column => String(row[column.key] ?? "").toLowerCase().includes(keyword)));
  }, [columns, query, rows]);
  const columnDefs = useMemo<ColDef<IssueGridRow>[]>(() => columns.filter(column => column.visible !== false).map(column => ({
    field: column.key,
    headerName: column.name,
    width: column.width ?? 160,
    editable: column.key !== "serial" && column.key !== "updatedAt" && column.editable !== false,
    sortable: column.key !== "serial",
    resizable: true,
    pinned: column.frozen ? "left" : undefined,
    headerStyle: column.headerStyle,
    cellStyle: column.cellStyle,
    cellEditor: column.fieldType === "select" ? "agSelectCellEditor" : column.fieldType === "date" ? DateEditor : column.fieldType === "multiSelect" ? MultiSelectEditor : undefined,
    cellEditorParams: needsOptions(column.fieldType) ? { values: column.options?.map(option => option.value) ?? [], options: column.options } : undefined,
    cellRenderer: column.fieldType === "select" ? (params: { value: string | number }) => <SelectBadge value={params.value} options={column.options} dropdownStyle={column.dropdownStyle} /> : column.fieldType === "checkbox" ? (params: { value: string | number; setValue: (value: string) => void }) => <CheckboxCell {...params} /> : column.fieldType === "multiSelect" ? (params: { value: string | number }) => <MultiSelectCell {...params} options={column.options} dropdownStyle={column.dropdownStyle} /> : undefined,
    cellClass: column.key === "serial" ? "issue-data-grid__serial" : undefined,
  })), [columns]);

  const saveSettings = (nextColumns: TestCenterGridColumn[], nextStyle = tableStyle) => {
    setColumns(nextColumns);
    void api.saveTestCenterGridSettings(projectId, gridSettingsKey, nextColumns, nextStyle);
  };
  const updateColumn = (key: string, patch: Partial<TestCenterGridColumn>) => saveSettings(columns.map(column => column.key === key ? { ...column, ...patch } : column));
  const updateHeaderStyle = (key: string, patch: NonNullable<TestCenterGridColumn["headerStyle"]>) => {
    const column = columns.find(item => item.key === key);
    updateColumn(key, { headerStyle: { ...column?.headerStyle, ...patch } });
  };
  const updateCellStyle = (key: string, patch: NonNullable<TestCenterGridColumn["cellStyle"]>) => {
    const column = columns.find(item => item.key === key);
    updateColumn(key, { cellStyle: { ...column?.cellStyle, ...patch } });
  };
  const updateOptions = (key: string, options: Array<{ label: string; value: string }>) => updateColumn(key, { options });
  const addOption = (key: string) => {
    const options = columns.find(column => column.key === key)?.options ?? [];
    const label = `选项 ${options.length + 1}`;
    updateOptions(key, [...options, { label, value: `option-${Date.now()}` }]);
  };
  const moveOption = (key: string, from: number, direction: -1 | 1) => {
    const options = [...(columns.find(column => column.key === key)?.options ?? [])];
    const to = from + direction;
    if (to < 0 || to >= options.length) return;
    [options[from], options[to]] = [options[to], options[from]];
    updateOptions(key, options);
  };
  const removeColumn = (key: string) => {
    if (defaultColumns.some(column => column.key === key)) {
      const column = columns.find(item => item.key === key);
      if (column) saveSettings([...columns.filter(item => item.key !== key), { ...column, deleted: true }]);
    }
    else saveSettings(columns.filter(column => column.key !== key));
  };
  const addField = () => {
    const name = newFieldName.trim();
    if (!name) return;
    const baseKey = fieldKeyFromName(name);
    let key = baseKey; let index = 2;
    while (columns.some(column => column.key === key)) key = `${baseKey}_${index++}`;
    saveSettings([...columns, { key, name, width: 160, editable: true, searchable: true, visible: true, fieldType: "text" }]);
    setNewFieldName("");
  };
  const saveColumnWidths = (gridApi: GridApi<IssueGridRow>) => {
    clearTimeout(resizeTimer.current);
    resizeTimer.current = setTimeout(() => {
      const widths = new Map(gridApi.getColumnState().map(column => [column.colId, column.width ?? undefined]));
      saveSettings(columns.map(column => ({ ...column, width: widths.get(column.key) ?? column.width })));
    }, 350);
  };
  const updateStyle = (patch: Partial<TestCenterGridStyle>) => {
    const nextStyle = { ...tableStyle, ...patch };
    setTableStyle(nextStyle);
    void api.saveTestCenterGridSettings(projectId, gridSettingsKey, columns, nextStyle);
  };

  return <div className={`issue-data-grid issue-data-grid--${tableStyle.density} issue-data-grid--header-${tableStyle.headerTone}${tableStyle.stripedRows ? " issue-data-grid--striped" : ""}`} aria-label="高级问题表格">
    <div className="issue-data-grid__toolbar">
      <label className="issue-data-grid__search"><span aria-hidden="true">⌕</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索已设为可检索的字段" /></label>
      <button className="issue-data-grid__settings-trigger" type="button" onClick={() => setSettingsOpen(open => !open)} aria-expanded={settingsOpen}>表格设置</button>
    </div>
    {settingsOpen && <aside className="issue-data-grid__settings" aria-label="表格设置">
      <div className="issue-data-grid__add-field"><input value={newFieldName} onChange={event => setNewFieldName(event.target.value)} onKeyDown={event => { if (event.key === "Enter") addField(); }} placeholder="新字段名称，例如：优先级" /><button type="button" onClick={addField}>添加字段</button></div>
      <div className="issue-data-grid__field-table-wrap"><table className="issue-data-grid__field-table"><thead><tr><th>字段名称</th><th>字段类型</th><th>选项与样式</th><th>字段样式</th><th>可编辑</th><th>参与搜索</th><th>显示</th><th>操作</th></tr></thead><tbody>{columns.map(column => <tr key={column.key}>
        <td><input aria-label={`${column.name}列名`} value={column.name} onChange={event => updateColumn(column.key, { name: event.target.value })} /></td>
        <td><select value={column.fieldType ?? "text"} disabled={column.key === "serial" || column.key === "updatedAt"} onChange={event => { const fieldType = event.target.value as TestCenterGridColumn["fieldType"]; updateColumn(column.key, { fieldType, options: needsOptions(fieldType) ? column.options ?? [] : undefined }); }}><option value="text">编辑框</option><option value="date">日期</option><option value="checkbox">勾选</option><option value="select">下拉选项</option><option value="multiSelect">多选下拉</option></select></td>
        <td>{needsOptions(column.fieldType) ? <details className={`issue-data-grid__option-editor issue-data-grid__option-editor--${column.dropdownStyle ?? "soft"}`}><summary aria-label={`${column.name}下拉选项`}><span>{column.options?.[0]?.label ?? "添加选项"}</span><span aria-hidden="true">⌄</span></summary><div className="issue-data-grid__option-editor-menu"><div className="issue-data-grid__option-style-picker"><span>下拉样式</span><div>{dropdownStyles.map(style => <button key={style.value} className={`issue-data-grid__option-style-choice issue-data-grid__option-style-choice--${style.value}${column.dropdownStyle === style.value ? " is-selected" : ""}`} type="button" onClick={() => updateColumn(column.key, { dropdownStyle: style.value })}><i>{style.label}</i></button>)}</div></div><div className="issue-data-grid__option-list">{(column.options ?? []).map((option, index) => <div className="issue-data-grid__option-row" key={option.value}><input aria-label={`${option.label}选项`} value={option.label} onChange={event => updateOptions(column.key, (column.options ?? []).map(item => item.value === option.value ? { ...item, label: event.target.value } : item))} /><div><button type="button" aria-label="上移选项" title="上移选项" disabled={index === 0} onClick={() => moveOption(column.key, index, -1)}>↑</button><button type="button" aria-label="下移选项" title="下移选项" disabled={index === (column.options?.length ?? 0) - 1} onClick={() => moveOption(column.key, index, 1)}>↓</button><button type="button" aria-label="删除选项" title="删除选项" onClick={() => updateOptions(column.key, (column.options ?? []).filter(item => item.value !== option.value))}>×</button></div></div>)}</div><button className="issue-data-grid__add-option" type="button" onClick={() => addOption(column.key)}>＋ 新增选项</button></div></details> : <span className="issue-data-grid__not-applicable">—</span>}</td>
        <td><details className="issue-data-grid__field-style"><summary aria-label={`${column.name}字段样式`}><span className="issue-data-grid__field-style-preview"><span className="issue-data-grid__field-style-preview-header" style={column.headerStyle}>{column.name}</span><span className="issue-data-grid__field-style-preview-cell" style={column.cellStyle}>示例值</span></span></summary><div><label>表头字号<select value={column.headerStyle?.fontSize ?? "13px"} onChange={event => updateHeaderStyle(column.key, { fontSize: event.target.value as NonNullable<TestCenterGridColumn["headerStyle"]>["fontSize"] })}><option value="12px">12 px</option><option value="13px">13 px</option><option value="14px">14 px</option><option value="16px">16 px</option></select></label><label>表头文字<input type="color" value={column.headerStyle?.color ?? "#aab4ba"} onChange={event => updateHeaderStyle(column.key, { color: event.target.value })} /></label><label>表头底色<input type="color" value={column.headerStyle?.backgroundColor ?? "#292f34"} onChange={event => updateHeaderStyle(column.key, { backgroundColor: event.target.value })} /></label><label>表头字重<select value={column.headerStyle?.fontWeight ?? "600"} onChange={event => updateHeaderStyle(column.key, { fontWeight: event.target.value as NonNullable<TestCenterGridColumn["headerStyle"]>["fontWeight"] })}><option value="400">常规</option><option value="600">中等</option><option value="700">粗体</option></select></label><label><input type="checkbox" checked={column.headerStyle?.fontStyle === "italic"} onChange={event => updateHeaderStyle(column.key, { fontStyle: event.target.checked ? "italic" : "normal" })} /> 斜体</label><label>单元格字号<select value={column.cellStyle?.fontSize ?? "13px"} onChange={event => updateCellStyle(column.key, { fontSize: event.target.value as NonNullable<TestCenterGridColumn["cellStyle"]>["fontSize"] })}><option value="12px">12 px</option><option value="13px">13 px</option><option value="14px">14 px</option><option value="16px">16 px</option></select></label><label>单元格字重<select value={column.cellStyle?.fontWeight ?? "400"} onChange={event => updateCellStyle(column.key, { fontWeight: event.target.value as NonNullable<TestCenterGridColumn["cellStyle"]>["fontWeight"] })}><option value="400">常规</option><option value="600">中等</option><option value="700">粗体</option></select></label><label>单元格文字<input type="color" value={column.cellStyle?.color ?? "#d7e0e3"} onChange={event => updateCellStyle(column.key, { color: event.target.value })} /></label><label>单元格底色<input type="color" value={column.cellStyle?.backgroundColor ?? "#202529"} onChange={event => updateCellStyle(column.key, { backgroundColor: event.target.value })} /></label></div></details></td>
        <td><input type="checkbox" checked={column.editable !== false && column.key !== "serial" && column.key !== "updatedAt"} disabled={column.key === "serial" || column.key === "updatedAt"} onChange={event => updateColumn(column.key, { editable: event.target.checked })} /></td>
        <td><input type="checkbox" checked={column.searchable === true} onChange={event => updateColumn(column.key, { searchable: event.target.checked })} /></td>
        <td><input type="checkbox" checked={column.visible !== false} onChange={event => updateColumn(column.key, { visible: event.target.checked })} /></td>
        <td><button className="issue-data-grid__delete-column" type="button" aria-label="删除字段" title="删除字段" onClick={() => removeColumn(column.key)}><svg className="issue-data-grid__delete-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13M10 11v5m4-5v5" /></svg></button></td>
      </tr>)}</tbody></table></div>
      <section className="issue-data-grid__style"><b>表格样式</b><label>密度<select value={tableStyle.density} onChange={event => updateStyle({ density: event.target.value as TestCenterGridStyle["density"] })}><option value="compact">紧凑</option><option value="comfortable">舒适</option></select></label><label>表头色调<select value={tableStyle.headerTone} onChange={event => updateStyle({ headerTone: event.target.value as TestCenterGridStyle["headerTone"] })}><option value="neutral">中性</option><option value="slate">石板</option><option value="cyan">青色</option></select></label><label><input type="checkbox" checked={tableStyle.stripedRows} onChange={event => updateStyle({ stripedRows: event.target.checked })} /> 斑马纹行</label></section>
    </aside>}
    <div className="issue-data-grid__table"><AgGridReact<IssueGridRow>
      theme={issueGridTheme} rowData={visibleRows} columnDefs={columnDefs} defaultColDef={{ sortable: true }} getRowId={params => params.data.id} rowHeight={tableStyle.density === "compact" ? 36 : 44} headerHeight={40} stopEditingWhenCellsLoseFocus
      onColumnResized={event => { if (event.finished) saveColumnWidths(event.api); }}
      onCellValueChanged={event => {
        const field = event.colDef.field;
        if (!field || systemFields.has(field) && field !== "title" && field !== "description" && field !== "owner" && field !== "status" && field !== "externalRef" || event.oldValue === event.newValue) return;
        const value = String(event.newValue ?? "");
        if (systemFields.has(field)) onIssueChange(event.data.id, { [field]: value });
        else onIssueChange(event.data.id, { customFields: { ...event.data.customFields, [field]: value } });
      }}
    /></div>
  </div>;
}

export default IssueDataGrid;
