import { randomUUID } from "node:crypto";
import type { PgPool } from "../../../db/postgres.js";
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

export class PostgresProjectAutomationRepo implements ProjectAutomationRepo {
  constructor(private readonly pg: PgPool) {}

  async listPlans(projectId: string): Promise<AutomationPlan[]> {
    await this.pg.ready;
    const result = await this.pg.query(`SELECT * FROM pm_automation_plans WHERE project_id=$1 ORDER BY sort_order, created_at`, [projectId]);
    return result.rows.map(planFromRow);
  }

  async getPlan(projectId: string, planId: string): Promise<AutomationPlanDetail | null> {
    await this.pg.ready;
    const [planResult, groupResult, itemResult] = await Promise.all([
      this.pg.query(`SELECT * FROM pm_automation_plans WHERE project_id=$1 AND id=$2`, [projectId, planId]),
      this.pg.query(`SELECT * FROM pm_automation_groups WHERE project_id=$1 AND plan_id=$2 ORDER BY sort_order, created_at`, [projectId, planId]),
      this.pg.query(`SELECT i.*, t.table_name, t.table_cn, t.system_id, s.name AS system_name
        FROM pm_automation_items i
        JOIN pm_data_tables t ON t.id=i.table_id AND t.project_id=i.project_id
        LEFT JOIN pm_data_systems s ON s.id=t.system_id
        WHERE i.project_id=$1 AND i.plan_id=$2 ORDER BY i.sort_order, i.created_at`, [projectId, planId]),
    ]);
    const row = planResult.rows[0] as Row | undefined;
    if (!row) return null;
    const groups = (groupResult.rows as Row[]).map(groupFromRow);
    const items = itemResult.rows as Row[];
    return { ...planFromRow(row), groups: groups.map(group => ({ ...group, items: items.filter(item => item.group_id === group.id).map(itemFromRow) })) };
  }

  async createPlan(projectId: string, input: AutomationPlanInput): Promise<AutomationPlan> {
    await this.pg.ready;
    const id = `automation-plan-${randomUUID()}`;
    const now = new Date().toISOString();
    const result = await this.pg.query(`INSERT INTO pm_automation_plans (id, project_id, name, description, sort_order, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$6) RETURNING *`, [id, projectId, requiredName(input.name, "自动化方案"), input.description ?? null, input.sortOrder ?? 0, now]);
    return planFromRow(result.rows[0] as Row);
  }

  async updatePlan(projectId: string, planId: string, input: Partial<AutomationPlanInput>): Promise<AutomationPlan | null> {
    const current = (await this.listPlans(projectId)).find(plan => plan.id === planId);
    if (!current) return null;
    const result = await this.pg.query(`UPDATE pm_automation_plans SET name=$1, description=$2, sort_order=$3, updated_at=$4 WHERE project_id=$5 AND id=$6 RETURNING *`, [
      input.name === undefined ? current.name : requiredName(input.name, "自动化方案"),
      input.description === undefined ? current.description ?? null : input.description,
      input.sortOrder ?? current.sortOrder,
      new Date().toISOString(), projectId, planId,
    ]);
    return result.rows[0] ? planFromRow(result.rows[0] as Row) : null;
  }

  async deletePlan(projectId: string, planId: string): Promise<boolean> {
    const result = await this.pg.query(`DELETE FROM pm_automation_plans WHERE project_id=$1 AND id=$2`, [projectId, planId]);
    return (result.rowCount ?? 0) > 0;
  }

  async createGroup(projectId: string, planId: string, input: AutomationGroupInput): Promise<AutomationGroup> {
    const id = `automation-group-${randomUUID()}`;
    const now = new Date().toISOString();
    const result = await this.pg.query(`INSERT INTO pm_automation_groups (id, project_id, plan_id, name, sort_order, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$6) RETURNING *`, [id, projectId, planId, requiredName(input.name, "执行分组"), input.sortOrder ?? 0, now]);
    return groupFromRow(result.rows[0] as Row);
  }

  async updateGroup(projectId: string, groupId: string, input: Partial<AutomationGroupInput>): Promise<AutomationGroup | null> {
    const currentResult = await this.pg.query(`SELECT * FROM pm_automation_groups WHERE project_id=$1 AND id=$2`, [projectId, groupId]);
    const currentRow = currentResult.rows[0] as Row | undefined;
    if (!currentRow) return null;
    const current = groupFromRow(currentRow);
    const result = await this.pg.query(`UPDATE pm_automation_groups SET name=$1, sort_order=$2, updated_at=$3 WHERE project_id=$4 AND id=$5 RETURNING *`, [
      input.name === undefined ? current.name : requiredName(input.name, "执行分组"), input.sortOrder ?? current.sortOrder, new Date().toISOString(), projectId, groupId,
    ]);
    return result.rows[0] ? groupFromRow(result.rows[0] as Row) : null;
  }

