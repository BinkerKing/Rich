import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (name: string) => readFileSync(new URL(name, import.meta.url), "utf8");

test("Multica 看板使用源码一致的列宽、卡片密度和品牌归属", () => {
  const styles = read("./MulticaProjectWorkbench.css");
  const board = read("./MulticaProjectBoard.tsx");
  const card = read("./MulticaBoardCard.tsx");
  const todos = read("../sections/TodosSection.tsx");
  assert.match(styles, /--multica-board-column-width:\s*280px/);
  assert.match(styles, /border:\s*\.5px solid/);
  assert.match(card, /Powered by Multica/);
  assert.match(board, /getMulticaBoard/);
  assert.match(board, /getMulticaTeam/);
  assert.match(board, /visibilitychange/);
  assert.doesNotMatch(todos, /createProjectManagementModuleItem/);
});

test("团队面板展示 Squad、运行时、模型、MCP 与项目资源", () => {
  const team = read("./MulticaTeamPanel.tsx");
  assert.match(team, /squad/);
  assert.match(team, /leader_id/);
  assert.match(team, /runtime_name/);
  assert.match(team, /model/);
  assert.match(team, /mcp_servers/);
  assert.match(team, /execution_mode/);
});

test("Issue 详情遵循 Multica 主内容、时间线和右侧栏结构而不是自定义标签页", () => {
  const detail = read("./MulticaIssueDetail.tsx");
  const sidebar = read("./MulticaIssueSidebar.tsx");
  const timeline = read("./MulticaTimeline.tsx");
  const execution = read("./MulticaExecutionLog.tsx");
  assert.match(detail, /description/);
  assert.match(detail, /children/);
  assert.match(detail, /MulticaTimeline/);
  assert.match(detail, /MulticaIssueSidebar/);
  assert.doesNotMatch(detail, /tablist|detail-tabs/);
  assert.match(sidebar, /attachments/);
  assert.match(sidebar, /pullRequests/);
  assert.match(sidebar, /usage/);
  assert.match(timeline, /addMulticaComment/);
  assert.match(timeline, /resolveMulticaComment/);
  assert.match(execution, /getMulticaRunMessages/);
  assert.match(execution, /cancelMulticaRun/);
});
