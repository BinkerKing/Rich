import { useEffect, useMemo, useState, type ReactNode } from "react";
import { api, type ProjectModuleItem, type TestCenterCase, type TestCenterIssue } from "../../../api/client.js";
import { ConfigurableDataGrid, type ConfigurableGridColumn, type ConfigurableGridRow } from "../../../components/ConfigurableDataGrid.js";
import "./IssuesWorkspace.css";

const defaultColumns: ConfigurableGridColumn[] = [
  { key: "title", name: "问题", width: 280, frozen: true },
  { key: "description", name: "问题说明", width: 300 },
  { key: "owner", name: "负责人", width: 150 },
  { key: "status", name: "状态", width: 130, options: [["open", "待处理"], ["fixed", "已修复"], ["retest", "待复测"], ["closed", "已关闭"]].map(([value, label]) => ({ value, label })) },
  { key: "externalRef", name: "外部记录", width: 170 },
  { key: "updatedAt", name: "更新时间", width: 165, editable: false },
];
type IssueRow = ConfigurableGridRow & { title: string; description: string; owner: string; status: string; externalRef: string; updatedAt: string };
type IssueStatus = "open" | "fixed" | "retest" | "closed";
const templatePrefix = "issue-template:";
const tableGridKey = (tableId: string) => `issue-table:${tableId}`;
const formatTime = (value: string) => value.replace("T", " ").slice(0, 16);
const templateName = (key: string) => decodeURIComponent(key.slice(templatePrefix.length));

