import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('./FlowchartsWorkspace.css', import.meta.url), 'utf8');
const rule = selector => css.match(new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ' \\{([^}]+)\\}'))?.[1] || '';

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

test('title accordion replaces the heading, task sidebar, objective and node creation', () => {
  const source = readFileSync(new URL('./FlowchartsWorkspace.tsx', import.meta.url), 'utf8');
  assert.match(source, /aria-expanded=/);
  assert.match(source, /className="pfc-task-title"/);
  assert.match(source, /if \(expanded && active !== item\.id\) return null;/);
  assert.doesNotMatch(source, /pfc-heading|pfc-tasks|pfc-objective|添加节点/);
  assert.match(source, /\(node \|\| edge\) && <aside/);
});

test('canvas nodes show only a symbol and key label; evidence stays in details', () => {
  const source = readFileSync(new URL('./FlowchartsWorkspace.tsx', import.meta.url), 'utf8');
  const renderer = source.slice(source.indexOf('function AnalysisNode'), source.indexOf('const nodeTypes'));
  assert.doesNotMatch(renderer, /data\.source|已核验|待核验/);
  assert.match(renderer, /pfc-node-symbol/);
  assert.match(source, /graph.nodes.some\(node => node.data.scope === row.id\)/);
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
  assert.match(source, /onPaneClick=\{\(\) => setEditingNode\(""\)\}/);
});

test('canvas supports lasso and Command multi-selection for shared node styles', () => {
  const source = readFileSync(new URL('./FlowchartsWorkspace.tsx', import.meta.url), 'utf8');
  assert.match(source, /const \[selectedIds, setSelectedIds\] = useState<string\[\]>\(\[\]\)/);
  assert.match(source, /selectionOnDrag/);
  assert.match(source, /multiSelectionKeyCode="Meta"/);
  assert.match(source, /onPaneClick=\{\(\) => setEditingNode\(""\)\}/);
  assert.match(source, /<FlowchartNodeStyleToolbar nodes=\{selectedNodes\}/);
});

test('right drag pans the canvas while left drag remains reserved for lasso selection', () => {
  const source = readFileSync(new URL('./FlowchartsWorkspace.tsx', import.meta.url), 'utf8');
  assert.match(source, /selectionOnDrag panOnDrag=\{\[2\]\}/);
  assert.match(source, /onPaneContextMenu=\{event => event\.preventDefault\(\)\}/);
});
