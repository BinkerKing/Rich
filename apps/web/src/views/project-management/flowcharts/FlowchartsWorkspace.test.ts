import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
test("项目管理内的流程图清单有紧凑标题头和交付物式列表行", () => {
  assert.match(source, /embedded && !expanded && <header className="pfc-project-header">/);
  assert.match(source, /<h1>项目流程图<\/h1>/);
  assert.match(source, /<button type="button" disabled=\{busy \|\| !loaded\} onClick=\{\(\) => setCreating\(true\)\}>＋ 新建流程图<\/button>/);
  assert.match(styles, /\.pfc-project-header\s*\{[^}]*min-height:42px/s);
  assert.match(source, /items\.map\(\(item, index\)[\s\S]*?pfc-task-index[\s\S]*?String\(index \+ 1\)\.padStart\(2, "0"\)/);
  assert.match(styles, /\.pfc--embedded:not\(:has\(\.pfc-task\.is-expanded\)\) \.pfc-task\s*\{[^}]*box-sizing:border-box[^}]*height:62px[^}]*min-height:62px[^}]*background:#252525[^}]*box-shadow:inset 0 1px rgba\(255,255,255,.025\)/s);
  assert.match(styles, /\.pfc--embedded:not\(:has\(\.pfc-task\.is-expanded\)\) \.pfc-task-index\s*\{[^}]*width:30px[^}]*height:30px[^}]*font-size:12px/s);
  assert.match(styles, /\.pfc--embedded:not\(:has\(\.pfc-task\.is-expanded\)\) \.pfc-task:hover\s*\{[^}]*border-color:#424242[^}]*background:#303030[^}]*box-shadow:none/s);
  assert.match(styles, /\.pfc--embedded:not\(:has\(\.pfc-task\.is-expanded\)\) \.pfc-task:hover \.pfc-task-title\s*\{[^}]*background:transparent/s);
  assert.doesNotMatch(source, /!standalone && <button aria-label="创建流程图任务"/);
});

test("流程图空状态不重复提供创建入口", () => {
  assert.doesNotMatch(source, /items\.length === 0 \? <div className="pfc-empty">[\s\S]*?<button[\s\S]*?>新建流程图<\/button>/);
});

test("项目流程图记住上次打开的图和列表状态", () => {
  assert.match(source, /const viewKey = `rich-flowchart-view:\$\{projectId \?\? flowchartIds\?\.join\(","\) \?\? "standalone"\}`/);
  assert.match(source, /const view = JSON\.parse\(sessionStorage\.getItem\(viewKey\) \|\| "null"\)/);
  assert.match(source, /setExpanded\(view\?\.expanded === true\)/);
  assert.match(source, /sessionStorage\.setItem\(viewKey, JSON\.stringify\(\{ id: active \?\? null, expanded \}\)\)/);
});

