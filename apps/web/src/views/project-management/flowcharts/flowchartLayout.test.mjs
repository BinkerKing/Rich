import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('./FlowchartsWorkspace.css', import.meta.url), 'utf8');
const rule = selector => css.match(new RegExp(`(?:^|\\n)${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\{([^}]+)\\}`))?.[1] || '';

test('flowchart fills available height below an expanded title row', () => {
  for (const selector of ['.pfc', '.pfc-task']) {
    assert.match(rule(selector), /display: flex/);
    assert.match(rule(selector), /flex-direction: column/);
    assert.match(rule(selector), /min-height: 0/);
  }
  for (const selector of ['.pfc-task.is-expanded', '.pfc-editor']) {
    assert.match(rule(selector), /flex: 1/);
    assert.match(rule(selector), /min-height: 0/);
  }
  assert.match(rule('.pfc-canvas'), /height: 100%/);
  assert.doesNotMatch(css, /(?:max-)?height: (?:610|850)px/);
});

test('details float over the full-width canvas instead of reserving a column', () => {
  assert.match(rule('.pfc-details'), /min-height: 0/);
  assert.match(rule('.pfc-details'), /overflow: auto/);
  assert.match(rule('.pfc-details'), /position: absolute/);
  assert.doesNotMatch(rule('.pfc-editor'), /grid-template-columns/);
});

test('title accordion replaces the heading, task sidebar and objective', () => {
  const source = readFileSync(new URL('./FlowchartsWorkspace.tsx', import.meta.url), 'utf8');
  assert.match(source, /aria-expanded=/);
  assert.match(source, /className="pfc-task-title"/);
  assert.match(source, /if \(expanded && active !== item\.id\) return null;/);
  assert.doesNotMatch(source, /pfc-heading|pfc-tasks|pfc-objective/);
  assert.match(source, /aria-label="添加节点"/);
});

test('canvas nodes show only a symbol and key label; evidence stays in details', () => {
  const source = readFileSync(new URL('./FlowchartsWorkspace.tsx', import.meta.url), 'utf8');
  const renderer = source.slice(source.indexOf('function AnalysisNode'), source.indexOf('const nodeTypes'));
  assert.doesNotMatch(renderer, /data\.source|已核验|待核验/);
  assert.match(renderer, /pfc-node-symbol/);
});

test('regions and notes are visual components without business connectors', () => {
  const source = readFileSync(new URL('./FlowchartsWorkspace.tsx', import.meta.url), 'utf8');
  const components = source.slice(source.indexOf('function RegionNode'), source.indexOf('function AnalysisNode'));
  assert.match(components, /pfc-region/);
  assert.match(components, /pfc-note/);
  assert.doesNotMatch(components, /<Handle/);
  assert.match(source, /pfc-legend/);
  assert.match(rule('.pfc-region'), /height: 100%/);
});