  async deleteGroup(projectId: string, groupId: string): Promise<boolean> {
    const result = await this.pg.query(`DELETE FROM pm_automation_groups WHERE project_id=$1 AND id=$2`, [projectId, groupId]);
    return (result.rowCount ?? 0) > 0;
  }

  async reorderGroups(projectId: string, planId: string, groupIds: string[]): Promise<void> {
    await Promise.all(groupIds.map((id, index) => this.pg.query(`UPDATE pm_automation_groups SET sort_order=$1, updated_at=$2 WHERE project_id=$3 AND plan_id=$4 AND id=$5`, [index, new Date().toISOString(), projectId, planId, id])));
  }

  async addItem(projectId: string, planId: string, groupId: string, input: AutomationItemInput): Promise<AutomationItem> {
    const id = `automation-item-${randomUUID()}`;
    const now = new Date().toISOString();
    await this.pg.query(`INSERT INTO pm_automation_items (id, project_id, plan_id, group_id, table_id, sort_order, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$7)`, [id, projectId, planId, groupId, input.tableId, input.sortOrder ?? 0, now]);
    const plan = await this.getPlan(projectId, planId);
    const item = plan?.groups.flatMap(group => group.items).find(candidate => candidate.id === id);
    if (!item) throw new Error("自动化表项创建失败");
    return item;
  }

  async removeItem(projectId: string, itemId: string): Promise<boolean> {
    const result = await this.pg.query(`DELETE FROM pm_automation_items WHERE project_id=$1 AND id=$2`, [projectId, itemId]);
    return (result.rowCount ?? 0) > 0;
  }

  async reorderItems(projectId: string, groupId: string, itemIds: string[]): Promise<void> {
    await Promise.all(itemIds.map((id, index) => this.pg.query(`UPDATE pm_automation_items SET sort_order=$1, updated_at=$2 WHERE project_id=$3 AND group_id=$4 AND id=$5`, [index, new Date().toISOString(), projectId, groupId, id])));
  }

  async createRun(plan: AutomationPlanDetail, runtimeParams: Record<string, unknown> = {}): Promise<AutomationRun> {
    await this.pg.ready;
    const now = new Date().toISOString();
    const run: AutomationRun = {
      id: `automation-run-${randomUUID()}`, projectId: plan.projectId, planId: plan.id, planName: plan.name,
      status: "running", startedAt: now, updatedAt: now,
      runtimeParams,
      items: plan.groups.flatMap(group => group.items.map(item => ({
        id: `automation-run-item-${randomUUID()}`, tableId: item.tableId, tableName: item.tableName,
        groupId: group.id, groupName: group.name, groupOrder: group.sortOrder, itemOrder: item.sortOrder,
        status: "pending" as const, steps: AUTOMATION_STEPS.map(step => ({ step, status: "pending" as const })),
      }))),
    };
    const client = await this.pg.connect();
    try {
      await client.query("BEGIN");
      await client.query(`INSERT INTO pm_automation_runs (id, project_id, plan_id, plan_name, status, runtime_params, started_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$7)`, [run.id, run.projectId, run.planId, run.planName, run.status, JSON.stringify(runtimeParams), now]);
      await insertRunItems(client.query.bind(client), run);
      await client.query("COMMIT");
      return run;
    } catch (errorValue) {
      await client.query("ROLLBACK");
      throw errorValue;
    } finally {
      client.release();
    }
  }

  async saveRun(run: AutomationRun): Promise<void> {
    await this.pg.ready;
    run.updatedAt = new Date().toISOString();
    const client = await this.pg.connect();
    try {
      await client.query("BEGIN");
      await client.query(`UPDATE pm_automation_runs SET status=$1, error=$2, finished_at=$3, runtime_params=$4::jsonb, updated_at=$5 WHERE project_id=$6 AND id=$7`, [run.status, run.error ?? null, run.finishedAt ?? null, JSON.stringify(run.runtimeParams ?? {}), run.updatedAt, run.projectId, run.id]);
      await client.query(`DELETE FROM pm_automation_run_items WHERE run_id=$1`, [run.id]);
      await insertRunItems(client.query.bind(client), run);
      await client.query("COMMIT");
    } catch (errorValue) {
      await client.query("ROLLBACK");
      throw errorValue;
    } finally {
      client.release();
    }
  }

