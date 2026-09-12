import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./IssueDataGrid.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("./IssueDataGrid.css", import.meta.url), "utf8");

test("问题表使用 AG Grid 并提供搜索、状态筛选和内联编辑", () => {
  assert.match(source, /from "ag-grid-react"/);
  assert.match(source, /placeholder="搜索已设为可检索的字段"/);
  assert.match(source, /cellEditor: column\.fieldType === "select" \? SelectDrawerEditor/);
  assert.match(source, /cellEditorPopupPosition: column\.fieldType === "select" \? "under"/);
  assert.match(source, /onCellValueChanged=/);
});

test("表格内下拉以向下抽屉展示带最终样式的选项", () => {
  assert.match(source, /issue-data-grid__select-drawer/);
  assert.match(source, /<SelectBadge value=\{option\.value\}/);
  assert.match(source, /onValueChange\(nextValue\); stopEditing\(\)/);
  assert.match(source, /singleClickEdit=\{false\} stopEditingWhenCellsLoseFocus/);
  assert.match(source, /onCellClicked=.*needsOptions\(column\?\.fieldType\).*startEditingCell/s);
  assert.match(styles, /\.issue-data-grid__select-drawer\s*\{[^}]*border-radius:0 0 8px 8px/s);
});

test("下拉选中的值以完整单元格效果呈现", () => {
  assert.match(source, /column\.fieldType === "select" \? "issue-data-grid__select-cell"/);
  assert.match(styles, /\.issue-data-grid \.ag-cell\.issue-data-grid__select-cell\s*\{[^}]*padding:0/s);
  assert.match(styles, /\.issue-data-grid \.issue-data-grid__select-cell \.issue-data-grid__select-badge\s*\{[^}]*width:100%[^}]*height:100%/s);
});

