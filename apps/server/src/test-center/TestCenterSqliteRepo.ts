import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import type { TestCaseType, TestCenterCase, TestCenterCaseComment, TestCenterCaseStep, TestCenterEvidence, TestCenterGroup, TestCenterIssue, TestCenterIssueDiscussion, TestCenterReport, TestCenterRun, TestCenterRunStep, TestCenterTask, TestRunStatus } from "../repos/ProjectManagementRepo.js";

type CreateCaseInput = Pick<TestCenterCase, "projectId" | "code" | "title" | "objective" | "type" | "priority" | "scenario"> & { taskId?: string; groupId?: string };

function now() { return new Date().toISOString(); }

export class TestCenterSqliteRepo {
  constructor(private readonly db: Database.Database) { this.migrateLegacyScenarios(); }

  async createTask(input: Pick<TestCenterTask, "projectId" | "title" | "objective">): Promise<TestCenterTask> {
    const id = `pm-test-task-${randomUUID()}`;
    const createdAt = now();
    const sortOrder = this.nextOrder("pm_test_tasks", "project_id=?", [input.projectId]);
    this.db.prepare(`INSERT INTO pm_test_tasks (id, project_id, title, objective, test_data, test_links, app_version, status, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, '', '', '', 'draft', ?, ?, ?)`)
      .run(id, input.projectId, input.title, input.objective, sortOrder, createdAt, createdAt);
    return { id, projectId: input.projectId, title: input.title, objective: input.objective, testData: "", testLinks: "", appVersion: "", status: "draft", sortOrder, createdAt, updatedAt: createdAt };
  }

  async listTasks(projectId: string): Promise<TestCenterTask[]> {
    return (this.db.prepare(`SELECT id, project_id, title, objective, test_data, test_links, app_version, status, sort_order, created_at, updated_at FROM pm_test_tasks WHERE project_id=? ORDER BY sort_order ASC, rowid ASC`).all(projectId) as TaskRow[]).map(taskFromRow);
  }

  async updateTaskDetails(input: Pick<TestCenterTask, "projectId" | "id" | "objective" | "testData" | "testLinks" | "appVersion">): Promise<TestCenterTask | null> {
    const updatedAt = now();
    const result = this.db.prepare(`UPDATE pm_test_tasks SET objective=?, test_data=?, test_links=?, app_version=?, updated_at=? WHERE project_id=? AND id=?`)
      .run(input.objective, input.testData, input.testLinks, input.appVersion, updatedAt, input.projectId, input.id);
    if (!result.changes) return null;
    const row = this.db.prepare(`SELECT id, project_id, title, objective, test_data, test_links, app_version, status, sort_order, created_at, updated_at FROM pm_test_tasks WHERE project_id=? AND id=?`).get(input.projectId, input.id) as TaskRow;
    return taskFromRow(row);
  }

  async deleteTask(projectId: string, taskId: string): Promise<boolean> {
    this.requireTask(projectId, taskId);
    this.db.transaction(() => {
      this.db.prepare(`DELETE FROM pm_test_cases WHERE project_id=? AND task_id=?`).run(projectId, taskId);
      this.db.prepare(`DELETE FROM pm_test_tasks WHERE project_id=? AND id=?`).run(projectId, taskId);
    })();
    return true;
  }

  async moveTask(input: { projectId: string; taskId: string; beforeTaskId?: string | null }): Promise<void> {
    this.requireTask(input.projectId, input.taskId);
    if (input.beforeTaskId) this.requireTask(input.projectId, input.beforeTaskId);
    this.reorder("pm_test_tasks", "project_id=?", [input.projectId], input.taskId, input.beforeTaskId ?? null);
  }

