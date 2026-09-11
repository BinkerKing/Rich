import { useMemo, useState, type ReactNode } from "react";
import { AgGridReact } from "ag-grid-react";
import { AllCommunityModule, colorSchemeDark, ModuleRegistry, themeQuartz, type ColDef } from "ag-grid-community";
import type { TestCenterIssue } from "../api/client.js";
import "./IssueDataGrid.css";

ModuleRegistry.registerModules([AllCommunityModule]);

type IssueStatus = "open" | "fixed" | "retest" | "closed";
type EditableIssueField = "title" | "description" | "owner" | "status" | "externalRef";

type IssueDataGridProps = {
  issues: TestCenterIssue[];
  onIssueChange: (issueId: string, patch: Partial<Pick<TestCenterIssue, EditableIssueField>>) => void;
};

type IssueGridRow = {
  id: string;
  title: string;
  description: string;
  owner: string;
  status: IssueStatus;
  externalRef: string;
  updatedAt: string;
};

const statusLabels: Record<IssueStatus, string> = { open: "待处理", fixed: "已修复", retest: "待复测", closed: "已关闭" };
const statusValues = Object.keys(statusLabels) as IssueStatus[];
const issueGridTheme = themeQuartz.withPart(colorSchemeDark);
const formatTime = (value: string) => value.replace("T", " ").slice(0, 16);

function StatusCell({ value }: { value: IssueStatus }): ReactNode {
  return <span className={`issue-data-grid__status issue-data-grid__status--${value}`}>{statusLabels[value]}</span>;
}

export function IssueDataGrid({ issues, onIssueChange }: IssueDataGridProps): ReactNode {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | IssueStatus>("all");
  const rows = useMemo<IssueGridRow[]>(() => issues.map(issue => ({
    id: issue.id,
    title: issue.title,
    description: issue.description,
    owner: issue.owner ?? "",
    status: issue.status as IssueStatus,
    externalRef: issue.externalRef ?? "",
    updatedAt: formatTime(issue.updatedAt),
  })), [issues]);
  const visibleRows = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return rows.filter(row => (statusFilter === "all" || row.status === statusFilter) && (!keyword || [row.title, row.description, row.owner, row.externalRef].some(value => value.toLowerCase().includes(keyword))));
  }, [query, rows, statusFilter]);
  const columnDefs = useMemo<ColDef<IssueGridRow>[]>(() => [
    { field: "title", headerName: "问题", minWidth: 220, flex: 1.25, editable: true },
    { field: "description", headerName: "问题说明", minWidth: 280, flex: 1.7, editable: true },
    { field: "owner", headerName: "负责人", width: 136, editable: true },
    { field: "status", headerName: "状态", width: 118, editable: true, cellEditor: "agSelectCellEditor", cellEditorParams: { values: statusValues }, cellRenderer: StatusCell },
    { field: "externalRef", headerName: "外部记录", minWidth: 150, flex: .8, editable: true },
    { field: "updatedAt", headerName: "更新时间", width: 164, editable: false },
  ], []);

  return <div className="issue-data-grid" aria-label="高级问题表格">
    <div className="issue-data-grid__toolbar">
      <label className="issue-data-grid__search"><span aria-hidden="true">⌕</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索问题、负责人或外部记录" /></label>
      <label className="issue-data-grid__filter">状态<select value={statusFilter} onChange={event => setStatusFilter(event.target.value as "all" | IssueStatus)}><option value="all">全部</option>{statusValues.map(status => <option key={status} value={status}>{statusLabels[status]}</option>)}</select></label>
    </div>
    <div className="issue-data-grid__table">
      <AgGridReact<IssueGridRow>
        theme={issueGridTheme}
        rowData={visibleRows}
        columnDefs={columnDefs}
        defaultColDef={{ sortable: true, resizable: true }}
        getRowId={params => params.data.id}
        rowHeight={44}
        headerHeight={40}
        stopEditingWhenCellsLoseFocus
        onCellValueChanged={event => {
          const field = event.colDef.field as EditableIssueField | undefined;
          if (field && event.oldValue !== event.newValue) onIssueChange(event.data.id, { [field]: String(event.newValue ?? "") });
        }}
      />
    </div>
  </div>;
}

export default IssueDataGrid;
