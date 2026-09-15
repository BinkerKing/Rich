import { Fragment, createContext, useContext, useEffect, useMemo, useRef, useState, type DragEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { FlaskConical } from "lucide-react";
import { api, type TestCenterCase, type TestCenterCaseComment, type TestCenterCaseStep, type TestCenterEvidence, type TestCenterGroup, type TestCenterIssue, type TestCenterIssueDiscussion, type TestCenterReport, type TestCenterRun, type TestCenterRunStep, type TestCenterTask } from "../../../api/client.js";
import { ConfigurableDataGrid, type ConfigurableGridColumn, type ConfigurableGridRow } from "../../../components/ConfigurableDataGrid.js";
import "./TestCenterWorkspace.css";

const labels: Record<string, string> = { draft: "草稿", active: "进行中", completed: "已完成", archived: "已归档", ready: "待执行", testing: "执行中", passed: "通过", failed: "失败", blocked: "阻塞", retest: "待复测", open: "待处理", fixed: "已修复", closed: "已关闭" };
const defaultIssueGridColumns: ConfigurableGridColumn[] = [
  { key: "title", name: "问题", width: 260, frozen: true },
  { key: "description", name: "问题说明", width: 260 },
  { key: "sourceCase", name: "来源用例", width: 150, editable: false },
  { key: "externalRef", name: "外部记录", width: 160 },
  { key: "owner", name: "负责人", width: 130 },
  { key: "status", name: "状态", width: 120, options: [["open", "待处理"], ["fixed", "已修复"], ["retest", "待复测"], ["closed", "已关闭"]].map(([value, label]) => ({ value, label })) },
  { key: "updatedAt", name: "更新时间", width: 155, editable: false },
];
const typeLabels = { data: "数据校验", functional: "功能测试" };
const TestCenterTreeContext = createContext<{ projectId: string; groups: TestCenterGroup[]; addGroup: (group: TestCenterGroup) => void } | null>(null);
type TestCenterPageMemory = { panel?: "overview" | "tasks" | "cases" | "runs" | "issues" | "report"; workbenchMode?: "cases" | "issues"; caseView?: "execution" | "excel"; caseStatusFilter?: string; caseTypeFilter?: string; runStatusFilter?: string; issueStatusFilter?: string; selectedTaskId?: string; selectedCaseId?: string; selectedIssueId?: string; selectedDetailKind?: "task" | "case"; expandedCase?: string; expandedRun?: string; expandedIssue?: string; expandedTask?: string };
const testCenterPageMemoryKey = (projectId: string) => `rich-test-center-page-memory:${projectId}`;
function readTestCenterPageMemory(projectId: string): TestCenterPageMemory {
  try { return JSON.parse(window.localStorage.getItem(testCenterPageMemoryKey(projectId)) ?? "{}") as TestCenterPageMemory; } catch { return {}; }
}

function statusClass(status: string) {
  return status === "passed" || status === "closed" ? "pass" : status === "failed" ? "fail" : status === "blocked" ? "block" : "pending";
}

function Status({ value }: { value: string }) {
  return <span className={`status ${statusClass(value)} is-${value}`}>{labels[value] ?? value}</span>;
}

function executionTone(cases: TestCenterCase[]) {
  if (!cases.length) return "pending";
  if (cases.some(item => item.status === "failed")) return "fail";
  if (cases.some(item => item.status === "blocked")) return "block";
  if (cases.every(item => item.status === "passed")) return "pass";
  if (cases.some(item => item.status === "testing")) return "testing";
  return "pending";
}

function conciseTime(value?: string) {
  return value ? value.replace("T", " ").slice(0, 16) : "—";
}
function activityTime(value: string) {
  return { date: value.slice(5, 10), time: value.slice(11, 16) };
}

export function TestCenterWorkspace({ projectId }: { projectId: string }): ReactNode {
  const initialMemory = readTestCenterPageMemory(projectId);
  const [cases, setCases] = useState<TestCenterCase[]>([]);
  const [tasks, setTasks] = useState<TestCenterTask[]>([]);
  const [groups, setGroups] = useState<TestCenterGroup[]>([]);
  const [runs, setRuns] = useState<TestCenterRun[]>([]);
  const [issues, setIssues] = useState<TestCenterIssue[]>([]);
  const [issueGridColumns, setIssueGridColumns] = useState<ConfigurableGridColumn[]>(defaultIssueGridColumns);
  const [report, setReport] = useState<TestCenterReport>();
  const [evidenceByRun, setEvidenceByRun] = useState<Record<string, TestCenterEvidence[]>>({});
  const [caseStepsByCase, setCaseStepsByCase] = useState<Record<string, TestCenterCaseStep[]>>({});
  const [runStepsByRun, setRunStepsByRun] = useState<Record<string, TestCenterRunStep[]>>({});
  const [discussionsByIssue, setDiscussionsByIssue] = useState<Record<string, TestCenterIssueDiscussion[]>>({});
  const [commentsByCase, setCommentsByCase] = useState<Record<string, TestCenterCaseComment[]>>({});
  const [expandedCase, setExpandedCase] = useState<string | undefined>(initialMemory.expandedCase);
  const [expandedRun, setExpandedRun] = useState<string | undefined>(initialMemory.expandedRun);
  const [expandedIssue, setExpandedIssue] = useState<string | undefined>(initialMemory.expandedIssue);
  const [expandedTask, setExpandedTask] = useState<string | undefined>(initialMemory.expandedTask);
  const [selectedTaskId, setSelectedTaskId] = useState(initialMemory.selectedTaskId ?? "");
  const [selectedCaseId, setSelectedCaseId] = useState(initialMemory.selectedCaseId ?? "");
  const [selectedDetailKind, setSelectedDetailKind] = useState<"task" | "case">(initialMemory.selectedDetailKind ?? "case");
  const [selectedIssueId, setSelectedIssueId] = useState(initialMemory.selectedIssueId ?? "");
  const [workbenchMode, setWorkbenchMode] = useState<"cases" | "issues">("cases");
  const [caseView, setCaseView] = useState<"execution" | "excel">(initialMemory.caseView ?? "execution");
  const [caseStatusFilter, setCaseStatusFilter] = useState(initialMemory.caseStatusFilter ?? "");
  const [caseTypeFilter, setCaseTypeFilter] = useState(initialMemory.caseTypeFilter ?? "");
  const [runStatusFilter, setRunStatusFilter] = useState(initialMemory.runStatusFilter ?? "");
  const [issueStatusFilter, setIssueStatusFilter] = useState(initialMemory.issueStatusFilter ?? "");
  const [panel, setPanel] = useState<"overview" | "tasks" | "cases" | "runs" | "issues" | "report">(initialMemory.panel ?? "cases");
  const [error, setError] = useState<string>();

  const load = async () => {
    try {
      setError(undefined);
      const [nextCases, nextTasks, nextGroups, nextRuns, nextIssues, nextReport, issueGridSettings] = await Promise.all([
        api.listTestCenterCases(projectId), api.listTestCenterTasks(projectId), api.listTestCenterGroups(projectId), api.listTestCenterRuns(projectId), api.listTestCenterIssues(projectId), api.getTestCenterReport(projectId), api.getTestCenterGridSettings(projectId, "issues"),
      ]);
      setCases(nextCases); setTasks(nextTasks); setGroups(nextGroups); setRuns(nextRuns); setIssues(nextIssues); setReport(nextReport);
      setIssueGridColumns(issueGridSettings.columns.length ? issueGridSettings.columns : defaultIssueGridColumns);
      (window as typeof window & { __richTestCenterGroups?: TestCenterGroup[] }).__richTestCenterGroups = nextGroups;
      window.dispatchEvent(new CustomEvent("rich-test-center-groups", { detail: nextGroups }));
      const caseSteps = await Promise.all(nextCases.map(async testCase => [testCase.id, await api.listTestCenterCaseSteps(projectId, testCase.id)] as const));
      setCaseStepsByCase(Object.fromEntries(caseSteps));
      const comments = await Promise.all(nextCases.map(async testCase => [testCase.id, await api.listTestCenterCaseComments(projectId, testCase.id)] as const));
      setCommentsByCase(Object.fromEntries(comments));
      const evidence = await Promise.all(nextRuns.map(async run => [run.id, await api.listTestCenterRunEvidence(projectId, run.id)] as const));
      setEvidenceByRun(Object.fromEntries(evidence));
      const runSteps = await Promise.all(nextRuns.map(async run => [run.id, await api.listTestCenterRunSteps(projectId, run.id)] as const));
      setRunStepsByRun(Object.fromEntries(runSteps));
    } catch {
      setError("测试中心数据暂时无法读取，请稍后刷新。");
    }
  };

  useEffect(() => { void load(); }, [projectId]);
  useEffect(() => {
    const refresh = () => { void load(); };
    window.addEventListener("test-center-tree-changed", refresh);
    return () => window.removeEventListener("test-center-tree-changed", refresh);
  }, [projectId]);
  useEffect(() => {
    try {
      window.localStorage.setItem(testCenterPageMemoryKey(projectId), JSON.stringify({ panel, workbenchMode, caseView, caseStatusFilter, caseTypeFilter, runStatusFilter, issueStatusFilter, selectedTaskId, selectedCaseId, selectedIssueId, selectedDetailKind, expandedCase, expandedRun, expandedIssue, expandedTask } satisfies TestCenterPageMemory));
    } catch {}
  }, [projectId, panel, workbenchMode, caseView, caseStatusFilter, caseTypeFilter, runStatusFilter, issueStatusFilter, selectedTaskId, selectedCaseId, selectedIssueId, selectedDetailKind, expandedCase, expandedRun, expandedIssue, expandedTask]);
  useEffect(() => { if (!selectedTaskId && tasks[0]) setSelectedTaskId(tasks[0].id); }, [tasks, selectedTaskId]);
  useEffect(() => { if (!selectedCaseId && cases[0]) setSelectedCaseId(cases[0].id); }, [cases, selectedCaseId]);
  useEffect(() => { if (!selectedIssueId && issues[0]) setSelectedIssueId(issues[0].id); }, [issues, selectedIssueId]);

  const caseById = useMemo(() => new Map(cases.map(item => [item.id, item])), [cases]);
  const runsByCase = useMemo(() => new Map(cases.map(item => [item.id, runs.filter(run => run.caseId === item.id)])), [cases, runs]);
  const issuesByCase = useMemo(() => new Map(cases.map(item => [item.id, issues.filter(issue => issue.caseId === item.id)])), [cases, issues]);
  const taskById = useMemo(() => new Map(tasks.map(item => [item.id, item])), [tasks]);
  const visibleCases = useMemo(() => cases.filter(item => (!selectedTaskId || item.taskId === selectedTaskId) && (!caseStatusFilter || item.status === caseStatusFilter) && (!caseTypeFilter || item.type === caseTypeFilter)), [cases, selectedTaskId, caseStatusFilter, caseTypeFilter]);
  const visibleRuns = useMemo(() => runs.filter(item => !runStatusFilter || item.status === runStatusFilter), [runs, runStatusFilter]);
  const visibleIssues = useMemo(() => issues.filter(item => !issueStatusFilter || item.status === issueStatusFilter), [issues, issueStatusFilter]);
  const workbenchCases = useMemo(() => cases.filter(item => !caseStatusFilter || item.status === caseStatusFilter), [cases, caseStatusFilter]);
  const selectedTask = tasks.find(task => task.id === selectedTaskId);
  const currentTitle = selectedTask?.title ?? "全部测试用例";
  const currentPassed = visibleCases.filter(item => item.status === "passed").length;
  const currentFailed = visibleCases.filter(item => item.status === "failed").length;
  const currentBlocked = visibleCases.filter(item => item.status === "blocked").length;
  const createCase = async () => {
    const title = window.prompt("测试用例名称");
    if (!title?.trim()) return;
    const objective = window.prompt("测试目标", "") ?? "";
    try {
      await api.createTestCenterCase(projectId, { code: `TC-${String(cases.length + 1).padStart(3, "0")}`, title: title.trim(), objective, type: "functional", priority: "medium", taskId: selectedTaskId || undefined });
      await load();
    } catch {
      setError("新建测试用例失败，请检查编号是否重复。");
    }
  };
  const createTask = async () => {
    const title = window.prompt("测试任务名称");
    if (!title?.trim()) return;
    const objective = window.prompt("测试任务目标", "") ?? "";
    try { await api.createTestCenterTask(projectId, { title: title.trim(), objective }); await load(); } catch { setError("新建测试任务失败。"); }
  };
  const createGroup = async (taskId: string, parentGroupId?: string) => {
    const title = window.prompt(parentGroupId ? "子分组名称" : "分组名称");
    if (!title?.trim()) return;
    try { await api.createTestCenterGroup(projectId, { taskId, parentGroupId, title: title.trim() }); await load(); } catch { setError("新建分组失败。"); }
  };
  const deleteTask = async (taskId: string) => {
    if (!window.confirm("删除测试任务？其中的分组和用例也会一并删除。")) return;
    try { await api.deleteTestCenterTask(projectId, taskId); await load(); } catch { setError("删除测试任务失败。"); }
  };
  const deleteGroup = async (groupId: string) => {
    if (!window.confirm("删除分组？其中的子分组和用例也会一并删除。")) return;
    try { await api.deleteTestCenterGroup(projectId, groupId); await load(); } catch { setError("删除分组失败。"); }
  };
  const startRun = async (caseId: string) => {
    try { await api.startTestCenterRun(projectId, caseId); await load(); } catch { setError("无法启动测试执行。"); }
  };
  const addCaseStep = async (caseId: string) => {
    const instruction = window.prompt("测试步骤"); if (!instruction?.trim()) return;
    const expectedResult = window.prompt("预期结果", "") ?? "";
    try { await api.addTestCenterCaseStep(projectId, caseId, { stepOrder: (caseStepsByCase[caseId]?.length ?? 0) + 1, instruction: instruction.trim(), expectedResult }); await load(); } catch { setError("新增测试步骤失败。"); }
  };
  const finishRun = async (runId: string) => {
    const status = window.prompt("执行结果：passed / failed / blocked / retest", "passed");
    if (!status) return;
    if (!(["passed", "failed", "blocked", "retest"] as string[]).includes(status)) { setError("执行结果必须是 passed、failed、blocked 或 retest。"); return; }
    const actualResult = window.prompt("实际结果", "") ?? "";
    try { await api.finishTestCenterRun(projectId, runId, { status: status as "passed" | "failed" | "blocked" | "retest", actualResult }); await load(); } catch { setError("保存执行结果失败。"); }
  };
  const addEvidence = async (runId: string) => {
    const title = window.prompt("证据名称"); if (!title?.trim()) return;
    const location = window.prompt("证据链接或文件路径"); if (!location?.trim()) return;
    try { await api.addTestCenterEvidence(projectId, runId, { title: title.trim(), kind: "link", location: location.trim() }); await load(); } catch { setError("登记测试证据失败。"); }
  };
  const finishRunStep = async (runStepId: string) => {
    const status = window.prompt("步骤结果：passed / failed / blocked", "passed");
    if (!status) return;
    if (!(["passed", "failed", "blocked"] as string[]).includes(status)) { setError("步骤结果必须是 passed、failed 或 blocked。"); return; }
    const actualResult = window.prompt("步骤实际结果", "") ?? "";
    try { await api.finishTestCenterRunStep(projectId, runStepId, { status: status as "passed" | "failed" | "blocked", actualResult }); await load(); } catch { setError("保存步骤结果失败。"); }
  };
  const createIssue = async (run: TestCenterRun) => {
    const title = window.prompt("问题标题"); if (!title?.trim()) return;
    const description = window.prompt("问题说明", "") ?? "";
    const externalRef = window.prompt("外部问题编号或链接（可留空）", "") ?? "";
    try { await api.createTestCenterIssue(projectId, { caseId: run.caseId, runId: run.id, title: title.trim(), description, externalRef: externalRef.trim() || undefined }); await load(); } catch { setError("登记问题失败。"); }
  };
  const updateIssueStatus = async (issueId: string) => {
    const status = window.prompt("问题状态：open / fixed / closed", "fixed");
    if (!status) return;
    if (!(["open", "fixed", "closed"] as string[]).includes(status)) { setError("问题状态必须是 open、fixed 或 closed。"); return; }
    try { await api.updateTestCenterIssue(projectId, issueId, { status: status as "open" | "fixed" | "closed" }); await load(); } catch { setError("更新问题状态失败。"); }
  };
  const updateIssue = async (issueId: string, input: { title?: string; description?: string; status?: "open" | "fixed" | "retest" | "closed"; owner?: string | null; externalRef?: string | null; customFields?: Record<string, string> }) => {
    try { const issue = await api.updateTestCenterIssue(projectId, issueId, input); setIssues(current => current.map(item => item.id === issue.id ? issue : item)); } catch { setError("保存问题失败，请稍后重试。"); }
  };
  const saveIssueGridColumns = async (columns: ConfigurableGridColumn[]) => {
    setIssueGridColumns(columns);
    try { await api.saveTestCenterGridSettings(projectId, "issues", columns); } catch { setError("保存表格设置失败，请稍后重试。"); }
  };
  const createIssueFromGrid = async (input: { caseId: string; title: string; description: string }) => {
    try { const issue = await api.createTestCenterIssue(projectId, { ...input, customFields: {} }); setIssues(current => [issue, ...current]); setSelectedIssueId(issue.id); } catch { setError("新增问题失败，请稍后重试。"); }
  };
  const retestIssue = async (issueId: string) => {
    try { await api.startTestCenterRetest(projectId, issueId); await load(); } catch { setError("仅已修复的问题可以发起复测。"); }
  };
  const loadDiscussions = async (issueId: string) => {
    try { const discussions = await api.listTestCenterIssueDiscussions(projectId, issueId); setDiscussionsByIssue(current => ({ ...current, [issueId]: discussions })); } catch { setError("读取问题讨论失败。"); }
  };
  const addDiscussion = async (issueId: string) => {
    const content = window.prompt("讨论记录"); if (!content?.trim()) return;
    try { await api.addTestCenterIssueDiscussion(projectId, issueId, content.trim()); await loadDiscussions(issueId); } catch { setError("保存问题讨论失败。"); }
  };
  const refreshCaseComments = async (caseId: string) => {
    const comments = await api.listTestCenterCaseComments(projectId, caseId);
    setCommentsByCase(current => ({ ...current, [caseId]: comments }));
  };
  const addCaseComment = async (caseId: string, content: string) => {
    try { await api.addTestCenterCaseComment(projectId, caseId, content); await refreshCaseComments(caseId); } catch { setError("保存信息评论失败。"); throw new Error("save case comment failed"); }
  };
  const updateCaseComment = async (caseId: string, commentId: string, content: string) => {
    try { await api.updateTestCenterCaseComment(projectId, commentId, content); await refreshCaseComments(caseId); } catch { setError("更新信息评论失败。"); throw new Error("update case comment failed"); }
  };
  const deleteCaseComment = async (caseId: string, commentId: string) => {
    try { await api.deleteTestCenterCaseComment(projectId, commentId); await refreshCaseComments(caseId); } catch { setError("删除测试动态失败。"); throw new Error("delete case comment failed"); }
  };

  return <TestCenterTreeContext.Provider value={{ projectId, groups, addGroup: group => setGroups(current => [...current, group]) }}><section className="delivery test-center">
    <header className="test-center__masthead"><div className="prj-pm-workspace-head__identity"><FlaskConical aria-hidden="true" /><div><h1>测试中心</h1></div></div>{panel === "cases" && <div className="test-center__case-summary"><button type="button" className={`test-case-workbench__filter${!caseStatusFilter ? " is-active" : ""}`} onClick={() => { setCaseStatusFilter(""); setWorkbenchMode("cases"); }}>用例 <b>{cases.length}</b></button><button type="button" className={`test-case-workbench__filter is-pass${caseStatusFilter === "passed" ? " is-active" : ""}`} onClick={() => { setCaseStatusFilter("passed"); setWorkbenchMode("cases"); }}>通过 <b>{cases.filter(item => item.status === "passed").length}</b></button><button type="button" className={`test-case-workbench__filter is-fail${caseStatusFilter === "failed" ? " is-active" : ""}`} onClick={() => { setCaseStatusFilter("failed"); setWorkbenchMode("cases"); }}>失败 <b>{cases.filter(item => item.status === "failed").length}</b></button><button type="button" className={`test-case-workbench__filter is-block${caseStatusFilter === "blocked" ? " is-active" : ""}`} onClick={() => { setCaseStatusFilter("blocked"); setWorkbenchMode("cases"); }}>阻塞 <b>{cases.filter(item => item.status === "blocked").length}</b></button></div>}</header>
    {panel === "overview" && <div className="test-center__kpis"><span>用例 <b>{report?.totalCases ?? cases.length}</b></span><span>通过率 <b>{report?.passRate ?? 0}%</b></span><span>失败 <b>{report?.failedCases ?? 0}</b></span><span>待复测 <b>{report?.retestCases ?? 0}</b></span><span>待处理问题 <b>{report?.openIssues ?? 0}</b></span></div>}
    {error && <p role="alert">{error}</p>}

    {(panel === "report" || panel === "overview") && <><h2>测试报告</h2>
    <div className="card table-card"><table className="table"><thead><tr><th>指标</th><th>结果</th><th>来源</th></tr></thead><tbody>
      <tr><td>用例总数</td><td>{report?.totalCases ?? 0}</td><td>测试用例</td></tr><tr><td>通过率</td><td>{report?.passRate ?? 0}%</td><td>已结束用例的最新执行结论</td></tr><tr><td>通过 / 失败 / 阻塞</td><td>{report?.passedCases ?? 0} / {report?.failedCases ?? 0} / {report?.blockedCases ?? 0}</td><td>用例最新状态</td></tr><tr><td>草稿 / 执行中 / 待复测</td><td>{report?.draftCases ?? 0} / {report?.testingCases ?? 0} / {report?.retestCases ?? 0}</td><td>用例最新状态</td></tr><tr><td>开放 / 已修复 / 待复测问题</td><td>{report?.openIssues ?? 0} / {report?.fixedIssues ?? 0} / {report?.retestIssues ?? 0}</td><td>问题跟进表</td></tr>
    </tbody></table></div></>}

    {panel === "tasks" && <><h2>测试任务</h2>
    <div className="card table-card"><table className="table"><thead><tr><th>任务 / 测试目标</th><th>用例数</th><th>状态</th><th>更新时间</th><th /></tr></thead><tbody>
      {tasks.map(task => <Fragment key={task.id}><tr><td><b>{task.title}</b><br /><small>{task.objective || "未填写测试目标"}</small></td><td>{cases.filter(item => item.taskId === task.id).length}</td><td><Status value={task.status} /></td><td>{conciseTime(task.updatedAt)}</td><td><button type="button" onClick={() => setExpandedTask(expandedTask === task.id ? undefined : task.id)}>{expandedTask === task.id ? "收起" : "展开"}</button></td></tr>
        {expandedTask === task.id && <tr><td colSpan={5}><div style={{ padding: "14px 18px", background: "#f4f7ef" }}><b>任务范围</b><p>{task.objective || "尚未填写"}</p><p>包含用例：{cases.filter(item => item.taskId === task.id).map(item => item.code).join("、") || "尚未关联用例"}</p></div></td></tr>}</Fragment>)}
    </tbody></table>{tasks.length === 0 && <p style={{ padding: 20 }}>先创建测试任务，再将用例归入对应任务。</p>}</div></>}

    {panel === "cases" && <><header className="test-case-workbench__header"><div><h2>{workbenchMode === "cases" ? "测试用例" : "问题清单"}</h2><p>{workbenchMode === "cases" ? "点击测试任务查看任务资料，点击用例查看执行详情。" : "像编辑表格一样维护问题；单击记录可查看完整详情。"}</p></div><div className="test-case-workbench__toolbar"><button type="button" className={`test-case-workbench__filter${!caseStatusFilter ? " is-active" : ""}`} onClick={() => { setCaseStatusFilter(""); setWorkbenchMode("cases"); }}>用例 <b>{cases.length}</b></button><button type="button" className={`test-case-workbench__filter is-pass${caseStatusFilter === "passed" ? " is-active" : ""}`} onClick={() => { setCaseStatusFilter("passed"); setWorkbenchMode("cases"); }}>通过 <b>{cases.filter(item => item.status === "passed").length}</b></button><button type="button" className={`test-case-workbench__filter is-fail${caseStatusFilter === "failed" ? " is-active" : ""}`} onClick={() => { setCaseStatusFilter("failed"); setWorkbenchMode("cases"); }}>失败 <b>{cases.filter(item => item.status === "failed").length}</b></button><button type="button" className={`test-case-workbench__filter is-block${caseStatusFilter === "blocked" ? " is-active" : ""}`} onClick={() => { setCaseStatusFilter("blocked"); setWorkbenchMode("cases"); }}>阻塞 <b>{cases.filter(item => item.status === "blocked").length}</b></button><div className="delivery-switch"><button type="button" className={workbenchMode === "cases" ? "is-active" : ""} onClick={() => setWorkbenchMode("cases")}>测试用例</button><button type="button" className={workbenchMode === "issues" ? "is-active" : ""} onClick={() => setWorkbenchMode("issues")}>问题清单</button></div></div></header>{workbenchMode === "cases" && <TestCaseExecution cases={workbenchCases} tasks={tasks} runsByCase={runsByCase} issuesByCase={issuesByCase} caseStepsByCase={caseStepsByCase} evidenceByRun={evidenceByRun} commentsByCase={commentsByCase} selectedTaskId={selectedTaskId} selectedDetailKind={selectedDetailKind} selectedCaseId={selectedCaseId} onSelectTask={taskId => { setSelectedTaskId(taskId); setSelectedDetailKind("task"); }} onSelectCase={caseId => { setSelectedCaseId(caseId); setSelectedDetailKind("case"); }} onSaveTaskDetails={async (taskId, input) => { const task = await api.updateTestCenterTaskDetails(projectId, taskId, input); setTasks(current => current.map(item => item.id === task.id ? task : item)); }} onAddComment={addCaseComment} onUpdateComment={updateCaseComment} onDeleteComment={deleteCaseComment} />}{workbenchMode === "issues" && <TestIssueExecution issues={issues} cases={cases} caseById={caseById} runs={runs} discussionsByIssue={discussionsByIssue} selectedIssueId={selectedIssueId} columns={issueGridColumns} onColumnsChange={saveIssueGridColumns} onCreateIssue={createIssueFromGrid} onUpdateIssue={updateIssue} onSelectIssue={issueId => { setSelectedIssueId(issueId); void loadDiscussions(issueId); }} onAddDiscussion={addDiscussion} onUpdateStatus={updateIssueStatus} onRetest={retestIssue} />}</>}

    {panel === "cases" && caseView === "excel" && <><div className="test-center__case-page"><h2>测试用例</h2><div className="test-center__cases-layout"><aside className="test-center__tree"><b>测试任务 <i>☰</i></b>{tasks.map(task => <div className="tree-task" key={task.id}><button className={selectedTaskId === task.id ? "is-selected" : ""} type="button" onClick={() => setSelectedTaskId(task.id)}>▾　▰ {task.title}<em>{cases.filter(item => item.taskId === task.id).length}</em></button></div>)}{cases.some(item => !item.taskId) && <div className="tree-task"><button className={!selectedTaskId ? "is-selected" : ""} type="button" onClick={() => setSelectedTaskId("")}>▾　▰ 未归属测试任务<em>{cases.filter(item => !item.taskId).length}</em></button></div>}{!tasks.length && !cases.length && <p className="tree-empty">暂无测试任务或用例</p>}</aside><div className="test-center__cases-main"><header className="test-center__scene-head"><h2>{currentTitle}</h2><p>{currentTitle} · {visibleCases.length} 条用例</p></header><div className="test-center__scene-kpis"><span>◉　已执行 <b>{visibleCases.length} / {visibleCases.length}</b></span><span className="is-pass">✓　通过 <b>{currentPassed}</b></span><span className="is-fail">×　失败 <b>{currentFailed}</b></span><span className="is-block">−　阻塞 <b>{currentBlocked}</b></span></div>
    <div className="test-center__filters">状态：<select value={caseStatusFilter} onChange={event => setCaseStatusFilter(event.target.value)}><option value="">全部</option>{["draft", "testing", "passed", "failed", "blocked", "retest"].map(status => <option key={status} value={status}>{labels[status]}</option>)}</select> 分组：<select value={caseTypeFilter} onChange={event => setCaseTypeFilter(event.target.value)}><option value="">全部</option><option value="functional">功能测试</option><option value="data">数据校验</option></select><button type="button" onClick={() => void createCase()}>＋ 新建用例</button></div>
    <div className="card table-card"><table className="table"><thead><tr><th>编号</th><th>用例 / 测试目标</th><th>所属测试任务</th><th>分组</th><th>优先级</th><th>执行 / 问题</th><th>最新状态</th><th>更新时间</th><th /></tr></thead><tbody>
      {visibleCases.map(item => <Fragment key={item.id}><tr><td>›　{item.code}</td><td><b>{item.title}</b><br /><small>{item.objective || "未填写测试目标"}</small></td><td className="scenario-cell">{item.taskId ? taskById.get(item.taskId)?.title ?? "任务已不存在" : "未归属"}</td><td>{typeLabels[item.type]}</td><td className="priority-cell">{item.priority}</td><td>{runsByCase.get(item.id)?.length ?? 0} / {issuesByCase.get(item.id)?.length ?? 0}</td><td><Status value={item.status} /></td><td>{conciseTime(item.updatedAt)}</td><td><button type="button" onClick={() => setExpandedCase(expandedCase === item.id ? undefined : item.id)}>{expandedCase === item.id ? "收起" : "展开"}</button></td></tr>
        {expandedCase === item.id && <tr className="case-detail"><td colSpan={9}><div className="case-detail__grid"><section><h3>▧ 测试步骤（{caseStepsByCase[item.id]?.length ?? 0}）</h3>{caseStepsByCase[item.id]?.map(step => <p key={step.id}><b>{step.stepOrder}</b> {step.instruction}<small>预期：{step.expectedResult || "未填写"}</small></p>)}</section><section><h3>▧ 证据文档（{(runsByCase.get(item.id) ?? []).flatMap(run => evidenceByRun[run.id] ?? []).length}）</h3>{(runsByCase.get(item.id) ?? []).flatMap(run => evidenceByRun[run.id] ?? []).map(evidence => <p key={evidence.id}>▤ {evidence.title}<small>{evidence.location}</small></p>) || <p>尚未关联证据</p>}</section><section><h3>♧ 关联问题（{issuesByCase.get(item.id)?.length ?? 0}）</h3>{issuesByCase.get(item.id)?.map(issue => <p key={issue.id}><b className="is-danger">{issue.externalRef ?? issue.title}</b><small>{issue.description}</small></p>) || <p>暂无关联问题</p>}</section><section className="case-detail__discussion"><h3>▣ 讨论摘要</h3><p>{issuesByCase.get(item.id)?.[0]?.description || "本用例暂无讨论记录。"}</p></section></div></td></tr>}</Fragment>)}
    </tbody></table>{cases.length === 0 && <p style={{ padding: 20 }}>还没有测试用例。可通过此处或后续 MCP/CLI 创建。</p>}</div></div></div></div></>}

    {panel === "runs" && <><h2>测试执行表</h2>
    <p><label>执行状态：<select value={runStatusFilter} onChange={event => setRunStatusFilter(event.target.value)}><option value="">全部</option>{["testing", "passed", "failed", "blocked", "retest"].map(status => <option key={status} value={status}>{labels[status]}</option>)}</select></label></p>
    <div className="card table-card"><table className="table"><thead><tr><th>用例</th><th>执行时间</th><th>结果</th><th>实际结果</th><th>证据</th><th /></tr></thead><tbody>
      {visibleRuns.map(run => <Fragment key={run.id}><tr><td>{caseById.get(run.caseId)?.code ?? "已删除用例"}<br /><small>{caseById.get(run.caseId)?.title ?? run.caseId}</small></td><td>{conciseTime(run.finishedAt ?? run.startedAt)}</td><td><Status value={run.status} /></td><td>{run.actualResult || "—"}</td><td>{evidenceByRun[run.id]?.length ?? 0} 项</td><td><button type="button" onClick={() => setExpandedRun(expandedRun === run.id ? undefined : run.id)}>{expandedRun === run.id ? "收起" : "展开"}</button></td></tr>
        {expandedRun === run.id && <tr><td colSpan={6}><div style={{ padding: "14px 18px", background: "#f4f7ef" }}><b>执行详情</b><p>实际结果：{run.actualResult || "未填写"}</p><p>步骤：{runStepsByRun[run.id]?.length ? runStepsByRun[run.id].map(step => <span key={step.id}>第 {step.stepOrder} 步 {step.instruction}（<Status value={step.status} />，{step.actualResult || "未填写"}） <button type="button" onClick={() => void finishRunStep(step.id)}>填写步骤结果</button> </span>) : "用例尚未配置步骤"}</p><p>证据：{evidenceByRun[run.id]?.length ? evidenceByRun[run.id].map(item => `${item.title}（${item.kind}）`).join("；") : "尚未关联"}</p><button type="button" onClick={() => void finishRun(run.id)}>填写执行结果</button> <button type="button" onClick={() => void addEvidence(run.id)}>登记证据</button> <button type="button" onClick={() => void createIssue(run)}>登记问题</button></div></td></tr>}</Fragment>)}
    </tbody></table>{runs.length === 0 && <p style={{ padding: 20 }}>尚无执行记录。开始执行后，记录会按用例保留历史。</p>}</div></>}

    {panel === "issues" && <><h2>问题跟进表</h2>
    <p><label>问题状态：<select value={issueStatusFilter} onChange={event => setIssueStatusFilter(event.target.value)}><option value="">全部</option>{["open", "fixed", "retest", "closed"].map(status => <option key={status} value={status}>{labels[status]}</option>)}</select></label></p>
    <div className="card table-card"><table className="table"><thead><tr><th>问题</th><th>来源用例</th><th>外部记录</th><th>负责人</th><th>状态</th><th>更新时间</th><th /></tr></thead><tbody>
      {visibleIssues.map(issue => <Fragment key={issue.id}><tr><td><b>{issue.title}</b></td><td>{caseById.get(issue.caseId)?.code ?? "—"}</td><td>{issue.externalRef ?? "—"}</td><td>{issue.owner ?? "未指定"}</td><td><Status value={issue.status} /></td><td>{conciseTime(issue.updatedAt)}</td><td><button type="button" onClick={() => { if (expandedIssue === issue.id) setExpandedIssue(undefined); else { setExpandedIssue(issue.id); void loadDiscussions(issue.id); } }}>{expandedIssue === issue.id ? "收起" : "展开"}</button></td></tr>
        {expandedIssue === issue.id && <tr><td colSpan={7}><div style={{ padding: "14px 18px", background: "#f4f7ef" }}><b>问题详情</b><p>{issue.description || "尚未填写问题描述"}</p><p>来源执行：{issue.runId ? (runs.find(run => run.id === issue.runId)?.actualResult || issue.runId) : "未关联执行记录"}</p><p>讨论：{discussionsByIssue[issue.id]?.length ? discussionsByIssue[issue.id].map(item => item.content).join("；") : "暂无讨论"}</p><button type="button" onClick={() => void addDiscussion(issue.id)}>新增讨论</button> <button type="button" onClick={() => void updateIssueStatus(issue.id)}>更新问题状态</button>{issue.status === "fixed" && <> <button type="button" onClick={() => void retestIssue(issue.id)}>发起复测</button></>}</div></td></tr>}</Fragment>)}
    </tbody></table>{issues.length === 0 && <p style={{ padding: 20 }}>尚无问题记录。失败或阻塞的执行可关联问题，后续从原用例发起复测。</p>}</div></>}
  </section></TestCenterTreeContext.Provider>;
}

type TestCaseExecutionProps = {
  cases: TestCenterCase[];
  tasks: TestCenterTask[];
  runsByCase: Map<string, TestCenterRun[]>;
  issuesByCase: Map<string, TestCenterIssue[]>;
  caseStepsByCase: Record<string, TestCenterCaseStep[]>;
  evidenceByRun: Record<string, TestCenterEvidence[]>;
  commentsByCase: Record<string, TestCenterCaseComment[]>;
  selectedTaskId: string;
  selectedDetailKind: "task" | "case";
  selectedCaseId: string;
  onSelectTask: (id: string) => void;
  onSelectCase: (id: string) => void;
  onSaveTaskDetails: (taskId: string, input: Pick<TestCenterTask, "objective" | "testData" | "testLinks" | "appVersion">) => Promise<void>;
  onAddComment: (caseId: string, content: string) => Promise<void>;
  onUpdateComment: (caseId: string, commentId: string, content: string) => Promise<void>;
  onDeleteComment: (caseId: string, commentId: string) => Promise<void>;
};

function TestCaseExecution({ cases, tasks, runsByCase, issuesByCase, caseStepsByCase, evidenceByRun, commentsByCase, selectedTaskId, selectedDetailKind, selectedCaseId, onSelectTask, onSelectCase, onSaveTaskDetails, onAddComment, onUpdateComment, onDeleteComment }: TestCaseExecutionProps): ReactNode {
  const treeContext = useContext(TestCenterTreeContext);
  const selected = cases.find(item => item.id === selectedCaseId) ?? cases[0];
  const selectedTask = tasks.find(item => item.id === selectedTaskId);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [groups, setGroups] = useState<TestCenterGroup[]>(() => (window as typeof window & { __richTestCenterGroups?: TestCenterGroup[] }).__richTestCenterGroups ?? []);
  const [dragged, setDragged] = useState<{ kind: "task" | "group" | "case"; id: string }>();
  const [dropHint, setDropHint] = useState<string>();
  const projectId = treeContext?.projectId ?? tasks[0]?.projectId ?? cases[0]?.projectId;
  const treeMemoryReady = useRef(false);
  const refreshTree = async () => { if (projectId) setGroups(await api.listTestCenterGroups(projectId)); };
  useEffect(() => { void refreshTree(); }, [projectId]);
  useEffect(() => {
    const sync = (event: Event) => setGroups((event as CustomEvent<TestCenterGroup[]>).detail ?? []);
    window.addEventListener("rich-test-center-groups", sync);
    return () => window.removeEventListener("rich-test-center-groups", sync);
  }, []);
  useEffect(() => { if (treeContext) setGroups(treeContext.groups); }, [treeContext]);
  useEffect(() => {
    treeMemoryReady.current = false;
    if (!projectId) return;
    try {
      const saved = JSON.parse(window.localStorage.getItem(`${testCenterPageMemoryKey(projectId)}:tree`) ?? "[]") as unknown;
      setCollapsed(new Set(Array.isArray(saved) ? saved.filter((id): id is string => typeof id === "string") : []));
    } catch { setCollapsed(new Set()); }
    treeMemoryReady.current = true;
  }, [projectId]);
  useEffect(() => {
    if (!projectId || !treeMemoryReady.current) return;
    try { window.localStorage.setItem(`${testCenterPageMemoryKey(projectId)}:tree`, JSON.stringify([...collapsed])); } catch {}
  }, [projectId, collapsed]);
  const toggle = (branch: string) => setCollapsed(current => {
    const next = new Set(current);
    if (next.has(branch)) next.delete(branch); else next.add(branch);
    return next;
  });
  const evidence = selected ? (runsByCase.get(selected.id) ?? []).flatMap(run => evidenceByRun[run.id] ?? []) : [];
  const selectedIssues = selected ? issuesByCase.get(selected.id) ?? [] : [];
  const comments = selected ? commentsByCase[selected.id] ?? [] : [];
  const taskGroups = [
    ...tasks.map(task => ({ id: task.id, title: task.title, cases: cases.filter(item => item.taskId === task.id), scenarios: groups.filter(item => item.taskId === task.id).map(item => [item, cases.filter(candidate => candidate.groupId === item.id)] as [TestCenterGroup, TestCenterCase[]]) })),
    ...(cases.some(item => !item.taskId) ? [{ id: "unassigned", title: "未归属测试任务", cases: cases.filter(item => !item.taskId), scenarios: [] as Array<[TestCenterGroup, TestCenterCase[]]> }] : []),
  ];
  const selectedTaskTitle = selected?.taskId ? tasks.find(task => task.id === selected.taskId)?.title ?? "任务已不存在" : "未归属测试任务";
  const [context, setContext] = useState<{ x: number; y: number; kind: "task" | "group"; id: string; taskId: string }>();
  const [createDialog, setCreateDialog] = useState<{ taskId: string; parentGroupId?: string }>();
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const closeContext = () => setContext(undefined);
  const openContextFromPointer = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 2) return;
    const target = event.target as HTMLElement;
    const row = target.closest<HTMLElement>(".test-case-execution__task-row, .test-case-execution__group-row");
    if (!row) return;
    const title = row.querySelector("span")?.textContent?.replace(/\d+\s*\/\s*\d+$/, "").trim() ?? "";
    const isTask = row.classList.contains("test-case-execution__task-row");
    const task = isTask ? tasks.find(item => title.includes(item.title)) : undefined;
    const group = !isTask ? groups.find(item => title.includes(item.title)) : undefined;
    if (!task && !group) return;
    event.preventDefault();
    setContext({ x: event.clientX, y: event.clientY, kind: task ? "task" : "group", id: task?.id ?? group!.id, taskId: task?.id ?? group!.taskId });
  };
  useEffect(() => {
    if (!context) return;
    const dismiss = (event: PointerEvent) => { if (!contextMenuRef.current?.contains(event.target as Node)) closeContext(); };
    const dismissOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") closeContext(); };
    window.addEventListener("pointerdown", dismiss); window.addEventListener("keydown", dismissOnEscape);
    return () => { window.removeEventListener("pointerdown", dismiss); window.removeEventListener("keydown", dismissOnEscape); };
  }, [context]);
  const notifyMove = () => window.dispatchEvent(new Event("test-center-tree-changed"));
  const onDropTask = async (beforeTaskId: string) => {
    if (!projectId || dragged?.kind !== "task" || dragged.id === beforeTaskId) return;
    await api.moveTestCenterTask(projectId, dragged.id, beforeTaskId); notifyMove();
  };
  const onDropGroup = async (target: TestCenterGroup, placement: "before" | "inside" | "after") => {
    if (!projectId || !dragged || dragged.id === target.id) return;
    if (dragged.kind === "group") {
      if (placement === "inside") await api.moveTestCenterGroup(projectId, dragged.id, { parentGroupId: target.id });
      else {
        const siblings = groups.filter(item => item.taskId === target.taskId && item.parentGroupId === target.parentGroupId).sort((left, right) => left.sortOrder - right.sortOrder);
        const next = siblings[siblings.findIndex(item => item.id === target.id) + 1];
        await api.moveTestCenterGroup(projectId, dragged.id, { parentGroupId: target.parentGroupId, beforeGroupId: placement === "before" ? target.id : next?.id });
      }
    }
    if (dragged.kind === "case") await api.moveTestCenterCase(projectId, dragged.id, { groupId: target.id });
    notifyMove();
  };
  const onDropCase = async (target: TestCenterCase) => {
    if (!projectId || dragged?.kind !== "case" || dragged.id === target.id) return;
    await api.moveTestCenterCase(projectId, dragged.id, { taskId: target.taskId, groupId: target.groupId, beforeCaseId: target.id });
    notifyMove();
  };
  const groupDropPlacement = (event: DragEvent<HTMLElement>) => {
    const { top, height } = event.currentTarget.getBoundingClientRect();
    const offset = event.clientY - top;
    return offset < height * .27 ? "before" : offset > height * .73 ? "after" : "inside";
  };

  return <div className="test-case-execution">
    <section className="test-case-execution__list" aria-label="测试用例层级列表" onPointerDownCapture={openContextFromPointer} onDragStartCapture={event => event.dataTransfer?.setData("text/plain", "rich-test-tree")}>
      <div className="test-case-execution__list-head"><span>测试任务 / 分组 / 用例</span><span>执行状态</span></div>
      {taskGroups.map(group => {
        const isCollapsed = collapsed.has(group.id);
        const hasScenarios = group.scenarios.length > 0;
        const taskTone = executionTone(group.cases);
        return <div key={group.id} className="test-case-execution__group">
          <div className={`test-case-execution__task-row${selectedDetailKind === "task" && selectedTaskId === group.id ? " is-selected" : ""}${dropHint === `task:${group.id}` ? " is-drop-target" : ""}`} role="button" tabIndex={0} draggable={group.id !== "unassigned"} onDragStart={() => setDragged({ kind: "task", id: group.id })} onDragEnd={() => { setDragged(undefined); setDropHint(undefined); }} onDragOver={event => { if (dragged?.kind === "task") { event.preventDefault(); setDropHint(`task:${group.id}`); } }} onDrop={event => { event.preventDefault(); void onDropTask(group.id); }} onContextMenu={event => { if (group.id !== "unassigned") { event.preventDefault(); setContext({ x: event.clientX, y: event.clientY, kind: "task", id: group.id, taskId: group.id }); } }} onClick={() => { if (group.id !== "unassigned") onSelectTask(group.id); }} onKeyDown={event => { if ((event.key === "Enter" || event.key === " ") && group.id !== "unassigned") { event.preventDefault(); onSelectTask(group.id); } }}><span><button type="button" className="delivery-gantt-split__toggle" aria-label={isCollapsed ? `展开${group.title}` : `收起${group.title}`} onClick={event => { event.stopPropagation(); toggle(group.id); }}>{isCollapsed ? "▸" : "▾"}</button><i className={`test-case-execution__status-dot is-${taskTone}`} aria-hidden="true" />{group.title}</span><span className={`test-case-execution__count is-${taskTone}`}><b>{group.cases.filter(item => item.status === "passed").length}</b> / {group.cases.length}</span></div>
          {!isCollapsed && !hasScenarios && group.cases.map(item => <button key={item.id} type="button" draggable className={`test-case-execution__case-row test-case-execution__case-row--task is-${item.type}${selected?.id === item.id ? " is-selected" : ""}`} onDragStart={() => setDragged({ kind: "case", id: item.id })} onDragEnd={() => setDragged(undefined)} onDragOver={event => { if (dragged?.kind === "case") event.preventDefault(); }} onDrop={event => { event.preventDefault(); void onDropCase(item); }} onClick={() => onSelectCase(item.id)}><span><i className={`test-case-execution__status-dot is-${statusClass(item.status)}`} aria-hidden="true" /><small>{item.code}</small>　{item.title}</span><span><Status value={item.status} /></span></button>)}
          {!isCollapsed && hasScenarios && group.scenarios.map(([scenario, scenarioCases]) => {
            const scenarioKey = `${group.id}:${scenario.id}`;
            const scenarioCollapsed = collapsed.has(scenarioKey);
            const scenarioTone = executionTone(scenarioCases);
            return <div key={scenarioKey} className="test-case-execution__group">
              <div className={`test-case-execution__group-row${dropHint?.startsWith(`group:${scenario.id}:`) ? " is-drop-target" : ""}`} role="button" tabIndex={0} draggable onDragStart={() => setDragged({ kind: "group", id: scenario.id })} onDragEnd={() => { setDragged(undefined); setDropHint(undefined); }} onDragOver={event => { if (dragged) { event.preventDefault(); setDropHint(`group:${scenario.id}:${groupDropPlacement(event)}`); } }} onDrop={event => { event.preventDefault(); void onDropGroup(scenario, groupDropPlacement(event)); }} onContextMenu={event => { event.preventDefault(); setContext({ x: event.clientX, y: event.clientY, kind: "group", id: scenario.id, taskId: scenario.taskId }); }} onClick={() => toggle(scenarioKey)} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); toggle(scenarioKey); } }}><span><button type="button" className="delivery-gantt-split__toggle" aria-label={scenarioCollapsed ? `展开${scenario.title}` : `收起${scenario.title}`} onClick={event => { event.stopPropagation(); toggle(scenarioKey); }}>{scenarioCollapsed ? "▸" : "▾"}</button><i className={`test-case-execution__status-dot is-${scenarioTone}`} aria-hidden="true" />{scenario.title}</span><span className={`test-case-execution__count is-${scenarioTone}`}><b>{scenarioCases.filter(item => item.status === "passed").length}</b> / {scenarioCases.length}</span></div>
              {!scenarioCollapsed && scenarioCases.map(item => <button key={item.id} type="button" draggable className={`test-case-execution__case-row test-case-execution__case-row--group is-${item.type}${selected?.id === item.id ? " is-selected" : ""}`} onDragStart={() => setDragged({ kind: "case", id: item.id })} onDragEnd={() => setDragged(undefined)} onDragOver={event => { if (dragged?.kind === "case") event.preventDefault(); }} onDrop={event => { event.preventDefault(); void onDropCase(item); }} onClick={() => onSelectCase(item.id)}><span><i className={`test-case-execution__status-dot is-${statusClass(item.status)}`} aria-hidden="true" /><small>{item.code}</small>　{item.title}</span><span><Status value={item.status} /></span></button>)}
            </div>;
          })}
        </div>;
      })}
      {!taskGroups.length && <p className="test-case-execution__empty">当前项目暂无测试任务或用例。</p>}
    </section>
    {context && <div ref={contextMenuRef} className="test-case-execution__context-menu" style={{ left: context.x, top: context.y }}>
      <button type="button" onClick={() => { setCreateDialog({ taskId: context.taskId, parentGroupId: context.kind === "group" ? context.id : undefined }); closeContext(); }}>创建分组</button>
      <button type="button" className="is-danger" onClick={async () => { if (projectId && window.confirm(context.kind === "group" ? "删除分组？其中的子分组和用例也会一并删除。" : "删除测试任务？其中的分组和用例也会一并删除。")) { if (context.kind === "group") await api.deleteTestCenterGroup(projectId, context.id); else await api.deleteTestCenterTask(projectId, context.id); await refreshTree(); notifyMove(); } closeContext(); }}>删除</button>
    </div>}
    {createDialog && <div className="test-case-execution__dialog-backdrop" role="presentation">
      <form className="test-case-execution__dialog" onSubmit={async event => {
        event.preventDefault();
        const title = String(new FormData(event.currentTarget).get("title") ?? "").trim();
        if (!title || !projectId) return;
        try {
          const created = await api.createTestCenterGroup(projectId, { ...createDialog, title });
          if (treeContext) treeContext.addGroup(created); else setGroups(current => [...current, created]);
          setCollapsed(current => { const next = new Set(current); next.delete(createDialog.taskId); return next; });
          notifyMove(); setCreateDialog(undefined);
        } catch { window.alert("创建分组失败，请稍后重试。"); }
      }}>
        <h3>创建分组</h3><input name="title" autoFocus placeholder="请输入分组名称" />
        <div><button type="button" onClick={() => setCreateDialog(undefined)}>取消</button><button type="submit">创建</button></div>
      </form>
    </div>}
    <section className="test-case-execution__detail" aria-label={selectedDetailKind === "task" ? "选中测试任务详情" : "选中用例详情"}>
      {selectedDetailKind === "task" && selectedTask ? <TestTaskDetail task={selectedTask} caseCount={cases.filter(item => item.taskId === selectedTask.id).length} onSave={onSaveTaskDetails} /> : !selected ? <p className="test-case-execution__empty">请选择一个测试用例。</p> : <>
        <header className="test-case-execution__detail-head"><div><p>{selected.code}　/　{selectedTaskTitle}　/　{selected.scenario || "未分组"}</p><div className="test-case-execution__title-line"><h2>{selected.title}</h2><Status value={selected.status} /><div className="test-case-execution__meta"><span>{typeLabels[selected.type]}</span><span>{selected.priority}</span><span>执行 {runsByCase.get(selected.id)?.length ?? 0} 次</span><span>问题 {selectedIssues.length} 个</span><span>{conciseTime(selected.updatedAt)}</span></div></div><span>{selected.objective || "未填写测试目标"}</span></div></header>
        <div className="test-case-modules">
          <section className="test-case-module test-case-module--steps"><h3>测试步骤 <b>{caseStepsByCase[selected.id]?.length ?? 0}</b></h3><div className="test-case-module__scroll">{caseStepsByCase[selected.id]?.length ? caseStepsByCase[selected.id].map(step => <p key={step.id}><em>{step.stepOrder}</em><span>{step.instruction}<small>预期：{step.expectedResult || "未填写"}</small></span></p>) : <p className="is-empty">尚未配置测试步骤</p>}</div></section>
          <section className="test-case-module test-case-module--issues"><h3>关联问题 <b>{selectedIssues.length}</b></h3><div className="test-case-module__scroll">{selectedIssues.length ? selectedIssues.map(issue => <p key={issue.id} className="test-case-execution__issue"><strong>{issue.externalRef ?? issue.title}</strong><small>{issue.description || "未填写问题说明"}</small><Status value={issue.status} /></p>) : <p className="is-empty">暂无关联问题</p>}</div></section>
          <TestCaseActivity key={selected.id} caseId={selected.id} comments={comments} onAddComment={onAddComment} onUpdateComment={onUpdateComment} onDeleteComment={onDeleteComment} />
          <section className="test-case-module test-case-module--evidence"><h3>测试证据 <b>{evidence.length}</b></h3><div className="test-case-module__scroll">{evidence.length ? evidence.map(item => <p key={item.id} className="test-case-execution__evidence">▧　{item.title}<small>{item.location}</small></p>) : <p className="is-empty">尚未关联测试证据</p>}</div></section>
        </div>
      </>}
    </section>
  </div>;
}