  async createGroup(input: Pick<TestCenterGroup, "projectId" | "taskId" | "title"> & { parentGroupId?: string }): Promise<TestCenterGroup> {
    this.requireTask(input.projectId, input.taskId);
    if (input.parentGroupId) this.requireGroup(input.projectId, input.parentGroupId, input.taskId);
    const id = `pm-test-group-${randomUUID()}`;
    const createdAt = now();
    const sortOrder = this.nextOrder("pm_test_groups", "project_id=? AND task_id=? AND parent_group_id IS ?", [input.projectId, input.taskId, input.parentGroupId ?? null]);
    this.db.prepare(`INSERT INTO pm_test_groups (id, project_id, task_id, parent_group_id, title, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, input.projectId, input.taskId, input.parentGroupId ?? null, input.title, sortOrder, createdAt, createdAt);
    return { id, projectId: input.projectId, taskId: input.taskId, parentGroupId: input.parentGroupId, title: input.title, sortOrder, createdAt, updatedAt: createdAt };
  }

  async listGroups(projectId: string): Promise<TestCenterGroup[]> {
    return (this.db.prepare(`SELECT id, project_id, task_id, parent_group_id, title, sort_order, created_at, updated_at FROM pm_test_groups WHERE project_id=? ORDER BY task_id ASC, parent_group_id ASC, sort_order ASC, rowid ASC`).all(projectId) as GroupRow[]).map(groupFromRow);
  }

  async deleteGroup(input: { projectId: string; groupId: string }): Promise<boolean> {
    const group = this.getGroup(input.projectId, input.groupId);
    if (!group) return false;
    this.db.transaction(() => {
      const descendants = this.db.prepare(`WITH RECURSIVE tree(id) AS (SELECT id FROM pm_test_groups WHERE project_id=? AND id=? UNION ALL SELECT child.id FROM pm_test_groups child JOIN tree ON child.parent_group_id=tree.id WHERE child.project_id=?) SELECT id FROM tree`).all(input.projectId, group.id, input.projectId) as Array<{ id: string }>;
      const ids = descendants.map(item => item.id);
      const marks = ids.map(() => "?").join(",");
      this.db.prepare(`DELETE FROM pm_test_cases WHERE project_id=? AND group_id IN (${marks})`).run(input.projectId, ...ids);
      this.db.prepare(`DELETE FROM pm_test_groups WHERE project_id=? AND id IN (${marks})`).run(input.projectId, ...ids);
    })();
    return true;
  }

  async moveGroup(input: { projectId: string; groupId: string; parentGroupId?: string | null; beforeGroupId?: string | null }): Promise<void> {
    const group = this.getGroup(input.projectId, input.groupId);
    if (!group) throw new Error("test group not found");
    const parentGroupId = input.parentGroupId ?? null;
    if (parentGroupId) {
      const parent = this.getGroup(input.projectId, parentGroupId);
      if (!parent || parent.taskId !== group.taskId) throw new Error("test group parent not found");
      for (let cursor: TestCenterGroup | null = parent; cursor; cursor = cursor.parentGroupId ? this.getGroup(input.projectId, cursor.parentGroupId) : null) {
        if (cursor.id === group.id) throw new Error("test group cannot contain itself");
      }
    }
    if (input.beforeGroupId) {
      const before = this.getGroup(input.projectId, input.beforeGroupId);
      if (!before || before.taskId !== group.taskId || (before.parentGroupId ?? null) !== parentGroupId) throw new Error("test group target not found");
    }
    this.db.prepare(`UPDATE pm_test_groups SET parent_group_id=?, updated_at=? WHERE project_id=? AND id=?`).run(parentGroupId, now(), input.projectId, group.id);
    this.reorder("pm_test_groups", "project_id=? AND task_id=? AND parent_group_id IS ?", [input.projectId, group.taskId, parentGroupId], group.id, input.beforeGroupId ?? null);
  }

  async createCase(input: CreateCaseInput): Promise<TestCenterCase> {
    if (input.taskId) this.requireTask(input.projectId, input.taskId);
    const group = input.groupId ? this.getGroup(input.projectId, input.groupId) : null;
    if (input.groupId && !group) throw new Error("test group not found");
    const taskId = group?.taskId ?? input.taskId;
    const id = `pm-test-case-${randomUUID()}`;
    const createdAt = now();
    const sortOrder = this.nextOrder("pm_test_cases", "project_id=? AND task_id IS ? AND group_id IS ?", [input.projectId, taskId ?? null, input.groupId ?? null]);
    const scenario = input.scenario ?? "";
    this.db.prepare(`INSERT INTO pm_test_cases (id, project_id, task_id, group_id, scenario, code, title, objective, type, priority, status, sort_order, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?)`).run(id, input.projectId, taskId ?? null, input.groupId ?? null, scenario, input.code, input.title, input.objective, input.type, input.priority, sortOrder, createdAt, createdAt);
    return { id, projectId: input.projectId, taskId, groupId: input.groupId, scenario, code: input.code, title: input.title, objective: input.objective, type: input.type as TestCaseType, priority: input.priority, status: "draft", sortOrder, createdAt, updatedAt: createdAt };
  }

  async listCases(projectId: string): Promise<TestCenterCase[]> {
    return (this.db.prepare(`SELECT id, project_id, task_id, group_id, scenario, code, title, objective, type, priority, status, sort_order, created_at, updated_at FROM pm_test_cases WHERE project_id=? ORDER BY task_id ASC, group_id ASC, sort_order ASC, rowid ASC`).all(projectId) as CaseRow[]).map(caseFromRow);
  }

  async moveCase(input: { projectId: string; caseId: string; taskId?: string | null; groupId?: string | null; beforeCaseId?: string | null }): Promise<void> {
    this.requireCase(input.projectId, input.caseId);
    const group = input.groupId ? this.getGroup(input.projectId, input.groupId) : null;
    if (input.groupId && !group) throw new Error("test group not found");
    const taskId = group?.taskId ?? input.taskId ?? null;
    if (taskId) this.requireTask(input.projectId, taskId);
    if (input.beforeCaseId) {
      const before = this.getCase(input.projectId, input.beforeCaseId);
      if (!before || (before.taskId ?? null) !== taskId || (before.groupId ?? null) !== (input.groupId ?? null)) throw new Error("test case target not found");
    }
    this.db.prepare(`UPDATE pm_test_cases SET task_id=?, group_id=?, updated_at=? WHERE project_id=? AND id=?`).run(taskId, input.groupId ?? null, now(), input.projectId, input.caseId);
    this.reorder("pm_test_cases", "project_id=? AND task_id IS ? AND group_id IS ?", [input.projectId, taskId, input.groupId ?? null], input.caseId, input.beforeCaseId ?? null);
  }

  async startRun(input: { projectId: string; caseId: string }): Promise<TestCenterRun> {
    this.requireCase(input.projectId, input.caseId);
    const id = `pm-test-run-${randomUUID()}`;
    const startedAt = now();
    const write = this.db.transaction(() => {
      this.db.prepare(`INSERT INTO pm_test_runs (id, project_id, case_id, status, actual_result, started_at, created_at)
        VALUES (?, ?, ?, 'testing', '', ?, ?)`).run(id, input.projectId, input.caseId, startedAt, startedAt);
      this.db.prepare(`UPDATE pm_test_cases SET status='testing', updated_at=? WHERE project_id=? AND id=?`).run(startedAt, input.projectId, input.caseId);
      const steps = this.db.prepare(`SELECT id, step_order, instruction, expected_result FROM pm_test_case_steps WHERE project_id=? AND case_id=? ORDER BY step_order ASC, rowid ASC`).all(input.projectId, input.caseId) as CaseStepSnapshotRow[];
      const insertStep = this.db.prepare(`INSERT INTO pm_test_run_steps (id, project_id, run_id, case_step_id, step_order, instruction, expected_result, status, actual_result, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', '', ?, ?)`);
      for (const step of steps) insertStep.run(`pm-test-run-step-${randomUUID()}`, input.projectId, id, step.id, step.step_order, step.instruction, step.expected_result, startedAt, startedAt);
    });
    write();
    return { id, projectId: input.projectId, caseId: input.caseId, status: "testing", actualResult: "", startedAt, createdAt: startedAt };
  }

