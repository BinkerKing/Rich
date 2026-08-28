import type { PgPool } from "../../../db/postgres.js";
import type { MulticaBindingRepo, MulticaProjectBinding, MulticaTeamPlan } from "./MulticaBindingRepo.js";

interface BindingRow { binding_json: unknown }
interface PlanRow {
  id: string;
  rich_project_id: string;
  request_json: unknown;
  plan_json: unknown;
  status: MulticaTeamPlan["status"];
  created_at: string;
  applied_at: string | null;
  resolved_binding_json: unknown | null;
}

export class PostgresMulticaBindingRepo implements MulticaBindingRepo {
  constructor(private readonly pg: PgPool) {}

  async getBinding(richProjectId: string): Promise<MulticaProjectBinding | null> {
    await this.pg.ready;
    const result = await this.pg.query<BindingRow>("SELECT binding_json FROM multica_project_bindings WHERE rich_project_id = $1", [richProjectId]);
    return result.rows[0] ? parseJson(result.rows[0].binding_json) as MulticaProjectBinding : null;
  }

  async saveBinding(binding: MulticaProjectBinding): Promise<void> {
    await this.pg.ready;
    await this.pg.query(`INSERT INTO multica_project_bindings (rich_project_id, binding_json, created_at, updated_at)
      VALUES ($1, $2::jsonb, $3, $4)
      ON CONFLICT(rich_project_id) DO UPDATE SET binding_json = excluded.binding_json, updated_at = excluded.updated_at`,
    [binding.richProjectId, JSON.stringify(binding), binding.createdAt, binding.updatedAt]);
  }

  async createPlan(plan: MulticaTeamPlan): Promise<void> {
    await this.pg.ready;
    await this.pg.query(`INSERT INTO multica_team_plans
      (id, rich_project_id, request_json, plan_json, status, created_at, applied_at, resolved_binding_json)
      VALUES ($1, $2, $3::jsonb, $4::jsonb, $5, $6, $7, $8::jsonb)`,
    [plan.id, plan.richProjectId, JSON.stringify(plan.request), JSON.stringify(plan.definition), plan.status,
      plan.createdAt, plan.appliedAt ?? null, plan.resolvedBinding ? JSON.stringify(plan.resolvedBinding) : null]);
  }

  async getPlan(planId: string): Promise<MulticaTeamPlan | null> {
    await this.pg.ready;
    const result = await this.pg.query<PlanRow>(`SELECT id, rich_project_id, request_json, plan_json, status,
      created_at, applied_at, resolved_binding_json FROM multica_team_plans WHERE id = $1`, [planId]);
    const row = result.rows[0];
    return row ? {
      id: row.id,
      richProjectId: row.rich_project_id,
      request: parseJson(row.request_json),
      definition: parseJson(row.plan_json),
      status: row.status,
      createdAt: row.created_at,
      ...(row.applied_at ? { appliedAt: row.applied_at } : {}),
      ...(row.resolved_binding_json ? { resolvedBinding: parseJson(row.resolved_binding_json) } : {}),
    } as MulticaTeamPlan : null;
  }

  async markPlanApplied(planId: string, binding: MulticaProjectBinding, appliedAt: string): Promise<void> {
    await this.pg.ready;
    const client = await this.pg.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`INSERT INTO multica_project_bindings (rich_project_id, binding_json, created_at, updated_at)
        VALUES ($1, $2::jsonb, $3, $4)
        ON CONFLICT(rich_project_id) DO UPDATE SET binding_json = excluded.binding_json, updated_at = excluded.updated_at`,
      [binding.richProjectId, JSON.stringify(binding), binding.createdAt, binding.updatedAt]);
      const result = await client.query(`UPDATE multica_team_plans SET status = 'applied', applied_at = $1,
        resolved_binding_json = $2::jsonb WHERE id = $3`, [appliedAt, JSON.stringify(binding), planId]);
      if ((result.rowCount ?? 0) !== 1) throw new Error(`Multica team plan ${planId} was not found.`);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}

function parseJson<T = any>(value: unknown): T {
  return (typeof value === "string" ? JSON.parse(value) : value) as T;
}