function TestTaskDetail({ task, caseCount, onSave }: { task: TestCenterTask; caseCount: number; onSave: (taskId: string, input: Pick<TestCenterTask, "objective" | "testData" | "testLinks" | "appVersion">) => Promise<void> }): ReactNode {
  const [draft, setDraft] = useState({ objective: task.objective, testData: task.testData, testLinks: task.testLinks, appVersion: task.appVersion });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  useEffect(() => setDraft({ objective: task.objective, testData: task.testData, testLinks: task.testLinks, appVersion: task.appVersion }), [task]);
  const save = async () => {
    if (saving) return;
    setSaving(true); setError(undefined);
    try { await onSave(task.id, draft); } catch { setError("保存任务资料失败，请稍后重试。"); } finally { setSaving(false); }
  };
  return <><header className="test-case-execution__detail-head"><div><p>测试任务　/　{task.status === "draft" ? "草稿" : labels[task.status]}</p><div className="test-case-execution__title-line"><h2>{task.title}</h2><Status value={task.status} /><div className="test-case-execution__meta"><span>用例 {caseCount} 条</span><span>{conciseTime(task.updatedAt)}</span></div></div><span>维护本任务的测试范围、数据和版本资料。</span></div></header><div className="test-task-detail__fields"><label><span>任务说明</span><textarea value={draft.objective} onChange={event => setDraft(current => ({ ...current, objective: event.target.value }))} placeholder="填写测试范围、目标或说明" /></label><label><span>测试数据</span><textarea value={draft.testData} onChange={event => setDraft(current => ({ ...current, testData: event.target.value }))} placeholder="填写账号、数据集、前置条件等" /></label><label><span>测试链接</span><textarea value={draft.testLinks} onChange={event => setDraft(current => ({ ...current, testLinks: event.target.value }))} placeholder="填写环境、需求或接口链接；一行一个" /></label><label><span>应用版本</span><input value={draft.appVersion} onChange={event => setDraft(current => ({ ...current, appVersion: event.target.value }))} placeholder="例如 v1.8.0 / build 20260907" /></label></div>{error && <p className="test-task-detail__error" role="alert">{error}</p>}<footer className="test-task-detail__actions"><button type="button" onClick={() => void save()} disabled={saving}>{saving ? "保存中…" : "保存任务资料"}</button></footer></>;
}