  async finishRun(input: { projectId: string; runId: string; status: Exclude<TestRunStatus, "testing">; actualResult: string }): Promise<TestCenterRun | null> {
    const finishedAt = now();
    const run = this.getRun(input.projectId, input.runId);
    if (!run) return null;
    this.db.transaction(() => {
      this.db.prepare(`UPDATE pm_test_runs SET status=?, actual_result=?, finished_at=? WHERE project_id=? AND id=?`).run(input.status, input.actualResult, finishedAt, input.projectId, input.runId);
      this.db.prepare(`UPDATE pm_test_cases SET status=?, updated_at=? WHERE project_id=? AND id=?`).run(input.status, finishedAt, input.projectId, run.caseId);
    })();
    return this.getRun(input.projectId, input.runId);
  }

  async listRuns(projectId: string, caseId: string): Promise<TestCenterRun[]> {
    return (this.db.prepare(`SELECT id, project_id, case_id, status, actual_result, started_at, finished_at, created_at FROM pm_test_runs WHERE project_id=? AND case_id=? ORDER BY created_at DESC, rowid DESC`).all(projectId, caseId) as RunRow[]).map(runFromRow);
  }

  async listProjectRuns(projectId: string): Promise<TestCenterRun[]> {
    return (this.db.prepare(`SELECT id, project_id, case_id, status, actual_result, started_at, finished_at, created_at FROM pm_test_runs WHERE project_id=? ORDER BY created_at DESC, rowid DESC`).all(projectId) as RunRow[]).map(runFromRow);
  }

