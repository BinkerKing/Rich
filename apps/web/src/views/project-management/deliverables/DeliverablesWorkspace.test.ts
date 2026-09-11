import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const navigation = readFileSync(new URL("../ProjectManagementNavigation.tsx", import.meta.url), "utf8");
const workspace = readFileSync(new URL("../../ProjectWorkspace.tsx", import.meta.url), "utf8");
const deliveryPlan = readFileSync(new URL("../delivery/DeliveryWorkspace.tsx", import.meta.url), "utf8");
const deliverables = readFileSync(new URL("./DeliverablesWorkspace.tsx", import.meta.url), "utf8").replace(/\s+/g, " ");
const deliverableModel = readFileSync(new URL("./DeliverablesModel.ts", import.meta.url), "utf8");
const codexWorkbench = readFileSync(new URL("./DeliverableCodexWorkbench.tsx", import.meta.url), "utf8");
const modules = readFileSync(new URL("../ProjectManagementModules.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../../ProjectsView.css", import.meta.url), "utf8");
const standaloneStyles = readFileSync(new URL("../../DeliverablesView.css", import.meta.url), "utf8");

test("交付物是项目计划同级的顶层菜单", () => {
  const planIndex = navigation.indexOf('id: "deliveryPlan"');
  const deliverablesIndex = navigation.indexOf('id: "deliverables"');
  assert.ok(planIndex >= 0 && deliverablesIndex > planIndex);
  assert.match(workspace, /section === "deliverables" && <DeliverablesWorkspace/);
});

test("项目计划不再维护正式交付物占位页", () => {
  assert.doesNotMatch(deliveryPlan, /page === "deliverables"/);
});

test("交付物工作区采用需求说明左侧、记录右上、版本右下布局", () => {
  assert.match(deliverables, /ProjectRichTextEditor/);
  assert.match(deliverables, /<h2>需求说明<\/h2>/);
  assert.match(deliverables, /<h2>记录<\/h2>/);
  assert.match(deliverables, /<h2>版本与材料<\/h2>/);
});

test("项目计划中的交付物可以跳转并定位到对应工作台", () => {
  assert.match(deliveryPlan, /打开交付物工作台/);
  assert.match(deliveryPlan, /requestDeliverableFocus\(task.id, activity.id\)/);
  assert.match(workspace, /DELIVERABLE_FOCUS_EVENT/);
  assert.match(deliverables, /consumeDeliverableFocus\(projectId\)/);
});

test("勾选交付物时同步工作台状态并显示完成", () => {
  assert.match(deliveryPlan, /async function syncLinkedDeliverableStatus\(projectId: string, taskId: string, activity: DeliveryActivity, done: boolean\)/);
  assert.match(deliveryPlan, /status: done \? "accepted" : "preparing"/);
  assert.match(deliveryPlan, /await syncLinkedDeliverableStatus\(projectId, task\.id, activity, !activity\.done\)/);
  assert.match(deliverables, /accepted: "已完成"/);
});

test("切换交付物后，Codex 会话上下文同步为当前定位的交付物", () => {
  assert.match(deliverables, /const item = items\.find\(candidate => candidate\.id === openId\); if \(item\) \{ setCodexItem\(item\); setCodexVisible\(current => !current\); \}/);
  assert.doesNotMatch(deliverables, /setCodexItem\(current => current \?\? item\)/);
});

test("展开交付物后只渲染当前表头与工作台，再次点击表头回到完整列表", () => {
  assert.match(deliverables, /const visibleItems = openId \? items\.filter\(\(?item\)? => item\.id === openId\) : items/);
  assert.match(deliverables, /visibleItems\.map\(\(?item\)?, index\) =>/);
  assert.match(deliverables, /setOpenId\(item\.id\); void refreshFiles\(item\); setEditing\(false\);/);
});

