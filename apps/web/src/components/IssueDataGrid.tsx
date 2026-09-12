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
  { key: "issueType", name: "类型", width: 142, editable: true, fieldType: "select", options: issueTypeOptions, searchable: true, visible: true },
  { key: "module", name: "模块", width: 140, editable: true, searchable: true, visible: true },
  { key: "title", name: "问题", width: 220, editable: true, searchable: true, visible: true },
  { key: "description", name: "问题说明", width: 260, editable: true, searchable: true, visible: true },
  { key: "eta", name: "ETA", width: 132, editable: true, searchable: true, visible: true },
  { key: "progressFollowUp", name: "进度跟进", width: 180, editable: true, searchable: true, visible: true },
  { key: "owner", name: "负责人", width: 136, editable: true, searchable: true, visible: true },
  { key: "status", name: "状态", width: 118, editable: true, fieldType: "select", options: Object.entries(statusLabels).map(([value, label]) => ({ value, label })), searchable: true, visible: true },
  { key: "externalRef", name: "外部记录", width: 150, editable: true, searchable: true, visible: true },
  { key: "updatedAt", name: "更新时间", width: 164, editable: false, searchable: false, visible: true },
];
const defaultStyle: TestCenterGridStyle = { density: "comfortable", headerTone: "neutral", stripedRows: false };
const issueGridTheme = themeQuartz.withPart(colorSchemeDark);
const formatTime = (value: string) => value.replace("T", " ").slice(0, 16);
const optionText = (options?: Array<{ label: string; value: string }>) => options?.map(option => option.label).join("\n") ?? "";
const parseOptions = (value: string) => value.split("\n").map(item => item.trim()).filter(Boolean).map(item => ({ label: item, value: item }));
const fieldKeyFromName = (name: string) => `custom_${name.trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "_").replace(/^_+|_+$/g, "") || "field"}`;

function SelectBadge({ value, options }: { value: string | number; options?: Array<{ label: string; value: string }> }): ReactNode {
  const label = options?.find(option => option.value === value)?.label ?? String(value || "选择选项");
  return <span className={`issue-data-grid__select-badge${value ? "" : " issue-data-grid__select-badge--empty"}`}>{label}</span>;
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
        ...defaultColumns.map(column => ({ ...column, ...saved.get(column.key) })),
        ...settings.columns.filter(column => !systemFields.has(column.key) && !defaultColumns.some(defaultColumn => defaultColumn.key === column.key)),
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
    cellEditor: column.fieldType === "select" ? "agSelectCellEditor" : undefined,
    cellEditorParams: column.fieldType === "select" ? { values: column.options?.map(option => option.value) ?? [] } : undefined,
    cellRenderer: column.fieldType === "select" ? (params: { value: string | number }) => <SelectBadge value={params.value} options={column.options} /> : undefined,
    cellClass: column.key === "serial" ? "issue-data-grid__serial" : undefined,
  })), [columns]);

  const saveSettings = (nextColumns: TestCenterGridColumn[], nextStyle = tableStyle) => {
    setColumns(nextColumns);
    void api.saveTestCenterGridSettings(projectId, gridSettingsKey, nextColumns, nextStyle);
  };
  const updateColumn = (key: string, patch: Partial<TestCenterGridColumn>) => saveSettings(columns.map(column => column.key === key ? { ...column, ...patch } : column));
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
      <header><div><b>字段配置</b><span>字段顺序、宽度和显示内容会自动保存。</span></div><button type="button" aria-label="关闭表格设置" onClick={() => setSettingsOpen(false)}>×</button></header>
      <div className="issue-data-grid__add-field"><input value={newFieldName} onChange={event => setNewFieldName(event.target.value)} onKeyDown={event => { if (event.key === "Enter") addField(); }} placeholder="新字段名称，例如：优先级" /><button type="button" onClick={addField}>添加字段</button></div>
      <div className="issue-data-grid__field-list">{columns.map(column => <article key={column.key}>
        <input aria-label={`${column.name}列名`} value={column.name} onChange={event => updateColumn(column.key, { name: event.target.value })} />
        <label>字段类型<select value={column.fieldType ?? "text"} disabled={column.key === "serial" || column.key === "updatedAt"} onChange={event => updateColumn(column.key, { fieldType: event.target.value as "text" | "select", options: event.target.value === "select" ? column.options ?? [] : undefined })}><option value="text">编辑框</option><option value="select">下拉选项</option></select></label>
        {column.fieldType === "select" && <label className="issue-data-grid__options">下拉选项<textarea value={optionText(column.options)} onChange={event => updateColumn(column.key, { options: parseOptions(event.target.value) })} placeholder="每行一个选项" /></label>}
        <div className="issue-data-grid__properties"><label><input type="checkbox" checked={column.editable !== false && column.key !== "serial" && column.key !== "updatedAt"} disabled={column.key === "serial" || column.key === "updatedAt"} onChange={event => updateColumn(column.key, { editable: event.target.checked })} /> 可编辑</label><label><input type="checkbox" checked={column.searchable === true} onChange={event => updateColumn(column.key, { searchable: event.target.checked })} /> 参与搜索</label><label><input type="checkbox" checked={column.visible !== false} onChange={event => updateColumn(column.key, { visible: event.target.checked })} /> 显示</label></div>
      </article>)}</div>
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
