import type Database from "better-sqlite3";
import type { MulticaBindingRepo, MulticaProjectBinding, MulticaTeamPlan } from "./MulticaBindingRepo.js";

interface BindingRow { binding_json: string }
interface PlanRow {
  id: string;
  rich_project_id: string;
  request_json: string;
  plan_json: string;
  status: MulticaTeamPlan["status"];
  created_at: string;
  applied_at: string | null;
  resolved_binding_json: string | null;
}

export class SqliteMulticaBindingRepo implements MulticaBindingRepo {
  constructor(private readonly db: Database.Database) {}

  getBinding(richProjectId: string): MulticaProjectBinding | null {
    const row = this.db.prepare("SELECT binding_json FROM multica_project_bindings WHERE rich_project_id = ?")
      .get(richProjectId) as BindingRow | undefined;
    return row ? JSON.parse(row.binding_json) as MulticaProjectBinding : null;
  }

  saveBinding(binding: MulticaProjectBinding): void {
    this.db.prepare(`INSERT INTO multica_project_bindings (rich_project_id, binding_json, created_at, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(rich_project_id) DO UPDATE SET binding_json = excluded.binding_json, updated_at = excluded.updated_at`
    ).run(binding.richProjectId, JSON.stringify(binding), binding.createdAt, binding.updatedAt);
  }

  createPlan(plan: MulticaTeamPlan): void {
    this.db.prepare(`INSERT INTO multica_team_plans
      (id, rich_project_id, request_json, plan_json, status, created_at, applied_at, resolved_binding_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(plan.id, plan.richProjectId, JSON.stringify(plan.request), JSON.stringify(plan.definition), plan.status,
      plan.createdAt, plan.appliedAt ?? null, plan.resolvedBinding ? JSON.stringify(plan.resolvedBinding) : null);
  }

  getPlan(planId: string): MulticaTeamPlan | null {
    const row = this.db.prepare(`SELECT id, rich_project_id, request_json, plan_json, status, created_at,
      applied_at, resolved_binding_json FROM multica_team_plans WHERE id = ?`).get(planId) as PlanRow | undefined;
    return row ? hydratePlan(row) : null;
  }

  markPlanApplied(planId: string, binding: MulticaProjectBinding, appliedAt: string): void {
    const apply = this.db.transaction(() => {
      this.saveBinding(binding);
      const result = this.db.prepare(`UPDATE multica_team_plans SET status = 'applied', applied_at = ?,
        resolved_binding_json = ? WHERE id = ?`).run(appliedAt, JSON.stringify(binding), planId);
      if (result.changes !== 1) throw new Error(`Multica team plan ${planId} was not found.`);
    });
    apply();
  }
}

function hydratePlan(row: PlanRow): MulticaTeamPlan {
  return {
    id: row.id,
    richProjectId: row.rich_project_id,
    request: JSON.parse(row.request_json),
    definition: JSON.parse(row.plan_json),
    status: row.status,
    createdAt: row.created_at,
    ...(row.applied_at ? { appliedAt: row.applied_at } : {}),
    ...(row.resolved_binding_json ? { resolvedBinding: JSON.parse(row.resolved_binding_json) } : {}),
  };
}
