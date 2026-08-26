import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./AutomationWorkspace.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("./AutomationWorkspace.css", import.meta.url), "utf8");

test("数据自动化新增操作使用应用内表单而不是 Electron 不支持的 window.prompt", () => {
  assert.doesNotMatch(source, /window\.prompt/);
  assert.match(source, /automation-name-dialog/);
  assert.match(source, /aria-label="名称"/);
});

test("数据字典表选择器使用可搜索的列表而不是原生下拉框", () => {
  assert.doesNotMatch(source, /<select/);
  assert.match(source, /aria-label="搜索数据字典表"/);
  assert.match(source, /automation-table-picker__list/);
  assert.match(source, /automation-table-picker__row/);
});

test("每个执行分组通过添加按钮展开和收起表选择器", () => {
  assert.match(source, /openTablePickers/);
  assert.match(source, />\{openTablePickers\[group\.id\] \? "收起" : "添加"\}</);
  assert.match(source, /openTablePickers\[group\.id\] && <AutomationTablePicker/);
});

test("双击分组任务名称行可折叠和展开组内任务", () => {
  assert.match(source, /collapsedGroups/);
  assert.match(source, /onDoubleClick=\{\(\) => setCollapsedGroups/);
  assert.match(source, /aria-expanded=\{!collapsedGroups\[group\.id\]\}/);
  assert.match(source, /!collapsedGroups\[group\.id\] && <>/);
  assert.match(styles, /\.automation-group__title[^}]*cursor:\s*pointer/s);
});

test("表选择器只搜索中英文表名并支持多选批量添加", () => {
  assert.match(source, /selectedTableIds: string\[\]/);
  assert.match(source, /onToggle: \(tableId: string\) => void/);
  assert.match(source, /for \(const tableId of tableIds\)/);
  assert.match(source, /placeholder="搜索中文表名或英文表名/);
  const filterBody = source.match(/function filterAutomationTables[\s\S]*?\n\}/)?.[0] || "";
  assert.match(filterBody, /table\.tableCn/);
  assert.match(filterBody, /table\.tableName/);
  assert.doesNotMatch(filterBody, /table\.tableGroup|table\.dataLayer|table\.sourceKind|table\.fileType|table\.usageStatus/);
});

test("表选择器只提供使用中的表，并展示是否使用状态", () => {
  assert.match(source, />是否使用</);
  assert.match(source, /automationTableUsageLabel\(table\.usageStatus\)/);
  assert.match(source, /tables\.filter\(table => automationTableUsageRank\(table\.usageStatus\) === 0\)/);
  assert.match(source, /filterAutomationTables\(eligibleTables, query\)/);
  assert.match(source, /visibleTables\.length\} \/ \{eligibleTables\.length\}/);
  const sortBody = source.match(/function sortAutomationTablesByUsage[\s\S]*?\n\}/)?.[0] || "";
  assert.match(sortBody, /automationTableUsageRank\(left\.usageStatus\)/);
  assert.match(source, /if \(\["使用", "是", "yes"/);
  assert.match(source, /return "未确定"/);
  assert.match(styles, /110px 100px 82px 68px/);
});

test("自动化工作台使用左右双栏并在右侧提供检查、参数和执行记录", () => {
  assert.match(source, /automation-console-grid/);
  assert.match(source, /automation-config-pane/);
  assert.match(source, /automation-run-pane/);
  assert.match(source, /自动化检查/);
  assert.match(source, /automation-params/);
  assert.match(styles, /\.automation-console-grid\s*\{[^}]*grid-template-columns:/s);
  assert.match(styles, /\.automation-config-pane[^}]*overflow:\s*auto/s);
  assert.match(styles, /\.automation-run-pane[^}]*overflow:\s*auto/s);
});

test("自动化检查结果和运行参数会按项目与方案缓存，方案变更时清除缓存", () => {
  assert.match(source, /rich-project-automation-preflight:/);
  assert.match(source, /loadAutomationPreflightMemory\(projectId, selectedPlanId\)/);
  assert.match(source, /saveAutomationPreflightMemory\(projectId, selectedPlanId, \{ inspection, runtimeParams \}\)/);
  assert.match(source, /clearAutomationPreflightMemory\(projectId, selectedPlanId\)/);
});

test("执行记录区域不再展示历史批次入口", () => {
  assert.doesNotMatch(source, /automation-history|历史批次/);
  assert.doesNotMatch(styles, /automation-history/);
});