test("交付物列表在标题前展示描边序号图标", () => {
  assert.match(deliverables, /className="deliverables-workspace__list-index"[^>]*>\{String\(index \+ 1\)\.padStart\(2, "0"\)\}/);
  assert.match(styles, /\.deliverables-workspace__list-index\s*\{[^}]*width:30px[^}]*border:1px solid #666[^}]*color:#b6b6b6[^}]*background:transparent/s);
  assert.match(styles, /\.deliverables-workspace__row:hover \.deliverables-workspace__list-index\s*\{[^}]*border-color:#f1f1f1[^}]*color:#fff/s);
});

test("项目内打开交付物后隐藏列表标题，并使用全尺寸工作台", () => {
  assert.match(deliverables, /deliverables-workspace\$\{standalone \? " deliverables-workspace--standalone" : ""\}\$\{openId && !standalone \? " is-open" : ""\}/);
  assert.match(deliverables, /\{\(!openId \|\| standalone\) && <header>/);
  assert.match(styles, /\.prj-ws \.deliverables-workspace:not\(\.deliverables-workspace--standalone\)\.is-open \{ padding:0; overflow:hidden; \}/);
  assert.match(deliverables, /deliverables-workspace__detail-title[\s\S]*?className="deliverables-workspace__title-actions"/);
  assert.match(deliverables, /\{!standalone && onDeliverableIdsChange && <button className="deliverables-workspace__bind"/);
  assert.doesNotMatch(styles, /deliverables-workspace__detail-title::before \{ content:"←"/);
});

test("独立交付物详情覆盖整个视口，不继承列表卡片的固定高度", () => {
  assert.match(standaloneStyles, /article\.is-open\s*\{[^}]*height:100vh/);
});

test("独立交付物详情点击标题栏收起，不显示返回按钮", () => {
  assert.match(deliverables, /className="deliverables-workspace__row deliverables-workspace__detail-title"[\s\S]*?aria-label="收起交付物详情"[\s\S]*?onClick=\{\(\) => \{ setOpenId\(undefined\); setEditing\(false\); \}\}/);
  assert.doesNotMatch(deliverables, /deliverables-workspace__back|返回交付物列表|data-window-drag-region="true"/);
  assert.match(standaloneStyles, /deliverables-workspace__detail-title\s*\{\s*cursor:pointer/);
  assert.match(standaloneStyles, /deliverables-workspace__detail-title::before\s*\{\s*display:none/);
});

test("绑定已有交付物保留带说明和选择卡片的选择器", () => {
  assert.match(deliverables, /<span>交付物库<\/span>[\s\S]*?<strong>绑定已有交付物<\/strong>[\s\S]*?点击绑定到当前项目/);
  assert.match(deliverables, /aria-label="关闭绑定交付物"/);
  assert.match(standaloneStyles, /deliverables-workspace__binding-list\s*>\s*button\s*\{[^}]*grid-template-columns:34px minmax\(0,1fr\) auto/s);
  assert.match(standaloneStyles, /deliverables-workspace__binding::before\s*\{[^}]*background:linear-gradient/s);
});

test("交付物详情将操作收进标题行图标栏，绑定按钮仅在列表标题行显示", () => {
  assert.match(deliverables, /className="deliverables-workspace__title-actions"[\s\S]*?aria-label="Codex 对话"[\s\S]*?aria-label="版本策略"[\s\S]*?aria-label="打开文件夹"/);
  assert.match(deliverables, /className="deliverables-workspace__bind"[\s\S]*?<DeliverableListIcon name="link"\s*\/>\s*<span>绑定已有交付物<\/span>/);
  assert.doesNotMatch(deliverables, />Codex 对话<|>只保留最新<|>版本控制<|>打开文件夹<|>解除项目绑定</);
  assert.match(styles, /\.deliverables-workspace__title-action[^}]*width:28px[^}]*height:28px[^}]*border:1px solid #515151/s);
  assert.match(styles, /\.deliverables-workspace > header > \.deliverables-workspace__bind\s*\{[^}]*min-height:28px[^}]*padding:6px 9px[^}]*border:1px solid #515151[^}]*background:#303030/s);
});

test("独立交付物记录编辑区不会因左右边距裁掉发布按钮", () => {
  assert.match(standaloneStyles, /deliverables-workspace__record-composer\s*\{[^}]*width:calc\(100% - 36px\)!important[^}]*box-sizing:border-box/s);
});

test("新建交付物采用带字段标签的创建卡，而非一排裸输入框", () => {
  assert.match(deliverables, /deliverables-workspace__create-intro/);
  assert.match(deliverables, /<span>交付物名称<\/span>/);
  assert.match(deliverables, /<span>存放目录<\/span>/);
  assert.match(standaloneStyles, /deliverables-workspace__create-fields\s*\{[^}]*grid-template-columns/s);
  assert.match(standaloneStyles, /deliverables-workspace__create > button\s*\{[^}]*background:linear-gradient/s);
});

test("打开工作台时清理已失去任务交付物来源的历史关联记录", () => {
  assert.match(deliverables, /const activeKeys = new Set<string>\(\)/);
  assert.match(deliverables, /activeKeys\.add\(key\)/);
  assert.match(deliverables, /return key && !activeKeys\.has\(key\)/);
  assert.match(deliverables, /archiveDeliverableFolder\( projectId, String\(entry\.content\.folderPath\)/);
  assert.match(deliverables, /Promise\.all\( stale\.map\(\(?entry\)? => api\.deleteProjectManagementModuleItem\(\s*projectId, entry\.id/);
});

test("交付物需求说明的富文本编辑区填满卡片并在内部滚动", () => {
  assert.match(modules, /<EditorContent[\s\S]*editor=\{editor\}[\s\S]*className="prj-pm-rich-content"/);
  assert.match(styles, /\.deliverables-workspace__description > \.prj-pm-rich-editor \{ display:flex; flex:1 1 auto; flex-direction:column; min-height:0; height:0;/);
  assert.match(styles, /\.deliverables-workspace__description > \.prj-pm-rich-editor > \.prj-pm-rich-content \{ display:flex; flex:1 1 auto; min-height:0; overflow:hidden; \}/);
  assert.match(styles, /\.deliverables-workspace__description > \.prj-pm-rich-editor > \.prj-pm-rich-content > \.tiptap \{ flex:1 1 auto; min-height:0; max-height:none; overflow-y:auto;/);
  assert.match(styles, /\.workflow-rich-content > img,\s*\.prj-pm-rich-surface > img/);
  assert.match(styles, /\.workflow-rich-content table,\s*\.prj-pm-rich-surface table/);
  assert.match(styles, /\.prj-pm-rich-surface::-webkit-scrollbar \{ width:4px; height:4px; \}/);
});

test("富文本编辑在输入期间不接受旧的外部回写", () => {
  assert.match(modules, /const onChangeRef = useRef\(onChange\)/);
  assert.match(modules, /onChangeRef\.current = onChange/);
  assert.match(modules, /onUpdate: \(\{ editor: nextEditor \}\) => \{ latestHtmlRef\.current = nextEditor\.getHTML\(\); \}/);
  assert.match(modules, /if \(editor && !editor\.isFocused && value !== editor\.getHTML\(\)\) editor\.commands\.setContent/);
  assert.match(modules, /onBlur: \(\{ editor: nextEditor \}\) => \{ latestHtmlRef\.current = nextEditor\.getHTML\(\); onChangeRef\.current\(latestHtmlRef\.current\); \}/);
  assert.match(deliverables, /scrollIntoView\(\{ block: "start", behavior: "smooth",? \}\); \}, \[openId\]\)/);
  assert.doesNotMatch(deliverables, /scrollIntoView\(\{ block: "start", behavior: "smooth" \}\); \}, \[items, openId\]\)/);
});

test("项目路径可设置交付物与版本控制的默认目录", () => {
  assert.match(workspace, /默认交付物目录/);
  assert.match(workspace, /默认版本控制目录/);
  assert.match(workspace, /defaultDeliverablesDirectory/);
  assert.match(workspace, /defaultVersionControlDirectory/);
});

test("进入交付物工作台时同步任务和交付物名称对应的目录", () => {
  assert.match(deliverables, /const existing = deliverables\.find/);
  assert.match(deliverables, /renameDeliverableFolder\( projectId, current\.folderPath, folderPath/);
  assert.match(deliverables, /title: activity\.text, content/);
});

test("打开文件夹会先确保目录存在，再调用系统打开该目录", () => {
  assert.match(deliverables, /const openFolder = async \(item: Item\) => \{ await api\.createDeliverableFolder\(projectId, item\.content\.folderPath\); await api\.deliverableFileAction\(projectId, "open", item\.content\.folderPath\); \}/);
  assert.match(deliverables, /onClick=\{\(\) => void openFolder\(item\)\}>\s*打开文件夹/);
});

test("交付物版本与材料展示目录内全部文件，并支持刷新", () => {
  assert.match(deliverables, /const refreshFiles = async \(item: Item\) => \{/);
  assert.match(deliverables, /setLoadingFolders\(\(?all\)? => \(\{ \.\.\.all, \[item\.content\.folderPath\]: true \}\)\)/);
  assert.match(deliverables, /await api\.listDeliverableFiles\(\s*projectId, item\.content\.folderPath/);
  assert.match(deliverables, /<h2>版本与材料<\/h2>/);
  assert.match(deliverables, /目录内的全部文件/);
  assert.match(deliverables, /file\.relativePath\.slice\(\s*item\.content\.folderPath\.length \+ 1/);
});

test("Codex 通过交付物 MCP 写入成功后，刷新当前交付物页面数据", () => {
  assert.match(deliverableModel, /DELIVERABLE_DATA_CHANGED_EVENT/);
  assert.match(deliverableModel, /notifyDeliverableDataChanged\(projectId: string, deliverableId: string\)/);
  assert.match(codexWorkbench, /event === "tool" && data\.status === "succeeded" && isDeliverableWriteTool\(data\.name\)/);
  assert.match(codexWorkbench, /notifyDeliverableDataChanged\(projectId, deliverableId\)/);
  assert.match(deliverables, /window\.addEventListener\(DELIVERABLE_DATA_CHANGED_EVENT, refreshDeliverableData\)/);
  assert.match(deliverables, /void refreshItems\(\);/);
});

test("Codex 对话消息、卡片和图片支持右键复制", () => {
  assert.match(codexWorkbench, /onContextMenu=\{event => openMessageContextMenu\(event, message\.content\)\}/);
  assert.match(codexWorkbench, /openMessageContextMenu\(event, message\.content, attachment\)/);
  assert.match(codexWorkbench, /复制图片/);
  assert.match(codexWorkbench, /navigator\.clipboard\.write\(/);
});

test("任务规则更新在本次发送时立即以规则卡片展示", () => {
  assert.match(codexWorkbench, /kind\?: "task-mode-started" \| "task-mode-instruction" \| "task-mode-policy-updated"/);
  assert.match(codexWorkbench, /event === "policy" && policyContent/);
  assert.match(codexWorkbench, /kind: "task-mode-policy-updated"/);
  assert.match(codexWorkbench, /message\.kind === "task-mode-policy-updated"/);
});

test("Codex 右键菜单限制在对话窗口内，并在滚动时关闭", () => {
  assert.match(codexWorkbench, /const workbenchRef = useRef<HTMLElement>\(null\);/);
  assert.match(codexWorkbench, /workbenchRef\.current\?\.getBoundingClientRect\(\)/);
  assert.match(codexWorkbench, /element\?\.addEventListener\("scroll", closeOnScroll\)/);
  assert.match(codexWorkbench, /event\.key === "Escape"/);
});

test("文件区标题下方的说明行不显示", () => {
  assert.match(styles, /\.deliverables-workspace__versions > header small \{ display:none; \}/);
});

test("工具栏按钮紧凑，需求说明编辑使用无背景绿色图标", () => {
  assert.match(styles, /\.deliverables-workspace__toolbar > button \{ padding:5px 8px;/);
  assert.match(styles, /\.deliverables-workspace__switch button \{ padding:5px 7px!important;/);
  assert.match(styles, /\.deliverables-workspace__description > header button \{ display:grid; width:24px; height:24px;/);
  assert.match(styles, /content:"✎"; color:#54d7a7/);
});

test("文件清单将文件大小放到末列，文件名区域只保留文件名和备注两行", () => {
  assert.match(deliverables, /deliverables-workspace__file-head/);
  assert.match(deliverables, /<span>类型<\/span>\s*<span>版本<\/span>\s*<span>文件名<\/span>\s*<span>更新时间<\/span>\s*<span>大小<\/span>\s*<span>操作<\/span>/);
  assert.match(deliverables, /<option value="deliverable">\s*交付物\s*<\/option>/);
  assert.match(deliverables, /<option value="material">\s*材料\s*<\/option>/);
  assert.match(deliverables, /<option value="intermediate">\s*中间文件\s*<\/option>/);
  assert.match(deliverables, /aria-label=\{`\$\{file\.fileName\} 的版本号`\} value=\{version\}/);
  assert.match(deliverables, /updateFileMeta\(item, file, \{ type:/);
  assert.match(deliverables, /updateFileMeta\(item, file, \{ version:/);
  assert.match(styles, /\.deliverables-workspace__file-row select/);
  assert.match(styles, /\.deliverables-workspace__file-size/);
});

test("每个交付物文件在文件名下方支持双击编辑并保存备注", () => {
  assert.doesNotMatch(deliverables, /<span>备注<\/span>/);
  assert.match(deliverables, /const \[editingFileNotePath, setEditingFileNotePath\] = useState<string>\(\);/);
  assert.match(deliverables, /<strong title=\{file\.relativePath\}>[\s\S]*?<span className="deliverables-workspace__file-note"/);
  assert.match(deliverables, /onDoubleClick=\{\(\) => startFileNoteEdit\(file, note\)\}/);
  assert.match(deliverables, /updateFileMeta\(item, file, \{ note: editingFileNote\.trim\(\) \}\)/);
  assert.match(deliverables, /aria-label=\{`\$\{file\.fileName\} 的备注`\}/);
  assert.match(styles, /\.deliverables-workspace__file-row > strong \.deliverables-workspace__file-note/);
  assert.match(styles, /\.deliverables-workspace__file-note \{[^}]*color:#8fe8ed/);
});

test("子目录只显示目录名，并可直接打开目录", () => {
  assert.match(deliverables, /isDirectory: boolean/);
  assert.match(deliverables, /if \(file\.isDirectory\)/);
  assert.match(deliverables, /className="deliverables-workspace__file-row is-directory"/);
  assert.match(deliverables, /title="打开目录"/);
  assert.match(deliverables, /deliverableFileAction\(projectId, "open", file\.relativePath\)/);
  assert.match(styles, /\.deliverables-workspace__file-row\.is-directory/);
});

test("交付物文件区支持拖拽多文件上传，刷新使用图标按钮", () => {
  assert.match(deliverables, /onDrop=\{\(?event\)? => \{ event\.preventDefault\(\); setDraggingFiles\(false\); void upload\(item, Array\.from\(event\.dataTransfer\.files\)\); \}\}/);
  assert.match(deliverables, /const upload = async \(item: Item, files: File\[\]\)/);
  assert.match(deliverables, /className="deliverables-workspace__refresh" title="刷新文件清单"/);
  assert.doesNotMatch(deliverables, /<h2>版本与材料<\/h2>[\s\S]*?<input type="file"/);
});

test("首次展开交付物时立即刷新文件清单并显示读取状态", () => {
  assert.match(deliverables, /const item = items\.find\(\(?current\)? => current\.id === openId\); if \(item\) void refreshFiles\(item\);/);
  assert.match(deliverables, /if \(opening\) void refreshFiles\(item\)/);
  assert.match(deliverables, /正在读取目录文件…/);
});

test("交付物记录支持信息与材料，材料上传后进入交付物文件目录", () => {
  assert.match(deliverables, /aria-label="记录类型"/);
  assert.match(deliverables, /<option value="change">修改<\/option>\s*<option value="information">信息<\/option>\s*<option value="material">材料<\/option>/);
  assert.match(deliverables, /api\.uploadDeliverableFile\(projectId, item\.content\.folderPath, file\)/);
  assert.match(deliverables, /updateDeliverableFileMeta\(content, uploaded\.relativePath, \{ type: "material", version: "" \}\)/);
  assert.match(deliverables, /添加附件\s*<input\s*ref=\{editingRecordId \? editingMaterialInputRef : materialInputRef\}\s*type="file"\s*multiple/);
});

test("交付物记录提供 Codex 操作记录和 AI 可选的决策、问题、风险类型", () => {
  assert.match(deliverables, /<option value="decision">决策<\/option>/);
  assert.match(deliverables, /<option value="issue">问题<\/option>/);
  assert.match(deliverables, /<option value="risk">风险<\/option>/);
  assert.match(deliverables, /<option value="codex">Codex<\/option>/);
  assert.match(styles, /\.deliverables-workspace__record\.is-codex/);
  assert.match(styles, /\.deliverables-workspace__record\.is-decision/);
  assert.match(styles, /\.deliverables-workspace__record\.is-issue/);
  assert.match(styles, /\.deliverables-workspace__record\.is-risk/);
});

test("每条交付物记录显示记录时间，并支持编辑和删除", () => {
  assert.match(deliverables, /fileDate\(record\.aiTaskResult\?\.completedAt \|\| record\.createdAt\)/);
  assert.match(deliverables, /onDoubleClick=\{\(\) => record\.kind === "ai_task_result" \? undefined : startRecordEdit\(item, record\)\}/);
  assert.match(deliverables, /aria-label="删除记录"/);
  assert.match(deliverables, /const saveRecordEdit/);
  assert.match(deliverables, /const deleteRecord/);
});

test("切换交付物时不显示或保存其他交付物的记录编辑草稿", () => {
  assert.match(deliverables, /editingRecordDeliverableId/);
  assert.match(deliverables, /const isEditingCurrentRecord = editingRecordDeliverableId === openId && Boolean\(editingRecordId\)/);
  assert.match(deliverables, /startRecordEdit\(item, record\)/);
  assert.match(deliverables, /if \(!editingRecordDeliverableId \|\| editingRecordDeliverableId === openId\) return;/);
});

test("交付物记录编辑器的操作栏位于正文下方，编辑记录在原位置展开", () => {
  assert.match(styles, /\.deliverables-workspace__record \{ order:1; \}/);
  assert.match(deliverables, /deliverables-workspace__record-rich-editor[\s\S]*?<footer[\s\S]*?aria-label="记录类型"[\s\S]*?添加附件[\s\S]*?发布记录/);
  assert.match(styles, /\.deliverables-workspace__records > \.deliverables-workspace__record-composer > footer \{ display:flex; align-items:center; justify-content:flex-start; gap:12px;/);
  assert.match(styles, /\.deliverables-workspace__records > \.deliverables-workspace__record-composer\.is-editing \{ order:1;/);
});

test("嵌入式交付物详情用边框而非深蓝底色区分记录和材料区域", () => {
  assert.match(styles, /Embedded deliverable detail: neutral panels separated by explicit semantic borders/);
  assert.match(styles, /deliverables-workspace__records \{ border-color:#3e9dab!important; background:#282828!important;/);
  assert.match(styles, /deliverables-workspace__versions \{ border-color:#927841!important; background:#292724!important;/);
  assert.match(styles, /record-composer \.prj-pm-rich-editor \{[^}]*border:1px solid #3e98a5!important/s);
  assert.match(styles, /deliverables-workspace__file-head \{ border-bottom:1px solid #806b3e;/);
});

test("交付物记录可选择 AI 任务并显式选择 Hermes 或 Multica", () => {
  assert.match(deliverables, /AI 任务/);
  assert.match(deliverables, /Hermes/);
  assert.match(deliverables, /Multica/);
  assert.match(deliverables, /publishDeliverableAiTask/);
});

test("AI 任务记录将时间、状态和删除操作固定在同一操作栏，避免状态竖排", () => {
  assert.match(deliverables, /className="deliverables-workspace__record-actions"/);
  assert.match(deliverables, /deliverables-workspace__record-ai-task/);
  assert.match(styles, /\.deliverables-workspace__record-list > \.deliverables-workspace__record \{[^}]*grid-template-columns:auto minmax\(0,1fr\) minmax\(150px,auto\);/);
  assert.match(styles, /\.deliverables-workspace__record-actions \{[^}]*white-space:nowrap/);
  assert.match(styles, /\.deliverables-workspace__record-ai-task \{[^}]*overflow:hidden/);
});

test("发布 AI 任务时先保存父记录并携带稳定关联 ID", () => {
  assert.match(deliverables, /const originRecordId = crypto\.randomUUID\(\);/);
  assert.match(deliverables, /aiTask: \{ id: "", status: "publishing", executor: aiExecutor \}/);
  assert.match(deliverables, /await save\(item, addDeliverableRecord\(item\.content, parent\)\);/);
  assert.match(deliverables, /originRecordId,/);
});

test("AI 任务结果以线程回复展示并能打开完整报告", () => {
  assert.match(deliverables, /orderDeliverableRecords\(item\.content\.records\)/);
  assert.match(deliverables, /AI 回复/);
  assert.match(deliverables, /待复核/);
  assert.match(deliverables, /record\.aiTaskResult\.report/);
  assert.match(deliverables, /deliverableFileAction\(\s*projectId,\s*"open",\s*file\.relativePath/);
  assert.match(styles, /\.deliverables-workspace__record\.is-ai_task_result/);
});