test("项目流程图的展开页可打开与当前图绑定的 Codex 对话", () => {
  assert.match(source, /import \{ openBoundCodex \} from "\.\.\/deliverables\/DeliverableCodexLauncher\.js";/);
  assert.match(source, /const openCodexConversation = async \(item: ProjectModuleItem\) => \{/);
  assert.match(source, /api\.ensureFlowchartCodexSession\(projectId, item\.id, `\$\{item\.title\} · Codex`\)/);
  assert.match(source, /openBoundCodex\(\{ projectId, deliverableId: item\.id, deliverableTitle: item\.title, resourceType: "flowchart", conversationId: session\.conversation\.id \}\)/);
  assert.match(source, /aria-label="Codex 对话" title="Codex 对话" onClick=\{\(\) => void openCodexConversation\(item\)\}/);
  assert.match(source, /function FlowchartListIcon[\s\S]*?<svg aria-hidden="true" width=\{18\} height=\{18\}/);
});

test("右键节点或多选区域会打开 Codex 整改输入，并在执行时标记节点状态", () => {
  assert.match(source, /const \[codexSelection, setCodexSelection\] = useState<string\[\]>\(\[\]\)/);
  assert.match(source, /const focusedNode = selectedNodes\.length === 1 \? selectedNodes\[0\] : undefined/);
  assert.match(source, /className="pfc-node-focus" aria-label="当前选中节点">\{focusedNode\.data\.label\}/);
  assert.match(source, /const \[codexRunningNodeIds, setCodexRunningNodeIds\] = useState<string\[\]>\(\[\]\)/);
  assert.match(source, /onNodeContextMenu=\{\(event, row\) => \{ event\.preventDefault\(\); void openCodexRefinement\(\[row\.id\]\); \}\}/);
  assert.doesNotMatch(source, /onPaneContextMenu=\{event => \{[\s\S]*?selectedIds\.length/);
  assert.match(source, /void openCodexRefinement\(\[\], \{ left: event\.clientX - rect\.left, top: event\.clientY - rect\.top \}\)/);
  assert.match(source, /setQuickCreate\(\{ fromCanvas: true, position: flow\.screenToFlowPosition\(\{ x: event\.clientX, y: event\.clientY \}\), screen: \{ x: event\.clientX - rect\.left, y: event\.clientY - rect\.top \} \}\)/);
  assert.match(source, /const \[codexWholeChart, setCodexWholeChart\] = useState\(false\)/);
  assert.match(source, /is-codex-chart-running/);
  assert.match(source, /onSelectionContextMenu=\{\(event, nodes\) => \{ event\.preventDefault\(\); event\.stopPropagation\(\); void openCodexRefinement\(nodes\.map\(node => node\.id\)\); \}\}/);
  assert.match(source, /className: codexRunningNodeIds\.includes\(row\.id\) \? "is-codex-running"/);
  assert.match(source, /className="pfc-codex-refinement"/);
  assert.match(source, /pfc-quick-create--with-codex/);
  assert.match(source, /quickCreate\.fromCanvas \? \["step", "decision", "table", "boundary", "region", "note"\] : \["step", "note", "region"\]/);
  assert.match(source, /!quickCreate\.fromCanvas && <button type="button" onClick=\{\(\) => setQuickCreate\(undefined\)\}>取消<\/button>/);
  assert.match(source, /const \[codexAnchor, setCodexAnchor\] = useState/);
  assert.match(source, /flow\.getNodesBounds\(ids\)/);
  assert.match(source, /flow\.flowToScreenPosition/);
  assert.match(source, /<input aria-label="Codex 整改要求"/);
  assert.match(source, /const closeCodexRefinement = \(\) => \{ setCodexSelection\(\[\]\); setCodexWholeChart\(false\); setCodexRequest\(""\); setCodexAnchor\(undefined\); \}/);
  assert.match(source, /onPaneClick=\{\(\) => \{ setEditingNode\(""\); setQuickCreate\(undefined\); closeCodexRefinement\(\); \}\}/);
  assert.match(source, /event\.key === "Escape" && \(detailNode \|\| selectedIds\.length \|\| selectedEdge \|\| codexSelection\.length \|\| codexWholeChart\)/);
  assert.match(source, /setSelected\(""\); setSelectedIds\(\[\]\); setSelectedEdge\(""\); setEditingNode\(""\); setQuickCreate\(undefined\); setCodexSelection\(\[\]\); setCodexWholeChart\(false\); setCodexRequest\(""\); setCodexAnchor\(undefined\); return;/);
  assert.doesNotMatch(source, /Codex 会先读取整张流程图，再通过 MCP 保存调整/);
  assert.match(styles, /\.pfc \.react-flow__node\.is-codex-running/);
  assert.match(styles, /@keyframes pfc-codex-flow/);
  assert.match(styles, /is-codex-running > \.pfc-node \{ border-color:#e9ffff;[\s\S]*?0 0 42px/);
  assert.match(styles, /is-codex-complete > \.pfc-node \{[\s\S]*?background:linear-gradient/);
});

test("流程图变更自动同步后端，不保留本地草稿", () => {
  assert.doesNotMatch(source, /rich-flowchart-draft/);
  assert.match(source, /window\.setTimeout\(\(\) => \{ void save\(\); \}, 400\)/);
  assert.match(source, /自动保存中…/);
  assert.doesNotMatch(source, />保存修改</);
});

test("流程图顶部不提供冗余的整理和添加节点按钮", () => {
  assert.doesNotMatch(source, /aria-label="添加节点" title="添加处理节点"/);
  assert.doesNotMatch(source, /aria-label="自动排版" title="自动排版当前层级"/);
  assert.doesNotMatch(source, /const autoLayout =/);
});

test("锁定画布后双击节点仍打开详情，不触发默认缩放", () => {
  assert.match(source, /zoomOnDoubleClick=\{false\}/);
  assert.match(source, /onNodeDoubleClick=\{\(_, row\) => \{ setSelected\(row\.id\); setSelectedIds\(\[row\.id\]\); setDetailNode\(row\.id\); setCodexCompletedNodeIds\(current => current\.filter\(id => id !== row\.id\)\); \}\}/);
});


const source = readFileSync(new URL("./FlowchartsWorkspace.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("./FlowchartsWorkspace.css", import.meta.url), "utf8");

test("流程节点按类型和稳定调色板使用不同的高亮边框", () => {
  assert.match(source, /pfc-node is-\$\{data\.kind\}/);
  assert.match(source, /const palette = \["#63ddeb", "#a98aff", "#f1b968", "#6de2ae"\]/);
  assert.match(styles, /border: 2px solid color-mix\(in srgb,var\(--node-accent\) 82%,#4b5158\)/);
  assert.match(styles, /\.pfc-node\.is-table \{ --node-accent: #70e6ba; \}/);
});

test("节点详情标题沿用节点颜色，并提高标题层级", () => {
  assert.match(source, /function nodeDetailTitleColor\(node\?: FlowNode\): string/);
  assert.match(source, /if \(node\.data\.color\) return node\.data\.color/);
  assert.match(source, /return nodeAccent\(node\.id, node\.data\)/);
  assert.match(source, /<h2 style=\{\{ color: nodeDetailTitleColor\(detail\) \}\}>\{detail\?\.data\.label\}<\/h2>/);
  assert.match(styles, /\.pfc-node-detail h2 \{[^}]*font-size:24px[^}]*font-weight:800/s);
});