test('neon style uses translucent neutral surfaces instead of colored gradients', () => {
  for (const selector of ['.pfc-node', '.pfc-region', '.pfc-note']) {
    assert.doesNotMatch(rule(selector), /linear-gradient|radial-gradient/);
    assert.match(rule(selector), /background: rgba\(/);
  }
  assert.doesNotMatch(rule('.pfc-canvas'), /gradient/);
  for (const selector of ['.pfc-node.is-table', '.pfc-node.is-decision', '.pfc-node.is-boundary']) {
    assert.doesNotMatch(rule(selector), /background:/);
  }
  assert.match(rule('.pfc .react-flow__edge-path'), /stroke:/);
});

test('panning does not resample backdrops or apply SVG blur filters', () => {
  assert.doesNotMatch(css, /(?:backdrop-)?filter\s*:\s*(?:blur|drop-shadow)\(/);
});

test('flowchart toolbar exports the current canvas as a PNG image', () => {
  const source = readFileSync(new URL('./FlowchartsWorkspace.tsx', import.meta.url), 'utf8');
  assert.match(source, /aria-label="导出 PNG"/);
  assert.match(source, /exportFlowchartPng/);
});

test('selecting a flowchart node opens the movable style editor', () => {
  const source = readFileSync(new URL('./FlowchartsWorkspace.tsx', import.meta.url), 'utf8');
  assert.match(source, /FlowchartNodeStyleToolbar/);
  assert.match(source, /selectedNodes\.length > 0 && <FlowchartNodeStyleToolbar/);
  assert.match(source, /onChange=\{editNode\}/);
});

test('flowchart style editor supports persistent custom node icons', () => {
  const source = readFileSync(new URL('./FlowchartsWorkspace.tsx', import.meta.url), 'utf8');
  const model = readFileSync(new URL('./flowchartModel.ts', import.meta.url), 'utf8');
  const toolbar = readFileSync(new URL('./FlowchartNodeStyleToolbar.tsx', import.meta.url), 'utf8');
  assert.match(model, /icon\?: string/);
  assert.match(source, /data\.icon \|\|/);
  assert.match(toolbar, /type OpenMenu = .*"icon"/);
  assert.match(toolbar, /openMenu === "icon"/);
  assert.match(toolbar, /aria-label="节点图标"/);
  assert.match(toolbar, /onChange\(\{ icon:/);
});

test('tilde opens inline text editing for the selected flowchart node', () => {
  const source = readFileSync(new URL('./FlowchartsWorkspace.tsx', import.meta.url), 'utf8');
  assert.match(source, /isNodeEditShortcut/);
  assert.match(source, /setEditingNode\(selected\)/);
  assert.match(source, /aria-label="编辑节点文字"/);
});

test('inline node editing turns the original label itself into editable text', () => {
  const source = readFileSync(new URL('./FlowchartsWorkspace.tsx', import.meta.url), 'utf8');
  assert.match(source, /contentEditable/);
  assert.match(source, /className="pfc-node-label-editor nodrag nopan"/);
  assert.doesNotMatch(source, /pfc-node-label-input/);
});

test('inline note editing includes both its title and visible note content', () => {
  const source = readFileSync(new URL('./FlowchartsWorkspace.tsx', import.meta.url), 'utf8');
  assert.match(source, /function NoteNode[\s\S]*data\.editing \? <NoteContent data=\{data\} \/> : <><NodeLabel data=\{data\} \/>\{data\.caption && <p>\{data\.caption\}<\/p>\}<\/>/);
  assert.match(source, /function NoteContent/);
  assert.match(source, /data\.onNoteTextChange\?\.\(event\.currentTarget\.innerText\)/);
  assert.match(source, /onNoteTextChange: text =>/);
});

test('inline region editing includes its title and small explanatory text', () => {
  const source = readFileSync(new URL('./FlowchartsWorkspace.tsx', import.meta.url), 'utf8');
  assert.match(source, /function RegionContent/);
  assert.match(source, /data\.editing \? <RegionContent data=\{data\} \/>/);
  assert.match(source, /onRegionTextChange/);
  assert.match(rule('.pfc-region-content-editor'), /min-height:112px/);
  assert.match(rule('.pfc-region-content-editor strong,.pfc-region-content-editor span'), /border-bottom:/);
  assert.match(rule('.pfc-node-label-editor'), /caret-color:/);
});

test('Command Enter inserts a line break while Enter saves node editing', () => {
  const source = readFileSync(new URL('./FlowchartsWorkspace.tsx', import.meta.url), 'utf8');
  assert.match(source, /event\.key === "Enter" && event\.metaKey/);
  assert.match(source, /document\.execCommand\("insertLineBreak"\)/);
  assert.match(source, /event\.currentTarget\.innerText\.trim\(\)/);
  assert.match(source, /event\.key === "Enter"\) \{ event\.preventDefault\(\); event\.currentTarget\.blur\(\); \}/);
});

test('left double click opens details while right double click enters a child flowchart', () => {
  const source = readFileSync(new URL('./FlowchartsWorkspace.tsx', import.meta.url), 'utf8');
  assert.match(source, /const \[detailNode, setDetailNode\] = useState\(""\)/);
  assert.match(source, /onNodeDoubleClick=\{\(_, row\) => \{ setSelected\(row\.id\); setSelectedIds\(\[row\.id\]\); setDetailNode\(row\.id\); \}\}/);
  assert.match(source, /onNodeContextMenu=\{\(event, row\) => \{/);
  assert.match(source, /event\.preventDefault\(\)/);
  assert.match(source, /rightClickNode\.current\?\.id === row\.id/);
  assert.match(source, /enter\(row\.id\)/);
  assert.match(source, /event\.key === "Escape" && detailNode/);
  assert.match(source, /detailNode && <aside/);
});

test('clicking the canvas exits inline node editing', () => {
  const source = readFileSync(new URL('./FlowchartsWorkspace.tsx', import.meta.url), 'utf8');
  assert.match(source, /onPaneClick=\{\(\) => \{ setEditingNode\(""\);/);
});

test('canvas supports lasso and Command multi-selection for shared node styles', () => {
  const source = readFileSync(new URL('./FlowchartsWorkspace.tsx', import.meta.url), 'utf8');
  assert.match(source, /const \[selectedIds, setSelectedIds\] = useState<string\[\]>\(\[\]\)/);
  assert.match(source, /selectionOnDrag/);
  assert.match(source, /multiSelectionKeyCode="Meta"/);
  assert.match(source, /onPaneClick=\{\(\) => \{ setEditingNode\(""\);/);
  assert.match(source, /<FlowchartNodeStyleToolbar nodes=\{selectedNodes\}/);
});

test('trackpad two-finger scrolling pans while left drag remains reserved for lasso selection', () => {
  const source = readFileSync(new URL('./FlowchartsWorkspace.tsx', import.meta.url), 'utf8');
  assert.match(source, /selectionOnDrag panOnDrag=\{false\} panOnScroll panOnScrollMode=\{PanOnScrollMode\.Free\}/);
  assert.match(source, /zoomOnScroll=\{false\}/);
  assert.match(source, /onPaneContextMenu=\{event => \{\s*event\.preventDefault\(\);/);
});

test('right clicking an empty canvas opens an add-node menu at that canvas position', () => {
  const source = readFileSync(new URL('./FlowchartsWorkspace.tsx', import.meta.url), 'utf8');
  assert.match(source, /onPaneContextMenu=\{event => \{/);
  assert.match(source, /flow\.screenToFlowPosition/);
  assert.match(source, /aria-label="快速新建节点菜单"/);
  assert.match(source, /\["step", "note", "region"\]/);
  assert.match(source, /step: "图标节点", note: "备注", region: "区域"/);
});

test('new note nodes enter their in-place editor with a writable body paragraph', () => {
  const source = readFileSync(new URL('./FlowchartsWorkspace.tsx', import.meta.url), 'utf8');
  assert.match(source, /setEditingNode\(kind === "note" \|\| kind === "region" \? node\.id : ""\)/);
  assert.match(source, /<p>\{data\.caption \|\| <br \/>\}<\/p>/);
});

test('phase one exposes node type, resize, edge styling and reconnecting controls', () => {
  const source = readFileSync(new URL('./FlowchartsWorkspace.tsx', import.meta.url), 'utf8');
  const toolbar = readFileSync(new URL('./FlowchartNodeStyleToolbar.tsx', import.meta.url), 'utf8');
  assert.match(source, /NodeResizer/);
  assert.match(source, /onReconnect=/);
  assert.match(source, /reconnectEdge/);
  assert.match(source, /pfc-edge-toolbar/);
  assert.match(toolbar, /aria-label="节点类型"/);
  assert.match(toolbar, /onKindChange/);
});

test('resized node borders fill the same bounds as the resize controls', () => {
  assert.match(rule('.pfc-node'), /width: 100%/);
  assert.match(rule('.pfc-node'), /height: 100%/);
  assert.match(rule('.pfc-note'), /width: 100%/);
  assert.match(rule('.pfc-note'), /height: 100%/);
});

test('phase one makes drawing and arranging productive from the canvas', () => {
  const source = readFileSync(new URL('./FlowchartsWorkspace.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /<MiniMap/);
  assert.match(source, /proOptions=\{\{ hideAttribution: true \}\}/);
  assert.match(source, /onConnectEnd=/);
  assert.match(source, /快速新建节点/);
  assert.match(source, /undoGraph/);
  assert.match(source, /duplicateSelectedNodes/);
  assert.match(source, /autoLayout/);
});


test('edge and node editing share one movable toolbar position', () => {
  const floatingToolbar = readFileSync(new URL('./FlowchartFloatingToolbar.tsx', import.meta.url), 'utf8');
  const source = readFileSync(new URL('./FlowchartsWorkspace.tsx', import.meta.url), 'utf8');
  assert.match(floatingToolbar, /SELECTION_TOOLBAR_POSITION_STORAGE_KEY/);
  assert.match(source, /FlowchartFloatingToolbar/);
  assert.match(source, /className="pfc-edge-toolbar"/);
  assert.doesNotMatch(source, /className="pfc-edge-toolbar"[^>]*style=\{[^}]*right/);
});

test('selection toolbar uses larger SVG line icons instead of small text glyphs', () => {
  const floatingToolbar = readFileSync(new URL('./FlowchartFloatingToolbar.tsx', import.meta.url), 'utf8');
  const nodeToolbar = readFileSync(new URL('./FlowchartNodeStyleToolbar.tsx', import.meta.url), 'utf8');
  assert.match(floatingToolbar, /function FlowchartToolbarIcon/);
  assert.match(floatingToolbar, /width=\{24\} height=\{24\}/);
  assert.match(nodeToolbar, /<FlowchartToolbarIcon name="bold"/);
  assert.match(rule('.pfc-node-style-toolbar > button'), /width:48px/);
  assert.match(rule('.pfc-node-style-toolbar > button'), /height:46px/);
});

test('phase two adds canvas arrangement, copy paste and collapsible flow groups', () => {
  const source = readFileSync(new URL('./FlowchartsWorkspace.tsx', import.meta.url), 'utf8');
  const toolbar = readFileSync(new URL('./FlowchartNodeStyleToolbar.tsx', import.meta.url), 'utf8');
  const model = readFileSync(new URL('./flowchartModel.ts', import.meta.url), 'utf8');
  assert.match(source, /copyFlowSelection\(graph, selectedIds\)/);
  assert.match(source, /pasteFlowSelection\(graph, clipboard\.current\)/);
  assert.match(source, /visibleNodes/);
  assert.match(source, /collapsedGroups/);
  assert.match(toolbar, /aria-label="对齐"/);
  assert.match(toolbar, /aria-label="均匀分布"/);
  assert.match(toolbar, /aria-label="自动布局"/);
  assert.match(toolbar, /aria-label="创建流程组"/);
  assert.match(model, /export function createFlowGroup/);
  assert.match(model, /export function toggleFlowGroup/);
});
