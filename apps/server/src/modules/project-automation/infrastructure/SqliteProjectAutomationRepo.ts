import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import { AUTOMATION_STEPS, type AutomationRunItem } from "../application/runner.js";
import type {
  AutomationGroup,
  AutomationGroupInput,
  AutomationItem,
  AutomationItemInput,
  AutomationPlan,
  AutomationPlanDetail,
  AutomationPlanInput,
  AutomationRun,
  ProjectAutomationRepo,
} from "../contracts.js";

type Row = Record<string, unknown>;

export class SqliteProjectAutomationRepo implements ProjectAutomationRepo {
  constructor(private readonly db: Database.Database) {}

  async listPlans(projectId: string): Promise<AutomationPlan[]> {
    return (this.db.prepare(`SELECT * FROM pm_automation_plans WHERE project_id=? ORDER BY sort_order, created_at`).all(projectId) as Row[]).map(planFromRow);
  }

  async getPlan(projectId: string, planId: string): Promise<AutomationPlanDetail | null> {
    const row = this.db.prepare(`SELECT * FROM pm_automation_plans WHERE project_id=? AND id=?`).get(projectId, planId) as Row | undefined;
    if (!row) return null;
    const groups = (this.db.prepare(`SELECT * FROM pm_automation_groups WHERE project_id=? AND plan_id=? ORDER BY sort_order, created_at`).all(projectId, planId) as Row[]).map(groupFromRow);
    const items = this.db.prepare(`SELECT i.*, t.table_name, t.table_cn, t.system_id, s.name AS system_name
      FROM pm_automation_items i
      JOIN pm_data_tables t ON t.id=i.table_id AND t.project_id=i.project_id
      LEFT JOIN pm_data_systems s ON s.id=t.system_id
      WHERE i.project_id=? AND i.plan_id=? ORDER BY i.sort_order, i.created_at`).all(projectId, planId) as Row[];
    return {
      ...planFromRow(row),
      groups: groups.map(group => ({ ...group, items: items.filter(item => item.group_id === group.id).map(itemFromRow) })),
    };
  }