  async addCaseStep(input: Pick<TestCenterCaseStep, "projectId" | "caseId" | "stepOrder" | "instruction" | "expectedResult">): Promise<TestCenterCaseStep> {
    this.requireCase(input.projectId, input.caseId);
    const id = `pm-test-case-step-${randomUUID()}`;
    const createdAt = now();
    this.db.prepare(`INSERT INTO pm_test_case_steps (id, project_id, case_id, step_order, instruction, expected_result, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(id, input.projectId, input.caseId, input.stepOrder, input.instruction, input.expectedResult, createdAt, createdAt);
    return { id, projectId: input.projectId, caseId: input.caseId, stepOrder: input.stepOrder, instruction: input.instruction, expectedResult: input.expectedResult, createdAt, updatedAt: createdAt };
  }

  async listCaseSteps(projectId: string, caseId: string): Promise<TestCenterCaseStep[]> {
    return (this.db.prepare(`SELECT id, project_id, case_id, step_order, instruction, expected_result, created_at, updated_at FROM pm_test_case_steps WHERE project_id=? AND case_id=? ORDER BY step_order ASC, rowid ASC`).all(projectId, caseId) as CaseStepRow[]).map(caseStepFromRow);
  }

  async listRunSteps(projectId: string, runId: string): Promise<TestCenterRunStep[]> {
    return (this.db.prepare(`SELECT id, project_id, run_id, case_step_id, step_order, instruction, expected_result, status, actual_result, created_at, updated_at FROM pm_test_run_steps WHERE project_id=? AND run_id=? ORDER BY step_order ASC, rowid ASC`).all(projectId, runId) as RunStepRow[]).map(runStepFromRow);
  }

  async finishRunStep(input: { projectId: string; runStepId: string; status: Exclude<TestCenterRunStep["status"], "pending">; actualResult: string }): Promise<TestCenterRunStep | null> {
    const updatedAt = now();
    const result = this.db.prepare(`UPDATE pm_test_run_steps SET status=?, actual_result=?, updated_at=? WHERE project_id=? AND id=?`)
      .run(input.status, input.actualResult, updatedAt, input.projectId, input.runStepId);
    if (!result.changes) return null;
    const row = this.db.prepare(`SELECT id, project_id, run_id, case_step_id, step_order, instruction, expected_result, status, actual_result, created_at, updated_at FROM pm_test_run_steps WHERE project_id=? AND id=?`)
      .get(input.projectId, input.runStepId) as RunStepRow;
    return runStepFromRow(row);
  }

  async addEvidence(input: Pick<TestCenterEvidence, "projectId" | "runId" | "title" | "kind" | "location"> & { runStepId?: string }): Promise<TestCenterEvidence> {
    this.requireRun(input.projectId, input.runId);
    if (input.runStepId) this.requireRunStepForRun(input.projectId, input.runStepId, input.runId);
    const id = `pm-test-evidence-${randomUUID()}`;
    const createdAt = now();
    this.db.prepare(`INSERT INTO pm_test_evidence (id, project_id, run_id, run_step_id, title, kind, location, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(id, input.projectId, input.runId, input.runStepId ?? null, input.title, input.kind, input.location, createdAt);
    return { id, projectId: input.projectId, runId: input.runId, runStepId: input.runStepId, title: input.title, kind: input.kind, location: input.location, createdAt };
  }

  async listEvidence(projectId: string, runId: string): Promise<TestCenterEvidence[]> {
    return (this.db.prepare(`SELECT id, project_id, run_id, run_step_id, title, kind, location, created_at FROM pm_test_evidence WHERE project_id=? AND run_id=? ORDER BY created_at DESC, rowid DESC`).all(projectId, runId) as EvidenceRow[]).map(evidenceFromRow);
  }

  async createIssue(input: Pick<TestCenterIssue, "projectId" | "caseId" | "title" | "description"> & { runId?: string; owner?: string; externalRef?: string; customFields?: Record<string, string> }): Promise<TestCenterIssue> {
    this.requireCase(input.projectId, input.caseId);
    if (input.runId) this.requireRunForCase(input.projectId, input.runId, input.caseId);
    const id = `pm-test-issue-${randomUUID()}`;
    const createdAt = now();
    const customFields = input.customFields ?? {};
    const sortOrder = this.nextOrder("pm_test_issues", "project_id=?", [input.projectId]);
    this.db.prepare(`INSERT INTO pm_test_issues (id, project_id, case_id, run_id, title, description, owner, external_ref, custom_fields, status, sort_order, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '', ?, ?, ?)`).run(id, input.projectId, input.caseId, input.runId ?? null, input.title, input.description, input.owner ?? null, input.externalRef ?? null, JSON.stringify(customFields), sortOrder, createdAt, createdAt);
    return { id, projectId: input.projectId, caseId: input.caseId, runId: input.runId, title: input.title, description: input.description, owner: input.owner, externalRef: input.externalRef, customFields, status: "", sortOrder, createdAt, updatedAt: createdAt };
  }

  async listIssues(projectId: string): Promise<TestCenterIssue[]> {
    return (this.db.prepare(`SELECT id, project_id, case_id, run_id, title, description, owner, external_ref, custom_fields, status, sort_order, created_at, updated_at FROM pm_test_issues WHERE project_id=? ORDER BY sort_order ASC, rowid ASC`).all(projectId) as IssueRow[]).map(issueFromRow);
  }

  async updateIssue(input: { projectId: string; issueId: string; title?: string; description?: string; status?: TestCenterIssue["status"]; owner?: string | null; externalRef?: string | null; customFields?: Record<string, string> }): Promise<TestCenterIssue | null> {
    const issue = this.getIssue(input.projectId, input.issueId);
    if (!issue) return null;
    const updatedAt = now();
    const next = { title: input.title ?? issue.title, description: input.description ?? issue.description, status: input.status ?? issue.status, owner: input.owner === undefined ? issue.owner : input.owner ?? undefined, externalRef: input.externalRef === undefined ? issue.externalRef : input.externalRef ?? undefined, customFields: input.customFields ?? issue.customFields };
    this.db.prepare(`UPDATE pm_test_issues SET title=?, description=?, status=?, owner=?, external_ref=?, custom_fields=?, updated_at=? WHERE project_id=? AND id=?`)
      .run(next.title, next.description, next.status, next.owner ?? null, next.externalRef ?? null, JSON.stringify(next.customFields), updatedAt, input.projectId, input.issueId);
    return this.getIssue(input.projectId, input.issueId);
  }

  async deleteIssue(projectId: string, issueId: string): Promise<boolean> {
    return this.db.prepare(`DELETE FROM pm_test_issues WHERE project_id=? AND id=?`).run(projectId, issueId).changes > 0;
  }

  async reorderIssues(projectId: string, issueIds: string[]): Promise<boolean> {
    const currentIds = (this.db.prepare(`SELECT id FROM pm_test_issues WHERE project_id=? ORDER BY sort_order ASC, rowid ASC`).all(projectId) as Array<{ id: string }>).map(row => row.id);
    if (currentIds.length !== issueIds.length || currentIds.some(id => !issueIds.includes(id))) return false;
    this.db.transaction(() => {
      const update = this.db.prepare(`UPDATE pm_test_issues SET sort_order=? WHERE project_id=? AND id=?`);
      issueIds.forEach((id, index) => update.run(index + 1, projectId, id));
    })();
    return true;
  }

  async getGridSettings(projectId: string, gridKey: string): Promise<{ columns: unknown[]; style?: unknown }> {
    const row = this.db.prepare(`SELECT columns_json FROM pm_test_grid_settings WHERE project_id=? AND grid_key=?`).get(projectId, gridKey) as { columns_json: string } | undefined;
    try { const saved = row ? JSON.parse(row.columns_json) as unknown : []; return Array.isArray(saved) ? { columns: saved } : saved as { columns: unknown[]; style?: unknown }; } catch { return { columns: [] }; }
  }

  async listGridSettings(projectId: string, prefix: string): Promise<Array<{ key: string; columns: unknown[] }>> {
    const rows = this.db.prepare(`SELECT grid_key, columns_json FROM pm_test_grid_settings WHERE project_id=? AND grid_key LIKE ? ORDER BY grid_key ASC`).all(projectId, `${prefix}%`) as Array<{ grid_key: string; columns_json: string }>;
    return rows.map(row => {
      try { const saved = JSON.parse(row.columns_json) as unknown; return { key: row.grid_key, columns: Array.isArray(saved) ? saved : (saved as { columns?: unknown[] }).columns ?? [] }; } catch { return { key: row.grid_key, columns: [] }; }
    });
  }

  async saveGridSettings(projectId: string, gridKey: string, columns: unknown[], style?: unknown): Promise<{ columns: unknown[]; style?: unknown }> {
    this.db.prepare(`INSERT INTO pm_test_grid_settings (project_id, grid_key, columns_json, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(project_id, grid_key) DO UPDATE SET columns_json=excluded.columns_json, updated_at=excluded.updated_at`)
      .run(projectId, gridKey, JSON.stringify({ columns, style }), now());
    return { columns, style };
  }

  async startRetestFromIssue(input: { projectId: string; issueId: string }): Promise<TestCenterRun> {
    const issue = this.getIssue(input.projectId, input.issueId);
    if (!issue) throw new Error("test issue not found");
    if (issue.status !== "fixed") throw new Error("only fixed issue can start retest");
    const run = await this.startRun({ projectId: input.projectId, caseId: issue.caseId });
    this.db.prepare(`UPDATE pm_test_issues SET status='retest', updated_at=? WHERE project_id=? AND id=?`).run(now(), input.projectId, input.issueId);
    return run;
  }

  async addIssueDiscussion(input: Pick<TestCenterIssueDiscussion, "projectId" | "issueId" | "content">): Promise<TestCenterIssueDiscussion> {
    this.requireIssue(input.projectId, input.issueId);
    const id = `pm-test-discussion-${randomUUID()}`;
    const createdAt = now();
    this.db.prepare(`INSERT INTO pm_test_issue_discussions (id, project_id, issue_id, content, created_at) VALUES (?, ?, ?, ?, ?)`)
      .run(id, input.projectId, input.issueId, input.content, createdAt);
    return { id, projectId: input.projectId, issueId: input.issueId, content: input.content, createdAt };
  }

  async listIssueDiscussions(projectId: string, issueId: string): Promise<TestCenterIssueDiscussion[]> {
    return (this.db.prepare(`SELECT id, project_id, issue_id, content, created_at FROM pm_test_issue_discussions WHERE project_id=? AND issue_id=? ORDER BY created_at ASC, rowid ASC`).all(projectId, issueId) as DiscussionRow[]).map(discussionFromRow);
  }

  async addCaseComment(input: Pick<TestCenterCaseComment, "projectId" | "caseId" | "content">): Promise<TestCenterCaseComment> {
    this.requireCase(input.projectId, input.caseId);
    const id = `pm-test-case-comment-${randomUUID()}`;
    const createdAt = now();
    this.db.prepare(`INSERT INTO pm_test_case_comments (id, project_id, case_id, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
      .run(id, input.projectId, input.caseId, input.content, createdAt, createdAt);
    return { id, projectId: input.projectId, caseId: input.caseId, content: input.content, createdAt, updatedAt: createdAt };
  }

  async listCaseComments(projectId: string, caseId: string): Promise<TestCenterCaseComment[]> {
    return (this.db.prepare(`SELECT id, project_id, case_id, content, created_at, updated_at FROM pm_test_case_comments WHERE project_id=? AND case_id=? ORDER BY created_at ASC, rowid ASC`).all(projectId, caseId) as CaseCommentRow[]).map(caseCommentFromRow);
  }

  async updateCaseComment(input: Pick<TestCenterCaseComment, "projectId" | "id" | "content">): Promise<TestCenterCaseComment | null> {
    const updatedAt = now();
    const result = this.db.prepare(`UPDATE pm_test_case_comments SET content=?, updated_at=? WHERE project_id=? AND id=?`)
      .run(input.content, updatedAt, input.projectId, input.id);
    if (!result.changes) return null;
    const row = this.db.prepare(`SELECT id, project_id, case_id, content, created_at, updated_at FROM pm_test_case_comments WHERE project_id=? AND id=?`)
      .get(input.projectId, input.id) as CaseCommentRow;
    return caseCommentFromRow(row);
  }

  async deleteCaseComment(projectId: string, id: string): Promise<boolean> {
    return Boolean(this.db.prepare(`DELETE FROM pm_test_case_comments WHERE project_id=? AND id=?`).run(projectId, id).changes);
  }

  async getReport(projectId: string): Promise<TestCenterReport> {
    const caseCounts = this.statusCounts(`SELECT status, COUNT(*) AS count FROM pm_test_cases WHERE project_id=? GROUP BY status`, projectId);
    const issueCounts = this.statusCounts(`SELECT status, COUNT(*) AS count FROM pm_test_issues WHERE project_id=? GROUP BY status`, projectId);
    const passedCases = caseCounts.passed ?? 0;
    const concludedCases = passedCases + (caseCounts.failed ?? 0) + (caseCounts.blocked ?? 0) + (caseCounts.retest ?? 0);
    return {
      totalCases: Object.values(caseCounts).reduce((sum, value) => sum + value, 0),
      draftCases: caseCounts.draft ?? 0,
      readyCases: caseCounts.ready ?? 0,
      testingCases: caseCounts.testing ?? 0,
      passedCases,
      failedCases: caseCounts.failed ?? 0,
      blockedCases: caseCounts.blocked ?? 0,
      retestCases: caseCounts.retest ?? 0,
      openIssues: issueCounts.open ?? 0,
      fixedIssues: issueCounts.fixed ?? 0,
      retestIssues: issueCounts.retest ?? 0,
      passRate: concludedCases ? Math.round((passedCases / concludedCases) * 10000) / 100 : 0,
    };
  }

  private getRun(projectId: string, runId: string): TestCenterRun | null {
    const row = this.db.prepare(`SELECT id, project_id, case_id, status, actual_result, started_at, finished_at, created_at FROM pm_test_runs WHERE project_id=? AND id=?`).get(projectId, runId) as RunRow | undefined;
    return row ? runFromRow(row) : null;
  }

  private requireCase(projectId: string, caseId: string) {
    if (!this.db.prepare(`SELECT 1 FROM pm_test_cases WHERE project_id=? AND id=?`).get(projectId, caseId)) throw new Error("test case not found");
  }

  private requireTask(projectId: string, taskId: string) {
    if (!this.db.prepare(`SELECT 1 FROM pm_test_tasks WHERE project_id=? AND id=?`).get(projectId, taskId)) throw new Error("test task not found");
  }

  private getCase(projectId: string, caseId: string): TestCenterCase | null {
    const row = this.db.prepare(`SELECT id, project_id, task_id, group_id, scenario, code, title, objective, type, priority, status, sort_order, created_at, updated_at FROM pm_test_cases WHERE project_id=? AND id=?`).get(projectId, caseId) as CaseRow | undefined;
    return row ? caseFromRow(row) : null;
  }

  private getGroup(projectId: string, groupId: string): TestCenterGroup | null {
    const row = this.db.prepare(`SELECT id, project_id, task_id, parent_group_id, title, sort_order, created_at, updated_at FROM pm_test_groups WHERE project_id=? AND id=?`).get(projectId, groupId) as GroupRow | undefined;
    return row ? groupFromRow(row) : null;
  }

  private requireGroup(projectId: string, groupId: string, taskId?: string) {
    const group = this.getGroup(projectId, groupId);
    if (!group || (taskId && group.taskId !== taskId)) throw new Error("test group not found");
  }

  private nextOrder(table: "pm_test_tasks" | "pm_test_groups" | "pm_test_cases" | "pm_test_issues", where: string, values: unknown[]): number {
    const row = this.db.prepare(`SELECT COALESCE(MAX(sort_order), 0) AS value FROM ${table} WHERE ${where}`).get(...values) as { value: number };
    return Number(row.value) + 1;
  }

  private reorder(table: "pm_test_tasks" | "pm_test_groups" | "pm_test_cases", where: string, values: unknown[], itemId: string, beforeId: string | null) {
    const rows = this.db.prepare(`SELECT id FROM ${table} WHERE ${where} ORDER BY sort_order ASC, rowid ASC`).all(...values) as Array<{ id: string }>;
    const ids = rows.map(row => row.id).filter(id => id !== itemId);
    const at = beforeId ? Math.max(0, ids.indexOf(beforeId)) : ids.length;
    ids.splice(at, 0, itemId);
    const update = this.db.prepare(`UPDATE ${table} SET sort_order=?, updated_at=? WHERE id=?`);
    const updatedAt = now();
    this.db.transaction(() => ids.forEach((id, index) => update.run(index + 1, updatedAt, id)))();
  }

  private migrateLegacyScenarios() {
    const legacy = this.db.prepare(`SELECT project_id, task_id, scenario FROM pm_test_cases WHERE task_id IS NOT NULL AND group_id IS NULL AND scenario <> '' GROUP BY project_id, task_id, scenario ORDER BY MIN(rowid)`).all() as Array<{ project_id: string; task_id: string; scenario: string }>;
    const migrate = this.db.transaction(() => {
      for (const row of legacy) {
        const createdAt = now();
        const id = `pm-test-group-${randomUUID()}`;
        const sortOrder = this.nextOrder("pm_test_groups", "project_id=? AND task_id=? AND parent_group_id IS NULL", [row.project_id, row.task_id]);
        this.db.prepare(`INSERT INTO pm_test_groups (id, project_id, task_id, parent_group_id, title, sort_order, created_at, updated_at) VALUES (?, ?, ?, NULL, ?, ?, ?, ?)`).run(id, row.project_id, row.task_id, row.scenario, sortOrder, createdAt, createdAt);
        this.db.prepare(`UPDATE pm_test_cases SET group_id=? WHERE project_id=? AND task_id=? AND group_id IS NULL AND scenario=?`).run(id, row.project_id, row.task_id, row.scenario);
      }
    });
    migrate();
  }

  private requireRun(projectId: string, runId: string) {
    if (!this.db.prepare(`SELECT 1 FROM pm_test_runs WHERE project_id=? AND id=?`).get(projectId, runId)) throw new Error("test run not found");
  }

  private requireRunForCase(projectId: string, runId: string, caseId: string) {
    if (!this.db.prepare(`SELECT 1 FROM pm_test_runs WHERE project_id=? AND id=? AND case_id=?`).get(projectId, runId, caseId)) throw new Error("test run not found for case");
  }

  private requireRunStepForRun(projectId: string, runStepId: string, runId: string) {
    if (!this.db.prepare(`SELECT 1 FROM pm_test_run_steps WHERE project_id=? AND id=? AND run_id=?`).get(projectId, runStepId, runId)) throw new Error("test run step not found for run");
  }

  private requireIssue(projectId: string, issueId: string) {
    if (!this.db.prepare(`SELECT 1 FROM pm_test_issues WHERE project_id=? AND id=?`).get(projectId, issueId)) throw new Error("test issue not found");
  }

  private getIssue(projectId: string, issueId: string): TestCenterIssue | null {
    const row = this.db.prepare(`SELECT id, project_id, case_id, run_id, title, description, owner, external_ref, custom_fields, status, sort_order, created_at, updated_at FROM pm_test_issues WHERE project_id=? AND id=?`).get(projectId, issueId) as IssueRow | undefined;
    return row ? issueFromRow(row) : null;
  }

  private statusCounts(sql: string, projectId: string): Record<string, number> {
    const rows = this.db.prepare(sql).all(projectId) as Array<{ status: string; count: number }>;
    return Object.fromEntries(rows.map(row => [row.status, Number(row.count)]));
  }
}

type RunRow = { id: string; project_id: string; case_id: string; status: TestRunStatus; actual_result: string; started_at: string; finished_at: string | null; created_at: string };
function runFromRow(row: RunRow): TestCenterRun { return { id: row.id, projectId: row.project_id, caseId: row.case_id, status: row.status, actualResult: row.actual_result, startedAt: row.started_at, finishedAt: row.finished_at ?? undefined, createdAt: row.created_at }; }
type CaseRow = { id: string; project_id: string; task_id: string | null; group_id: string | null; scenario: string; code: string; title: string; objective: string; type: TestCaseType; priority: TestCenterCase["priority"]; status: TestCenterCase["status"]; sort_order: number; created_at: string; updated_at: string };
function caseFromRow(row: CaseRow): TestCenterCase { return { id: row.id, projectId: row.project_id, taskId: row.task_id ?? undefined, groupId: row.group_id ?? undefined, scenario: row.scenario, code: row.code, title: row.title, objective: row.objective, type: row.type, priority: row.priority, status: row.status, sortOrder: row.sort_order, createdAt: row.created_at, updatedAt: row.updated_at }; }
type TaskRow = { id: string; project_id: string; title: string; objective: string; test_data: string; test_links: string; app_version: string; status: TestCenterTask["status"]; sort_order: number; created_at: string; updated_at: string };
function taskFromRow(row: TaskRow): TestCenterTask { return { id: row.id, projectId: row.project_id, title: row.title, objective: row.objective, testData: row.test_data, testLinks: row.test_links, appVersion: row.app_version, status: row.status, sortOrder: row.sort_order, createdAt: row.created_at, updatedAt: row.updated_at }; }
type GroupRow = { id: string; project_id: string; task_id: string; parent_group_id: string | null; title: string; sort_order: number; created_at: string; updated_at: string };
function groupFromRow(row: GroupRow): TestCenterGroup { return { id: row.id, projectId: row.project_id, taskId: row.task_id, parentGroupId: row.parent_group_id ?? undefined, title: row.title, sortOrder: row.sort_order, createdAt: row.created_at, updatedAt: row.updated_at }; }
type CaseStepSnapshotRow = { id: string; step_order: number; instruction: string; expected_result: string };
type CaseStepRow = { id: string; project_id: string; case_id: string; step_order: number; instruction: string; expected_result: string; created_at: string; updated_at: string };
function caseStepFromRow(row: CaseStepRow): TestCenterCaseStep { return { id: row.id, projectId: row.project_id, caseId: row.case_id, stepOrder: row.step_order, instruction: row.instruction, expectedResult: row.expected_result, createdAt: row.created_at, updatedAt: row.updated_at }; }
type RunStepRow = { id: string; project_id: string; run_id: string; case_step_id: string | null; step_order: number; instruction: string; expected_result: string; status: TestCenterRunStep["status"]; actual_result: string; created_at: string; updated_at: string };
function runStepFromRow(row: RunStepRow): TestCenterRunStep { return { id: row.id, projectId: row.project_id, runId: row.run_id, caseStepId: row.case_step_id ?? undefined, stepOrder: row.step_order, instruction: row.instruction, expectedResult: row.expected_result, status: row.status, actualResult: row.actual_result, createdAt: row.created_at, updatedAt: row.updated_at }; }
type EvidenceRow = { id: string; project_id: string; run_id: string; run_step_id: string | null; title: string; kind: string; location: string; created_at: string };
function evidenceFromRow(row: EvidenceRow): TestCenterEvidence { return { id: row.id, projectId: row.project_id, runId: row.run_id, runStepId: row.run_step_id ?? undefined, title: row.title, kind: row.kind, location: row.location, createdAt: row.created_at }; }
type IssueRow = { id: string; project_id: string; case_id: string; run_id: string | null; title: string; description: string; owner: string | null; external_ref: string | null; custom_fields: string; status: TestCenterIssue["status"]; sort_order: number; created_at: string; updated_at: string };
function issueFromRow(row: IssueRow): TestCenterIssue { let customFields: Record<string, string> = {}; try { customFields = JSON.parse(row.custom_fields || "{}") as Record<string, string>; } catch {} return { id: row.id, projectId: row.project_id, caseId: row.case_id, runId: row.run_id ?? undefined, title: row.title, description: row.description, owner: row.owner ?? undefined, externalRef: row.external_ref ?? undefined, customFields, status: row.status, sortOrder: row.sort_order, createdAt: row.created_at, updatedAt: row.updated_at }; }
type DiscussionRow = { id: string; project_id: string; issue_id: string; content: string; created_at: string };
function discussionFromRow(row: DiscussionRow): TestCenterIssueDiscussion { return { id: row.id, projectId: row.project_id, issueId: row.issue_id, content: row.content, createdAt: row.created_at }; }
type CaseCommentRow = { id: string; project_id: string; case_id: string; content: string; created_at: string; updated_at: string };
function caseCommentFromRow(row: CaseCommentRow): TestCenterCaseComment { return { id: row.id, projectId: row.project_id, caseId: row.case_id, content: row.content, createdAt: row.created_at, updatedAt: row.updated_at }; }