export function IssuesWorkspace({ projectId }: { projectId: string }): ReactNode {
  const [tables, setTables] = useState<ProjectModuleItem[]>([]);
  const [issues, setIssues] = useState<TestCenterIssue[]>([]);
  const [cases, setCases] = useState<TestCenterCase[]>([]);
  const [templates, setTemplates] = useState<Array<{ key: string; columns: ConfigurableGridColumn[] }>>([]);
  const [activeId, setActiveId] = useState("");
  const [columns, setColumns] = useState<ConfigurableGridColumn[]>(defaultColumns);
  const [error, setError] = useState("");
  const [creatingTable, setCreatingTable] = useState(false);
  const [newTableTitle, setNewTableTitle] = useState("");

  const load = async () => {
    const [nextTables, nextIssues, nextCases, nextTemplates] = await Promise.all([
      api.listProjectManagementModuleItems(projectId, "issues"), api.listTestCenterIssues(projectId), api.listTestCenterCases(projectId), api.listTestCenterGridSettings(projectId, templatePrefix),
    ]);
    setTables(nextTables); setIssues(nextIssues); setCases(nextCases); setTemplates(nextTemplates);
  };
  useEffect(() => { void load().catch(() => setError("问题清单暂时无法读取，请稍后刷新。")); }, [projectId]);
  const active = tables.find(table => table.id === activeId);
  useEffect(() => {
    if (!active) return;
    void api.getTestCenterGridSettings(projectId, tableGridKey(active.id)).then(settings => setColumns(settings.columns.length ? settings.columns : defaultColumns)).catch(() => setError("读取表格设置失败。"));
  }, [active?.id, projectId]);
  const createTable = async () => {
    const title = newTableTitle.trim();
    if (!title) return;
    try {
      const table = await api.createProjectManagementModuleItem(projectId, "issues", { title, content: {} });
      setTables(current => [...current, table]); setActiveId(table.id); setCreatingTable(false); setNewTableTitle("");
    } catch {
      setError("新建问题表失败，请稍后重试。");
    }
  };
  const rows = useMemo(() => issues.map(issue => ({ id: issue.id, title: issue.title, description: issue.description, owner: issue.owner ?? "", status: issue.status, externalRef: issue.externalRef ?? "", updatedAt: formatTime(issue.updatedAt), ...issue.customFields })), [issues]);
  const saveColumns = async (next: ConfigurableGridColumn[]) => {
    if (!active) return;
    setColumns(next);
    try { await api.saveTestCenterGridSettings(projectId, tableGridKey(active.id), next); } catch { setError("保存表格设置失败。 "); }
  };
  const saveRows = (nextRows: IssueRow[]) => {
    const changed = nextRows.find((row, index) => row !== rows[index]);
    if (!changed) return;
    const status: IssueStatus = ["open", "fixed", "retest", "closed"].includes(String(changed.status)) ? String(changed.status) as IssueStatus : "open";
    const customFields = Object.fromEntries(columns.filter(column => column.key.startsWith("custom_")).map(column => [column.key, String(changed[column.key] ?? "")]));
    void api.updateTestCenterIssue(projectId, changed.id, { title: String(changed.title).trim() || "未命名问题", description: String(changed.description ?? ""), owner: String(changed.owner ?? "").trim() || null, externalRef: String(changed.externalRef ?? "").trim() || null, status, customFields }).then(updated => setIssues(current => current.map(issue => issue.id === updated.id ? updated : issue))).catch(() => setError("保存问题失败。"));
  };
  const addRow = async () => {
    const firstCase = cases[0];
    if (!firstCase) { setError("请先在测试中心创建至少一条测试用例，再新增问题记录。"); return; }
    const created = await api.createTestCenterIssue(projectId, { caseId: firstCase.id, title: "新问题", description: "" });
    setIssues(current => [created, ...current]);
  };
  const saveTemplate = async () => {
    const name = window.prompt("模板名称");
    if (!name?.trim()) return;
    const key = `${templatePrefix}${encodeURIComponent(name.trim())}`;
    await api.saveTestCenterGridSettings(projectId, key, columns);
    setTemplates(current => [...current.filter(template => template.key !== key), { key, columns }]);
  };
  if (!active) return <section className="issues-workspace"><header><div><p>ISSUE TABLES</p><h1>问题清单</h1><span>一个问题表对应一条记录；打开后可像 Excel 一样维护问题和表头。</span></div><button className="issues-workspace__create-button" type="button" onClick={() => { setNewTableTitle(`问题清单 ${tables.length + 1}`); setCreatingTable(true); }}>＋ 新建问题表</button></header>{error && <p className="issues-workspace__error">{error}</p>}{creatingTable && <form className="issues-workspace__create" onSubmit={event => { event.preventDefault(); void createTable(); }}><label>问题表名称<input autoFocus value={newTableTitle} onChange={event => setNewTableTitle(event.target.value)} /></label><div><button type="button" onClick={() => setCreatingTable(false)}>取消</button><button type="submit">创建并打开</button></div></form>}<div className="issues-workspace__list">{tables.map((table, index) => <button key={table.id} type="button" onClick={() => setActiveId(table.id)}><b>{String(index + 1).padStart(2, "0")}</b><strong>{table.title}</strong><span>问题表 · {issues.length} 条记录</span><i>打开 →</i></button>)}{!tables.length && <p className="issues-workspace__empty">还没有问题表。点击“新建问题表”开始。</p>}</div></section>;
  return <section className="issues-workspace issues-workspace--editor"><header className="issues-workspace__table-title"><button type="button" onClick={() => setActiveId("")} title="回到问题表列表">{active.title}</button><div><select aria-label="套用问题表模板" defaultValue="" onChange={event => { const template = templates.find(item => item.key === event.target.value); if (template) void saveColumns(template.columns); event.currentTarget.value = ""; }}><option value="">套用保存的模板</option>{templates.map(template => <option key={template.key} value={template.key}>{templateName(template.key)}</option>)}</select><button type="button" onClick={() => void saveTemplate()}>保存为模板</button></div></header>{error && <p className="issues-workspace__error">{error}</p>}<div className="issues-workspace__grid"><ConfigurableDataGrid ariaLabel={`${active.title} 表格`} rows={rows} columns={columns} onRowsChange={saveRows} onColumnsChange={next => void saveColumns(next)} onAddRow={() => void addRow()} toolbar={<span className="issues-workspace__grid-hint">双击单元格编辑；可增加列、拖动表头调整顺序、冻结列并保存模板。</span>} emptyRowsRenderer={<>暂无问题记录。点击“新增记录”创建第一条。</>} /></div></section>;
}