  async createPlan(projectId: string, input: AutomationPlanInput): Promise<AutomationPlan> {
    const id = `automation-plan-${randomUUID()}`;
    const now = new Date().toISOString();
    this.db.prepare(`INSERT INTO pm_automation_plans (id, project_id, name, description, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(id, projectId, requiredName(input.name, "自动化方案"), input.description ?? null, input.sortOrder ?? 0, now, now);
    return (await this.listPlans(projectId)).find(plan => plan.id === id)!;
  }

  async updatePlan(projectId: string, planId: string, input: Partial<AutomationPlanInput>): Promise<AutomationPlan | null> {
    const current = (await this.listPlans(projectId)).find(plan => plan.id === planId);
    if (!current) return null;
    const now = new Date().toISOString();
    this.db.prepare(`UPDATE pm_automation_plans SET name=?, description=?, sort_order=?, updated_at=? WHERE project_id=? AND id=?`)
      .run(input.name === undefined ? current.name : requiredName(input.name, "自动化方案"), input.description === undefined ? current.description ?? null : input.description, input.sortOrder ?? current.sortOrder, now, projectId, planId);
    return (await this.listPlans(projectId)).find(plan => plan.id === planId) ?? null;
  }

  async deletePlan(projectId: string, planId: string): Promise<boolean> {
    return this.db.prepare(`DELETE FROM pm_automation_plans WHERE project_id=? AND id=?`).run(projectId, planId).changes > 0;
  }

  async createGroup(projectId: string, planId: string, input: AutomationGroupInput): Promise<AutomationGroup> {
    const id = `automation-group-${randomUUID()}`;
    const now = new Date().toISOString();
    this.db.prepare(`INSERT INTO pm_automation_groups (id, project_id, plan_id, name, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(id, projectId, planId, requiredName(input.name, "执行分组"), input.sortOrder ?? 0, now, now);
    return { id, projectId, planId, name: requiredName(input.name, "执行分组"), sortOrder: input.sortOrder ?? 0, createdAt: now, updatedAt: now, items: [] };
  }

  async updateGroup(projectId: string, groupId: string, input: Partial<AutomationGroupInput>): Promise<AutomationGroup | null> {
    const row = this.db.prepare(`SELECT * FROM pm_automation_groups WHERE project_id=? AND id=?`).get(projectId, groupId) as Row | undefined;
    if (!row) return null;
    const current = groupFromRow(row);
    const now = new Date().toISOString();
    this.db.prepare(`UPDATE pm_automation_groups SET name=?, sort_order=?, updated_at=? WHERE project_id=? AND id=?`)
      .run(input.name === undefined ? current.name : requiredName(input.name, "执行分组"), input.sortOrder ?? current.sortOrder, now, projectId, groupId);
    return { ...current, name: input.name === undefined ? current.name : requiredName(input.name, "执行分组"), sortOrder: input.sortOrder ?? current.sortOrder, updatedAt: now };
  }

  async deleteGroup(projectId: string, groupId: string): Promise<boolean> {
    return this.db.prepare(`DELETE FROM pm_automation_groups WHERE project_id=? AND id=?`).run(projectId, groupId).changes > 0;
  }

  async reorderGroups(projectId: string, planId: string, groupIds: string[]): Promise<void> {
    const statement = this.db.prepare(`UPDATE pm_automation_groups SET sort_order=?, updated_at=? WHERE project_id=? AND plan_id=? AND id=?`);
    const now = new Date().toISOString();
    this.db.transaction((ids: string[]) => ids.forEach((id, index) => statement.run(index, now, projectId, planId, id)))(groupIds);
  }

  async addItem(projectId: string, planId: string, groupId: string, input: AutomationItemInput): Promise<AutomationItem> {
    const id = `automation-item-${randomUUID()}`;
    const now = new Date().toISOString();
    this.db.prepare(`INSERT INTO pm_automation_items (id, project_id, plan_id, group_id, table_id, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, projectId, planId, groupId, input.tableId, input.sortOrder ?? 0, now, now);
    const plan = await this.getPlan(projectId, planId);
    const item = plan?.groups.flatMap(group => group.items).find(candidate => candidate.id === id);
    if (!item) throw new Error("自动化表项创建失败");
    return item;
  }

  async removeItem(projectId: string, itemId: string): Promise<boolean> {
    return this.db.prepare(`DELETE FROM pm_automation_items WHERE project_id=? AND id=?`).run(projectId, itemId).changes > 0;
  }

  async reorderItems(projectId: string, groupId: string, itemIds: string[]): Promise<void> {
    const statement = this.db.prepare(`UPDATE pm_automation_items SET sort_order=?, updated_at=? WHERE project_id=? AND group_id=? AND id=?`);
    const now = new Date().toISOString();
    this.db.transaction((ids: string[]) => ids.forEach((id, index) => statement.run(index, now, projectId, groupId, id)))(itemIds);
  }

  async createRun(plan: AutomationPlanDetail, runtimeParams: Record<string, unknown> = {}): Promise<AutomationRun> {
    const now = new Date().toISOString();
    const run: AutomationRun = {
      id: `automation-run-${randomUUID()}`,
      projectId: plan.projectId,
      planId: plan.id,
      planName: plan.name,
      status: "running",
      startedAt: now,
      updatedAt: now,
      runtimeParams,
      items: plan.groups.flatMap(group => group.items.map(item => ({
        id: `automation-run-item-${randomUUID()}`,
        tableId: item.tableId,
        tableName: item.tableName,
        groupId: group.id,
        groupName: group.name,
        groupOrder: group.sortOrder,
        itemOrder: item.sortOrder,
        status: "pending" as const,
        steps: AUTOMATION_STEPS.map(step => ({ step, status: "pending" as const })),
      }))),
    };
    this.db.prepare(`INSERT INTO pm_automation_runs (id, project_id, plan_id, plan_name, status, runtime_params, started_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(run.id, run.projectId, run.planId, run.planName, run.status, JSON.stringify(runtimeParams), run.startedAt, run.updatedAt);
    this.replaceRunItems(run);
    return run;
  }

  async saveRun(run: AutomationRun): Promise<void> {
    run.updatedAt = new Date().toISOString();
    this.db.prepare(`UPDATE pm_automation_runs SET status=?, error=?, finished_at=?, runtime_params=?, updated_at=? WHERE project_id=? AND id=?`)
      .run(run.status, run.error ?? null, run.finishedAt ?? null, JSON.stringify(run.runtimeParams ?? {}), run.updatedAt, run.projectId, run.id);
    this.replaceRunItems(run);
  }

  async getRun(projectId: string, runId: string): Promise<AutomationRun | null> {
    const row = this.db.prepare(`SELECT * FROM pm_automation_runs WHERE project_id=? AND id=?`).get(projectId, runId) as Row | undefined;
    if (!row) return null;
    return runFromRows(row, this.db.prepare(`SELECT * FROM pm_automation_run_items WHERE run_id=? ORDER BY group_order, item_order`).all(runId) as Row[]);
  }

  async listRuns(projectId: string, planId: string, limit = 20): Promise<AutomationRun[]> {
    const rows = this.db.prepare(`SELECT * FROM pm_automation_runs WHERE project_id=? AND plan_id=? ORDER BY started_at DESC LIMIT ?`).all(projectId, planId, Math.max(1, Math.min(limit, 100))) as Row[];
    return Promise.all(rows.map(row => this.getRun(projectId, String(row.id)))).then(runs => runs.filter((run): run is AutomationRun => Boolean(run)));
  }

  private replaceRunItems(run: AutomationRun): void {
    const remove = this.db.prepare(`DELETE FROM pm_automation_run_items WHERE run_id=?`);
    const insert = this.db.prepare(`INSERT INTO pm_automation_run_items
      (id, run_id, table_id, table_name, group_id, group_name, group_order, item_order, status, steps, affected_rows, failed_step, error, started_at, finished_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    this.db.transaction(() => {
      remove.run(run.id);
      run.items.forEach(item => insert.run(item.id, run.id, item.tableId, item.tableName, item.groupId, item.groupName, item.groupOrder, item.itemOrder, item.status, JSON.stringify(item.steps), item.affectedRows ?? null, item.failedStep ?? null, item.error ?? null, item.startedAt ?? null, item.finishedAt ?? null));
    })();
  }
}

function requiredName(value: string, fallback: string): string {
  return value.trim() || fallback;
}

function planFromRow(row: Row): AutomationPlan {
  return { id: String(row.id), projectId: String(row.project_id), name: String(row.name), description: row.description == null ? undefined : String(row.description), sortOrder: Number(row.sort_order), createdAt: String(row.created_at), updatedAt: String(row.updated_at) };
}

function groupFromRow(row: Row): AutomationGroup {
  return { id: String(row.id), projectId: String(row.project_id), planId: String(row.plan_id), name: String(row.name), sortOrder: Number(row.sort_order), createdAt: String(row.created_at), updatedAt: String(row.updated_at), items: [] };
}

function itemFromRow(row: Row): AutomationItem {
  return { id: String(row.id), projectId: String(row.project_id), planId: String(row.plan_id), groupId: String(row.group_id), tableId: String(row.table_id), tableName: String(row.table_name), tableCn: row.table_cn == null ? undefined : String(row.table_cn), systemId: row.system_id == null ? undefined : String(row.system_id), systemName: row.system_name == null ? undefined : String(row.system_name), sortOrder: Number(row.sort_order) };
}

function runFromRows(row: Row, itemRows: Row[]): AutomationRun {
  return {
    id: String(row.id), projectId: String(row.project_id), planId: String(row.plan_id), planName: String(row.plan_name), status: row.status as AutomationRun["status"], error: row.error == null ? undefined : String(row.error), startedAt: String(row.started_at), finishedAt: row.finished_at == null ? undefined : String(row.finished_at), updatedAt: String(row.updated_at), runtimeParams: parseObject(row.runtime_params),
    items: itemRows.map(item => ({ id: String(item.id), tableId: String(item.table_id), tableName: String(item.table_name), groupId: String(item.group_id), groupName: String(item.group_name), groupOrder: Number(item.group_order), itemOrder: Number(item.item_order), status: item.status as AutomationRunItem["status"], steps: JSON.parse(String(item.steps)) as AutomationRunItem["steps"], affectedRows: item.affected_rows == null ? undefined : Number(item.affected_rows), failedStep: item.failed_step == null ? undefined : item.failed_step as AutomationRunItem["failedStep"], error: item.error == null ? undefined : String(item.error), startedAt: item.started_at == null ? undefined : String(item.started_at), finishedAt: item.finished_at == null ? undefined : String(item.finished_at) })),
  };
}

function parseObject(value: unknown): Record<string, unknown> {
  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
}