type IssueGridRow = ConfigurableGridRow & { title: string; description: string; sourceCase: string; externalRef: string; owner: string; status: string; updatedAt: string };

function TestIssueExecution({ issues, cases, caseById, runs, discussionsByIssue, selectedIssueId, columns, onColumnsChange, onCreateIssue, onUpdateIssue, onSelectIssue, onAddDiscussion, onUpdateStatus, onRetest }: { issues: TestCenterIssue[]; cases: TestCenterCase[]; caseById: Map<string, TestCenterCase>; runs: TestCenterRun[]; discussionsByIssue: Record<string, TestCenterIssueDiscussion[]>; selectedIssueId: string; columns: ConfigurableGridColumn[]; onColumnsChange: (columns: ConfigurableGridColumn[]) => void; onCreateIssue: (input: { caseId: string; title: string; description: string }) => Promise<void>; onUpdateIssue: (issueId: string, input: { title?: string; description?: string; status?: "open" | "fixed" | "retest" | "closed"; owner?: string | null; externalRef?: string | null; customFields?: Record<string, string> }) => Promise<void>; onSelectIssue: (issueId: string) => void; onAddDiscussion: (issueId: string) => void; onUpdateStatus: (issueId: string) => void; onRetest: (issueId: string) => void }): ReactNode {
  const [statusFilter, setStatusFilter] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [newCaseId, setNewCaseId] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const visibleIssues = issues.filter(issue => !statusFilter || issue.status === statusFilter);
  const gridRows = visibleIssues.map((issue): IssueGridRow => ({ id: issue.id, title: issue.title, description: issue.description, sourceCase: caseById.get(issue.caseId)?.code ?? "用例已删除", externalRef: issue.externalRef ?? "", owner: issue.owner ?? "", status: issue.status, updatedAt: conciseTime(issue.updatedAt), ...issue.customFields }));
  const selected = visibleIssues.find(issue => issue.id === selectedIssueId) ?? visibleIssues[0];
  const sourceCase = selected ? caseById.get(selected.caseId) : undefined;
  const sourceRun = selected?.runId ? runs.find(run => run.id === selected.runId) : undefined;
  const discussions = selected ? discussionsByIssue[selected.id] ?? [] : [];
  const saveGridRows = (nextRows: IssueGridRow[]) => {
    const changed = nextRows.find((row, index) => row !== gridRows[index]);
    if (!changed) return;
    const status = ["open", "fixed", "retest", "closed"].includes(changed.status) ? changed.status as "open" | "fixed" | "retest" | "closed" : "open";
    const customFields = Object.fromEntries(columns.filter(column => column.key.startsWith("custom_")).map(column => [column.key, String(changed[column.key] ?? "")]));
    void onUpdateIssue(changed.id, { title: String(changed.title).trim() || "未命名问题", description: String(changed.description ?? ""), owner: String(changed.owner ?? "").trim() || null, externalRef: String(changed.externalRef ?? "").trim() || null, status, customFields });
  };
  const createFromGrid = async () => {
    const caseId = newCaseId || cases[0]?.id;
    if (!caseId || !newTitle.trim()) return;
    await onCreateIssue({ caseId, title: newTitle.trim(), description: newDescription });
    setNewCaseId(""); setNewTitle(""); setNewDescription(""); setIsAdding(false);
  };
  return <div className="test-case-execution test-issue-execution test-issue-execution--grid-only">
    <section className="test-issue-execution__grid" aria-label="问题清单表格">
      {isAdding && <form className="test-issue-execution__create" onSubmit={event => { event.preventDefault(); void createFromGrid(); }}><select value={newCaseId} onChange={event => setNewCaseId(event.target.value)} aria-label="来源测试用例"><option value="">选择来源测试用例</option>{cases.map(item => <option key={item.id} value={item.id}>{item.code} · {item.title}</option>)}</select><input value={newTitle} onChange={event => setNewTitle(event.target.value)} placeholder="问题标题" autoFocus /><input value={newDescription} onChange={event => setNewDescription(event.target.value)} placeholder="问题说明（可选）" /><button type="submit" disabled={!newTitle.trim() || !cases.length}>创建</button><button type="button" onClick={() => setIsAdding(false)}>取消</button></form>}
      <ConfigurableDataGrid
        ariaLabel="问题清单表格"
        rows={gridRows}
        columns={columns}
        onRowsChange={nextRows => saveGridRows(nextRows)}
        onColumnsChange={onColumnsChange}
        onAddRow={() => setIsAdding(true)}
        toolbar={<div className="test-issue-execution__filters">{[["", "全部"], ["open", "待处理"], ["fixed", "已修复"], ["retest", "待复测"], ["closed", "已关闭"]].map(([value, label]) => <button key={value} type="button" className={statusFilter === value ? "is-active" : ""} onClick={() => setStatusFilter(value)}>{label}</button>)}</div>}
        emptyRowsRenderer={<>当前筛选条件下暂无问题。点击“新增记录”创建一条问题。</>}
      />
    </section>
  </div>;
}