test("普通单元格的长内容不会穿透到相邻列", () => {
  assert.match(styles, /\.issue-data-grid \.ag-cell \{ display:flex; align-items:center; overflow:hidden;/);
  assert.match(styles, /\.ag-cell:not\(\.ag-cell-inline-editing\) \.ag-cell-value \{ min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;/);
});

test("内容样式工具栏可启用自动换行并让单元格随内容增高", () => {
  assert.match(source, /title="自动换行" aria-label="自动换行"/);
  assert.match(source, /whiteSpace: activeCellStyle\?\.whiteSpace === "normal" \? "nowrap" : "normal"/);
  assert.match(source, /const isTextField = \(column: TestCenterGridColumn\) => !column\.fieldType \|\| column\.fieldType === "text";/);
  assert.match(source, /autoHeight: isTextField\(column\) && \(/);
  assert.match(source, /wrapText: isTextField\(column\) && \(/);
  assert.match(source, /column\.cellStyle\?\.whiteSpace === "normal"/);
  assert.match(styles, /\.issue-data-grid__cell-auto-wrap \.ag-cell-value \{ overflow:visible; text-overflow:clip; white-space:pre-wrap;/);
});

test("编辑时输入区域贴合完整单元格，而非悬浮小输入框", () => {
  assert.match(styles, /\.issue-data-grid \.ag-cell\.ag-cell-inline-editing\s*\{[^}]*padding:0 !important[^}]*border-radius:0/s);
  assert.match(styles, /\.issue-data-grid \.ag-cell-inline-editing \.ag-cell-editor input,[^{]*\{[^}]*width:100%[^}]*height:100%[^}]*border:0 !important/s);
});

test("问题记录可通过右键菜单新增或删除", () => {
  assert.match(source, /onCellContextMenu=/);
  assert.match(source, /issue-data-grid__record-menu/);
  assert.match(source, /onAddIssue\(\)/);
  assert.match(source, /onDeleteIssue\(recordMenu\.issueId!\)/);
  assert.match(styles, /\.issue-data-grid__record-menu\s*\{[^}]*position:fixed/s);
  assert.match(styles, /\.issue-data-grid__record-menu button\.is-danger/);
});

test("右键记录菜单会在点击菜单外后自动收起", () => {
  assert.match(source, /window\.addEventListener\("pointerdown", closeMenu\)/);
  assert.match(source, /window\.removeEventListener\("pointerdown", closeMenu\)/);
  assert.match(source, /onPointerDown=\{event => event\.stopPropagation\(\)\}/);
});

test("序号列是问题记录唯一的拖拽排序入口", () => {
  assert.match(source, /rowDrag: column\.key === "serial" && !query/);
  assert.match(source, /rowDragManaged=\{!query\} suppressMoveWhenRowDragging animateRows/);
  assert.match(source, /onRowDragEnd=.*forEachNode.*onIssueReorder\(issueIds\)/s);
  assert.match(styles, /\.issue-data-grid__serial \.ag-row-drag\s*\{[^}]*cursor:grab/s);
});

test("单元格支持快捷键复制粘贴，并为复制源显示虚线框", () => {
  assert.match(source, /suppressKeyboardEvent:/);
  assert.doesNotMatch(source, /onCellKeyDown=/);
  assert.match(source, /enableCellTextSelection suppressClipboardPaste suppressCutToClipboard/);
  assert.match(source, /onKeyDownCapture=\{handleGridKeyDownCapture\}/);
  assert.match(source, /event\.stopPropagation\(\)/);
  assert.match(source, /!keyEvent\.metaKey && !keyEvent\.ctrlKey/);
  assert.match(source, /const key = keyEvent\.key\.toLowerCase\(\);/);
  assert.match(source, /key !== "c" && key !== "v"/);
  assert.match(source, /keyEvent\.stopPropagation\(\)/);
  assert.match(source, /navigator\.clipboard\?\.writeText/);
  assert.match(source, /copiedCell\.current = \{ issueId: row\.id, field, value \};/);
  assert.match(source, /copiedCellElement\.current\?\.classList\.remove\("issue-data-grid__cell-copied"\)/);
  assert.match(source, /cellElement\?\.classList\.add\("issue-data-grid__cell-copied"\)/);
  assert.doesNotMatch(source, /refreshCells\(\{ force: true \}\)/);
  assert.match(source, /\}\)\), \[columns, handleClipboardShortcut, query\]\);/);
  assert.doesNotMatch(source, /\}\)\), \[columns, copiedCell, query\]\);/);
  assert.match(source, /issue-data-grid__cell-copied/);
  assert.match(styles, /\.issue-data-grid \.ag-cell\.issue-data-grid__cell-copied\s*\{[^}]*outline:1px dashed/s);
});

test("新增问题记录不预填单元格内容", () => {
  assert.match(source, /String\(value \|\| ""\)/);
  assert.doesNotMatch(source, /String\(value \|\| "选择选项"\)/);
});

test("高级问题表格撑满编辑区域并使用紧凑深色工具栏", () => {
  assert.match(styles, /\.issue-data-grid\s*\{[^}]*height:100%[^}]*grid-template-rows:auto minmax\(0,1fr\)/s);
  assert.match(styles, /\.issue-data-grid__toolbar\s*\{[^}]*min-height:48px[^}]*background:#252629/s);
});

