import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AgGridReact } from "ag-grid-react";
import { AllCommunityModule, colorSchemeDark, ModuleRegistry, themeQuartz, type ColDef, type GridApi } from "ag-grid-community";
import { api, type TestCenterGridColumn, type TestCenterIssue } from "../api/client.js";
import "./IssueDataGrid.css";

ModuleRegistry.registerModules([AllCommunityModule]);

type IssueStatus = "open" | "fixed" | "retest" | "closed";
type IssueCustomField = "project" | "issueType" | "module" | "eta" | "progressFollowUp";
type EditableIssueField = "title" | "description" | "owner" | "status" | "externalRef";
type IssueChange = Partial<Pick<TestCenterIssue, EditableIssueField | "customFields">>;

type IssueDataGridProps = {
  projectId: string;
  tableId: string;
  issues: TestCenterIssue[];
  onIssueChange: (issueId: string, patch: IssueChange) => void;
};

type IssueGridRow = {
  id: string; serial: number; title: string; description: string; project: string; issueType: string; module: string; eta: string; progressFollowUp: string; owner: string; status: IssueStatus; externalRef: string; updatedAt: string; customFields: Record<string, string>;
};

const statusLabels: Record<IssueStatus, string> = { open: "待处理", fixed: "已修复", retest: "待复测", closed: "已关闭" };
const statusValues = Object.keys(statusLabels) as IssueStatus[];
const issueTypeLabels = { "ba-requirement": "BA-需求", "ba-bug": "BA-BUG", "product-bug": "产品-BUG", "product-requirement": "产品-需求" } as const;
const issueTypeValues = Object.keys(issueTypeLabels) as Array<keyof typeof issueTypeLabels>;
const issueGridTheme = themeQuartz.withPart(colorSchemeDark);
const formatTime = (value: string) => value.replace("T", " ").slice(0, 16);

function StatusCell({ value }: { value: IssueStatus }): ReactNode { return <span className={`issue-data-grid__status issue-data-grid__status--${value}`}>{statusLabels[value]}</span>; }
function IssueTypeCell({ value }: { value: string }): ReactNode {
  if (!value) return <span className="issue-data-grid__type issue-data-grid__type--empty">选择类型</span>;
  return <span className={`issue-data-grid__type issue-data-grid__type--${value}`}>{issueTypeLabels[value as keyof typeof issueTypeLabels] ?? value}</span>;
}

export function IssueDataGrid({ projectId, tableId, issues, onIssueChange }: IssueDataGridProps): ReactNode {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | IssueStatus>("all");
  const resizeTimer = useRef<ReturnType<typeof setTimeout>>();
  const gridSettingsKey = `issues:${tableId}:columns`;
  const rows = useMemo<IssueGridRow[]>(() => issues.map((issue, index) => ({
    id: issue.id, serial: index + 1, title: issue.title, description: issue.description,
    project: issue.customFields.project ?? "", issueType: issue.customFields.issueType ?? "", module: issue.customFields.module ?? "", eta: issue.customFields.eta ?? "", progressFollowUp: issue.customFields.progressFollowUp ?? "",
    owner: issue.owner ?? "", status: issue.status as IssueStatus, externalRef: issue.externalRef ?? "", updatedAt: formatTime(issue.updatedAt), customFields: issue.customFields,
  })), [issues]);
  const visibleRows = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return rows.filter(row => (statusFilter === "all" || row.status === statusFilter) && (!keyword || [row.title, row.description, row.project, row.module, row.owner, row.externalRef].some(value => value.toLowerCase().includes(keyword))));
  }, [query, rows, statusFilter]);
  const columnDefs = useMemo<ColDef<IssueGridRow>[]>(() => [
    { field: "serial", headerName: "序号", width: 76, minWidth: 68, editable: false, sortable: false, cellClass: "issue-data-grid__serial" },
    { field: "project", headerName: "项目", minWidth: 140, flex: .8, editable: true },
    { field: "issueType", headerName: "类型", width: 142, editable: true, cellEditor: "agSelectCellEditor", cellEditorParams: { values: issueTypeValues }, cellRenderer: IssueTypeCell },
    { field: "module", headerName: "模块", minWidth: 130, flex: .75, editable: true },
    { field: "title", headerName: "问题", minWidth: 220, flex: 1.25, editable: true },
    { field: "description", headerName: "问题说明", minWidth: 260, flex: 1.45, editable: true },
    { field: "eta", headerName: "ETA", width: 132, editable: true },
    { field: "progressFollowUp", headerName: "进度跟进", minWidth: 180, flex: 1, editable: true },
    { field: "owner", headerName: "负责人", width: 136, editable: true },
    { field: "status", headerName: "状态", width: 118, editable: true, cellEditor: "agSelectCellEditor", cellEditorParams: { values: statusValues }, cellRenderer: StatusCell },
    { field: "externalRef", headerName: "外部记录", minWidth: 150, flex: .8, editable: true },
    { field: "updatedAt", headerName: "更新时间", width: 164, editable: false },
  ], []);

  useEffect(() => () => clearTimeout(resizeTimer.current), []);
  const saveColumnWidths = (gridApi: GridApi<IssueGridRow>) => {
    clearTimeout(resizeTimer.current);
    resizeTimer.current = setTimeout(() => {
      const columns: TestCenterGridColumn[] = gridApi.getColumnState().map(column => ({ key: column.colId, name: column.colId, width: column.width ?? undefined }));
      void api.saveTestCenterGridSettings(projectId, gridSettingsKey, columns);
    }, 350);
  };

  return <div className="issue-data-grid" aria-label="高级问题表格">
    <div className="issue-data-grid__toolbar">
      <label className="issue-data-grid__search"><span aria-hidden="true">⌕</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索项目、问题或负责人" /></label>
      <label className="issue-data-grid__filter">状态<select value={statusFilter} onChange={event => setStatusFilter(event.target.value as "all" | IssueStatus)}><option value="all">全部</option>{statusValues.map(status => <option key={status} value={status}>{statusLabels[status]}</option>)}</select></label>
    </div>
    <div className="issue-data-grid__table"><AgGridReact<IssueGridRow>
      theme={issueGridTheme} rowData={visibleRows} columnDefs={columnDefs} defaultColDef={{ sortable: true, resizable: true }} getRowId={params => params.data.id} rowHeight={44} headerHeight={40} stopEditingWhenCellsLoseFocus
      onGridReady={event => { void api.getTestCenterGridSettings(projectId, gridSettingsKey).then(settings => event.api.applyColumnState({ state: settings.columns.map(column => ({ colId: column.key, width: column.width })), applyOrder: true })); }}
      onColumnResized={event => { if (event.finished) saveColumnWidths(event.api); }}
      onCellValueChanged={event => {
        const field = event.colDef.field as EditableIssueField | IssueCustomField | undefined;
        if (!field || event.oldValue === event.newValue) return;
        const value = String(event.newValue ?? "");
        if (["project", "issueType", "module", "eta", "progressFollowUp"].includes(field)) onIssueChange(event.data.id, { customFields: { ...event.data.customFields, [field]: value } });
        else onIssueChange(event.data.id, { [field]: value });
      }}
    /></div>
  </div>;
}

export default IssueDataGrid;