function TestCaseActivity({ caseId, comments, onAddComment, onUpdateComment, onDeleteComment }: { caseId: string; comments: TestCenterCaseComment[]; onAddComment: (caseId: string, content: string) => Promise<void>; onUpdateComment: (caseId: string, commentId: string, content: string) => Promise<void>; onDeleteComment: (caseId: string, commentId: string) => Promise<void> }): ReactNode {
  const [draft, setDraft] = useState("");
  const [editingCommentId, setEditingCommentId] = useState<string>();
  const [contextMenu, setContextMenu] = useState<{ commentId: string; x: number; y: number }>();
  const [expandedCommentId, setExpandedCommentId] = useState<string>();
  const [saving, setSaving] = useState(false);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const reset = () => { setDraft(""); setEditingCommentId(undefined); };
  const edit = (comment: TestCenterCaseComment) => { setEditingCommentId(comment.id); setDraft(comment.content); };
  useEffect(() => {
    if (!contextMenu) return;
    const dismiss = (event: PointerEvent) => { if (!contextMenuRef.current?.contains(event.target as Node)) setContextMenu(undefined); };
    const dismissOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setContextMenu(undefined); };
    window.addEventListener("pointerdown", dismiss); window.addEventListener("keydown", dismissOnEscape);
    return () => { window.removeEventListener("pointerdown", dismiss); window.removeEventListener("keydown", dismissOnEscape); };
  }, [contextMenu]);
  const save = async () => {
    const content = draft.trim();
    if (!content || saving) return;
    setSaving(true);
    try { if (editingCommentId) await onUpdateComment(caseId, editingCommentId, content); else await onAddComment(caseId, content); reset(); } catch { /* 页面级提示由调用方统一展示。 */ } finally { setSaving(false); }
  };
  return <section className="test-case-module test-case-module--comments test-case-activity">
    <header className="test-case-activity__header"><div><h3>测试动态</h3><p>记录测试过程、讨论结论和补充信息。</p></div></header>
    <div className="delivery-dashboard-timeline test-case-activity__timeline">{comments.length ? comments.slice().sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)).map(comment => { const expanded = expandedCommentId === comment.id; return <article key={comment.id} className={`delivery-dashboard-activity${expanded ? " is-expanded" : ""}`} onContextMenu={event => { event.preventDefault(); setContextMenu({ commentId: comment.id, x: event.clientX, y: event.clientY }); }}><time><span>{activityTime(comment.updatedAt).date}</span><span>{activityTime(comment.updatedAt).time}</span></time><i/><div><header>{editingCommentId === comment.id ? <input className="delivery-dashboard-activity__edit" autoFocus value={draft} onChange={event => setDraft(event.target.value)} onBlur={() => void save()} onKeyDown={event => { if (event.key === "Enter") event.currentTarget.blur(); if (event.key === "Escape") reset(); }} /> : <><b>记录</b><strong>{comment.content}</strong><button type="button" aria-label={expanded ? "收起完整动态" : "查看完整动态"} title={expanded ? "收起完整信息" : "查看完整信息"} aria-expanded={expanded} onClick={() => setExpandedCommentId(current => current === comment.id ? undefined : comment.id)}>•••</button></>}</header></div></article>; }) : <p className="delivery-dashboard-empty">尚无动态，添加第一条记录。</p>}</div>
    <div className="delivery-dashboard-composer test-case-activity__composer"><select aria-label="动态类型" value="record" onChange={() => undefined}><option value="record">记录</option></select><div><input value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") void save(); }} placeholder={editingCommentId ? "修改测试动态…" : "添加记录、讨论结论或补充信息…"}/><button type="button" onClick={() => setDraft(current => `${current}${current ? " " : ""}🙂`)} title="添加表情">☺</button></div><button type="button" onClick={() => void save()} disabled={!draft.trim() || saving}>{saving ? "发布中…" : editingCommentId ? "保存" : "发布"}</button></div>
    {contextMenu && <div ref={contextMenuRef} className="delivery-dashboard-activity-menu" style={{ left: contextMenu.x, top: contextMenu.y }}><button type="button" onClick={() => { void onDeleteComment(caseId, contextMenu.commentId); setContextMenu(undefined); }}>删除</button></div>}
  </section>;
}