test("问题表以克制的数据工作台层级呈现，避免厚重装饰", () => {
  assert.match(styles, /min-height:76px; padding:0 28px; border-bottom-color:#34393d; background:#1b1d1f; box-shadow:none/);
  assert.match(styles, /border-color:#373d41; border-radius:6px; background:#191c1e; box-shadow:none/);
  assert.match(styles, /min-height:40px; border-bottom-color:#3b4145; box-shadow:none/);
});

test("问题表具有产品级的清单身份区与记录状态", () => {
  assert.match(source, /TEST CENTER · ISSUE LOG/);
  assert.match(source, /title = "产品问题测试清单"/);
  assert.match(source, /issue-data-grid__identity-title/);
  assert.match(source, /onBack/);
  assert.match(source, /issue-data-grid__record-count/);
  assert.match(styles, /\.issue-data-grid__identity\s*\{[^}]*min-height:70px/s);
  assert.match(styles, /\.issue-data-grid .ag-root-wrapper\s*\{[^}]*border-radius:10px/s);
  assert.match(styles, /\.issue-data-grid__identity h2\s*\{[^}]*font-size:23px[^}]*font-weight:800/s);
});

test("应用后的表格样式与表格设置中的色调、密度和斑马纹对应", () => {
  assert.match(styles, /\.issue-data-grid--header-neutral \.ag-header\s*\{[^}]*background:#252f34/s);
  assert.match(styles, /\.issue-data-grid--header-slate \.ag-header\s*\{[^}]*background:#2d3a43/s);
  assert.match(styles, /\.issue-data-grid--header-cyan \.ag-header\s*\{[^}]*background:#183c42/s);
  assert.match(styles, /\.issue-data-grid--striped \.ag-row-even\s*\{[^}]*background:#222c31/s);
});

test("标题与内容的对齐设定会映射到 AG Grid 的实际布局", () => {
  assert.match(source, /headerClass: `issue-data-grid__header-align-\$\{column\.headerStyle\?\.textAlign \?\? "left"\}`/);
  assert.match(source, /issue-data-grid__cell-align-\$\{column\.cellStyle\?\.textAlign \?\? "left"\}/);
  assert.match(styles, /\.issue-data-grid \.ag-header-cell\.issue-data-grid__header-align-center \.ag-header-cell-label\s*\{[^}]*justify-content:center/s);
  assert.match(styles, /\.issue-data-grid \.ag-header-cell\.issue-data-grid__header-align-right \.ag-header-cell-label\s*\{[^}]*justify-content:flex-end/s);
});

test("问题表包含可编辑的项目跟进字段，并记住每张表的列宽", () => {
  assert.match(source, /key: "serial", name: "序号"/);
  assert.match(source, /key: "project", name: "项目"[\s\S]*?editable: true/);
  assert.match(source, /key: "issueType", name: "类型"[\s\S]*?fieldType: "select"/);
  assert.match(source, /key: "module", name: "模块"[\s\S]*?editable: true/);
  assert.match(source, /key: "eta", name: "ETA"[\s\S]*?editable: true/);
  assert.match(source, /key: "progressFollowUp", name: "进度跟进"[\s\S]*?editable: true/);
  assert.match(source, /api\.getTestCenterGridSettings\(projectId, gridSettingsKey\)/);
  assert.match(source, /api\.saveTestCenterGridSettings\(projectId, gridSettingsKey/);
  assert.match(source, /onColumnResized=/);
  assert.match(source, /onColumnMoved=/);
  assert.match(source, /saveColumnOrder/);
});

test("列宽调整完成后立即持久化，切换页面不会取消保存", () => {
  assert.match(source, /const saveColumnWidths = \(gridApi: GridApi<IssueGridRow>\) => \{\s*const widths/s);
  assert.doesNotMatch(source, /saveColumnWidths[\s\S]{0,360}setTimeout/);
  assert.doesNotMatch(source, /resizeTimer/);
});

test("恢复字段配置时按已保存的列顺序构建表格", () => {
  assert.match(source, /const savedActiveColumns = settings\.columns\.filter\(column => !column\.deleted\)/);
  assert.match(source, /savedActiveColumns\.map\(column =>/);
  assert.match(source, /gridApi\.getColumnState\(\).*positions/s);
});

test("问题表提供字段配置器，支持列类型、搜索和样式设置", () => {
  assert.match(source, /表格设置/);
  assert.match(source, /添加字段/);
  assert.match(source, /字段类型/);
  assert.match(source, /参与搜索/);
  assert.match(source, /下拉选项/);
  assert.match(source, /表格样式/);
  assert.match(source, /fieldType: "select"/);
  assert.match(source, /searchable/);
  assert.match(source, /tableStyle/);
});

test("字段设置以表格行展示，并提供日期、勾选和多选类型", () => {
  assert.match(source, /issue-data-grid__field-table/);
  assert.match(source, /<th>字段名称<\/th>/);
  assert.match(source, /<option value="date">日期<\/option>/);
  assert.match(source, /<option value="checkbox">勾选<\/option>/);
  assert.match(source, /<option value="multiSelect">多选下拉<\/option>/);
});

test("下拉选项以所见即所得的可编辑下拉管理", () => {
  assert.match(source, /issue-data-grid__option-editor/);
  assert.match(source, /新增选项/);
  assert.match(source, /删除选项/);
  assert.match(source, /上移选项/);
  assert.match(source, /下移选项/);
  assert.match(source, /dropdownStyle/);
  assert.match(source, /圆角标签/);
  assert.match(source, /强调色块/);
  assert.doesNotMatch(source, /placeholder="每行一个选项"/);
});

test("下拉选项支持继承统一样式或单独覆盖样式", () => {
  assert.match(source, /统一所有选项/);
  assert.match(source, /option\?\.style \?\? dropdownStyle/);
  assert.match(source, /option-content/);
});

test("下拉统一样式和单项样式由同一工具栏编辑", () => {
  assert.match(source, /target: "dropdown"/);
  assert.match(source, /统一所有选项/);
  assert.match(source, /styleSelection\.optionValue/);
  assert.match(source, /下拉样式 ·/);
  assert.doesNotMatch(source, /issue-data-grid__option-style-picker/);
});

test("下拉样式工具保留清晰的最终效果预览", () => {
  assert.match(styles, /\.issue-data-grid__option-editor-menu\s*\{[^}]*width:420px/s);
  assert.match(styles, /\.issue-data-grid__option-row\s*\{[^}]*grid-template-columns:minmax\(0,1fr\) auto/s);
  assert.match(styles, /\.issue-data-grid__toolbar-dropdown-style--soft\s*\{[^}]*background:/s);
});

test("下拉选项在最终样式输入框中直接编辑，工具栏不叠层", () => {
  assert.match(source, /issue-data-grid__option-content/);
  assert.doesNotMatch(source, /issue-data-grid__option-preview/);
  assert.match(styles, /\.issue-data-grid__settings:has\(\.issue-data-grid__dropdown-toolbar\) \.issue-data-grid__style-toolbar\s*\{[^}]*visibility:hidden/s);
});

test("下拉样式直接作用于可编辑的最终效果输入框", () => {
  assert.match(styles, /input\.issue-data-grid__option-content--soft\s*\{[^}]*background:#23474d/s);
  assert.match(styles, /input\.issue-data-grid__option-content--pill\s*\{[^}]*border-radius:999px/s);
  assert.match(styles, /input\.issue-data-grid__option-content--signal\s*\{[^}]*background:#65442e/s);
});

test("下拉样式工具栏以真实样本展示每种效果", () => {
  assert.match(source, /<span>\{style\.label\}<\/span><\/button>/);
  assert.match(styles, /toolbar-dropdown-style--pill > span\s*\{[^}]*border-radius:999px/s);
  assert.match(styles, /toolbar-dropdown-style--signal > span\s*\{[^}]*background:#65442e/s);
});

test("字段定义表不显示冗余标题行，并使用图标删除字段", () => {
  assert.doesNotMatch(source, /字段顺序、宽度和显示内容会自动保存/);
  assert.match(source, /<th>操作<\/th>/);
  assert.match(source, /aria-label="删除字段"/);
  assert.match(source, /issue-data-grid__delete-icon/);
  assert.doesNotMatch(source, />删除字段<\/button>/);
  assert.match(source, /removeColumn/);
  assert.doesNotMatch(source, /\? "隐藏" : "删除字段"/);
  assert.match(source, /deleted: true/);
});

test("字段设置使用草稿并通过右下角应用按钮生效", () => {
  assert.match(source, /const \[draftColumns, setDraftColumns\]/);
  assert.match(source, /updateDraft\(settingsColumns\.filter/);
  assert.match(source, /settingsDirty \? "应用更改" : "已应用"/);
  assert.match(source, /disabled=\{!settingsDirty\}/);
  assert.match(source, /persistSettings\(settingsColumns, settingsStyle, draftDeletedColumns\)/);
  assert.match(styles, /\.issue-data-grid__apply-settings\s*\{[^}]*margin-left:auto/s);
});

test("字段定义表表头固定，字段样式以真实预览展示", () => {
  assert.match(styles, /\.issue-data-grid__field-table th\s*\{[^}]*position:sticky[^}]*top:0/s);
  assert.match(source, /issue-data-grid__style-preview-button/);
  assert.match(source, /column\.name/);
  assert.match(source, /示例值/);
});

test("字段设置表采用紧凑的数据工作台层级", () => {
  assert.match(styles, /\.issue-data-grid__field-table-wrap\s*\{[^}]*border-radius:10px[^}]*box-shadow:0 12px 28px/s);
  assert.match(styles, /\.issue-data-grid__field-table th\s*\{[^}]*letter-spacing:\.03em/s);
  assert.match(styles, /\.issue-data-grid__field-table td\s*\{[^}]*height:52px/s);
  assert.match(styles, /\.issue-data-grid__style-preview-button\s*\{[^}]*border-radius:6px/s);
});

test("打开字段设置时配置表占满剩余工作区", () => {
  assert.match(styles, /\.issue-data-grid:has\(\.issue-data-grid__settings\)\s*\{[^}]*grid-template-rows:auto auto minmax\(0,1fr\)/s);
  assert.match(styles, /\.issue-data-grid:has\(\.issue-data-grid__settings\) \.issue-data-grid__table\s*\{[^}]*display:none/s);
  assert.match(styles, /\.issue-data-grid:has\(\.issue-data-grid__settings\) \.issue-data-grid__settings\s*\{[^}]*max-height:none[^}]*grid-template-rows:auto minmax\(0,1fr\) auto/s);
});

test("字段属性可配置表头与单元格样式", () => {
  assert.match(source, /字号/);
  assert.match(source, /文字颜色/);
  assert.match(source, /背景颜色/);
  assert.match(source, /headerStyle/);
  assert.match(source, /cellStyle/);
  assert.match(source, /textAlign/);
});

test("字段样式拆分为标题与内容，并由工具栏即时调整", () => {
  assert.match(source, /<th>标题样式<\/th>/);
  assert.match(source, /<th>内容样式<\/th>/);
  assert.match(source, /styleSelection/);
  assert.match(source, /样式工具栏/);
  assert.match(source, /左对齐/);
  assert.match(source, /居中/);
  assert.match(source, /右对齐/);
  assert.match(source, /issue-data-grid__style-preview-button/);
});

test("编辑框字段可选换行、序号、点点和复选任务显示", () => {
  assert.match(source, /value: "wrap", label: "换行"/);
  assert.match(source, /label: "序号任务"/);
  assert.match(source, /label: "点点任务"/);
  assert.match(source, /label: "复选任务"/);
  assert.match(source, /<ContentModeToolbar/);
  assert.match(source, /StructuredTextCell/);
  assert.match(source, /StructuredTextEditor/);
  assert.match(styles, /\.issue-data-grid__task-list\s*\{[^}]*display:grid/s);
  assert.match(styles, /\.issue-data-grid__task-check\s*\{[^}]*border-radius:4px/s);
});

test("字段样式预览与属性面板保持同列宽度", () => {
  assert.match(styles, /\.issue-data-grid__field-table th:nth-child\(4\),\.issue-data-grid__field-table td:nth-child\(4\)\s*\{[^}]*width:190px/s);
  assert.match(styles, /\.issue-data-grid__field-style-preview\s*\{[^}]*width:100%/s);
  assert.match(styles, /\.issue-data-grid__field-style > div\s*\{[^}]*width:190px[^}]*min-width:0/s);
});
