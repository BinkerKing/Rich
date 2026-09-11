import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { api, type ProjectModuleItem, type TestCenterIssue } from "../../../api/client.js";
import "./IssuesWorkspace.css";

type IssueStatus = "open" | "fixed" | "retest" | "closed";
const formatTime = (value: string) => value.replace("T", " ").slice(0, 16);
const UniverIssueSheet = lazy(() => import("../../../components/UniverIssueSheet.js"));

export function IssuesWorkspace({ projectId }: { projectId: string }): ReactNode {
  const [tables, setTables] = useState<ProjectModuleItem[]>([]);
  const [issues, setIssues] = useState<TestCenterIssue[]>([]);
  const [activeId, setActiveId] = useState("");
  const [error, setError] = useState("");
  const [creatingTable, setCreatingTable] = useState(false);
  const [newTableTitle, setNewTableTitle] = useState("");

  const load = async () => {
    const [nextTables, nextIssues] = await Promise.all([
      api.listProjectManagementModuleItems(projectId, "issues"), api.listTestCenterIssues(projectId),
    ]);
    setTables(nextTables); setIssues(nextIssues);
  };
  useEffect(() => { void load().catch(() => setError("问题清单暂时无法读取，请稍后刷新。")); }, [projectId]);
  const active = tables.find(table => table.id === activeId);
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
  const saveIssueChange = (issueId: string, patch: { title?: string; description?: string; owner?: string; status?: string; externalRef?: string }) => {
    const status: IssueStatus = ["open", "fixed", "retest", "closed"].includes(String(patch.status)) ? patch.status as IssueStatus : "open";
    void api.updateTestCenterIssue(projectId, issueId, {
      title: patch.title?.trim() || undefined,
      description: patch.description,
      owner: patch.owner === undefined ? undefined : patch.owner.trim() || null,
      externalRef: patch.externalRef === undefined ? undefined : patch.externalRef.trim() || null,
      status: patch.status === undefined ? undefined : status,
    }).then(updated => setIssues(current => current.map(issue => issue.id === updated.id ? updated : issue))).catch(() => setError("保存问题失败。"));
  };
  if (!active) return <section className="issues-workspace"><header><div><h1>问题清单</h1><span>一个问题表对应一条记录；打开后可像 Excel 一样维护问题和表头。</span></div><button className="issues-workspace__create-button project-create-action" type="button" onClick={() => { setNewTableTitle(`问题清单 ${tables.length + 1}`); setCreatingTable(true); }}>＋ 新建问题表</button></header>{error && <p className="issues-workspace__error">{error}</p>}{creatingTable && <form className="issues-workspace__create" onSubmit={event => { event.preventDefault(); void createTable(); }}><label>问题表名称<input autoFocus value={newTableTitle} onChange={event => setNewTableTitle(event.target.value)} /></label><div><button type="button" onClick={() => setCreatingTable(false)}>取消</button><button type="submit">创建并打开</button></div></form>}<div className="issues-workspace__list">{tables.map((table, index) => <button key={table.id} type="button" onClick={() => setActiveId(table.id)}><span className="issues-workspace__list-index" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span><strong>{table.title}</strong></button>)}{!tables.length && <p className="issues-workspace__empty">还没有问题表。点击“新建问题表”开始。</p>}</div></section>;
  return <section className="issues-workspace issues-workspace--editor">{error && <p className="issues-workspace__error">{error}</p>}<div className="issues-workspace__editor-shell"><header className="issues-workspace__table-title"><button type="button" aria-label="返回问题清单" onClick={() => setActiveId("")} title="回到问题表列表">{active.title}</button></header><div className="issues-workspace__grid"><Suspense fallback={<p className="issues-workspace__loading">正在加载表格编辑器…</p>}><UniverIssueSheet key={`${active.id}:${issues.length}`} tableId={active.id} tableName={active.title} issues={issues.map(issue => ({ id: issue.id, title: issue.title, description: issue.description, owner: issue.owner ?? "", status: issue.status, externalRef: issue.externalRef ?? "", updatedAt: formatTime(issue.updatedAt) }))} onIssueChange={saveIssueChange} /></Suspense></div></div></section>;
}
