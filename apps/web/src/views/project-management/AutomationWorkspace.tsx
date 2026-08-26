import { useCallback, useEffect, useMemo, useState } from "react";
import {
  api,
  type ProjectAutomationGroup,
  type ProjectAutomationPlan,
  type ProjectAutomationPlanDetail,
  type ProjectAutomationPlanInspection,
  type ProjectAutomationRun,
  type ProjectAutomationRunItem,
  type ProjectAutomationStep,
  type ProjectDictionaryTable,
} from "../../api/client.js";
import "./AutomationWorkspace.css";

type AutomationPreflightMemory = {
  inspection: ProjectAutomationPlanInspection;
  runtimeParams: Record<string, string>;
};

export function AutomationSection({
  projectId,
  onOpenMapping,
}: {
  projectId: string;
  onOpenMapping: (tableId: string, systemId?: string) => void;
}) {
  const [plans, setPlans] = useState<ProjectAutomationPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [plan, setPlan] = useState<ProjectAutomationPlanDetail | null>(null);
  const [tables, setTables] = useState<ProjectDictionaryTable[]>([]);
  const [currentRun, setCurrentRun] = useState<ProjectAutomationRun | null>(null);
  const [inspection, setInspection] = useState<ProjectAutomationPlanInspection | null>(null);
  const [runtimeParams, setRuntimeParams] = useState<Record<string, string>>({});
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [openTablePickers, setOpenTablePickers] = useState<Record<string, boolean>>({});
  const [tableSelection, setTableSelection] = useState<Record<string, string[]>>({});
  const [tableSearch, setTableSearch] = useState<Record<string, string>>({});
  const [nameDialog, setNameDialog] = useState<{ kind: "plan" | "group"; title: string; value: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPlans = useCallback(async () => {
    const next = await api.listProjectAutomationPlans(projectId);
    setPlans(next);
    setSelectedPlanId(current => next.some(item => item.id === current) ? current : next[0]?.id || "");
  }, [projectId]);

  const loadPlan = useCallback(async () => {
    if (!selectedPlanId) {
      setPlan(null);
      setCurrentRun(null);
      return;
    }
    const [detail, history] = await Promise.all([
      api.getProjectAutomationPlan(projectId, selectedPlanId),
      api.listProjectAutomationRuns(projectId, selectedPlanId),
    ]);
    setPlan(detail);
    setCurrentRun(history[0] ?? null);
  }, [projectId, selectedPlanId]);

  useEffect(() => {
    setError(null);
    void Promise.all([loadPlans(), api.listProjectDictionaryTables(projectId).then(setTables)])
      .catch(errorValue => setError(errorMessage(errorValue)));
  }, [loadPlans, projectId]);

  useEffect(() => {
    setError(null);
    const remembered = loadAutomationPreflightMemory(projectId, selectedPlanId);
    setInspection(remembered?.inspection ?? null);
    setRuntimeParams(remembered?.runtimeParams ?? {});
    setCollapsedGroups({});
    setOpenTablePickers({});
    setTableSelection({});
    setTableSearch({});
    void loadPlan().catch(errorValue => setError(errorMessage(errorValue)));
  }, [loadPlan, projectId, selectedPlanId]);

  useEffect(() => {
    if (!selectedPlanId || !inspection) return;
    saveAutomationPreflightMemory(projectId, selectedPlanId, { inspection, runtimeParams });
  }, [inspection, projectId, runtimeParams, selectedPlanId]);

  useEffect(() => {
    if (!currentRun || currentRun.status !== "running") return;
    const timer = window.setInterval(() => {
      void api.getProjectAutomationRun(projectId, currentRun.id)
        .then(next => {
          setCurrentRun(next);
        })
        .catch(errorValue => setError(errorMessage(errorValue)));
    }, 800);
    return () => window.clearInterval(timer);
  }, [currentRun?.id, currentRun?.status, projectId]);

  const assignedTableIds = useMemo(() => new Set(plan?.groups.flatMap(group => group.items.map(item => item.tableId)) ?? []), [plan]);
  const itemStatus = useMemo(() => new Map(currentRun?.items.map(item => [item.tableId, item]) ?? []), [currentRun]);

  const mutate = async (operation: () => Promise<unknown>, refreshPlans = false, invalidateInspection = true) => {
    setBusy(true);
    setError(null);
    try {
      await operation();
      if (refreshPlans) {
        setPlan(null);
        setCurrentRun(null);
        await loadPlans();
      } else {
        if (invalidateInspection) {
          setInspection(null);
          clearAutomationPreflightMemory(projectId, selectedPlanId);
        }
        await loadPlan();
      }
    } catch (errorValue) {
      setError(errorMessage(errorValue));
    } finally {
      setBusy(false);
    }
  };

  const createPlan = () => {
    setNameDialog({ kind: "plan", title: "新建自动化方案", value: "每日取数" });
  };

  const createGroup = () => {
    if (!plan) return;
    setNameDialog({ kind: "group", title: "新建执行分组", value: `分组 ${plan.groups.length + 1}` });
  };

  const submitNameDialog = () => {
    if (!nameDialog) return;
    const name = nameDialog.value.trim();
    if (!name) return;
    const kind = nameDialog.kind;
    setNameDialog(null);
    if (kind === "plan") {
      void mutate(async () => {
        const created = await api.createProjectAutomationPlan(projectId, { name });
        await loadPlans();
        setSelectedPlanId(created.id);
      });
      return;
    }
    if (plan) {
      void mutate(() => api.createProjectAutomationGroup(projectId, plan.id, { name, sortOrder: plan.groups.length }));
    }
  };

  const moveGroup = (group: ProjectAutomationGroup, offset: number) => {
    if (!plan) return;
    const ids = moveId(plan.groups.map(item => item.id), group.id, offset);
    if (!ids) return;
    void mutate(() => api.reorderProjectAutomationGroups(projectId, plan.id, ids));
  };

  const moveItem = (group: ProjectAutomationGroup, itemId: string, offset: number) => {
    const ids = moveId(group.items.map(item => item.id), itemId, offset);
    if (!ids) return;
    void mutate(() => api.reorderProjectAutomationItems(projectId, group.id, ids));
  };

  const startRun = () => {
    if (!plan || !inspection?.ready || missingRuntimeParams(inspection, runtimeParams).length > 0) return;
    void mutate(async () => {
      const run = await api.startProjectAutomationRun(projectId, plan.id, runtimeParams);
      setCurrentRun(run);
    }, false, false);
  };

  const resumeRun = () => {
    if (!currentRun || currentRun.status !== "paused" || !inspection?.ready || missingRuntimeParams(inspection, runtimeParams).length > 0) return;
    void mutate(async () => {
      const run = await api.resumeProjectAutomationRun(projectId, currentRun.id, runtimeParams);
      setCurrentRun(run);
    }, false, false);
  };

  const checkAutomation = async () => {
    if (!plan) return;
    setChecking(true);
    setError(null);
    try {
      const result = await api.checkProjectAutomationPlan(projectId, plan.id);
      setInspection(result);
      setRuntimeParams(current => Object.fromEntries(result.parameters.map(parameter => [
        parameter.name,
        current[parameter.name] ?? runtimeParamText(currentRun?.runtimeParams?.[parameter.name]),
      ])));
    } catch (errorValue) {
      setError(errorMessage(errorValue));
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="automation-workspace">
      <aside className="automation-plans">
        <header><strong>自动化方案</strong><button type="button" onClick={createPlan}>＋</button></header>
        {plans.length === 0 && <p className="automation-empty">创建方案后配置执行分组。</p>}
        {plans.map(item => (
          <button key={item.id} type="button" className={item.id === selectedPlanId ? "is-active" : ""} onClick={() => setSelectedPlanId(item.id)}>
            <span>{item.name}</span><small>{item.description || "严格串行"}</small>
          </button>
        ))}
      </aside>

      <main className="automation-main">
        <header className="automation-toolbar">
          <div><h2>{plan?.name || "数据自动化"}</h2><p>按分组和表顺序严格串行执行：SQL 验证 → 表更新 → 抽取准备 → 取数</p></div>
          <div className="automation-toolbar__actions">
            {plan && <button type="button" disabled={busy} onClick={createGroup}>＋ 执行分组</button>}
            {plan && <button type="button" className="is-danger" disabled={busy || currentRun?.status === "running"} onClick={() => {
              if (window.confirm(`删除自动化方案“${plan.name}”？运行历史也将无法从方案入口查看。`)) {
                void mutate(() => api.deleteProjectAutomationPlan(projectId, plan.id), true);
              }
            }}>删除方案</button>}
          </div>
        </header>

        {error && <div className="automation-alert">{error}</div>}
        {!plan && <div className="automation-welcome"><strong>尚未配置数据自动化</strong><span>先创建一个方案，再按依赖关系添加分组和数据字典表。</span></div>}

        {plan && <div className="automation-console-grid">
          <section className="automation-config-pane" aria-label="自动化分组和任务">
          <div className="automation-pane-heading"><div><strong>分组与任务</strong><span>左侧配置决定严格串行的执行顺序</span></div></div>
          <div className="automation-groups">
          {plan.groups.length === 0 && <div className="automation-welcome"><strong>还没有执行分组</strong><span>建议先建立贴源层，再建立中间层。</span></div>}
          {plan.groups.map((group, groupIndex) => (
            <section className="automation-group" key={group.id}>
              <header>
                <div
                  className="automation-group__title"
                  aria-expanded={!collapsedGroups[group.id]}
                  title="双击折叠或展开组内任务"
                  onDoubleClick={() => setCollapsedGroups(current => ({ ...current, [group.id]: !current[group.id] }))}
                >
                  <span className="automation-group__chevron" aria-hidden="true">{collapsedGroups[group.id] ? "▸" : "▾"}</span>
                  <span className="automation-order">{groupIndex + 1}</span><strong>{group.name}</strong><small>{group.items.length} 张表</small>
                </div>
                <div>
                  <button type="button" className="is-add" disabled={busy} onClick={() => {
                    const willOpen = !openTablePickers[group.id];
                    setOpenTablePickers(current => ({ ...current, [group.id]: willOpen }));
                    if (!willOpen) {
                      setTableSearch(current => ({ ...current, [group.id]: "" }));
                      setTableSelection(current => ({ ...current, [group.id]: [] }));
                    }
                  }}>{openTablePickers[group.id] ? "收起" : "添加"}</button>
                  <button type="button" disabled={busy || groupIndex === 0} onClick={() => moveGroup(group, -1)}>上移</button>
                  <button type="button" disabled={busy || groupIndex === plan.groups.length - 1} onClick={() => moveGroup(group, 1)}>下移</button>
                  <button type="button" className="is-danger" disabled={busy} onClick={() => {
                    if (window.confirm(`删除分组“${group.name}”？`)) void mutate(() => api.deleteProjectAutomationGroup(projectId, group.id));
                  }}>删除</button>
                </div>
              </header>

              {!collapsedGroups[group.id] && <>
              {openTablePickers[group.id] && <AutomationTablePicker
                tables={tables.filter(table => !assignedTableIds.has(table.id))}
                query={tableSearch[group.id] || ""}
                selectedTableIds={tableSelection[group.id] || []}
                disabled={busy}
                onQueryChange={query => setTableSearch(current => ({ ...current, [group.id]: query }))}
                onToggle={tableId => setTableSelection(current => {
                  const selected = current[group.id] || [];
                  return { ...current, [group.id]: selected.includes(tableId) ? selected.filter(id => id !== tableId) : [...selected, tableId] };
                })}
                onAdd={() => {
                  const tableIds = tableSelection[group.id] || [];
                  if (tableIds.length === 0) return;
                  void mutate(async () => {
                    for (const tableId of tableIds) {
                      await api.addProjectAutomationItem(projectId, plan.id, group.id, tableId);
                    }
                    setTableSelection(current => ({ ...current, [group.id]: [] }));
                  });
                }}
              />}

              <div className="automation-table-list">
                {group.items.length === 0 && <p className="automation-empty">该分组还没有数据表。</p>}
                {group.items.map((item, itemIndex) => {
                  const status = itemStatus.get(item.tableId);
                  return <div className={`automation-table-row${status?.status === "error" ? " is-error" : ""}`} key={item.id}>
                    <span className="automation-order">{groupIndex + 1}.{itemIndex + 1}</span>
                    <div className="automation-table-name"><strong>{item.tableCn || item.tableName}</strong><small>{item.systemName ? `${item.systemName} · ` : ""}{item.tableName}</small></div>
                    <AutomationStatus item={status} />
                    <div className="automation-row-actions">
                      <button type="button" disabled={busy || itemIndex === 0} onClick={() => moveItem(group, item.id, -1)}>↑</button>
                      <button type="button" disabled={busy || itemIndex === group.items.length - 1} onClick={() => moveItem(group, item.id, 1)}>↓</button>
                      <button type="button" className="is-danger" disabled={busy} onClick={() => void mutate(() => api.removeProjectAutomationItem(projectId, item.id))}>移除</button>
                    </div>
                  </div>;
                })}
              </div>
              </>}
            </section>
          ))}
          </div>
          </section>

          <aside className="automation-run-pane" aria-label="运行控制和执行记录">
            <section className="automation-preflight">
              <header className="automation-pane-heading">
                <div><strong>运行参数</strong><span>先检查全部任务，再填写本批次参数</span></div>
                <button type="button" disabled={busy || checking || currentRun?.status === "running"} onClick={() => void checkAutomation()}>
                  {checking ? "检查中…" : "自动化检查"}
                </button>
              </header>

              {!inspection && <div className="automation-check-placeholder">点击“自动化检查”，系统将逐表分析 SQL 所需参数。</div>}
              {inspection && <>
                <div className={`automation-check-result ${inspection.ready ? "is-ready" : "is-error"}`}>
                  <strong>{inspection.ready ? "检查通过" : "检查发现问题"}</strong>
                  <span>{inspection.items.filter(item => item.ready).length} / {inspection.items.length} 张表可执行</span>
                </div>
                <div className="automation-params">
                  {inspection.parameters.length === 0 && <p>当前方案无需填写运行参数。</p>}
                  {inspection.parameters.map(parameter => <label key={parameter.name}>
                    <span><strong>{parameter.name}</strong><small>{parameter.types.join(" / ") || "TEXT"} · {parameter.tableIds.length} 张表使用</small></span>
                    <input
                      value={runtimeParams[parameter.name] || ""}
                      placeholder={`请输入 ${parameter.name}`}
                      onChange={event => setRuntimeParams(current => ({ ...current, [parameter.name]: event.target.value }))}
                    />
                  </label>)}
                </div>
                {inspection.items.some(item => !item.ready) && <div className="automation-check-errors">
                  {inspection.items.filter(item => !item.ready).map(item => <button key={item.tableId} type="button" onClick={() => {
                    const configured = plan.groups.flatMap(group => group.items).find(candidate => candidate.tableId === item.tableId);
                    onOpenMapping(item.tableId, configured?.systemId);
                  }}><strong>{item.groupName} · {item.tableName}</strong><span>{item.error || item.message || "检查未通过"}</span></button>)}
                </div>}
              </>}

              <div className="automation-run-actions">
                {currentRun?.status === "paused" && <button type="button" className="is-warning" disabled={busy || !canExecuteInspection(inspection, runtimeParams)} onClick={resumeRun}>断点续跑</button>}
                <button type="button" className="is-primary" disabled={busy || currentRun?.status === "running" || !canExecuteInspection(inspection, runtimeParams)} onClick={startRun}>
                  {currentRun ? "重新运行" : "执行自动化"}
                </button>
              </div>
            </section>

            <section className="automation-records">
              <div className="automation-pane-heading"><div><strong>执行记录</strong><span>失败信息可直接跳转到表 Mapping</span></div></div>
              {currentRun ? <AutomationRunPanel run={currentRun} onOpenMapping={(tableId) => {
                const configured = plan.groups.flatMap(group => group.items).find(item => item.tableId === tableId);
                onOpenMapping(tableId, configured?.systemId);
              }} /> : <div className="automation-check-placeholder">暂无执行记录。</div>}
            </section>
          </aside>
        </div>}
      </main>

      {nameDialog && <div className="automation-name-dialog" role="dialog" aria-modal="true" aria-labelledby="automation-name-dialog-title" onMouseDown={event => {
        if (event.target === event.currentTarget && !busy) setNameDialog(null);
      }}>
        <form onSubmit={event => { event.preventDefault(); submitNameDialog(); }}>
          <h3 id="automation-name-dialog-title">{nameDialog.title}</h3>
          <label>名称</label>
          <input
            autoFocus
            aria-label="名称"
            value={nameDialog.value}
            onChange={event => setNameDialog(current => current ? { ...current, value: event.target.value } : current)}
          />
          <div>
            <button type="button" disabled={busy} onClick={() => setNameDialog(null)}>取消</button>
            <button type="submit" className="is-primary" disabled={busy || !nameDialog.value.trim()}>创建</button>
          </div>
        </form>
      </div>}
    </div>
  );
}

function AutomationTablePicker({
  tables,
  query,
  selectedTableIds,
  disabled,
  onQueryChange,
  onToggle,
  onAdd,
}: {
  tables: ProjectDictionaryTable[];
  query: string;
  selectedTableIds: string[];
  disabled: boolean;
  onQueryChange: (query: string) => void;
  onToggle: (tableId: string) => void;
  onAdd: () => void;
}) {
  const eligibleTables = useMemo(
    () => tables.filter(table => automationTableUsageRank(table.usageStatus) === 0),
    [tables],
  );
  const visibleTables = useMemo(
    () => sortAutomationTablesByUsage(filterAutomationTables(eligibleTables, query)),
    [eligibleTables, query],
  );

  return <div className="automation-table-picker">
    <div className="automation-table-picker__toolbar">
      <label>
        <span>⌕</span>
        <input
          type="search"
          aria-label="搜索数据字典表"
          placeholder="搜索中文表名或英文表名…"
          value={query}
          onChange={event => onQueryChange(event.target.value)}
        />
      </label>
      <small>{visibleTables.length} / {eligibleTables.length} 张可选</small>
    </div>
    <div className="automation-table-picker__list" role="listbox" aria-label="数据字典表列表">
      <div className="automation-table-picker__head" aria-hidden="true">
        <span>选择</span><span>中文表名</span><span>英文表名</span><span>数据层级</span><span>载体类型</span><span>是否使用</span><span>字段数</span>
      </div>
      {visibleTables.map(table => <button
        key={table.id}
        type="button"
        role="option"
        aria-selected={selectedTableIds.includes(table.id)}
        className={`automation-table-picker__row${selectedTableIds.includes(table.id) ? " is-selected" : ""}`}
        onClick={() => onToggle(table.id)}>
        <span className="automation-table-picker__check" aria-hidden="true">{selectedTableIds.includes(table.id) ? "✓" : ""}</span>
        <strong title={table.tableCn || table.tableName}>{table.tableCn || table.tableName}</strong>
        <code title={table.tableName}>{table.tableName}</code>
        <span>{table.dataLayer || table.tableGroup || "源表层"}</span>
        <span>{table.sourceKind || table.fileType || "数据库"}</span>
        <span>{automationTableUsageLabel(table.usageStatus)}</span>
        <em>{table.fieldCount}</em>
      </button>)}
      {visibleTables.length === 0 && <div className="automation-table-picker__empty">没有匹配的数据字典表</div>}
    </div>
    <div className="automation-table-picker__footer">
      <span>{selectedTableIds.length > 0 ? <>已选择 <strong>{selectedTableIds.length}</strong> 张表</> : "单击列表可多选数据表"}</span>
      <button type="button" className="is-primary" disabled={disabled || selectedTableIds.length === 0} onClick={onAdd}>添加选中表</button>
    </div>
  </div>;
}

function filterAutomationTables(tables: ProjectDictionaryTable[], query: string): ProjectDictionaryTable[] {
  const tokens = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return tables;
  return tables.filter(table => {
    const searchText = [
      table.tableCn,
      table.tableName,
    ].filter(Boolean).join(" ").toLocaleLowerCase();
    return tokens.every(token => searchText.includes(token));
  });
}

function sortAutomationTablesByUsage(tables: ProjectDictionaryTable[]): ProjectDictionaryTable[] {
  return [...tables].sort((left, right) => {
    const usageOrder = automationTableUsageRank(left.usageStatus) - automationTableUsageRank(right.usageStatus);
    if (usageOrder !== 0) return usageOrder;
    return (left.tableCn || left.tableName).localeCompare(right.tableCn || right.tableName, "zh-Hans-CN");
  });
}

function automationTableUsageRank(usageStatus?: string): number {
  const status = usageStatus?.trim().toLocaleLowerCase() || "";
  if (["使用", "是", "yes", "true", "1", "active", "启用"].includes(status)) return 0;
  if (!status || ["未确定", "待确认", "未知", "pending", "unknown"].includes(status)) return 1;
  return 2;
}

function automationTableUsageLabel(usageStatus?: string): string {
  const status = usageStatus?.trim().toLocaleLowerCase() || "";
  if (["使用", "是", "yes", "true", "1", "active", "启用"].includes(status)) return "是";
  if (!status || ["未确定", "待确认", "未知", "pending", "unknown"].includes(status)) return "未确定";
  if (["未使用", "否", "no", "false", "0", "inactive", "停用"].includes(status)) return "否";
  return usageStatus!.trim();
}

function AutomationStatus({ item }: { item?: ProjectAutomationRunItem }) {
  if (!item) return <span className="automation-status is-unstarted">未运行</span>;
  return <div className="automation-status-cell"><span className={`automation-status is-${item.status}`}>{itemStatusLabel(item.status)}</span>{typeof item.affectedRows === "number" && <small>{item.affectedRows.toLocaleString()} 条</small>}</div>;
}

function AutomationRunPanel({ run, onOpenMapping }: { run: ProjectAutomationRun; onOpenMapping: (tableId: string) => void }) {
  return <section className={`automation-run-panel is-${run.status}`}>
    <header><div><h3>执行记录</h3><span>{formatTime(run.startedAt)}</span></div><strong>{runStatusLabel(run.status)}</strong></header>
    <div className="automation-run-items">
      {run.items.map(item => <article key={item.id} className={item.status === "error" ? "is-error" : ""}>
        <div className="automation-run-item__title"><span>{item.groupName}</span><strong>{item.tableName}</strong>{typeof item.affectedRows === "number" && <em>{item.affectedRows.toLocaleString()} 条记录</em>}</div>
        <div className="automation-step-track">{item.steps.map(step => <span key={step.step} className={`is-${step.status}`} title={step.error}>{stepLabel(step.step)}</span>)}</div>
        {item.error && <button type="button" className="automation-error-link" onClick={() => onOpenMapping(item.tableId)}><strong>{item.error}</strong><span>打开该表 Mapping →</span></button>}
      </article>)}
    </div>
  </section>;
}

function moveId(ids: string[], id: string, offset: number): string[] | null {
  const index = ids.indexOf(id);
  const target = index + offset;
  if (index < 0 || target < 0 || target >= ids.length) return null;
  const next = [...ids];
  [next[index], next[target]] = [next[target]!, next[index]!];
  return next;
}

function missingRuntimeParams(inspection: ProjectAutomationPlanInspection, values: Record<string, string>): string[] {
  return inspection.parameters.filter(parameter => !values[parameter.name]?.trim()).map(parameter => parameter.name);
}

function canExecuteInspection(inspection: ProjectAutomationPlanInspection | null, values: Record<string, string>): boolean {
  return Boolean(inspection?.ready && missingRuntimeParams(inspection, values).length === 0);
}

function runtimeParamText(value: unknown): string {
  return value == null ? "" : typeof value === "string" ? value : String(value);
}

function automationPreflightMemoryKey(projectId: string, planId: string) {
  return `rich-project-automation-preflight:${projectId}:${planId}`;
}

function loadAutomationPreflightMemory(projectId: string, planId: string): AutomationPreflightMemory | null {
  if (!planId || typeof window === "undefined") return null;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(automationPreflightMemoryKey(projectId, planId)) ?? "null") as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const record = parsed as Record<string, unknown>;
    if (!record.inspection || typeof record.inspection !== "object" || Array.isArray(record.inspection)) return null;
    const runtimeParams = record.runtimeParams && typeof record.runtimeParams === "object" && !Array.isArray(record.runtimeParams)
      ? Object.fromEntries(Object.entries(record.runtimeParams).filter(([, value]) => typeof value === "string")) as Record<string, string>
      : {};
    return { inspection: record.inspection as ProjectAutomationPlanInspection, runtimeParams };
  } catch {
    return null;
  }
}

function saveAutomationPreflightMemory(projectId: string, planId: string, memory: AutomationPreflightMemory) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(automationPreflightMemoryKey(projectId, planId), JSON.stringify(memory));
  } catch {
    // 本地存储不可用时，仍保留当前页面内的检查结果。
  }
}

function clearAutomationPreflightMemory(projectId: string, planId: string) {
  if (!planId || typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(automationPreflightMemoryKey(projectId, planId));
  } catch {
    // 忽略浏览器隐私模式等导致的本地存储错误。
  }
}

function stepLabel(step: ProjectAutomationStep): string {
  return { validate_sql: "SQL 验证", sync_table: "表更新", prepare_extraction: "抽取准备", extract: "取数" }[step];
}

function itemStatusLabel(status: ProjectAutomationRunItem["status"]): string {
  return { pending: "等待", running: "运行中", success: "成功", error: "失败" }[status];
}

function runStatusLabel(status: ProjectAutomationRun["status"]): string {
  return { running: "执行中", paused: "已暂停", success: "已完成" }[status];
}

function formatTime(value: string): string {
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}

function errorMessage(value: unknown): string {
  return value instanceof Error ? value.message : String(value);
}