  async getRun(projectId: string, runId: string): Promise<AutomationRun | null> {
    await this.pg.ready;
    const [runResult, itemResult] = await Promise.all([
      this.pg.query(`SELECT * FROM pm_automation_runs WHERE project_id=$1 AND id=$2`, [projectId, runId]),
      this.pg.query(`SELECT * FROM pm_automation_run_items WHERE run_id=$1 ORDER BY group_order, item_order`, [runId]),
    ]);
    const row = runResult.rows[0] as Row | undefined;
    return row ? runFromRows(row, itemResult.rows as Row[]) : null;
  }

  async listRuns(projectId: string, planId: string, limit = 20): Promise<AutomationRun[]> {
    await this.pg.ready;
    const result = await this.pg.query(`SELECT id FROM pm_automation_runs WHERE project_id=$1 AND plan_id=$2 ORDER BY started_at DESC LIMIT $3`, [projectId, planId, Math.max(1, Math.min(limit, 100))]);
    const runs = await Promise.all(result.rows.map(row => this.getRun(projectId, String(row.id))));
    return runs.filter((run): run is AutomationRun => Boolean(run));
  }
}

type Query = (text: string, values?: unknown[]) => Promise<unknown>;

async function insertRunItems(query: Query, run: AutomationRun): Promise<void> {
  for (const item of run.items) {
    await query(`INSERT INTO pm_automation_run_items
      (id, run_id, table_id, table_name, group_id, group_name, group_order, item_order, status, steps, affected_rows, failed_step, error, started_at, finished_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12,$13,$14,$15)`, [item.id, run.id, item.tableId, item.tableName, item.groupId, item.groupName, item.groupOrder, item.itemOrder, item.status, JSON.stringify(item.steps), item.affectedRows ?? null, item.failedStep ?? null, item.error ?? null, item.startedAt ?? null, item.finishedAt ?? null]);
  }
}

function requiredName(value: string, fallback: string): string { return value.trim() || fallback; }
function planFromRow(row: Row): AutomationPlan { return { id: String(row.id), projectId: String(row.project_id), name: String(row.name), description: row.description == null ? undefined : String(row.description), sortOrder: Number(row.sort_order), createdAt: String(row.created_at), updatedAt: String(row.updated_at) }; }
function groupFromRow(row: Row): AutomationGroup { return { id: String(row.id), projectId: String(row.project_id), planId: String(row.plan_id), name: String(row.name), sortOrder: Number(row.sort_order), createdAt: String(row.created_at), updatedAt: String(row.updated_at), items: [] }; }
function itemFromRow(row: Row): AutomationItem { return { id: String(row.id), projectId: String(row.project_id), planId: String(row.plan_id), groupId: String(row.group_id), tableId: String(row.table_id), tableName: String(row.table_name), tableCn: row.table_cn == null ? undefined : String(row.table_cn), systemId: row.system_id == null ? undefined : String(row.system_id), systemName: row.system_name == null ? undefined : String(row.system_name), sortOrder: Number(row.sort_order) }; }
function runFromRows(row: Row, itemRows: Row[]): AutomationRun {
  return { id: String(row.id), projectId: String(row.project_id), planId: String(row.plan_id), planName: String(row.plan_name), status: row.status as AutomationRun["status"], error: row.error == null ? undefined : String(row.error), startedAt: String(row.started_at), finishedAt: row.finished_at == null ? undefined : String(row.finished_at), updatedAt: String(row.updated_at), runtimeParams: parseObject(row.runtime_params), items: itemRows.map(item => ({ id: String(item.id), tableId: String(item.table_id), tableName: String(item.table_name), groupId: String(item.group_id), groupName: String(item.group_name), groupOrder: Number(item.group_order), itemOrder: Number(item.item_order), status: item.status as AutomationRunItem["status"], steps: parseSteps(item.steps), affectedRows: item.affected_rows == null ? undefined : Number(item.affected_rows), failedStep: item.failed_step == null ? undefined : item.failed_step as AutomationRunItem["failedStep"], error: item.error == null ? undefined : String(item.error), startedAt: item.started_at == null ? undefined : String(item.started_at), finishedAt: item.finished_at == null ? undefined : String(item.finished_at) })) };
}
function parseSteps(value: unknown): AutomationRunItem["steps"] { return (typeof value === "string" ? JSON.parse(value) : value) as AutomationRunItem["steps"]; }
function parseObject(value: unknown): Record<string, unknown> { const parsed = typeof value === "string" ? JSON.parse(value) : value; return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}; }
